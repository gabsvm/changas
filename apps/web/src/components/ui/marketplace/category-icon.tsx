type Props = {
  slug: string;
  className?: string;
};

function IconPath({ slug }: { slug: string }) {
  const s = slug.toLowerCase();
  // Hogar / limpieza
  if (s.includes("hogar") || s.includes("limpieza") || s.includes("casa")) {
    return (
      <path
        d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  // Reparaciones / mantenimiento
  if (s.includes("manten") || s.includes("repar") || s.includes("electr") || s.includes("plomer")) {
    return (
      <path
        d="M14.5 6.5a4 4 0 0 0-5.6 4.8L4 16.2V20h3.8l4.9-4.9a4 4 0 0 0 4.8-5.6l-2.8 2.8-2.1-2.1 2.9-2.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  // Mascotas
  if (s.includes("mascota") || s.includes("perro") || s.includes("gato") || s.includes("animal")) {
    return (
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <circle cx="8" cy="9" r="1.6" />
        <circle cx="16" cy="9" r="1.6" />
        <circle cx="5.5" cy="13.5" r="1.6" />
        <circle cx="18.5" cy="13.5" r="1.6" />
        <path d="M12 11.5c-2.3 0-4 1.8-4 3.6 0 1.4 1 2.4 2.2 2.4.8 0 1.2-.4 1.8-.4s1 .4 1.8.4c1.2 0 2.2-1 2.2-2.4 0-1.8-1.7-3.6-4-3.6Z" />
      </g>
    );
  }
  // Envíos / mudanza
  if (s.includes("envio") || s.includes("mudanza") || s.includes("flete") || s.includes("transporte")) {
    return (
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
        <circle cx="7" cy="18.5" r="1.6" />
        <circle cx="17" cy="18.5" r="1.6" />
      </g>
    );
  }
  // Tecnología
  if (s.includes("tecnolog") || s.includes("comput") || s.includes("inform")) {
    return (
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <rect x="3.5" y="4.5" width="17" height="11" rx="2" />
        <path d="M9.5 19.5h5M12 15.5v4" />
      </g>
    );
  }
  // Educación
  if (s.includes("clase") || s.includes("educ") || s.includes("ense") || s.includes("tutor")) {
    return (
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 4 3.5 8 12 12l8.5-4L12 4ZM6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
      </g>
    );
  }
  // Belleza / bienestar
  if (s.includes("belleza") || s.includes("bienestar") || s.includes("salud") || s.includes("cuidado")) {
    return (
      <path
        d="M12 20s-6.5-4.1-6.5-9.3c0-2 1.5-3.7 3.4-3.7 1.2 0 2.3.7 3.1 1.7.8-1 1.9-1.7 3.1-1.7 1.9 0 3.4 1.7 3.4 3.7C18.5 15.9 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }
  // Profesional
  if (s.includes("profes") || s.includes("admin") || s.includes("legal") || s.includes("contab")) {
    return (
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </g>
    );
  }
  return (
    <path
      d="M12 4l2.2 4.9 5.3.6-3.9 3.6 1 5.2-4.6-2.6-4.6 2.6 1-5.2L4.5 9.5l5.3-.6L12 4Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export function CategoryIcon({ slug, className = "h-7 w-7" }: Props) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <IconPath slug={slug} />
    </svg>
  );
}
