"use client";

import { useState } from "react";

type AvatarSize = "sm" | "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-base",
};

function initials(name: string): string {
  const value = name.trim();
  if (!value) return "C";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null | undefined;
  size?: AvatarSize;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const classes = `${sizeClasses[size]} bg-brand-orange/10 text-terracotta grid shrink-0 place-items-center overflow-hidden rounded-full font-bold ${className}`;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`${classes} object-cover`}
        src={src}
        alt={`Foto de ${name}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={classes} role="img" aria-label={`Foto de ${name}`}>
      {initials(name)}
    </span>
  );
}
