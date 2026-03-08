import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<number>('SMTP_PORT', 587) === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async requestOtp(email: string): Promise<void> {
    const code = this.generateOtp();
    const ttlMinutes = this.config.get<number>('OTP_TTL_MINUTES', 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Invalidate previous unused OTPs for this email
    await this.prisma.otpCode.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    await this.prisma.otpCode.create({
      data: { email, code, expiresAt },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n  OTP for ${email}: \x1b[33m${code}\x1b[0m\n`);
      return;
    }

    console.log(`[Auth] Sending OTP email to ${email} via ${this.config.get('SMTP_HOST')}:${this.config.get('SMTP_PORT')}`);
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'noreply@apiforge.dev'),
        to: email,
        subject: 'Your APIForge login code',
        text: `Your one-time login code is: ${code}\n\nThis code expires in ${ttlMinutes} minutes.`,
        html: `<p>Your APIForge login code is: <strong>${code}</strong></p><p>Expires in ${ttlMinutes} minutes.</p>`,
      });
      console.log(`[Auth] OTP email sent to ${email}`);
    } catch (err) {
      console.error(`[Auth] Failed to send OTP email:`, err);
      throw err;
    }
  }

  async verifyOtp(email: string, code: string): Promise<{ accessToken: string }> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { email, code, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    if (new Date() > otp.expiresAt) {
      throw new UnauthorizedException('OTP code has expired');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // Upsert user — first login auto-creates account
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
