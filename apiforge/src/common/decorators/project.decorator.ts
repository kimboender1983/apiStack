import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ResolvedApiKey } from '../types';

export const ApiKeyCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ResolvedApiKey => {
    const request = ctx.switchToHttp().getRequest();
    return request.resolvedApiKey as ResolvedApiKey;
  },
);

export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
