# Phase 01 — Accounts, auth and provider identity skeleton

## 1. Resumen ejecutivo

La Fase 01 está implementada en `codex/phase-01-accounts` y lista para auditoría estática. Incluye Auth email/password, callback PKCE, refresco SSR con `proxy.ts`, cuenta editable, onboarding de proveedor reanudable, documentos de identidad en Storage privado, RLS owner-only y la prohibición de auto-promoción a `ACTIVE`.

La validación contra una instancia Supabase real queda `NOT RUN`: esta máquina no tiene Docker ni Podman y no hay Postgres local escuchando en `127.0.0.1:54322`. Por lo tanto, no se afirma todavía el end-to-end de Auth, la ejecución de la migración, el comportamiento RLS entre dos usuarios ni la privacidad runtime de Storage.

## 2. Alcance entregado

- Auth email/password: login, alta, confirmación por correo, recuperación, actualización de contraseña, cierre de sesión y callback.
- Google OAuth como punto de integración opcional, sin credenciales ficticias, controlado por `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`.
- `profiles` público deliberado y `profile_private` separado para nombre legal, contacto privado, nacimiento, domicilio exacto y DNI.
- `provider_profiles` con progreso 1–4 y estados de identidad; las acciones nunca aceptan `status` desde formularios.
- `provider_documents` con un documento por tipo, metadata mínima y bucket `identity-documents` privado; no se crean URLs públicas ni firmadas en la UI.
- `user_settings` y `user_roles`, con rol inicial `user` creado por el trigger de Auth y sin escritura desde cliente.
- Formularios mobile-first accesibles con `useActionState`, estados pendientes, mensajes inline, labels y navegación de cuenta.
- No se incorporaron servicios, skills, catálogo, marketplace, chat, jobs, pagos, UI admin ni features de Fase 02.

## 3. Seguridad y datos

- Todas las tablas nuevas habilitan RLS antes de crear políticas.
- Las políticas de tablas y Storage limitan el acceso al `auth.uid()` actual; Storage además exige que la primera carpeta sea el UUID del usuario.
- La política de actualización de `provider_profiles` acepta únicamente `PROFILE_INCOMPLETE` e `IDENTITY_PENDING`.
- El trigger `public.handle_new_user()` es `SECURITY DEFINER` solo porque debe crear registros después del alta en Auth; usa `search_path = ''`, referencias calificadas y revoca ejecución a roles cliente.
- `SUPABASE_SERVICE_ROLE_KEY` no se usa en las nuevas acciones/proxy/UI y no apareció en el bundle cliente inspeccionado.

## 4. Commits

- `2a158cc` — `docs: plan phase 01 accounts`
- `8ef0e8d` — `feat(accounts): add identity schema and RLS boundaries`
- `a4edc75` — `feat(auth): add SSR sessions and account actions`
- `1303210` — `feat(ui): add account and provider onboarding flows`
- Este informe y la actualización de setup se agregan en el commit documental posterior a los gates finales.

## 5. Gates de validación

| Gate                             | Resultado | Evidencia                                                            |
| -------------------------------- | --------- | -------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PASS      | Dependencias sin cambios                                             |
| `pnpm lint`                      | PASS      | ESLint sin errores                                                   |
| `pnpm typecheck`                 | PASS      | 4 proyectos workspace                                                |
| `pnpm test`                      | PASS      | 4 archivos, 9 tests                                                  |
| `pnpm build`                     | PASS      | Rutas de cuenta/auth/provider y `ƒ Proxy (Middleware)`               |
| `pnpm format:check`              | PASS      | Prettier sin diferencias                                             |
| `git diff --check`               | PASS      | Sin errores de whitespace                                            |
| Smoke HTTP público               | PASS      | `/`, `/health`, manifest, auth pages y `/auth/callback` respondieron |
| Smoke protegido sin env/runtime  | NOT RUN   | `/account` y `/provider/onboarding` requieren Supabase configurado   |
| `supabase status`                | NOT RUN   | Docker/Podman no disponible                                          |
| `supabase test db`               | NOT RUN   | Conexión rechazada en `127.0.0.1:54322`                              |

## 6. Auditoría pendiente

Con Docker Desktop o Podman disponible, ejecutar:

```powershell
Copy-Item .env.example .env.local
pnpm dlx supabase@2.116.0 start
pnpm dlx supabase@2.116.0 db reset
pnpm dlx supabase@2.116.0 test db
pnpm dev
```

Después se debe comprobar el flujo completo de confirmación, edición propia, rechazo de edición cruzada, acceso privado a documentos, reanudación del onboarding y rechazo de `ACTIVE` para el owner. Hasta entonces, esta fase queda en condición de implementación estática validada, no de aprobación runtime.

## 7. Stop gate

La rama `codex/phase-01-accounts` se publica para auditoría. No se hace merge a `main` y no se inicia la Fase 02.
