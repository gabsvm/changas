import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Cookies y almacenamiento",
  description: "Qué guarda Changas en tu navegador y por qué.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies y almacenamiento"
      intro="Qué guardamos en tu navegador y para qué. Hoy solo usamos almacenamiento necesario para que la app funcione."
    >
      <LegalSection title="Lo que usamos">
        <LegalList
          items={[
            "Cookie de sesión (necesaria): mantiene tu sesión iniciada. Es una cookie propia de nuestro sistema de autenticación y se renueva mientras usás la app.",
            "Almacenamiento de la sesión del navegador: guarda temporalmente la ubicación que elegís para la búsqueda cercana. Se borra al cerrar la pestaña.",
            "Almacenamiento local: recuerda que cerraste el aviso de instalación de la app, para no mostrártelo durante 30 días.",
            "Service worker y caché de archivos estáticos: permiten abrir la app más rápido y mostrar una pantalla sin conexión.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Lo que no usamos">
        <p>
          No usamos cookies de publicidad ni de seguimiento entre sitios, ni
          herramientas de analítica de terceros. Si en el futuro las
          incorporamos, actualizaremos esta página y te pediremos tu
          consentimiento antes de activarlas.
        </p>
      </LegalSection>

      <LegalSection title="Cómo gestionarlas">
        <p>
          Podés borrar las cookies y los datos del sitio desde la configuración
          de tu navegador. Si borrás la cookie de sesión, vas a tener que volver
          a iniciar sesión. Más información sobre cómo tratamos tus datos en la{" "}
          <Link className="text-terracotta underline" href="/privacidad">
            Política de privacidad
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
