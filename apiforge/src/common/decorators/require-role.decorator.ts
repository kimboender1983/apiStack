import { SetMetadata } from '@nestjs/common';

export type ProjectRole = 'viewer' | 'editor' | 'owner';

export const ROLE_KEY = 'minProjectRole';
export const RequireRole = (role: ProjectRole) => SetMetadata(ROLE_KEY, role);
