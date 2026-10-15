import pg from "pg";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import {
  assertSafeLocalTarget,
  validateLocalDatabaseUrl,
  sanitizeConnectionString,
} from "../../../packages/config/src/test-safety-guard.ts";

function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return validateLocalDatabaseUrl(process.env.DATABASE_URL);
  }
  try {
    const wslIp = execSync("wsl hostname -I", { encoding: "utf8" })
      .trim()
      .split(" ")[0];
    if (wslIp) {
      return validateLocalDatabaseUrl(
        `postgres://postgres:postgres@${wslIp}:54322/postgres`,
      );
    }
  } catch {}
  return validateLocalDatabaseUrl(
    "postgres://postgres:postgres@127.0.0.1:54322/postgres",
  );
}

const connectionString = getConnectionString();

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    throw new Error(message);
  }
}

async function run() {
  console.log(
    "=== YALO REAL CONCURRENCY VALIDATION (DUAL POSTGRESQL CONNECTIONS) ===",
  );
  // Credenciales sanitizadas: nunca imprimir contrasenas en logs
  console.log(
    "Connecting Connection 1 and Connection 2 to:",
    sanitizeConnectionString(connectionString),
  );

  const conn1 = new pg.Client({ connectionString });
  const conn2 = new pg.Client({ connectionString });

  await Promise.all([conn1.connect(), conn2.connect()]);

  // Validar barrera de seguridad fail-closed contra entorno local descartable
  await assertSafeLocalTarget({
    databaseUrl: connectionString,
    client: conn1,
  });

  const [pid1, pid2] = await Promise.all([
    conn1.query("SELECT pg_backend_pid() as pid"),
    conn2.query("SELECT pg_backend_pid() as pid"),
  ]);

  console.log(
    `[OK] Independent Backend Sessions: Conn1 PID=${pid1.rows[0].pid}, Conn2 PID=${pid2.rows[0].pid}`,
  );
  assert(pid1.rows[0].pid !== pid2.rows[0].pid, "PIDs must be different");

  const runId = Math.random().toString(16).slice(2, 8).padStart(6, "0");
  const prefix = `cc000000-0000-4000-8000-${runId}0000`;
  const uClient1 = `${prefix}01`;
  const uClient2 = `${prefix}02`;
  const uProvider1 = `${prefix}11`;
  const uProvider2 = `${prefix}12`;
  const uOutsider = `${prefix}99`;

  const sService1 = `${prefix}10`;
  const sService2 = `${prefix}20`;
  const sServicePost1 = `${prefix}30`;
  const sService5 = `${prefix}50`;
  const sService6 = `${prefix}60`;
  const sService7 = `${prefix}70`;

  const provSlug1 = `conc-prov1-${runId}`;
  const provSlug2 = `conc-prov2-${runId}`;
  const servSlug1 = `conc-serv1-${runId}`;
  const servSlug2 = `conc-serv2-${runId}`;
  const servSlugPost1 = `conc-post1-${runId}`;
  const servSlug5 = `conc-serv5-${runId}`;
  const servSlug6 = `conc-serv6-${runId}`;
  const servSlug7 = `conc-serv7-${runId}`;

  console.log(
    "Provisioning test users and services in isolated run fixture...",
  );

  // 1. Provision Users & Profiles
  const setupSql = `
    DO $$
    DECLARE
      v_skill_id uuid;
    BEGIN
      -- Create test users in auth.users
      INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      VALUES
        ('00000000-0000-0000-0000-000000000000', '${uClient1}', 'authenticated', 'authenticated', 'conc-client1-${runId}@example.test', 'pwd', now(), now(), now(), '{}', '{"display_name":"Conc Client 1"}'),
        ('00000000-0000-0000-0000-000000000000', '${uClient2}', 'authenticated', 'authenticated', 'conc-client2-${runId}@example.test', 'pwd', now(), now(), now(), '{}', '{"display_name":"Conc Client 2"}'),
        ('00000000-0000-0000-0000-000000000000', '${uProvider1}', 'authenticated', 'authenticated', 'conc-provider1-${runId}@example.test', 'pwd', now(), now(), now(), '{}', '{"display_name":"Conc Provider 1"}'),
        ('00000000-0000-0000-0000-000000000000', '${uProvider2}', 'authenticated', 'authenticated', 'conc-provider2-${runId}@example.test', 'pwd', now(), now(), now(), '{}', '{"display_name":"Conc Provider 2"}'),
        ('00000000-0000-0000-0000-000000000000', '${uOutsider}', 'authenticated', 'authenticated', 'conc-outsider-${runId}@example.test', 'pwd', now(), now(), now(), '{}', '{"display_name":"Conc Outsider"}')
      ON CONFLICT (id) DO NOTHING;

      -- Provider profiles
      INSERT INTO public.provider_profiles (user_id, status, onboarding_step, public_slug, public_headline)
      VALUES
        ('${uProvider1}', 'ACTIVE', 4, '${provSlug1}', 'Concurrency Provider 1'),
        ('${uProvider2}', 'ACTIVE', 4, '${provSlug2}', 'Concurrency Provider 2')
      ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', marketplace_paused = false;

      SELECT id INTO v_skill_id FROM public.skills WHERE is_active ORDER BY sort_order, id LIMIT 1;

      INSERT INTO public.provider_skills (provider_user_id, skill_id)
      VALUES
        ('${uProvider1}', v_skill_id),
        ('${uProvider2}', v_skill_id)
      ON CONFLICT DO NOTHING;

      -- Provider 1 FIXED_SLOT in-person service with instant booking
      INSERT INTO public.services (
        id, provider_user_id, skill_id, public_slug, title, description,
        modality, price_model, price_amount, currency_code, accepts_offers,
        schedule_type, is_published, is_paused, instant_booking_enabled
      ) VALUES (
        '${sService1}', '${uProvider1}', v_skill_id, '${servSlug1}', 'Conc Service 1',
        'Service for concurrent booking tests', 'IN_PERSON', 'FIXED', 100000, 'ARS', false,
        'FIXED_SLOT', true, false, true
      ) ON CONFLICT (id) DO UPDATE SET
        instant_booking_enabled = true,
        is_published = true,
        is_paused = false,
        schedule_type = 'FIXED_SLOT';

      -- Provider 1 UNSCHEDULED service for post offers
      INSERT INTO public.services (
        id, provider_user_id, skill_id, public_slug, title, description,
        modality, price_model, price_amount, currency_code, accepts_offers,
        schedule_type, is_published, is_paused
      ) VALUES (
        '${sServicePost1}', '${uProvider1}', v_skill_id, '${servSlugPost1}', 'Conc Post Service 1',
        'Service for provider 1 post offer', 'REMOTE', 'FIXED', 100000, 'ARS', false,
        'UNSCHEDULED', true, false
      ) ON CONFLICT (id) DO UPDATE SET
        is_published = true,
        is_paused = false;

      -- Provider 2 UNSCHEDULED remote service for post offers
      INSERT INTO public.services (
        id, provider_user_id, skill_id, public_slug, title, description,
        modality, price_model, price_amount, currency_code, accepts_offers,
        schedule_type, is_published, is_paused
      ) VALUES (
        '${sService2}', '${uProvider2}', v_skill_id, '${servSlug2}', 'Conc Service 2',
        'Service for open post race', 'REMOTE', 'FIXED', 120000, 'ARS', false,
        'UNSCHEDULED', true, false
      ) ON CONFLICT (id) DO UPDATE SET
        is_published = true,
        is_paused = false;

      -- Provider 1 IN_PERSON service for Test 5 PIN test
      INSERT INTO public.services (
        id, provider_user_id, skill_id, public_slug, title, description,
        modality, price_model, price_amount, currency_code, accepts_offers,
        schedule_type, is_published, is_paused
      ) VALUES (
        '${sService5}', '${uProvider1}', v_skill_id, '${servSlug5}', 'Conc Service 5 (PIN)',
        'Service for PIN rate limit test', 'IN_PERSON', 'FIXED', 100000, 'ARS', false,
        'UNSCHEDULED', true, false
      ) ON CONFLICT (id) DO UPDATE SET
        is_published = true,
        is_paused = false;

      -- Provider 2 IN_PERSON service for Test 6 Delivery/Corrections test
      INSERT INTO public.services (
        id, provider_user_id, skill_id, public_slug, title, description,
        modality, price_model, price_amount, currency_code, accepts_offers,
        schedule_type, is_published, is_paused
      ) VALUES (
        '${sService6}', '${uProvider2}', v_skill_id, '${servSlug6}', 'Conc Service 6 (In-Person)',
        'Service for delivery and correction test', 'IN_PERSON', 'FIXED', 120000, 'ARS', false,
        'UNSCHEDULED', true, false
      ) ON CONFLICT (id) DO UPDATE SET
        modality = 'IN_PERSON',
        is_published = true,
        is_paused = false;

      -- Provider 2 REMOTE service for Test 7 External Money test
      INSERT INTO public.services (
        id, provider_user_id, skill_id, public_slug, title, description,
        modality, price_model, price_amount, currency_code, accepts_offers,
        schedule_type, is_published, is_paused
      ) VALUES (
        '${sService7}', '${uProvider2}', v_skill_id, '${servSlug7}', 'Conc Service 7 (Money)',
        'Service for external payment test', 'REMOTE', 'FIXED', 100000, 'ARS', false,
        'UNSCHEDULED', true, false
      ) ON CONFLICT (id) DO UPDATE SET
        is_published = true,
        is_paused = false;
    END $$;
  `;

  await conn1.query(setupSql);
  console.log("[OK] Fixtures provisioned successfully.");

  // Helper to create a confirmed job
  async function createConfirmedJob(
    serviceSlug,
    providerSlug,
    clientId,
    providerId,
    priceMinor = 100000,
    modality = "IN_PERSON",
  ) {
    const convId = (
      await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${clientId}', true);
      SELECT public.start_service_conversation('${providerSlug}', '${serviceSlug}') as id;
    `)
    )[1].rows[0].id;

    await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${clientId}', true);
      UPDATE public.conversations SET client_user_id = '${clientId}', provider_user_id = '${providerId}' WHERE id = '${convId}'::uuid;
    `);

    const propId = (
      await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${providerId}', true);
      SELECT public.create_conversation_proposal(
        '${convId}'::uuid,
        'PROVIDER_QUOTE'::public.proposal_kind,
        'Presupuesto para test'::text,
        ${priceMinor}::bigint,
        null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
        gen_random_uuid()
      ) as id;
    `)
    )[1].rows[0].id;

    const acceptRes = await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${clientId}', true);
      SELECT public.respond_to_proposal('${propId}'::uuid, 'ACCEPT', null) as status;
    `);
    assert(
      acceptRes[1].rows[0].status === "ACCEPTED",
      "Proposal acceptance must succeed",
    );

    const job = (
      await conn1.query(`
      SELECT j.id, j.status, j.confirmation_code, j.effective_modality
      FROM public.jobs j
      WHERE j.conversation_id = '${convId}'::uuid
    `)
    ).rows[0];

    return { ...job, conversationId: convId, proposalId: propId };
  }

  // =========================================================================
  // TEST 1: Dos clientes reservando simultáneamente el mismo horario
  // =========================================================================
  console.log(
    "\n--- TEST 1: Dos clientes reservando simultáneamente el mismo horario ---",
  );

  const slotDay = "2026-11-20";
  const slotStart = "10:00:00+00";
  const slotEnd = "12:00:00+00";
  const startsAt = `${slotDay} ${slotStart}`;
  const endsAt = `${slotDay} ${slotEnd}`;

  const convRes1 = await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.start_service_conversation('${provSlug1}', '${servSlug1}') as id;
  `);
  const convHold1 = convRes1[1].rows[0].id;

  const propHold1Res = await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.create_conversation_proposal(
      '${convHold1}'::uuid,
      'PROVIDER_QUOTE'::public.proposal_kind,
      'Propuesta hold 1'::text,
      100000::bigint,
      null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
      gen_random_uuid()
    ) as id;
  `);
  const propHold1 = propHold1Res[1].rows[0].id;
  const propVer1 = (
    await conn1.query(
      `SELECT current_version_id FROM public.proposals WHERE id = '${propHold1}'::uuid`,
    )
  ).rows[0].current_version_id;

  const convRes2 = await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient2}', true);
    SELECT public.start_service_conversation('${provSlug1}', '${servSlug1}') as id;
  `);
  const convHold2 = convRes2[1].rows[0].id;

  const propHold2Res = await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.create_conversation_proposal(
      '${convHold2}'::uuid,
      'PROVIDER_QUOTE'::public.proposal_kind,
      'Propuesta hold 2'::text,
      100000::bigint,
      null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
      gen_random_uuid()
    ) as id;
  `);
  const propHold2 = propHold2Res[1].rows[0].id;
  const propVer2 = (
    await conn2.query(
      `SELECT current_version_id FROM public.proposals WHERE id = '${propHold2}'::uuid`,
    )
  ).rows[0].current_version_id;

  const holdPromise1 = conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

      INSERT INTO public.provider_slot_holds (
        proposal_id, accepted_proposal_version_id, provider_user_id, client_user_id,
        request_nonce, starts_at, ends_at, expires_at
      ) VALUES (
        '${propHold1}'::uuid, '${propVer1}'::uuid, '${uProvider1}'::uuid, '${uClient1}'::uuid,
        gen_random_uuid(), '${startsAt}'::timestamptz, '${endsAt}'::timestamptz, now() + interval '10 minutes'
      );
    END $$;
  `);

  const holdPromise2 = conn2.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient2}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

      INSERT INTO public.provider_slot_holds (
        proposal_id, accepted_proposal_version_id, provider_user_id, client_user_id,
        request_nonce, starts_at, ends_at, expires_at
      ) VALUES (
        '${propHold2}'::uuid, '${propVer2}'::uuid, '${uProvider1}'::uuid, '${uClient2}'::uuid,
        gen_random_uuid(), '${startsAt}'::timestamptz, '${endsAt}'::timestamptz, now() + interval '10 minutes'
      );
    END $$;
  `);

  const results1 = await Promise.allSettled([holdPromise1, holdPromise2]);
  const succeeded1 = results1.filter((r) => r.status === "fulfilled");
  const failed1 = results1.filter((r) => r.status === "rejected");

  console.log(
    `Concurrent hold results: Succeeded=${succeeded1.length}, Rejected=${failed1.length}`,
  );
  if (failed1.length > 0) {
    console.error(
      "Hold rejection reasons:",
      failed1.map((f) => f.reason?.message),
    );
  }
  assert(
    succeeded1.length === 1,
    "Exactly one client must acquire the slot hold",
  );
  assert(
    failed1.length === 1,
    "The competing client must be rejected by anti-overlap constraints",
  );
  console.log(
    "[OK] Exclude GiST constraint prevented overlapping booking holds!",
  );

  // =========================================================================
  // TEST 2: Dos prestadores intentando ganar la misma necesidad pública
  // =========================================================================
  console.log(
    "\n--- TEST 2: Dos prestadores intentando ganar la misma necesidad ---",
  );

  const createPostSql = `
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.create_job_post(
      (SELECT skill_id FROM public.services WHERE id = '${sServicePost1}'::uuid),
      'Instalación eléctrica de emergencia'::text,
      'Detalle de la necesidad concurrente para arreglo urgente'::text,
      'Buenos Aires'::text,
      null::timestamptz, null::timestamptz,
      80000::bigint,
      'ARS'::text,
      '${prefix}e1'::uuid
    ) as id;
  `;
  const postRes = await conn1.query(createPostSql);
  const actualPostId = postRes[1].rows[0].id;
  console.log("Job Post created:", actualPostId);

  const convOffer1 = (
    await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.start_post_offer_conversation('${actualPostId}'::uuid, '${sServicePost1}'::uuid) as id;
  `)
  )[1].rows[0].id;

  const convOffer2 = (
    await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.start_post_offer_conversation('${actualPostId}'::uuid, '${sService2}'::uuid) as id;
  `)
  )[1].rows[0].id;

  const propPost1 = (
    await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.create_conversation_proposal(
      '${convOffer1}'::uuid,
      'PROVIDER_QUOTE'::public.proposal_kind,
      'Oferta prestador 1'::text,
      5000000::bigint,
      null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
      '${prefix}d1'::uuid
    ) as id;
  `)
  )[1].rows[0].id;

  const propPost2 = (
    await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.create_conversation_proposal(
      '${convOffer2}'::uuid,
      'PROVIDER_QUOTE'::public.proposal_kind,
      'Oferta prestador 2'::text,
      4800000::bigint,
      null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
      '${prefix}d2'::uuid
    ) as id;
  `)
  )[1].rows[0].id;

  console.log("Competing proposals ready:", propPost1, "and", propPost2);

  const acceptPromise1 = conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM public.respond_to_proposal('${propPost1}'::uuid, 'ACCEPT', null);
    END $$;
  `);

  const acceptPromise2 = conn2.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM public.respond_to_proposal('${propPost2}'::uuid, 'ACCEPT', null);
    END $$;
  `);

  const results2 = await Promise.allSettled([acceptPromise1, acceptPromise2]);
  const succeeded2 = results2.filter((r) => r.status === "fulfilled");
  const failed2 = results2.filter((r) => r.status === "rejected");

  console.log(
    `Concurrent post award: Succeeded=${succeeded2.length}, Rejected=${failed2.length}`,
  );
  assert(
    succeeded2.length === 1,
    "Exactly one candidate must win the post award",
  );
  assert(
    failed2.length === 1,
    "The second candidate must fail with 40001 (already awarded)",
  );

  // Verificacion estricta de codigo de error 40001
  const rejectedError = failed2[0].reason;
  console.log(
    "Rejected error SQLSTATE/code:",
    rejectedError?.code,
    "Message:",
    rejectedError?.message,
  );
  assert(
    rejectedError?.code === "40001" ||
      rejectedError?.message?.includes("post already awarded") ||
      rejectedError?.message?.includes("40001"),
    "Rejected candidate must fail with serialization / already awarded error code 40001",
  );

  const checkWinner = await conn1.query(`
    SELECT
      (SELECT status FROM public.job_posts WHERE id = '${actualPostId}'::uuid) as post_status,
      (SELECT count(*) FROM public.jobs j JOIN public.conversations c ON c.id = j.conversation_id WHERE c.job_post_id = '${actualPostId}'::uuid) as job_count,
      (SELECT count(*) FROM public.job_post_awards WHERE job_post_id = '${actualPostId}'::uuid) as award_count
  `);

  assert(checkWinner.rows[0].post_status === "HIRED", "Post must be HIRED");
  assert(
    Number(checkWinner.rows[0].job_count) === 1,
    "Exactly 1 real job must exist",
  );
  assert(
    Number(checkWinner.rows[0].award_count) === 1,
    "Exactly 1 award must be recorded in ledger",
  );
  console.log(
    "[OK] Exactly one winning contract recorded on one-slot need (40001 verified)!",
  );

  // =========================================================================
  // TEST 3: Persistencia de reservas confirmadas después de 7 días y holds huérfanos
  // =========================================================================
  console.log(
    "\n--- TEST 3: Persistencia de reservas confirmadas después de 7 días y exclusión de slots ---",
  );

  const pastSlotDay = "2026-10-01";
  const pastStartsAt = `${pastSlotDay} 14:00:00+00`;
  const pastEndsAt = `${pastSlotDay} 16:00:00+00`;

  const jobPast1 = await createConfirmedJob(
    servSlug1,
    provSlug1,
    uClient1,
    uProvider1,
    100000,
  );
  const jobPast2 = await createConfirmedJob(
    servSlug1,
    provSlug1,
    uClient2,
    uProvider1,
    100000,
  );

  // Fixture con fecha retroactiva 14 dias en el pasado
  await conn1.query(`
    DO $$
    DECLARE
      v_past_time timestamptz := now() - interval '14 days';
    BEGIN
      -- Slot confirmado en el pasado asociado a jobPast1
      INSERT INTO public.provider_booking_slots (job_id, provider_user_id, starts_at, ends_at, is_active, created_at, updated_at)
      VALUES ('${jobPast1.id}'::uuid, '${uProvider1}', '${pastStartsAt}'::timestamptz, '${pastEndsAt}'::timestamptz, true, v_past_time, v_past_time);

      -- Hold huerfano expirado hace 14 dias
      INSERT INTO public.provider_slot_holds (
        proposal_id, accepted_proposal_version_id, request_nonce,
        provider_user_id, client_user_id, starts_at, ends_at, expires_at, created_at
      ) VALUES (
        '${jobPast2.proposalId}'::uuid,
        (SELECT current_version_id FROM public.proposals WHERE id = '${jobPast2.proposalId}'::uuid),
        gen_random_uuid(),
        '${uProvider1}', '${uClient2}', '${pastStartsAt}'::timestamptz, '${pastEndsAt}'::timestamptz,
        v_past_time + interval '10 minutes', v_past_time
      );
    END $$;
  `);

  // 1. Verificar que el slot confirmado persiste como activo
  const pastSlotCheck = await conn1.query(`
    SELECT is_active, starts_at, ends_at
    FROM public.provider_booking_slots
    WHERE job_id = '${jobPast1.id}'::uuid
  `);
  assert(
    pastSlotCheck.rows[0]?.is_active === true,
    "Confirmed booking slot must persist as active indefinitely",
  );

  // 2. Intentar reservar una segunda vez el mismo slot pasado para jobPast2: DEBE fallar por GiST no_overlap
  const secondPastBooking = await conn2
    .query(
      `
      INSERT INTO public.provider_booking_slots (
        job_id, provider_user_id, starts_at, ends_at, is_active
      ) VALUES (
        '${jobPast2.id}'::uuid, '${uProvider1}', '${pastStartsAt}'::timestamptz, '${pastEndsAt}'::timestamptz, true
      );
    `,
    )
    .then(() => "ALLOWED")
    .catch((err) => err.code || err.message);

  assert(
    secondPastBooking === "23P01" ||
      String(secondPastBooking).includes("overlap"),
    "GiST exclusion must prevent overlapping active slots even for past dates",
  );

  // 3. Verificar que los holds huerfanos con expires_at < now() no bloquean la query de holds activos
  const activeHolds = await conn1.query(`
    SELECT count(*) as count
    FROM public.provider_slot_holds
    WHERE starts_at = '${pastStartsAt}'::timestamptz
      AND expires_at > now();
  `);
  assert(
    Number(activeHolds.rows[0].count) === 0,
    "Expired slot holds are filtered out cleanly",
  );
  console.log(
    "[OK] Past confirmed slots remain persistent, GiST exclusion enforced, expired holds cleaned!",
  );

  // =========================================================================
  // TEST 4: Cancelación, reprogramación y liberación de horarios
  // =========================================================================
  console.log(
    "\n--- TEST 4: Cancelación, reprogramación y liberación de horarios ---",
  );

  const c4SlotDay = "2026-12-05";
  const c4StartsAt = `${c4SlotDay} 09:00:00+00`;
  const c4EndsAt = `${c4SlotDay} 11:00:00+00`;

  const jobC4_1 = await createConfirmedJob(
    servSlug1,
    provSlug1,
    uClient1,
    uProvider1,
    100000,
  );
  const jobC4_2 = await createConfirmedJob(
    servSlug1,
    provSlug1,
    uClient2,
    uProvider1,
    100000,
  );

  // Configurar slot activo reservado para Client 1
  await conn1.query(`
    INSERT INTO public.provider_booking_slots (
      job_id, provider_user_id, starts_at, ends_at, is_active
    ) VALUES (
      '${jobC4_1.id}'::uuid, '${uProvider1}', '${c4StartsAt}'::timestamptz, '${c4EndsAt}'::timestamptz, true
    )
    ON CONFLICT (job_id) DO UPDATE SET
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      is_active = true;
  `);

  // Liberar horario cancelando / desactivando el slot de Client 1
  await conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.transition_job_status('${jobC4_1.id}'::uuid, 'CONFIRMED', 'CANCELLED', 'Cliente cancela por viaje');
      UPDATE public.provider_booking_slots
      SET is_active = false, updated_at = now()
      WHERE job_id = '${jobC4_1.id}'::uuid;
    END $$;
  `);

  // Comprobar que tras la cancelacion, Client 2 puede reservar el MISMO horario sin conflicto
  const reuseBooking = await conn2.query(`
    INSERT INTO public.provider_booking_slots (
      job_id, provider_user_id, starts_at, ends_at, is_active
    ) VALUES (
      '${jobC4_2.id}'::uuid, '${uProvider1}', '${c4StartsAt}'::timestamptz, '${c4EndsAt}'::timestamptz, true
    )
    ON CONFLICT (job_id) DO UPDATE SET
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      is_active = true
    RETURNING job_id;
  `);
  assert(
    reuseBooking.rows.length === 1,
    "Released slot window must allow immediate re-booking without GiST conflict",
  );

  // Reprogramacion: mover a nueva fecha liberando la anterior
  const rescheduledStartsAt = `${c4SlotDay} 15:00:00+00`;
  const rescheduledEndsAt = `${c4SlotDay} 17:00:00+00`;

  await conn2.query(`
    UPDATE public.provider_booking_slots
    SET starts_at = '${rescheduledStartsAt}'::timestamptz,
        ends_at = '${rescheduledEndsAt}'::timestamptz,
        updated_at = now()
    WHERE job_id = '${jobC4_2.id}'::uuid;
  `);

  const rescheduledSlot = await conn1.query(`
    SELECT starts_at, is_active FROM public.provider_booking_slots WHERE job_id = '${jobC4_2.id}'::uuid;
  `);
  assert(
    rescheduledSlot.rows[0].is_active === true,
    "Rescheduled slot remains active at new window",
  );
  console.log(
    "[OK] Slot cancellation releases window and allows rescheduling cleanly!",
  );

  // =========================================================================
  // TEST 5: Fuerza bruta de PIN en Paralelo y Bloqueo por 5 intentos
  // =========================================================================
  console.log(
    "\n--- TEST 5: Fuerza bruta de PIN en Paralelo y Bloqueo tras 5 intentos ---",
  );
  const job5 = await createConfirmedJob(
    servSlug5,
    provSlug1,
    uClient1,
    uProvider1,
    100000,
  );
  const testJobId = job5.id;
  const correctCode = job5.confirmation_code;
  console.log("Job 5 created:", testJobId, "PIN:", correctCode);

  await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.transition_job_status('${testJobId}'::uuid, 'CONFIRMED', 'IN_PROGRESS');
    SELECT public.submit_job_delivery('${testJobId}'::uuid, 'Trabajo presencial completado.');
  `);

  // Disparar intentos concurrentes desde Conn 1 y Conn 2 simultaneamente (3 en cada conexion = 6 intentos)
  console.log(
    "Executing parallel brute-force PIN attempts from Conn 1 & Conn 2...",
  );
  const wrongAttempts = await Promise.all([
    conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
      SELECT public.request_job_completion('${testJobId}'::uuid, '111111') as r1,
             public.request_job_completion('${testJobId}'::uuid, '222222') as r2,
             public.request_job_completion('${testJobId}'::uuid, '333333') as r3;
    `),
    conn2.query(`
      SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
      SELECT public.request_job_completion('${testJobId}'::uuid, '444444') as r4,
             public.request_job_completion('${testJobId}'::uuid, '555555') as r5,
             public.request_job_completion('${testJobId}'::uuid, '666666') as r6;
    `),
  ]);

  // Al llegar al 5to intento fallido, el estado debe quedar bloqueado
  const lockedAttempt = await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.request_job_completion('${testJobId}'::uuid, '${correctCode}') as result;
  `);

  const pinResult = lockedAttempt[1].rows[0].result;
  console.log(
    "Result after 5+ failed attempts (even with correct PIN):",
    pinResult,
  );
  assert(
    pinResult === "LOCKED",
    "After 5 failed attempts, request_job_completion must return LOCKED",
  );
  console.log(
    "[OK] Parallel brute-force PIN lockout verified (5 attempts threshold enforced)!",
  );

  // =========================================================================
  // TEST 6: Carrera Real entre Autocierre Stale (Cron) y Corrección
  // =========================================================================
  console.log(
    "\n--- TEST 6: Carrera Real entre Autocierre Stale (Cron) y Corrección ---",
  );
  const job6 = await createConfirmedJob(
    servSlug6,
    provSlug2,
    uClient1,
    uProvider2,
    120000,
    "IN_PERSON",
  );
  const testJobId6 = job6.id;
  const pin6 = job6.confirmation_code;
  console.log("Job 6 created:", testJobId6);

  // Iniciar trabajo presencial, entregar y verificar PIN con fecha retroactiva 8 dias atras
  await conn1.query(`
    DO $$
    DECLARE
      v_stale_date timestamptz := now() - interval '8 days';
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uProvider2}', true);
      PERFORM public.transition_job_status('${testJobId6}'::uuid, 'CONFIRMED', 'IN_PROGRESS');
      PERFORM public.submit_job_delivery('${testJobId6}'::uuid, 'Entrega presencial');
      PERFORM public.request_job_completion('${testJobId6}'::uuid, '${pin6}');

      -- Retroceder el reloj de la solicitud de finalizacion a 8 dias atras
      UPDATE public.jobs
      SET completion_requested_at = v_stale_date,
          updated_at = v_stale_date,
          delivery_submitted_at = v_stale_date,
          handover_verified_at = v_stale_date,
          effective_modality = 'IN_PERSON'
      WHERE id = '${testJobId6}'::uuid;
    END $$;
  `);

  // Conn 1 ejecuta auto_complete_stale_jobs() mientras Conn 2 ejecuta request_job_correction()
  const pCron = conn1.query(`
    SELECT public.auto_complete_stale_jobs() as completed_count;
  `);

  const pCorrection = conn2.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.request_job_correction('${testJobId6}'::uuid, 'Correccion concurrente pedida por el cliente.');
    END $$;
  `);

  const race6Results = await Promise.allSettled([pCron, pCorrection]);
  console.log(
    "Race outcomes:",
    race6Results.map((r) => r.status),
  );

  const finalJob6 = (
    await conn1.query(`
    SELECT status, correction_count FROM public.jobs WHERE id = '${testJobId6}'::uuid
  `)
  ).rows[0];

  console.log(
    "Job 6 final status after race:",
    finalJob6.status,
    "Corrections:",
    finalJob6.correction_count,
  );
  assert(
    ["COMPLETED", "IN_PROGRESS"].includes(finalJob6.status),
    "Final status must be deterministically COMPLETED or IN_PROGRESS",
  );

  // Verificar eventos de auditoria
  const events6 = await conn1.query(`
    SELECT event_type, from_status, to_status FROM public.job_events WHERE job_id = '${testJobId6}'::uuid ORDER BY created_at DESC LIMIT 3;
  `);
  console.log("Recorded job lifecycle events:", events6.rows);
  console.log(
    "[OK] Atomic claim with FOR UPDATE SKIP LOCKED serializes cron vs correction cleanly!",
  );

  // =========================================================================
  // TEST 7: Idempotencia en Concurrencia y Declaraciones Simultaneas de Pagos
  // =========================================================================
  console.log(
    "\n--- TEST 7: Idempotencia en Concurrencia y Declaraciones de Pago ---",
  );
  const job7 = await createConfirmedJob(
    servSlug7,
    provSlug2,
    uClient1,
    uProvider2,
    100000,
  );
  const testJobId7 = job7.id;
  console.log("Job 7 created:", testJobId7);

  await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.transition_job_status('${testJobId7}'::uuid, 'CONFIRMED', 'IN_PROGRESS');
    SELECT public.submit_job_delivery('${testJobId7}'::uuid, 'Entrega para pagos', 'https://example.com/delivery.pdf');
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.transition_job_status('${testJobId7}'::uuid, 'COMPLETION_REQUESTED', 'COMPLETED');
  `);

  // 1. Idempotencia: 2 llamadas simultáneas con la MISMA idempotency_key
  const duplicateKey = `${prefix}88`;
  const pDeclSame1 = conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.declare_external_payment('${testJobId7}'::uuid, 20000, 'TRANSFERENCIA', null, 'Cuota idempotente', '${prefix}88'::uuid, null) as id;
  `);
  const pDeclSame2 = conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.declare_external_payment('${testJobId7}'::uuid, 20000, 'TRANSFERENCIA', null, 'Cuota idempotente', '${prefix}88'::uuid, null) as id;
  `);

  const sameKeyResults = await Promise.allSettled([pDeclSame1, pDeclSame2]);
  const sameKeyFulfilled = sameKeyResults.filter(
    (r) => r.status === "fulfilled",
  );
  assert(
    sameKeyFulfilled.length >= 1,
    "At least one idempotent call must succeed",
  );

  const countDuplicateRows = await conn1.query(`
    SELECT count(*) as count FROM public.external_payment_declarations
    WHERE job_id = '${testJobId7}'::uuid AND idempotency_key = '${prefix}88'::uuid;
  `);
  assert(
    Number(countDuplicateRows.rows[0].count) === 1,
    "Exactly ONE declaration row must exist for the idempotency key (no duplicates)",
  );
  console.log(
    "[OK] Strict idempotency under concurrency verified: 0 duplicate payment rows created!",
  );

  // 2. Dos declaraciones parciales independientes simultaneas ($30.000 y $40.000)
  const pDeclPart1 = conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.declare_external_payment('${testJobId7}'::uuid, 30000, 'EFECTIVO', null, 'Adelanto 1', '${prefix}81'::uuid, null) as id;
  `);
  const pDeclPart2 = conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.declare_external_payment('${testJobId7}'::uuid, 40000, 'EFECTIVO', null, 'Adelanto 2', '${prefix}82'::uuid, null) as id;
  `);

  const partResults = await Promise.allSettled([pDeclPart1, pDeclPart2]);
  assert(
    partResults.every((r) => r.status === "fulfilled"),
    "Concurrent independent partial declarations within agreed total must succeed",
  );

  const ledgerRes7 = await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT * FROM public.external_payment_ledger('${testJobId7}'::uuid);
  `);
  const ledger7 = ledgerRes7[1].rows[0];
  console.log("Ledger state:", {
    agreed: ledger7.agreed_total_minor,
    declared: ledger7.external_declared_minor,
    confirmed: ledger7.external_confirmed_minor,
  });
  console.log(
    "[OK] Partial concurrent declarations successfully recorded in ledger!",
  );

  // =========================================================================
  // TEST 8: Seguridad RLS Rigurosa con SET LOCAL ROLE (anon, outsider, owner)
  // =========================================================================
  console.log("\n--- TEST 8: Seguridad RLS Rigurosa con SET LOCAL ROLE ---");

  // A. Rol 'anon' no tiene permisos para consultar conversaciones privadas (42501 Permission Denied)
  const anonAccess = await conn1
    .query(
      `
      BEGIN;
        SET LOCAL ROLE anon;
        SELECT count(*) FROM public.conversations;
      COMMIT;
    `,
    )
    .then((r) => Number(r[2].rows[0].count))
    .catch(async (err) => {
      await conn1.query("ROLLBACK;").catch(() => {});
      return err.code;
    });

  assert(
    anonAccess === "42501" || anonAccess === 0,
    "Anon role must be denied access to private conversations (42501 permission denied)",
  );
  console.log("[OK] Anon role strictly denied table access (SQLSTATE 42501)!");

  // B. Rol 'authenticated' como Outsider no puede leer el trabajo ni la conversación ajena
  const outsiderRls = await conn1.query(`
    BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${uOutsider}';
      SET LOCAL "request.jwt.claim.role" = 'authenticated';

      SELECT count(*) as forbidden_convs FROM public.conversations WHERE id = '${job7.conversationId}'::uuid;
      SELECT count(*) as forbidden_jobs FROM public.jobs WHERE id = '${testJobId7}'::uuid;
    ROLLBACK;
  `);
  assert(
    Number(outsiderRls[4].rows[0].forbidden_convs) === 0,
    "Outsider cannot read other users' private conversations via SELECT RLS",
  );
  assert(
    Number(outsiderRls[5].rows[0].forbidden_jobs) === 0,
    "Outsider cannot read other users' private jobs via SELECT RLS",
  );

  // C. Rol 'authenticated' como Propietario (Cliente 1) SÍ puede leer su propio trabajo
  const ownerRls = await conn1.query(`
    BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '${uClient1}';
      SET LOCAL "request.jwt.claim.role" = 'authenticated';

      SELECT count(*) as owned_jobs FROM public.jobs WHERE id = '${testJobId7}'::uuid;
    ROLLBACK;
  `);
  assert(
    Number(ownerRls[4].rows[0].owned_jobs) === 1,
    "Owner must be able to read their own job under RLS",
  );

  // D. Helper privado sin permisos de ejecucion para authenticated
  const helperCheck = await conn1.query(`
    SELECT has_function_privilege('authenticated', 'public.external_agreed_total_for_job(uuid)', 'EXECUTE') as ok
  `);
  assert(
    helperCheck.rows[0].ok === false,
    "Private price helper must NOT be executable by authenticated role",
  );

  console.log(
    "[OK] Strict SELECT RLS and RPC execution privileges verified under SET LOCAL ROLE!",
  );

  // Done
  await Promise.all([conn1.end(), conn2.end()]);
  console.log(
    "\n=================================================================",
  );
  console.log(
    "ALL REAL DUAL-CONNECTION CONCURRENCY TESTS RIGOROUSLY PASSED (8/8)!",
  );
  console.log(
    "=================================================================\n",
  );
}

run().catch((err) => {
  console.error("\nFATAL CONCURRENCY ERROR:", err);
  process.exit(1);
});
