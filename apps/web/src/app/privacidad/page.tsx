import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo Changas trata tus datos personales.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      intro="Qué datos recolectamos, para qué los usamos, con quién los compartimos y cuáles son tus derechos."
    >
      <LegalSection title="1. Responsable del tratamiento">
        <p>
          [COMPLETAR: razón social], CUIT [COMPLETAR], domicilio [COMPLETAR],
          correo de contacto [COMPLETAR]. Registro de la base de datos ante la
          Agencia de Acceso a la Información Pública: [COMPLETAR, si
          corresponde].
        </p>
      </LegalSection>

      <LegalSection title="2. Qué datos recolectamos">
        <LegalList
          items={[
            "Cuenta: correo electrónico, contraseña (almacenada de forma protegida por nuestro proveedor de autenticación) y nombre visible.",
            "Perfil público: foto, zona, presentación, habilidades, servicios, experiencia, estudios, certificaciones, portfolio y disponibilidad que elijas publicar.",
            "Identidad privada (solo prestadores): nombre legal, teléfono, fecha de nacimiento, domicilio exacto y número de DNI.",
            "Documentos de verificación: fotos del DNI (frente y dorso) y una selfie. Se guardan en almacenamiento privado.",
            "Actividad en la plataforma: conversaciones, archivos adjuntos, propuestas, acuerdos, trabajos, reseñas, favoritos, bloqueos y reportes.",
            "Ubicación: si usás la búsqueda cercana, tu ubicación se envía a nuestro servidor solo para ordenar los resultados por cercanía y no se guarda en tu perfil. La ubicación exacta de un trabajo presencial la cargan las partes y solo es visible para ellas.",
            "Notificaciones: si activás las alertas push, guardamos los datos técnicos de la suscripción de tu dispositivo.",
            "Pagos: la información de cobro la procesa Mercado Pago; nosotros guardamos referencias de las operaciones y el estado de la cuenta vinculada del prestador, no los datos de tu tarjeta.",
            "Datos técnicos: registros de errores y de seguridad con información mínima (por ejemplo ruta y tipo de error), sin el contenido de tus mensajes.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Para qué usamos tus datos">
        <LegalList
          items={[
            "Crear y mantener tu cuenta y permitir que uses la plataforma.",
            "Verificar la identidad de los prestadores y prevenir fraude y abusos.",
            "Mostrar perfiles y servicios, y conectar a clientes con prestadores.",
            "Enviarte avisos sobre tu actividad (propuestas, trabajos, verificación) según tus preferencias.",
            "Procesar pagos cuando estén habilitados y cumplir obligaciones legales.",
            "Moderar contenido y resolver reportes y reclamos.",
          ]}
        />
        <p>
          No vendemos tus datos personales ni los usamos para publicidad de
          terceros.
        </p>
      </LegalSection>

      <LegalSection title="4. Con quién los compartimos">
        <LegalList
          items={[
            "Otras personas usuarias: tu perfil público es visible para cualquiera; tus conversaciones y acuerdos, solo para las partes involucradas.",
            "Proveedores que nos prestan infraestructura: Supabase (base de datos, autenticación y almacenamiento; región São Paulo) y Vercel (alojamiento de la aplicación).",
            "Mercado Pago, para procesar pagos.",
            "Servicios de notificaciones push de tu navegador o sistema operativo, si activás las alertas.",
            "Autoridades, cuando una ley o una orden judicial lo requiera.",
          ]}
        />
        <p>
          Algunos de estos proveedores pueden tratar datos en servidores
          ubicados fuera de la Argentina. Exigimos medidas de seguridad
          adecuadas en cada caso.
        </p>
      </LegalSection>

      <LegalSection title="5. Cuánto tiempo los conservamos">
        <p>
          Mientras tu cuenta esté activa y durante el tiempo necesario para
          cumplir obligaciones legales, resolver disputas y prevenir fraude. Los
          documentos de identidad se conservan solo mientras sean necesarios
          para la verificación y su control posterior: [COMPLETAR: plazo].
        </p>
        <p>
          Si eliminás tu cuenta, borramos tus datos personales, tus documentos
          de identidad y tus avisos, y dejamos de mostrar tus servicios. Los
          trabajos, pagos y reseñas ya realizados se conservan sin tu nombre por
          obligaciones contables y para resolver reclamos.
        </p>
      </LegalSection>

      <LegalSection title="6. Seguridad">
        <p>
          Aplicamos controles de acceso por usuario a nivel de base de datos,
          almacenamiento privado para documentos de identidad con acceso
          controlado durante la revisión, cifrado de las comunicaciones y
          registros de auditoría de las acciones administrativas. Ningún sistema
          es infalible: si detectamos un incidente que te afecte, te lo
          comunicaremos según la ley.
        </p>
      </LegalSection>

      <LegalSection title="7. Tus derechos">
        <p>
          Podés acceder a tus datos, rectificarlos, actualizarlos y pedir su
          supresión, escribiendo a [COMPLETAR: correo]. El acceso es gratuito en
          intervalos no inferiores a seis meses, salvo que acredites un interés
          legítimo. Parte de tus datos podés editarlos vos mismo desde tu
          cuenta.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, en su carácter de
          Órgano de Control de la Ley 25.326, tiene la atribución de atender las
          denuncias y reclamos que interpongan quienes resulten afectados en sus
          derechos por el incumplimiento de las normas vigentes en materia de
          protección de datos personales.
        </p>
      </LegalSection>

      <LegalSection title="8. Menores de edad">
        <p>
          Changas no está dirigida a menores de 18 años y no recolectamos sus
          datos de forma intencional. Si creés que una persona menor creó una
          cuenta, escribinos y la eliminaremos.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies y almacenamiento">
        <p>
          Detalles en la{" "}
          <Link className="text-terracotta underline" href="/cookies">
            página de cookies y almacenamiento
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Cambios en esta política">
        <p>
          Podemos actualizar esta política. Publicaremos la versión vigente con
          su fecha y, si el cambio es relevante, te avisaremos en la plataforma.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
