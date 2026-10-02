-- Covering indexes for foreign keys on user-facing read paths flagged by the
-- Supabase performance advisor (0001_unindexed_foreign_keys). Admin-only audit
-- columns are intentionally left out until they show up in real queries.

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id);
create index if not exists conversation_reads_user_idx
  on public.conversation_reads (user_id);
create index if not exists messages_sender_user_idx
  on public.messages (sender_user_id);

create index if not exists proposals_client_user_idx
  on public.proposals (client_user_id);
create index if not exists proposals_provider_user_idx
  on public.proposals (provider_user_id);
create index if not exists proposals_service_idx
  on public.proposals (service_id);

create index if not exists jobs_conversation_idx
  on public.jobs (conversation_id);
create index if not exists jobs_service_idx
  on public.jobs (service_id);

create index if not exists services_provider_skill_idx
  on public.services (provider_user_id, skill_id);

create index if not exists provider_favorites_provider_idx
  on public.provider_favorites (provider_user_id);
create index if not exists user_blocks_blocked_user_idx
  on public.user_blocks (blocked_user_id);
create index if not exists user_blocks_blocker_user_idx
  on public.user_blocks (blocker_user_id);

create index if not exists reviews_reviewer_user_idx
  on public.reviews (reviewer_user_id);
create index if not exists review_replies_provider_user_idx
  on public.review_replies (provider_user_id);

create index if not exists provider_slot_holds_client_user_idx
  on public.provider_slot_holds (client_user_id);
create index if not exists job_private_locations_client_user_idx
  on public.job_private_locations (client_user_id);
create index if not exists notification_delivery_outbox_recipient_idx
  on public.notification_delivery_outbox (recipient_user_id);
create index if not exists payment_attempts_accepted_version_idx
  on public.payment_attempts (accepted_proposal_version_id);
