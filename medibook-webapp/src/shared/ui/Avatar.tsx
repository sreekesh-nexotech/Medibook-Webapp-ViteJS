import { useState } from 'react';

interface AvatarProps {
  name?: string;
  /** Diameter in px — data-driven, hence style. */
  size?: number;
  src?: string | null;
  /** Per-item background color from data (e.g. department accents). */
  bg?: string;
}

/**
 * Circle avatar: photo when `src` is given and loads, otherwise two-letter
 * initials (also when the photo link is broken or expired).
 */
export function Avatar({ name, size = 36, src, bg }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailedSrc(src)}
        className="flex-none rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = (name ?? '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className="bg-blue-soft-bg text-text-navy flex flex-none items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: bg }}
    >
      {initials}
    </div>
  );
}
