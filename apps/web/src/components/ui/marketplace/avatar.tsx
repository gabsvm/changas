"use client";

import { useState } from "react";

type AvatarSize = "sm" | "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-base",
};

const warmTones = [
  "bg-brand-orange/15 text-terracotta",
  "bg-brand-yellow/30 text-warning",
  "bg-terracotta/10 text-terracotta",
  "bg-moss/10 text-moss",
] as const;

function toneFor(name: string): (typeof warmTones)[number] {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return warmTones[hash % warmTones.length] ?? warmTones[0];
}

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
  const classes = `${sizeClasses[size]} ${toneFor(name)} grid shrink-0 place-items-center overflow-hidden rounded-full font-bold ${className}`;

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
