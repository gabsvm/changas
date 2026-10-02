import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso de la plataforma Changas.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      intro="Reglas para usar Changas, ya sea que busques un servicio o que lo ofrezcas."
    >
      <LegalSection title="1. Quiénes somos">
        <p>
          Changas es una plataforma digital que acerca a personas que necesitan
          un servicio (clientes) con personas que lo ofrecen de forma
          independiente (prestadores). Es operada por [COMPLETAR: razón social],
          CUIT [COMPLETAR], con domicilio en [COMPLETAR: domicilio] y correo de
          contacto [COMPLETAR: correo].
        </p>
        <p>
          Al crear una cuenta o usar el sitio aceptás estos términos y la{" "}
          <Link className="text-terracotta underline" href="/privacidad">
            Política de privacidad
          </Link>
          . Si no estás de acuerdo, no uses la plataforma.
        </p>
      </LegalSection>

      <LegalSection title="2. Rol de Changas">
        <p>
          Changas facilita el contacto, la comunicación y la organización de los
          acuerdos. Los servicios los presta cada prestador por su cuenta y
          riesgo, como profesional independiente: no es empleado, socio ni
          representante de Changas. El contrato de servicio se celebra entre
          cliente y prestador.
        </p>
      </LegalSection>

      <LegalSection title="3. Tu cuenta">
        <LegalList
          items={[
            "Tenés que ser mayor de 18 años y tener capacidad legal para contratar.",
            "Los datos que cargues deben ser verdaderos y estar actualizados.",
            "Sos responsable de tu contraseña y de lo que se haga con tu cuenta. Avisanos si sospechás un uso no autorizado.",
            "Podés cerrar tu cuenta cuando quieras escribiéndonos; las obligaciones ya contraídas siguen vigentes.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Prestadores y verificación de identidad">
        <p>
          Para publicar servicios, el prestador completa su perfil, sus datos
          privados de identidad y sube su DNI (frente y dorso) y una selfie. El
          equipo de Changas revisa ese caso antes de habilitar el perfil.
        </p>
        <p>
          La verificación confirma la identidad declarada; no certifica
          matrículas, habilitaciones, antecedentes ni la calidad del trabajo.
          Cada prestador es responsable de contar con los permisos y registros
          que su actividad requiera.
        </p>
      </LegalSection>

      <LegalSection title="5. Publicaciones permitidas">
        <p>
          Los servicios publicados deben ser lícitos y estar descritos con
          claridad. No está permitido:
        </p>
        <LegalList
          items={[
            "Ofrecer servicios ilegales, peligrosos o que requieran habilitaciones que no tengas.",
            "Publicar información falsa o engañosa, precios que no vas a respetar o reseñas falsas.",
            "Acosar, discriminar o amenazar a otras personas.",
            "Subir contenido de terceros sin autorización o que infrinja derechos de propiedad intelectual.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Propuestas, acuerdos y trabajos">
        <p>
          Dentro de la conversación, cliente y prestador pueden intercambiar
          propuestas con alcance, precio en pesos argentinos (ARS) y fecha. Un
          acuerdo aceptado queda registrado con el alcance y el precio pactados;
          los cambios posteriores deben acordarse de nuevo dentro de la
          plataforma. Los trabajos avanzan por estados (confirmado, en curso,
          pendiente de cierre, completado) y las partes pueden confirmar la
          finalización.
        </p>
      </LegalSection>

      <LegalSection title="7. Pagos">
        <p>
          Cuando el pago en línea esté disponible, se procesa a través de
          Mercado Pago, con la cuenta que el prestador vincula a Changas.
          Changas no almacena los datos de tu tarjeta. Comisiones, plazos y
          condiciones de reintegro: [COMPLETAR].
        </p>
      </LegalSection>

      <LegalSection title="8. Reseñas">
        <p>
          Solo pueden reseñar quienes completaron un trabajo con el prestador.
          Las reseñas deben reflejar una experiencia real. Podemos moderar o
          quitar reseñas que incumplan estas reglas.
        </p>
      </LegalSection>

      <LegalSection title="9. Reportes, bloqueos y suspensión">
        <p>
          Podés bloquear a otra persona o reportar conversaciones, reseñas o
          perfiles. Changas puede restringir o suspender cuentas y contenidos
          que incumplan estos términos o la ley, y conservar los registros
          necesarios para atender el caso.
        </p>
      </LegalSection>

      <LegalSection title="10. Responsabilidad">
        <p>
          Changas actúa como intermediaria tecnológica y no garantiza que un
          prestador esté disponible, ni el resultado, el plazo o la calidad del
          servicio. Hacemos esfuerzos razonables para mantener la plataforma
          operativa, pero puede haber interrupciones.
        </p>
        <p>
          Nada de estos términos limita los derechos que la ley reconoce a las
          personas consumidoras, incluidos los de la Ley 24.240 de Defensa del
          Consumidor, que son irrenunciables.
        </p>
      </LegalSection>

      <LegalSection title="11. Propiedad intelectual">
        <p>
          La marca, el diseño y el software de Changas pertenecen a su titular.
          Vos conservás los derechos sobre el contenido que subís y nos das
          permiso para mostrarlo en la plataforma con el fin de prestar el
          servicio.
        </p>
      </LegalSection>

      <LegalSection title="12. Cambios en estos términos">
        <p>
          Podemos actualizar estos términos. Si el cambio es relevante te lo
          vamos a avisar en la plataforma antes de que se aplique. Seguir usando
          Changas después implica aceptar la versión vigente.
        </p>
      </LegalSection>

      <LegalSection title="13. Ley aplicable, reclamos y contacto">
        <p>
          Estos términos se rigen por las leyes de la República Argentina. Para
          cualquier controversia son competentes los tribunales ordinarios de
          [COMPLETAR: jurisdicción]; si sos consumidor podés optar por los del
          lugar de tu domicilio. Podés hacer reclamos escribiendo a [COMPLETAR:
          correo] y también ante la Dirección de Defensa del Consumidor de tu
          jurisdicción.
        </p>
        <p>
          Arrepentimiento y baja de contrataciones a distancia: [COMPLETAR:
          procedimiento y enlace, según corresponda].
        </p>
      </LegalSection>
    </LegalPage>
  );
}
