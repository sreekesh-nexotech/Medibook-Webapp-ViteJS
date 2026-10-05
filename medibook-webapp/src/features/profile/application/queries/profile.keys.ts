import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';

/** Query keys for the my-account screen. */
export const profileKeys = {
  all: ['profile'] as const,
  sessions: (surface: AuthSurface) => [...profileKeys.all, 'sessions', surface] as const,
};
