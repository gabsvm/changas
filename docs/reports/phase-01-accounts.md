# Phase 01 — Accounts, auth and provider identity skeleton

## Estado de la segunda auditoría

La rama `codex/phase-01-accounts` contiene los hardening fixes solicitados y fue publicada en `origin/codex/phase-01-accounts`. La aprobación de Phase 01 queda pendiente: los gates locales de código están en PASS, pero Supabase runtime no pudo ejecutarse en esta máquina por falta de Docker/Podman y GitHub Actions sigue bloqueado antes de iniciar jobs por un problema de billing de la cuenta.

No se inició Phase 02 ni se implementaron categorías, skills, servicios, marketplace, búsqueda, chat, jobs o pagos.

## Causa del CI anterior y del nuevo run

El run previo [33291486241](https://github.com/gabsvm/changas/actions/runs/33291486241), sobre `782f861`, terminó sin pasos ejecutados. Su check annotation indicó exactamente:

> The job was not started because your account is locked due to a billing issue.

Después de publicar los fixes, el nuevo run [33320897397](https://github.com/gabsvm/changas/actions/runs/33320897397), sobre `0eea648`, reprodujo la misma causa. El job `validate` terminó `failure` sin pasos y `supabase-integration` terminó `skipped` por su dependencia. No es una falla atribuible a los tests ni a la configuración ejecutada en el runner; requiere resolver el bloqueo de billing de GitHub para que Actions pueda arrancar.

## Cambios implementados

### Data API y RLS

No se modificó la migración publicada `supabase/migrations/20260830034005_accounts_identity.sql`. La migración nueva generada con `pnpm dlx supabase@2.116.0 migration new accounts_api_grants` es:

- `supabase/migrations/20260830153830_accounts_api_grants.sql`

La migración concede `USAGE` sobre `public` a `authenticated` y `service_role`, y deja explícitamente esta matriz para `authenticated`:

| Tabla                | Privilegios                            |
| -------------------- | -------------------------------------- |
| `profiles`           | `SELECT`, `INSERT`, `UPDATE`           |
| `profile_private`    | `SELECT`, `INSERT`, `UPDATE`           |
| `provider_profiles`  | `SELECT`, `INSERT`, `UPDATE`           |
| `provider_documents` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| `user_settings`      | `SELECT`, `INSERT`, `UPDATE`           |
| `user_roles`         | `SELECT`                               |

Para operaciones futuras server-side/admin, `service_role` recibe explícitamente DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) sobre esas seis tablas, sin DDL. La clave `service_role` permanece server-only y no se importa en cliente. Se revocaron explícitamente todos los privilegios de tabla de `anon` y `PUBLIC`; no se concedió acceso anónimo a datos privados.

`supabase/config.toml` ahora contiene `auto_expose_new_tables = false`, sin depender de default grants implícitos.

Se agregó `supabase/tests/phase-01-grants.sql` con assertions pgTAP para la matriz permitida, privilegios ausentes de `anon` y `PUBLIC`, grants DML de `service_role`, RLS habilitado y predicates owner-only existentes. `supabase/tests/phase-01-rls.sql` mantiene las pruebas de dos usuarios para lectura/escritura propia, rechazo de escritura cruzada y rechazo de auto-promoción a `ACTIVE`.

### Node 24

- Root `package.json`: engine `node >=24.0.0`.
- GitHub Actions: `actions/setup-node@v4` con `node-version: 24.20.0` en ambos jobs.
- `@types/node` fijado a `24.13.3` en root, `apps/web` y `packages/config`; lockfile regenerado mínimamente y sin la versión `26.4.0`.
- README y documentación de setup actualizados.

El checkout local disponible usa Node `v26.4.0` y no tiene nvm/fnm/volta para cambiarlo; las declaraciones del proyecto y el runner CI están fijadas a Node 24.

### CI Supabase y seguridad runtime

`.github/workflows/ci.yml` conserva el job `validate` con install congelado, lint, typecheck, tests y build, y agrega `supabase-integration` sobre `ubuntu-latest`. El job está diseñado para ejecutar, sin credenciales Cloud:

1. `supabase start` con CLI `2.116.0`.
2. `db reset --local --no-seed`.
3. `test db --local` para pgTAP.
4. El script `apps/web/scripts/supabase-runtime-security.mjs` con las credenciales locales emitidas por `status -o env`.
5. `supabase stop` siempre, incluso ante fallas.

El script usa dos usuarios sintéticos y un fixture mínimo sin datos personales (`apps/web/fixtures/synthetic-identity.txt`). Comprueba owner read/write, aislamiento de `profile_private`, rechazo de `ACTIVE`, y Storage privado: owner upload/download, usuario B rechazado y anónimo rechazado. La ejecución efectiva quedó `NOT RUN` porque el runner local no tiene Docker ni Podman, y el job remoto fue `skipped` por el bloqueo externo de GitHub. Por lo tanto, no se afirma evidencia runtime RLS/Storage todavía.

Antes de incorporar los comandos al workflow se consultaron los help de:

```text
supabase --help
supabase migration --help
supabase migration new --help
supabase start --help
supabase db --help
supabase db reset --help
supabase test --help
supabase test db --help
supabase status --help
```

### Proxy SSR

El Proxy ahora usa únicamente `supabase.auth.getClaims()` para refrescar/validar claims. Se conserva `supabase.auth.getUser()` en Server Actions y páginas server-side que necesitan resolver el usuario autenticado actual. No se usa `getSession()` como fuente de autorización.

## Commits de esta corrección

- `94ecda6` — `fix(accounts): add explicit data api grants`
- `1af6e53` — `chore: align project with node 24`
- `ac95198` — `ci: add local supabase security integration`
- `0eea648` — `fix(auth): refresh proxy claims with getClaims`

Commits previos preservados:

- `2a158cc` — `docs: plan phase 01 accounts`
- `8ef0e8d` — `feat(accounts): add identity schema and RLS boundaries`
- `a4edc75` — `feat(auth): add SSR sessions and account actions`
- `1303210` — `feat(ui): add account and provider onboarding flows`
- `782f861` — `docs: report phase 01 accounts verification`

## Gates de validación

| Gate                                  | Resultado          | Evidencia                                                                                  |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`      | PASS               | pnpm 11.19.0, workspace up to date                                                         |
| `pnpm lint`                           | PASS               | ESLint sin errores                                                                         |
| `pnpm typecheck`                      | PASS               | 4 proyectos workspace                                                                      |
| `pnpm test`                           | PASS               | 5 archivos, 10 tests                                                                       |
| `pnpm build`                          | PASS               | Build Next.js exitoso; rutas Auth/Account/Provider y Proxy generadas                       |
| `pnpm format:check`                   | PASS               | Prettier sin diferencias                                                                   |
| `git diff --check`                    | PASS               | Sin errores de whitespace                                                                  |
| `supabase start` local                | NOT RUN            | Docker y Podman no están disponibles; CLI devolvió `docker: command not found`             |
| `supabase db reset --local --no-seed` | NOT RUN            | No había servicio local inspeccionable                                                     |
| `supabase test db --local` / pgTAP    | NOT RUN            | Conexión rechazada en `127.0.0.1:54322`                                                    |
| Supabase client/Storage runtime       | NOT RUN            | Depende del servicio local no disponible                                                   |
| GitHub Actions CI remoto              | FAIL / NOT STARTED | Run `33320897397`: cuenta bloqueada por billing; `validate` sin pasos, integración skipped |

## Limitación restante y stop gate

La corrección está publicada, pero Phase 01 no puede declararse aprobada mientras no se habilite un runner de GitHub Actions y se obtenga PASS real del job `validate` y de `supabase-integration`, incluyendo migración/reset, pgTAP y pruebas RLS/Storage. La rama queda detenida en Phase 01; no se hace merge y no se inicia Phase 02.
