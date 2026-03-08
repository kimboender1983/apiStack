import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ResolvedApiKey, ApiKeyPermission } from '../../common/types';

const KEY_PREFIX = 'apf_';
const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(
    projectId: string,
    name: string,
    permissions: ApiKeyPermission = 'read',
    rateLimitPerMinute = 60,
    rateLimitPerHour = 1000,
    expiresAt?: Date,
  ): Promise<{ apiKey: string; record: object }> {
    const raw = KEY_PREFIX + randomBytes(24).toString('base64url');
    const keyPrefix = raw.slice(0, 8);
    const keyHash = await argon2.hash(raw);

    const record = await this.prisma.apiKey.create({
      data: {
        projectId,
        keyHash,
        keyPrefix,
        name,
        permissions,
        rateLimitPerMinute,
        rateLimitPerHour,
        expiresAt,
      },
    });

    return { apiKey: raw, record };
  }

  async resolve(rawKey: string): Promise<ResolvedApiKey | null> {
    const cacheKey = `apikey:${rawKey}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ResolvedApiKey;
    }

    const prefix = rawKey.slice(0, 8);
    const candidates = await this.prisma.apiKey.findMany({
      where: { keyPrefix: prefix },
    });

    for (const candidate of candidates) {
      if (candidate.expiresAt && new Date() > candidate.expiresAt) continue;

      const valid = await argon2.verify(candidate.keyHash, rawKey);
      if (!valid) continue;

      const resolved: ResolvedApiKey = {
        id: candidate.id,
        projectId: candidate.projectId,
        permissions: candidate.permissions as ApiKeyPermission,
        rateLimitPerMinute: candidate.rateLimitPerMinute,
        rateLimitPerHour: candidate.rateLimitPerHour,
      };

      await this.redis.set(cacheKey, JSON.stringify(resolved), CACHE_TTL);
      await this.prisma.apiKey.update({
        where: { id: candidate.id },
        data: { lastUsedAt: new Date() },
      });

      return resolved;
    }

    return null;
  }

  async checkRateLimit(resolved: ResolvedApiKey): Promise<void> {
    const minuteKey = `rl:${resolved.id}:minute`;
    const hourKey = `rl:${resolved.id}:hour`;

    const [minuteCount, hourCount] = await Promise.all([
      this.redis.incrWithExpire(minuteKey, 60),
      this.redis.incrWithExpire(hourKey, 3600),
    ]);

    if (minuteCount > resolved.rateLimitPerMinute) {
      throw new HttpException('Rate limit exceeded (per minute)', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (hourCount > resolved.rateLimitPerHour) {
      throw new HttpException('Rate limit exceeded (per hour)', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async listForProject(projectId: string) {
    return this.prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        permissions: true,
        rateLimitPerMinute: true,
        rateLimitPerHour: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async delete(id: string, projectId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({ where: { id, projectId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.delete({ where: { id } });
  }
}
