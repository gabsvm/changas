# YALO — Rollout a producción S1→S4 (paso a paso)

> Cómo usar este archivo: corre cada paso en el SQL editor de Supabase (producción),
> en orden, **uno por vez**. Después de cada paso, pega la salida donde dice
> `RESPUESTA` y avísame para que lo lea. Si cualquier paso devuelve `ERROR`,
> **para ahí** y pega el error completo.

Reglas para todos los pasos:

- Solo `SELECT` en las verificaciones (no modifican nada).
- Los archivos S1–S4 sí escriben (crean tablas, funciones, índices). Es lo autorizado.
- `Success` sin filas = 0 filas: es un resultado válido, anótalo igual.

---

## PASO 0 — Confirmar despliegue (ya verificado por mí, solo registro)

Producción sirve `revision 6821d44` (merge PR #29). No hay que correr nada.
Si el sitio no te abre, para y avísame antes de seguir.

```text
RESPUESTA (abre https://changas-web-gray.vercel.app y anota qué ves):
```

---

## PASO 1 — Aplicar S1 (reserva directa preautorizada)

1. Abre el archivo `supabase/migrations/20261016080000_yalo_s1_direct_booking_preauth.sql`, copia **todo** su contenido.
2. Pégalo en el SQL editor y presiona Run.
3. Anota el resultado (esperado: `Success`).

```text
RESPUESTA S1 (Success o ERROR completo): Success. No rows returned
```

4. Corre esta verificación (esperado: `s1_ok` con valor no nulo y `s1_excl = 1`):

```sql
select to_regprocedure('public.create_conversation_proposal(uuid,public.proposal_kind,text,bigint,timestamptz,timestamptz,timestamptz,timestamptz,uuid)') as s1_ok, (select count(*) from pg_constraint where conname='provider_slot_holds_no_overlap_excl') as s1_excl;
```

```text
RESPUESTA verificación S1 (pega el JSON): [
  {
    "s1_ok": "create_conversation_proposal(uuid,proposal_kind,text,bigint,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid)",
    "s1_excl": 1
  }
]
```

---

## PASO 2 — Aplicar S2 (necesidades abiertas y adjudicación única)

1. Abre el archivo `supabase/migrations/20261016090000_yalo_s2_open_posts.sql`, copia **todo** su contenido.
2. Pégalo en el SQL editor y presiona Run.
3. Anota el resultado (esperado: `Success`).

```text
RESPUESTA S2 (Success o ERROR completo):Success. No rows returned
```

4. Corre esta verificación (esperado: `s2_posts` y `s2_awards` con valor no nulo):

```sql
select to_regclass('public.job_posts') as s2_posts, to_regclass('public.job_post_awards') as s2_awards;
```

```text
RESPUESTA verificación S2 (pega el JSON): [
  {
    "s2_posts": "job_posts",
    "s2_awards": "job_post_awards"
  }
]
```

---

## PASO 3 — Aplicar S3 (entrega presencial/remota desacoplada)

1. Abre el archivo `supabase/migrations/20261017080000_yalo_s3_delivery_decoupling.sql`, copia **todo** su contenido.
2. Pégalo en el SQL editor y presiona Run.
3. Anota el resultado (esperado: `Success`).

```text
RESPUESTA S3 (Success o ERROR completo):Success. No rows returned
```

4. Corre esta verificación (esperado: `s3_rpc = 1` y `s3_col = 1`):

```sql
select (select count(*) from pg_proc where proname = 'submit_job_delivery') as s3_rpc, (select count(*) from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='effective_modality') as s3_col;
```

```text
RESPUESTA verificación S3 (pega el JSON):[
  {
    "s3_rpc": 1,
    "s3_col": 1
  }
]
```

---

## PASO 4 — Aplicar S4 (declaraciones bilaterales de dinero externo)

1. Abre el archivo `supabase/migrations/20261018080000_yalo_s4_bilateral_money.sql`, copia **todo** su contenido.
2. Pégalo en el SQL editor y presiona Run.
3. Anota el resultado (esperado: `Success`).

```text
RESPUESTA S4 (Success o ERROR completo):Success. No rows returned
```

4. Corre esta verificación (esperado: `s4_tab` no nulo y `s4_rpc = 1`):

```sql
select to_regclass('public.external_payment_declarations') as s4_tab, (select count(*) from pg_proc where proname = 'declare_external_payment') as s4_rpc;
```

```text
RESPUESTA verificación S4 (pega el JSON):[
  {
    "s4_tab": "external_payment_declarations",
    "s4_rpc": 1
  }
]
```

---

## PASO 5 — Mapa final (registro post-rollout)

Corre estas tres consultas y pega cada salida. Esperado: todo presente
(valores no nulos, 4 versiones de migración, conteo de jobs).

```sql
select version as migracion_s1_s4 from supabase_migrations.schema_migrations where version in ('20261016080000','20261016090000','20261017080000','20261018080000');
```

```text
RESPUESTA mapa migraciones:
```

```sql
select to_regclass('public.job_posts') as job_posts, to_regclass('public.job_post_awards') as awards, to_regclass('public.external_payment_declarations') as pagos_externos;
```

```text
RESPUESTA mapa tablas:
```

```sql
select status, count(*) as jobs from public.jobs group by status;
```

```text
RESPUESTA conteo jobs:
```

---

## PASO 6 — Smoke en el navegador (tú navegas, yo diagnostico)

Abre cada ruta y anota qué renderiza + si hay errores rojos en consola (F12):

1. Detalle de uno de los jobs `COMPLETED`: `/jobs/[id]`.
2. `/needs`.
3. `/oportunidades`.

```text
RESPUESTA smoke job completado:
```

```text
RESPUESTA smoke /needs:
```

```text
RESPUESTA smoke /oportunidades:
```

---

*Archivo auxiliar de rollout (no forma parte del deploy). Pagos online (Mercado Pago) siguen OFF y `YALO_PUBLIC_NEEDS_ENABLED` sigue OFF hasta decisión explícita.*
