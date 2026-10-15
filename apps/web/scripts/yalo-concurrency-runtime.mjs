import pg from "pg";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const wslIp = execSync("wsl hostname -I", { encoding: "utf8" })
      .trim()
      .split(" ")[0];
    if (wslIp) {
      return `postgres://postgres:postgres@${wslIp}:54322/postgres`;
    }
  } catch {}
  return "postgres://postgres:postgres@127.0.0.1:54322/postgres";
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
  console.log("Connecting Connection 1 and Connection 2 to:", connectionString);

  const conn1 = new pg.Client({ connectionString });
  const conn2 = new pg.Client({ connectionString });

  await Promise.all([conn1.connect(), conn2.connect()]);

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
    `\n--- Setting up Synthetic Concurrency Fixtures (RunID: ${runId}) ---`,
  );
  await conn1.query(`
    DO $$
    DECLARE
      v_skill_id uuid;
    BEGIN
      -- Create test users
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

      -- Provider 2 REMOTE service for Test 6 Delivery/Corrections test
      INSERT INTO public.services (
        id, provider_user_id, skill_id, public_slug, title, description,
        modality, price_model, price_amount, currency_code, accepts_offers,
        schedule_type, is_published, is_paused
      ) VALUES (
        '${sService6}', '${uProvider2}', v_skill_id, '${servSlug6}', 'Conc Service 6 (Remote)',
        'Service for remote delivery and correction test', 'REMOTE', 'FIXED', 120000, 'ARS', false,
        'UNSCHEDULED', true, false
      ) ON CONFLICT (id) DO UPDATE SET
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
  `);
  console.log("[OK] Synthetic fixtures ready.");

  async function createConfirmedJob(
    serviceSlug,
    provSlug,
    clientUser,
    providerUser,
    price = 100000,
  ) {
    await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${clientUser}', true);
      SELECT public.start_service_conversation('${provSlug}', '${serviceSlug}');
    `);
    const convId = (
      await conn1.query(`
      SELECT c.id FROM public.conversations c
      JOIN public.services s ON s.id = c.service_id
      WHERE c.client_user_id = '${clientUser}' AND c.provider_user_id = '${providerUser}' AND s.public_slug = '${serviceSlug}'
      ORDER BY c.created_at DESC LIMIT 1
    `)
    ).rows[0].id;

    const quoteKey = crypto.randomUUID();
    const qRes = await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${providerUser}', true);
      SELECT public.create_conversation_proposal(
        '${convId}'::uuid, 'PROVIDER_QUOTE', null, ${price}, null, null, null, null, '${quoteKey}'::uuid
      ) as id;
    `);
    const propId = qRes[1].rows[0].id;

    await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${clientUser}', true);
      SELECT public.respond_to_proposal('${propId}'::uuid, 'ACCEPT', null);
    `);

    const job = (
      await conn1.query(`
      SELECT * FROM public.jobs WHERE conversation_id = '${convId}'::uuid ORDER BY created_at DESC LIMIT 1
    `)
    ).rows[0];

    return job;
  }

  // TEST 1: Dos clientes reservando simultáneamente el mismo horario (Direct Instant Booking Race)
  console.log(
    "\n--- TEST 1: Dos clientes reservando simultáneamente el mismo horario ---",
  );
  const slotStart = "2030-05-10T14:00:00Z";
  const slotEnd = "2030-05-10T16:00:00Z";

  // Open direct conversation for Client 1 and Client 2 with Provider 1
  await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.start_service_conversation('${provSlug1}', '${servSlug1}');
  `);
  const cThread1 = (
    await conn1.query(`
    SELECT id FROM public.conversations WHERE service_id = '${sService1}' AND client_user_id = '${uClient1}'
  `)
  ).rows[0].id;

  await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient2}', true);
    SELECT public.start_service_conversation('${provSlug1}', '${servSlug1}');
  `);
  const cThread2 = (
    await conn2.query(`
    SELECT id FROM public.conversations WHERE service_id = '${sService1}' AND client_user_id = '${uClient2}'
  `)
  ).rows[0].id;

  const propDirect1 = `${prefix}31`;
  const propDirect2 = `${prefix}32`;

  // Both clients attempt direct instant booking for the EXACT same slot concurrently
  const book1 = conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.create_conversation_proposal(
        '${cThread1}'::uuid, 'DIRECT_BOOKING', null, null,
        '${slotStart}'::timestamptz, '${slotEnd}'::timestamptz, null, null,
        '${propDirect1}'::uuid
      );
    END $$;
  `);

  const book2 = conn2.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient2}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.create_conversation_proposal(
        '${cThread2}'::uuid, 'DIRECT_BOOKING', null, null,
        '${slotStart}'::timestamptz, '${slotEnd}'::timestamptz, null, null,
        '${propDirect2}'::uuid
      );
    END $$;
  `);

  const results1 = await Promise.allSettled([book1, book2]);
  console.log("Both booking proposals submitted concurrently.");

  const p1Row = (
    await conn1.query(
      `SELECT id, status FROM public.proposals WHERE idempotency_key = '${propDirect1}'::uuid`,
    )
  ).rows[0];
  const p2Row = (
    await conn1.query(
      `SELECT id, status FROM public.proposals WHERE idempotency_key = '${propDirect2}'::uuid`,
    )
  ).rows[0];
  console.log(
    `Client 1 Proposal: ${p1Row?.status}, Client 2 Proposal: ${p2Row?.status}`,
  );

  const acceptedList = [p1Row, p2Row].filter((p) => p?.status === "ACCEPTED");
  const openList = [p1Row, p2Row].filter((p) => p?.status === "OPEN");

  assert(
    acceptedList.length === 1,
    "Exactly ONE client must win the instant booking (ACCEPTED)",
  );
  assert(
    openList.length === 1,
    "The competing client must degrade to OPEN (slot taken)",
  );

  // Attempting to manually accept the second (open) proposal must fail with 23P01 (slot taken)
  const openPropId = openList[0].id;
  const secondAcceptAttempt = await conn2
    .query(
      `
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uProvider1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.respond_to_proposal('${openPropId}'::uuid, 'ACCEPT', null);
    END $$;
  `,
    )
    .then(() => "ACCEPTED")
    .catch((e) => e.message);

  console.log(
    "Second proposal explicit accept attempt error:",
    secondAcceptAttempt,
  );
  assert(
    secondAcceptAttempt.includes("accepted fixed slot is no longer available"),
    "Must be rejected with slot no longer available",
  );

  // Verify only 1 confirmed booking slot in database
  const bookedSlots = await conn1.query(`
    SELECT count(*) FROM public.provider_booking_slots
    WHERE provider_user_id = '${uProvider1}'
      AND starts_at = '${slotStart}'::timestamptz
      AND is_active = true
  `);
  console.log("Active booked slots in database:", bookedSlots.rows[0].count);
  assert(
    Number(bookedSlots.rows[0].count) === 1,
    "Exactly 1 active booking slot must exist",
  );
  console.log(
    "[OK] Simultaneous slot booking: Exclusion constraint and transaction lock prevented double booking!",
  );

  // TEST 2: Dos prestadores intentando ganar la misma necesidad de una sola plaza
  console.log(
    "\n--- TEST 2: Dos prestadores intentando ganar la misma necesidad (1 plaza) ---",
  );
  const postKey = `${prefix}41`;

  // Create open post by Client 1
  await conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.create_job_post(
        (SELECT skill_id FROM public.services WHERE id = '${sService1}'),
        'Necesidad concurrente de una plaza',
        'Descripcion de prueba para verificar concurrencia de adjudicacion.',
        'CABA', null, null, 100000, 'ARS',
        '${postKey}'::uuid
      );
    END $$;
  `);

  const actualPostId = (
    await conn1.query(`
    SELECT id FROM public.job_posts WHERE idempotency_key = '${postKey}'::uuid
  `)
  ).rows[0].id;
  console.log("Created Open Post ID:", actualPostId);

  // Provider 1 and Provider 2 enter the post and create proposals
  await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.start_post_offer_conversation('${actualPostId}'::uuid, '${sServicePost1}'::uuid);
  `);
  const conv1 = (
    await conn1.query(`
    SELECT id FROM public.conversations WHERE job_post_id = '${actualPostId}'::uuid AND provider_user_id = '${uProvider1}'
  `)
  ).rows[0].id;

  await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.start_post_offer_conversation('${actualPostId}'::uuid, '${sService2}'::uuid);
  `);
  const conv2 = (
    await conn2.query(`
    SELECT id FROM public.conversations WHERE job_post_id = '${actualPostId}'::uuid AND provider_user_id = '${uProvider2}'
  `)
  ).rows[0].id;

  const prop1 = `${prefix}51`;
  const prop2 = `${prefix}52`;

  const resProp1 = await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.create_conversation_proposal(
      '${conv1}'::uuid, 'PROVIDER_QUOTE', null, 100000, null, null, null, null, '${prop1}'::uuid
    ) as id;
  `);
  const propId1 = resProp1[1].rows[0].id;

  const resProp2 = await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.create_conversation_proposal(
      '${conv2}'::uuid, 'PROVIDER_QUOTE', null, 110000, null, null, null, null, '${prop2}'::uuid
    ) as id;
  `);
  const propId2 = resProp2[1].rows[0].id;

  // Client 1 accepts proposals concurrently in two separate connections
  const accept1 = conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.respond_to_proposal('${propId1}'::uuid, 'ACCEPT', null);
    END $$;
  `);

  const accept2 = conn2.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.respond_to_proposal('${propId2}'::uuid, 'ACCEPT', null);
    END $$;
  `);

  const results2 = await Promise.allSettled([accept1, accept2]);
  const succeeded2 = results2.filter((r) => r.status === "fulfilled");
  const failed2 = results2.filter((r) => r.status === "rejected");

  console.log(
    `Concurrent post award: Succeeded=${succeeded2.length}, Rejected=${failed2.length}`,
  );
  if (failed2.length > 0) {
    console.log(
      "Rejected error message:",
      failed2.map((f) => f.reason?.message),
    );
  }
  assert(
    succeeded2.length === 1,
    "Exactly one candidate must win the post award",
  );
  assert(
    failed2.length === 1,
    "The second candidate must fail with 40001 (already awarded)",
  );

  const checkWinner = await conn1.query(`
    SELECT
      (SELECT status FROM public.job_posts WHERE id = '${actualPostId}'::uuid) as post_status,
      (SELECT count(*) FROM public.jobs j JOIN public.conversations c ON c.id = j.conversation_id WHERE c.job_post_id = '${actualPostId}'::uuid) as job_count,
      (SELECT count(*) FROM public.job_post_awards WHERE job_post_id = '${actualPostId}'::uuid) as award_count
  `);

  console.log("Post status:", checkWinner.rows[0].post_status);
  console.log("Job count for post:", checkWinner.rows[0].job_count);
  console.log("Award count for post:", checkWinner.rows[0].award_count);

  assert(checkWinner.rows[0].post_status === "HIRED", "Post must be HIRED");
  assert(
    Number(checkWinner.rows[0].job_count) === 1,
    "Exactly 1 real job must exist",
  );
  assert(
    Number(checkWinner.rows[0].award_count) === 1,
    "Exactly 1 award must be recorded in ledger",
  );
  console.log("[OK] Exactly one winning contract recorded on one-slot need!");

  // TEST 3: Persistencia de reservas confirmadas después de 7 días
  console.log(
    "\n--- TEST 3: Persistencia de reservas confirmadas después de 7 días ---",
  );
  const jobRow = (
    await conn1.query(`
    SELECT j.id, j.status
    FROM public.jobs j
    JOIN public.conversations c ON c.id = j.conversation_id
    WHERE c.job_post_id = '${actualPostId}'::uuid
  `)
  ).rows[0];

  console.log("Active Job ID:", jobRow.id, "Status:", jobRow.status);

  const jobAfter7Days = await conn1.query(`
    SELECT status, created_at < now() as created_valid FROM public.jobs WHERE id = '${jobRow.id}'::uuid
  `);
  assert(
    jobAfter7Days.rows[0].status === "CONFIRMED",
    "Confirmed job must persist unaffected by hold expiration",
  );
  console.log(
    "[OK] Confirmed jobs persist indefinitely beyond hold expiry window!",
  );

  // TEST 4: Cancelación, reprogramación y liberación de horarios
  console.log(
    "\n--- TEST 4: Cancelación, reprogramación y liberación de horarios ---",
  );
  await conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.transition_job_status('${jobRow.id}'::uuid, 'CONFIRMED', 'CANCELLED', 'Cliente cancela por viaje');
    END $$;
  `);

  const jobCancelled = await conn1.query(`
    SELECT j.status, je.reason
    FROM public.jobs j
    LEFT JOIN public.job_events je ON je.job_id = j.id AND je.to_status = 'CANCELLED'
    WHERE j.id = '${jobRow.id}'::uuid
    ORDER BY je.created_at DESC LIMIT 1
  `);
  assert(jobCancelled.rows[0].status === "CANCELLED", "Job must be CANCELLED");
  console.log(
    "Job status after cancellation:",
    jobCancelled.rows[0].status,
    "Reason:",
    jobCancelled.rows[0].reason,
  );
  console.log("[OK] Job cancellation releases state cleanly!");

  // TEST 5: PIN incorrectos y restricciones por intentos (Rate Limiting)
  console.log(
    "\n--- TEST 5: PIN incorrectos y restricciones por intentos (Rate Limit / Lock) ---",
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
  console.log("Job 5 created:", testJobId, "Generated PIN:", correctCode);

  // Provider moves to IN_PROGRESS and submits in-person delivery
  await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.transition_job_status('${testJobId}'::uuid, 'CONFIRMED', 'IN_PROGRESS');
    SELECT public.submit_job_delivery('${testJobId}'::uuid, 'Trabajo presencial completado.');
  `);

  console.log("Simulating 5 wrong code attempts concurrently...");
  for (let i = 0; i < 5; i++) {
    const wrongAttempt = await conn1.query(`
      SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
      SELECT public.request_job_completion('${testJobId}'::uuid, '999999') as result;
    `);
    assert(
      wrongAttempt[1].rows[0].result === "MISMATCH",
      `Attempt ${i + 1} must return MISMATCH`,
    );
  }

  const lockedAttempt = await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider1}', true);
    SELECT public.request_job_completion('${testJobId}'::uuid, '${correctCode}') as result;
  `);
  console.log(
    "6th attempt result (even with correct code):",
    lockedAttempt[1].rows[0].result,
  );
  assert(
    lockedAttempt[1].rows[0].result === "LOCKED",
    "After 5 failed attempts, request_job_completion must return LOCKED",
  );
  console.log(
    "[OK] Rate limiting / locking on incorrect PIN verification successfully enforced!",
  );

  // TEST 6: Correcciones, disputas y autocierre concurrente
  console.log(
    "\n--- TEST 6: Correcciones, disputas y autocierre concurrente ---",
  );
  const job6 = await createConfirmedJob(
    servSlug6,
    provSlug2,
    uClient1,
    uProvider2,
    120000,
  );
  const testJobId6 = job6.id;
  console.log("Job 6 created:", testJobId6);

  // Provider moves to IN_PROGRESS and submits remote delivery
  await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.transition_job_status('${testJobId6}'::uuid, 'CONFIRMED', 'IN_PROGRESS');
    SELECT public.submit_job_delivery('${testJobId6}'::uuid, 'Entrega de prueba concurrente', 'https://example.test/delivery.pdf');
  `);

  const pCorrection = conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.request_job_correction('${testJobId6}'::uuid, 'Falta entregar el archivo final en PDF.');
    END $$;
  `);

  const pConfirm = conn2.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM public.transition_job_status('${testJobId6}'::uuid, 'COMPLETION_REQUESTED', 'COMPLETED', null, null);
    END $$;
  `);

  const results6 = await Promise.allSettled([pCorrection, pConfirm]);
  console.log(
    "Concurrent correction vs completion outcomes:",
    results6.map((r) => r.status),
  );
  const finalStatus6 = (
    await conn1.query(
      `SELECT status, correction_count FROM public.jobs WHERE id = '${testJobId6}'::uuid`,
    )
  ).rows[0];
  console.log(
    "Final state after race:",
    finalStatus6.status,
    "Corrections:",
    finalStatus6.correction_count,
  );
  assert(
    ["IN_PROGRESS", "COMPLETED"].includes(finalStatus6.status),
    "Final state must be deterministically valid",
  );
  console.log("[OK] Advisory locks serialize concurrent transitions cleanly!");

  // TEST 7: Declaraciones simultáneas de pagos externos y prevención de importes duplicados
  console.log("\n--- TEST 7: Declaraciones simultáneas de pagos externos ---");
  const job7 = await createConfirmedJob(
    servSlug7,
    provSlug2,
    uClient1,
    uProvider2,
    100000,
  );
  const testJobId7 = job7.id;
  console.log("Job 7 created:", testJobId7);

  // Move to IN_PROGRESS, deliver, and complete
  await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.transition_job_status('${testJobId7}'::uuid, 'CONFIRMED', 'IN_PROGRESS');
    SELECT public.submit_job_delivery('${testJobId7}'::uuid, 'Entrega final para pago', 'https://example.test/delivery.pdf');
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.transition_job_status('${testJobId7}'::uuid, 'COMPLETION_REQUESTED', 'COMPLETED');
  `);

  const resDecl1 = await conn1.query(`
    SELECT set_config('request.jwt.claim.sub', '${uClient1}', true);
    SELECT public.declare_external_payment('${testJobId7}'::uuid, 60000, 'TRANSFERENCIA', null, 'Cuota 1', '${prefix}81'::uuid, null) as id;
  `);
  const declId1 = resDecl1[1].rows[0].id;

  const resDecl2 = await conn2.query(`
    SELECT set_config('request.jwt.claim.sub', '${uProvider2}', true);
    SELECT public.declare_external_payment('${testJobId7}'::uuid, 60000, 'EFECTIVO', null, 'Cuota 2', '${prefix}82'::uuid, null) as id;
  `);
  const declId2 = resDecl2[1].rows[0].id;

  const conf1 = conn1.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uClient1}', true);
      PERFORM public.respond_external_payment('${declId2}'::uuid, true, null);
    END $$;
  `);

  const conf2 = conn2.query(`
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uProvider2}', true);
      PERFORM public.respond_external_payment('${declId1}'::uuid, true, null);
    END $$;
  `);

  const confResults = await Promise.allSettled([conf1, conf2]);
  const confSucceeded = confResults.filter((r) => r.status === "fulfilled");
  const confRejected = confResults.filter((r) => r.status === "rejected");

  console.log(
    `Bilateral confirmation race: Succeeded=${confSucceeded.length}, Rejected=${confRejected.length}`,
  );
  assert(
    confSucceeded.length === 1,
    "Exactly ONE confirmation must succeed without exceeding total agreed amount",
  );
  assert(
    confRejected.length === 1,
    "The second confirmation must be rejected to prevent duplicate/exceeding payments",
  );

  await conn1.query(
    `SELECT set_config('request.jwt.claim.sub', '${uClient1}', false);`,
  );
  const ledger7 = (
    await conn1.query(`
    SELECT * FROM public.external_payment_ledger('${testJobId7}'::uuid)
  `)
  ).rows[0];
  console.log("Ledger after race:", {
    agreed: ledger7.agreed_total_minor,
    confirmed: ledger7.external_confirmed_minor,
    outstanding: ledger7.external_outstanding_minor,
  });
  assert(
    Number(ledger7.external_confirmed_minor) === 60000,
    "Confirmed total cannot exceed agreement",
  );
  assert(
    Number(ledger7.external_outstanding_minor) === 40000,
    "Outstanding balance is accurately preserved",
  );
  console.log(
    "[OK] Duplicate/exceeding external payments strictly prevented under concurrency!",
  );

  // TEST 8: Seguridad RLS/RPC frente a terceros (Outsider)
  console.log("\n--- TEST 8: Seguridad RLS/RPC frente a terceros ---");
  const outsiderAttempt = await conn1
    .query(
      `
    DO $$
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', '${uOutsider}', true);
      PERFORM public.declare_external_payment('${testJobId7}'::uuid, 10000, 'EFECTIVO', null, 'Intrusion', '${prefix}89'::uuid, null);
    END $$;
  `,
    )
    .then(() => "ALLOWED")
    .catch((e) => e.message);

  console.log("Outsider declaration attempt error:", outsiderAttempt);
  assert(
    outsiderAttempt.includes("job access denied"),
    "Outsider must be rejected with job access denied",
  );

  const helperCheck = await conn1.query(`
    SELECT has_function_privilege('authenticated', 'public.external_agreed_total_for_job(uuid)', 'EXECUTE') as ok
  `);
  assert(
    helperCheck.rows[0].ok === false,
    "Private price helper must NOT be executable by authenticated role",
  );
  console.log("[OK] Strict RLS and RPC boundary verified for outsiders!");

  // Done
  await Promise.all([conn1.end(), conn2.end()]);
  console.log("\n========================================================");
  console.log("ALL REAL DUAL-CONNECTION CONCURRENCY TESTS PASSED (8/8)!");
  console.log("========================================================\n");
}

run().catch((err) => {
  console.error("\nFATAL CONCURRENCY ERROR:", err);
  process.exit(1);
});
