import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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

    console.log(`[Auth] Sending OTP email to ${email} via Resend API`);
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('SMTP_FROM', 'onboarding@resend.dev');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your APIForge login code',
        text: `Your one-time login code is: ${code}\n\nThis code expires in ${ttlMinutes} minutes.`,
        html: `<p>Your APIForge login code is: <strong>${code}</strong></p><p>Expires in ${ttlMinutes} minutes.</p>`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Auth] Resend API error ${res.status}:`, body);
      throw new InternalServerErrorException('Failed to send OTP email');
    }
    console.log(`[Auth] OTP email sent to ${email}`);
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
