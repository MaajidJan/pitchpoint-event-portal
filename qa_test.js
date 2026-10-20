// End-to-End QA Verification Suite for Bahria Event Portal
const BASE_URL = 'https://bahria-event-portal.bahria-event-portal.workers.dev';

async function runQA() {
  console.log('====================================================');
  console.log('🧪 STARTING END-TO-END QA VERIFICATION SUITE');
  console.log('Target URL:', BASE_URL);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const multiTrx = `QA_TRX_MULTI_${timestamp}`;
  const offlineTrx = `QA_TRX_OFFLINE_${timestamp}`;

  // -------------------------------------------------------------
  // TEST 1: Config Endpoint (Single Official Pass)
  // -------------------------------------------------------------
  console.log('--- TEST 1: System Configuration & Single Ticket Verification ---');
  try {
    const configRes = await fetch(`${BASE_URL}/api/config`);
    const config = await configRes.json();
    assert(configRes.ok, 'Config endpoint returned 200 OK');
    assert(config.ticket_name === 'Official Event Pass', `Official ticket name is "${config.ticket_name}"`);
    assert(config.ticket_price === 1, `Ticket price is Rs. ${config.ticket_price}`);
    assert(config.account_number === '03175230209', `Official Easypaisa number is ${config.account_number}`);
  } catch (e) {
    assert(false, `Config test failed: ${e.message}`);
  }

  // -------------------------------------------------------------
  // TEST 2: Multi-Payment Support (1 Payment covers 2 Attendees)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Multi-Payment / Cumulative Credit Matching ---');
  try {
    // A) Android app forwards Rs. 2 payment for multiTrx
    const payRes = await fetch(`${BASE_URL}/api/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trx_id: multiTrx,
        amount: 2.0,
        sender_name: 'QA Group Payer',
        sender_phone: '03001234567',
        source: 'ANDROID_FORWARDER'
      })
    });
    const payData = await payRes.json();
    assert(payData.success === true, `Payment webhook accepted Rs. 2.0 (TRX: ${multiTrx})`);

    // B) Student 1 registers (claiming Rs. 1.0 of Rs. 2.0)
    const s1Res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'QA Student One',
        email: `qa.student1.${timestamp}@bahria.edu.pk`,
        phone: '03110000001',
        roll_no: `01-QA1-${timestamp.toString().slice(-4)}`,
        department: 'Software Engineering',
        ticket_type: 'OFFICIAL_ENTRY_PASS',
        expected_amount: 1.0,
        manual_trx_id: multiTrx
      })
    });
    const s1Data = await s1Res.json();
    assert(s1Data.status === 'VERIFIED', `Student 1 instantly VERIFIED using group TRX`);
    assert(typeof s1Data.ticket_qr === 'string' && s1Data.ticket_qr.startsWith('data:image/svg+xml'), 'Student 1 received genuine SVG QR ticket');
    const s1Id = s1Data.registration_id;

    // C) Student 2 registers with the SAME TRX (claiming the remaining Rs. 1.0)
    const s2Res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'QA Student Two',
        email: `qa.student2.${timestamp}@bahria.edu.pk`,
        phone: '03110000002',
        roll_no: `01-QA2-${timestamp.toString().slice(-4)}`,
        department: 'Computer Science',
        ticket_type: 'OFFICIAL_ENTRY_PASS',
        expected_amount: 1.0,
        manual_trx_id: multiTrx
      })
    });
    const s2Data = await s2Res.json();
    assert(s2Data.status === 'VERIFIED', `Student 2 instantly VERIFIED using SAME group TRX (multi-payment succeeded)`);
    assert(typeof s2Data.ticket_qr === 'string', 'Student 2 received distinct genuine QR ticket');
    const s2Id = s2Data.registration_id;

    // D) Student 3 tries to register with the SAME TRX (credit exhausted!)
    const s3Res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'QA Student Three (Overlimit)',
        email: `qa.student3.${timestamp}@bahria.edu.pk`,
        phone: '03110000003',
        roll_no: `01-QA3-${timestamp.toString().slice(-4)}`,
        department: 'Electrical Engineering',
        ticket_type: 'OFFICIAL_ENTRY_PASS',
        expected_amount: 1.0,
        manual_trx_id: multiTrx
      })
    });
    const s3Data = await s3Res.json();
    assert(s3Data.status === 'PENDING', `Student 3 correctly kept in PENDING (available credit exhausted)`);
    const s3Id = s3Data.registration_id;

    // -------------------------------------------------------------
    // TEST 3: Gate QR Entry & Anti-Fraud Duplicate Protection
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Gate Entry QR Verification & Anti-Fraud Scanner ---');
    
    // First scan of Student 1: Should be APPROVED
    const gateScan1 = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: s1Id, scanned_by: 'Main Gate Test' })
    });
    const gateData1 = await gateScan1.json();
    assert(gateData1.status === 'APPROVED', `Gate scanner granted entry for Student 1 (Status: APPROVED)`);
    assert(gateData1.student.name === 'QA Student One', 'Returned correct attendee details');

    // Second scan of Student 1: Fraud alert! ALREADY_USED
    const gateScanDuplicate = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: s1Id, scanned_by: 'Main Gate Test' })
    });
    const gateDataDup = await gateScanDuplicate.json();
    assert(gateDataDup.status === 'ALREADY_USED', `Gate scanner flagged re-use as FRAUD (Status: ALREADY_USED)`);

    // Gate scan of unverified attendee (Student 3): Should be UNVERIFIED
    const gateScanUnverified = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: s3Id, scanned_by: 'Main Gate Test' })
    });
    const gateDataUnverified = await gateScanUnverified.json();
    assert(gateDataUnverified.status === 'UNVERIFIED', `Gate scanner rejected unverified registration (Status: UNVERIFIED)`);

    // Gate scan of non-existent fake pass: Should be NOT_FOUND
    const gateScanFake = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: 'BU-FAKE-PASS-999', scanned_by: 'Main Gate Test' })
    });
    const gateDataFake = await gateScanFake.json();
    assert(gateDataFake.status === 'NOT_FOUND', `Gate scanner rejected fake ticket ID (Status: NOT_FOUND)`);

    // -------------------------------------------------------------
    // TEST 4: Offline-to-Online Synchronization (Timing Precision)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Zero-Conflict Offline-to-Online Sync ---');

    // Step 1: Student registers while owner phone is OFFLINE
    const offlineRoll = `01-QAOFF-${timestamp.toString().slice(-4)}`;
    const regOfflineRes = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'QA Offline Student',
        email: `qa.offline.${timestamp}@bahria.edu.pk`,
        phone: '03119998877',
        roll_no: offlineRoll,
        department: 'Artificial Intelligence',
        ticket_type: 'OFFICIAL_ENTRY_PASS',
        expected_amount: 1.0,
        manual_trx_id: offlineTrx
      })
    });
    const regOfflineData = await regOfflineRes.json();
    assert(regOfflineData.status === 'PENDING', `Registration accepted in PENDING state while phone offline`);
    const offlineRegId = regOfflineData.registration_id;

    // Step 2: Check polling status endpoint
    const pollBefore = await fetch(`${BASE_URL}/api/status/${offlineRegId}`);
    const pollBeforeData = await pollBefore.json();
    assert(pollBeforeData.status === 'PENDING', `Status poll returns PENDING while awaiting sync`);

    // Step 3: Owner phone comes ONLINE (e.g. 5 minutes later) and pushes payment notification
    const syncRes = await fetch(`${BASE_URL}/api/webhook/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trx_id: offlineTrx,
        amount: 1.0,
        sender_name: 'Offline Sync Payer',
        source: 'ANDROID_NOTIFICATION'
      })
    });
    const syncData = await syncRes.json();
    assert(syncData.success === true, `Webhook accepted payment after phone came online`);

    // Step 4: Check polling status endpoint - MUST now be VERIFIED with QR code!
    const pollAfter = await fetch(`${BASE_URL}/api/status/${offlineRegId}`);
    const pollAfterData = await pollAfter.json();
    assert(pollAfterData.status === 'VERIFIED', `Offline registration AUTO-UPGRADED to VERIFIED on phone sync`);
    assert(typeof pollAfterData.registration.ticket_qr === 'string', `Genuine QR pass automatically issued`);

    // -------------------------------------------------------------
    // TEST 5: Student Pass Self-Lookup ("Find My Pass")
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Student Ticket Lookup ("Find My Pass") ---');
    const lookupRes = await fetch(`${BASE_URL}/api/ticket/lookup?query=${encodeURIComponent(offlineRoll)}`);
    const lookupData = await lookupRes.json();
    assert(lookupData.success === true, `Attendee lookup by Roll No succeeded`);
    assert(lookupData.registration.roll_no === offlineRoll, `Lookup returned attendee ${offlineRoll}`);
    assert(lookupData.registration.status === 'VERIFIED', `Lookup pass status is VERIFIED`);

  } catch (err) {
    console.error('Test execution error:', err);
    assert(false, `Unexpected error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 QA SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

runQA();
