import Image from "next/image";
import Link from "next/link";

import { ActionArrowIcon } from "./action-arrow-icon";

type CategoryPhoto = { match: RegExp; src: string };

const PHOTOS: readonly CategoryPhoto[] = [
  { match: /hogar|limpieza|casa/i, src: "/categories/hogar.webp" },
  {
    match: /tecno|comput|inform|diseño|program/i,
    src: "/categories/tecnologia.webp",
  },
  { match: /educa|clase|curso|idioma/i, src: "/categories/educacion.webp" },
  { match: /mascota|perro|gato|paseo/i, src: "/categories/mascotas.webp" },
  {
    match: /profesional|admin|contab|legal/i,
    src: "/categories/profesionales.webp",
  },
  { match: /belleza|bienestar|salud|pelu/i, src: "/categories/belleza.webp" },
];

export function CategoryTile({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description?: string | null;
  icon: string;
}) {
  const src =
    PHOTOS.find((entry) => entry.match.test(icon))?.src ??
    "/categories/otros.svg";

  return (
    <Link
      href={href}
      className="yalo-category-card group"
      aria-label={description ? label + ": " + description : label}
    >
      <span className="yalo-category-photo" aria-hidden="true">
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 640px) 46vw, (max-width: 900px) 30vw, 24vw"
          className="yalo-category-photo-image"
        />
        <span className="yalo-category-photo-tone" />
        <span className="yalo-category-photo-dots" />
        <span className="yalo-category-photo-orb" />
        <span className="yalo-category-photo-footer">
          <span className="yalo-category-photo-title">{label}</span>
          <span className="yalo-category-photo-arrow">
            <ActionArrowIcon />
          </span>
        </span>
      </span>
    </Link>
  );
}
