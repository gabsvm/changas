# Phase 09 — Reconciled baseline override

This note preserves the original Phase 09 implementation plan as historical evidence while overriding only the branch/baseline assumptions that became invalid after Phase 08 was formally recovered and closed.

## Authoritative overrides

- Historical Phase 09 branch kept frozen for evidence: `codex/phase-09-admin-trust` at `8df3d21681bce42ee642439689ea5090e1a87242`.
- Active reconciled Phase 09 branch: `codex/phase-09-admin-trust-reconciled`.
- Approved Phase 08 Final HEAD and Phase 09 baseline: `133dfd58a078916ad123fdc84cd08d87ef20d141`.
- Approved Phase 08 final CI run: `33717614494` (`validate` and `supabase-integration` both GREEN).
- The original plan line that referenced `5d7d3072cbcc7d1420e515f8a1f5bb48c2881670` as baseline is superseded by this file.
- The original plan instruction to work only on `codex/phase-09-admin-trust` is superseded by this file; the historical branch must not be mutated.

## Replay policy

The existing Phase 09 work is preserved in order through the verified Admin Core/RBAC checkpoint. Temporary formatting commits are retained in the reconstructed history so the original development sequence remains auditable. The CI reconciliation keeps both Phase 08 runtimes (`phase-08-notifications-runtime.mjs` and `phase-08-delivery-policy-runtime.mjs`) and adds the Phase 09 admin runtime after them.

After the reconciled Admin Core/RBAC checkpoint proves GREEN on the approved Phase 08 baseline, the original identity-review contract is replayed as the next intentional RED and Phase 09 resumes from there using TDD.

No Phase 10 work is authorized by this override.
