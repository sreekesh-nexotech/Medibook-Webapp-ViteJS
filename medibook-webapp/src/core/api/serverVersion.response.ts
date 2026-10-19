import { z } from 'zod';

/**
 * Which backend build is deployed (`GET /shared/version`, public, UB-07).
 * Shape from the backend's `core/build_info.build_info()`; each value is a
 * short string, `"unknown"` when the server was built without it.
 */
export interface ServerVersion {
  /** The backend package version, e.g. `0.1.0`. */
  readonly version: string;
  /** Short git SHA of the deployed image. */
  readonly commit: string;
  /** UTC ISO-8601 time the image was built. */
  readonly buildTime: string;
}

export const serverVersionResponseSchema = z.object({
  version: z.string(),
  commit: z.string(),
  build_time: z.string(),
});

export type ServerVersionResponse = z.infer<typeof serverVersionResponseSchema>;

export function toServerVersion(dto: ServerVersionResponse): ServerVersion {
  return { version: dto.version, commit: dto.commit, buildTime: dto.build_time };
}
