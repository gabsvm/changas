-- Phase 06 compatibility: preserve the Phase 02 owner-managed availability contract.
-- Phase 06 adds audited convenience RPCs, but availability_rules and
-- availability_blocks remain provider-owned tables protected by their existing RLS.
-- Temporary provider_slot_holds remain RPC/server-authoritative.

grant insert, update, delete on table public.availability_rules to authenticated;
grant insert, update, delete on table public.availability_blocks to authenticated;
