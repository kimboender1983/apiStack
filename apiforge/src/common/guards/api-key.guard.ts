import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';
import { ApiKeyPermission } from '../types';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.extractKey(request);

    if (!key) {
      throw new UnauthorizedException('API key required');
    }

    const resolved = await this.apiKeysService.resolve(key);
    if (!resolved) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    request.resolvedApiKey = resolved;
    return true;
  }

  private extractKey(request: any): string | null {
    const authHeader: string | undefined = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    const queryKey = request.query?.apiKey as string | undefined;
    return queryKey ?? null;
  }
}

@Injectable()
export class WritePermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permission: ApiKeyPermission = request.resolvedApiKey?.permissions;
    if (permission !== 'write' && permission !== 'admin') {
      throw new UnauthorizedException('Write permission required');
    }
    return true;
  }
}

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const permission: ApiKeyPermission = request.resolvedApiKey?.permissions;
    if (permission !== 'admin') {
      throw new UnauthorizedException('Admin permission required');
    }
    return true;
  }
}
