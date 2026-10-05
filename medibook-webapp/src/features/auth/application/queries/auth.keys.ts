import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';

/** Query keys for staff auth (standards §4 — no inline key arrays). */
export const authKeys = {
  all: ['auth'] as const,
  session: (surface: AuthSurface) => [...authKeys.all, 'session', surface] as const,
  invitation: (token: string) => [...authKeys.all, 'invitation', token] as const,
};
