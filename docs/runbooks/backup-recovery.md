# Backup and recovery runbook

## Scope

This is the beta recovery procedure for Changas before real-money integration. It covers Postgres/Auth metadata and Supabase Storage as separate recovery assets.

## Recovery objectives

Operational beta targets (not provider guarantees):

- target RPO: <= 24 hours without PITR; tighten when PITR is enabled;
- target RTO: <= 4 hours for a rehearsed database recovery, excluding external-provider incidents and large Storage restores.

Actual achievable RPO/RTO depends on the active Supabase plan, database size, Storage volume and the latest successful restore drill.

## Database backups

Before beta launch, verify `Database > Backups` in the Supabase dashboard and record the plan/retention in the incident log. Supabase documentation states that paid Pro/Team/Enterprise projects receive managed daily database backups, while PITR is an optional finer-grained recovery mode on eligible paid projects. Free projects require operator-managed logical exports.

For an operator-owned logical backup, use either the current Supabase CLI `db dump` command after checking `supabase db dump --help`, or a version-compatible `pg_dump` against the direct database connection. Do not commit dumps, connection strings, access tokens or database passwords to Git.

## Storage is a separate asset

Supabase database backups contain Storage metadata but do **not** contain the objects stored through the Storage API. A database restore therefore cannot resurrect an identity document or conversation attachment whose object payload was deleted after the restore point.

For beta, maintain a separate Storage-object export/retention process for the private `identity-documents` and `conversation-attachments` buckets. Supabase supports object download through the dashboard, Storage CLI commands and its S3-compatible endpoint. Credentials for S3/Storage export must live in the secret manager/operator environment, never in the repository.

## Restore drill — preferred order

1. Freeze writes or place the application in maintenance mode if the incident requires consistency.
2. Record incident time, suspected corruption time and latest known-good point.
3. Restore/clone the database to a **non-production project first** when the active plan supports it; otherwise restore a logical backup into a disposable staging database.
4. Reapply non-database project configuration that a database clone does not transfer automatically (Storage objects/settings, API/Auth settings, Edge Functions/other infrastructure as applicable).
5. Restore required Storage objects separately and verify their metadata/path ownership matches the database.
6. Run schema migrations/status checks, Phase 10 seed/public discovery smoke where applicable, auth smoke, RLS/Storage tests and the critical browser smoke against the recovered environment.
7. Compare high-level counts and invariants (users, active providers, Jobs by status, proposals/payment attempts, reviews, Storage-object counts) against the incident snapshot. Do not export private row contents into tickets/logs.
8. Only then choose a controlled production restore/cutover.
9. After recovery, rotate credentials if compromise was possible and document actual RPO/RTO.

## Destructive-operation guardrails

- Never test a restore for the first time against production.
- Never treat a successful database restore as proof that Storage files were restored.
- Never restore a backup over a newer healthy environment without recording the data-loss window.
- Never run Phase 11 real-money flows until database and Storage recovery have both been rehearsed.
