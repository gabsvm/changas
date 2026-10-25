export type TrustStripItem = {
  /** Texto corto y verificable (sin cifras salvo que vengan de datos reales). */
  label: string;
};

export type TrustStripStat = {
  /** Cifra 100% real (computada con query agregada o fila existente). */
  value: string;
  label: string;
};

/**
 * Franja de confianza YALO ("confianza = datos reales").
 *
 * Solo muestra cifras que el llamador pasa ya computadas desde datos
 * existentes; si un agregado no existe, se omite (nunca texto de relleno).
 * Reutiliza las clases `yalo-confidence-bar` del showcase para no abrir otro
 * sistema visual.
 */
export function TrustStrip({
  items,
  stats,
}: {
  items: TrustStripItem[];
  stats?: TrustStripStat[];
}) {
  return (
    <section
      className="yalo-confidence-bar"
      aria-label="Por qué elegir YALO"
    >
      {items.map((item) => (
        <span key={item.label}>
          <span className="yalo-confidence-icon">✓</span>
          {item.label}
        </span>
      ))}
      {stats?.map((stat) => (
        <span key={stat.label}>
          <span className="yalo-confidence-icon">✓</span>
          <strong>
            {stat.value} {stat.label}
          </strong>
        </span>
      ))}
    </section>
  );
}
