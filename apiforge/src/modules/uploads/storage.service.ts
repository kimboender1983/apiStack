import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createWriteStream, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface StoredFile {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private driver: 'local' | 's3';
  private s3: S3Client | null = null;
  private s3Bucket: string;
  private s3PublicUrl: string;
  private uploadsDir: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.driver = this.config.get<string>('STORAGE_DRIVER', 'local') as 'local' | 's3';
    this.uploadsDir = join(process.cwd(), 'uploads');

    if (this.driver === 's3') {
      const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
      this.s3Bucket = this.config.getOrThrow<string>('R2_BUCKET');
      this.s3PublicUrl = this.config.getOrThrow<string>('R2_PUBLIC_URL');

      const jurisdiction = this.config.get<string>('R2_JURISDICTION', '');
      const r2Host = jurisdiction
        ? `${accountId}.${jurisdiction}.r2.cloudflarestorage.com`
        : `${accountId}.r2.cloudflarestorage.com`;

      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${r2Host}`,
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
        },
      });
    }
  }

  async save(
    stream: Readable,
    originalName: string,
    mimeType: string,
    projectId: string,
  ): Promise<StoredFile> {
    const ext = extname(originalName) || this.extFromMime(mimeType);
    const filename = `${randomUUID()}${ext}`;
    const key = `${projectId}/${filename}`;

    if (this.driver === 's3') {
      return this.saveToR2(stream, key, filename, originalName, mimeType);
    }
    return this.saveToLocal(stream, key, filename, originalName, mimeType, projectId);
  }

  private async saveToLocal(
    stream: Readable,
    key: string,
    filename: string,
    originalName: string,
    mimeType: string,
    projectId: string,
  ): Promise<StoredFile> {
    const projectDir = join(this.uploadsDir, projectId);
    mkdirSync(projectDir, { recursive: true });
    const dest = createWriteStream(join(this.uploadsDir, key));

    let size = 0;
    await pipeline(
      stream,
      async function* (source) {
        for await (const chunk of source) {
          size += chunk.length;
          yield chunk;
        }
      },
      dest,
    );

    return { url: `/uploads/${key}`, filename, originalName, size, mimeType };
  }

  private async saveToR2(
    stream: Readable,
    key: string,
    filename: string,
    originalName: string,
    mimeType: string,
  ): Promise<StoredFile> {
    // Buffer the stream to get size and bytes for S3 PutObject
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ContentLength: body.length,
        // Make publicly readable — requires bucket public access enabled in R2 dashboard
        // or use a custom domain / presigned URLs instead
      }),
    );

    const url = `${this.s3PublicUrl.replace(/\/$/, '')}/${key}`;
    return { url, filename, originalName, size: body.length, mimeType };
  }

  private extFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/json': '.json',
    };
    return map[mimeType] ?? '';
  }
}
