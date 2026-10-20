// End-to-End Real Security & Verification Test Suite for IdeaCrux 2025
// Tests Cashier On-Spot Assignment + Turnstile Scanner Verification Loop

const BASE_URL = process.env.TEST_URL || 'https://bahria-event-portal.bahria-event-portal.workers.dev';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 IDEACRUX 2025: CASHIER & TURNSTILE GATE SECURITY AUDIT TEST');
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    }
  }

  try {
    // 1. Staff Authentication: Cashier & Scanner Login
    console.log('--- Step 1: Staff Authentication & RBAC ---');
    
    // Login as Cashier
    const cashierLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier1', password: 'cashier2026' })
    });
    const cashierAuth = await cashierLoginRes.json();
    assert(cashierAuth.success && cashierAuth.token, 'Cashier Login (cashier1)', `Token: ${cashierAuth.token ? 'Issued' : 'Failed'}`);
    const cashierToken = cashierAuth.token;

    // Login as Scanner
    const scannerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'scanner1', password: 'scanner2026' })
    });
    const scannerAuth = await scannerLoginRes.json();
    assert(scannerAuth.success && scannerAuth.token, 'Gate Scanner Login (scanner1)', `Token: ${scannerAuth.token ? 'Issued' : 'Failed'}`);
    const scannerToken = scannerAuth.token;

    // Login as Admin
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'maajid', password: 'admin2026' })
    });
    const adminAuth = await adminLoginRes.json();
    assert(adminAuth.success && adminAuth.token, 'Admin Login (maajid)', `Role: ${adminAuth.user?.role}`);
    const adminToken = adminAuth.token;

    // 2. Security Test: Unauthorized access rejection
    console.log('\n--- Step 2: Unauthenticated Security & Exploitation Tests ---');
    const unauthScanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: 'HACKER-ATTEMPT' })
    });
    assert(unauthScanRes.status === 401 || unauthScanRes.status === 403, 'Unauthorized Gate Scan Rejected (No Token)', `Status: ${unauthScanRes.status}`);

    const unauthCashRes = await fetch(`${BASE_URL}/api/desk/ideacrux/register-cash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_name: 'Hack Team' })
    });
    assert(unauthCashRes.status === 401 || unauthCashRes.status === 403, 'Unauthorized Cash Registration Rejected (No Token)', `Status: ${unauthCashRes.status}`);

    // 3. Cashier On-Spot Walk-in Registration with Rs. 1,000 cash collection
    console.log('\n--- Step 3: Cashier On-Spot Assignment of Pitch Pass QR ---');
    const testTimestamp = Date.now();
    const testTeamName = `Audited Team ${testTimestamp.toString().slice(-4)}`;
    const testLeaderPhone = `0329${Math.floor(1000000 + Math.random() * 9000000)}`;

    const registerRes = await fetch(`${BASE_URL}/api/desk/ideacrux/register-cash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        team_name: testTeamName,
        members_count: 2,
        leader_name: 'Test Founder',
        leader_phone: testLeaderPhone,
        leader_dept: 'Computer Science',
        startup_name: 'AI Crop Security',
        startup_stage: 'Working MVP',
        cashier_name: 'Station 1 Cashier',
        desk_number: 'Auditorium Entry Counter'
      })
    });
    const regData = await registerRes.json();
    assert(regData.success && regData.team?.id, 'Cashier Issues Official Pitch Pass', `Team ID: ${regData.team?.id}, Receipt: ${regData.receipt_no}`);
    assert(regData.pitch_pass_qr && regData.pitch_pass_qr.startsWith('data:image/svg+xml'), 'Authentic SVG QR Code Generated');
    assert(regData.team?.fee_amount === 1000, 'Fee Amount Locked to Rs. 1,000');
    assert(regData.team?.status === 'VERIFIED', 'Team Instantly Verified Upon Cash Receipt');

    const createdTeamId = regData.team?.id;

    // 4. Gate Scanner: First legitimate scan at Turnstile Gate
    console.log('\n--- Step 4: Turnstile Gate Verification of Authentic QR Pass ---');
    
    // Simulate Gate Scanner scanning raw QR payload with team_id
    const qrPayload = JSON.stringify({
      v: 2,
      type: 'OFFICIAL_IDEACRUX_PITCH_PASS',
      team_id: createdTeamId,
      team_name: testTeamName,
      startup: 'AI Crop Security',
      trx_id: regData.receipt_no
    });

    const firstScanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scannerToken}`
      },
      body: JSON.stringify({
        ticket_id: createdTeamId,
        qr_raw: qrPayload,
        scanned_by: 'Gate Scanner (Auditorium Turnstile 1)'
      })
    });
    const firstScanData = await firstScanRes.json();
    assert(firstScanData.success === true && firstScanData.status === 'APPROVED', 'First Scan: ENTRY GRANTED', `Status: ${firstScanData.status}`);
    assert(firstScanData.student?.ticket_type === 'OFFICIAL_IDEACRUX_PITCH_PASS', 'Verified as Official IdeaCrux Pitch Pass');
    assert(firstScanData.student?.checked_in_at, 'Admitted Timestamp Stored');

    // 5. Anti-Passback & Anti-Fraud: Scan the SAME QR code a second time!
    console.log('\n--- Step 5: Anti-Passback & Anti-Fraud Protection Test ---');
    const replayScanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scannerToken}`
      },
      body: JSON.stringify({
        ticket_id: createdTeamId,
        qr_raw: qrPayload,
        scanned_by: 'Gate Scanner (Auditorium Turnstile 2)'
      })
    });
    const replayScanData = await replayScanRes.json();
    assert(replayScanData.success === false, 'Replay Attack Rejected');
    assert(replayScanData.status === 'ALREADY_USED', 'Flagged as ALREADY_USED (Anti-Passback Blocked Duplicate Entry)', `Message: ${replayScanData.message}`);
    assert(replayScanData.checked_in_at, 'Original Admission Timestamp Returned');

    // 6. Test Unverified Team: Online registration before payment
    console.log('\n--- Step 6: Unverified / Unpaid Team Rejection Test ---');
    const unverifiedPhone = `0321${Math.floor(1000000 + Math.random() * 9000000)}`;
    const onlineRegRes = await fetch(`${BASE_URL}/api/ideacrux/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_name: `Unpaid Team ${testTimestamp.toString().slice(-4)}`,
        members_count: 2,
        leader_name: 'Pending Founder',
        leader_email: 'pending@gmail.com',
        leader_phone: unverifiedPhone,
        leader_dept: 'EE',
        leader_semester: '5th',
        member_2_name: 'Co-Founder Two',
        member_2_phone: '03221234567',
        startup_name: 'Unpaid Venture',
        idea_description: 'Solar microgrids for decentralized rural energy distribution across Punjab',
        problem_statement: 'High energy costs in Pakistan affecting small businesses severely',
        startup_stage: 'Idea Stage',
        pitch_deck_ready: 'Yes',
        available_on_day: 'Yes',
        trx_id: `ZIN-${Date.now().toString().slice(-6)}`,
        screenshot_base64: 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(5)
      })
    });
    const onlineRegData = await onlineRegRes.json();
    if (!onlineRegData.success) console.log('ONLINE REG ERR:', onlineRegData);
    const unpaidTeamId = onlineRegData.team_id;
    assert(onlineRegData.success && onlineRegData.status === 'PENDING', 'Online Team in PENDING Status', `Team ID: ${unpaidTeamId}`);

    // Try scanning the unpaid team's pass at the gate
    const unpaidScanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scannerToken}`
      },
      body: JSON.stringify({
        ticket_id: unpaidTeamId,
        scanned_by: 'Gate Scanner'
      })
    });
    const unpaidScanData = await unpaidScanRes.json();
    assert(unpaidScanData.success === false && unpaidScanData.status === 'UNVERIFIED', 'Unpaid Team Denied Entry at Gate', `Status: ${unpaidScanData.status}`);
    assert(unpaidScanData.message && (unpaidScanData.message.includes('Cashier Desk') || unpaidScanData.message.includes('PENDING')), 'Instructs Attendee to Cashier Desk', unpaidScanData.message);

    // 7. Test Counterfeit / Fake QR Code
    console.log('\n--- Step 7: Fake / Tampered QR Code Protection ---');
    const fakeScanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scannerToken}`
      },
      body: JSON.stringify({
        ticket_id: 'CRUX-FAKE-FORGED-999',
        qr_raw: JSON.stringify({ team_id: 'CRUX-FAKE-FORGED-999', status: 'VERIFIED' }),
        scanned_by: 'Gate Scanner'
      })
    });
    const fakeScanData = await fakeScanRes.json();
    assert(fakeScanData.success === false && (fakeScanData.status === 'NOT_FOUND' || fakeScanData.status === 'INVALID' || fakeScanData.status === 'UNAUTHORIZED_LOOKUP'), 'Fake QR Code Blocked & Denied', `Status: ${fakeScanData.status}`);

    // 8. Admin Reset Check-in & Re-entry Test
    console.log('\n--- Step 8: Admin Reset Check-in Workflow ---');
    const resetRes = await fetch(`${BASE_URL}/api/admin/ideacrux/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        team_id: createdTeamId,
        action: 'RESET_CHECKIN'
      })
    });
    const resetData = await resetRes.json();
    assert(resetData.success === true, 'Admin Resets Gate Check-in Status', resetData.message);

    // Now scan again after reset -> Should be APPROVED again!
    const reScanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scannerToken}`
      },
      body: JSON.stringify({
        ticket_id: createdTeamId,
        scanned_by: 'Gate Scanner'
      })
    });
    const reScanData = await reScanRes.json();
    assert(reScanData.success === true && reScanData.status === 'APPROVED', 'Scan Succeeded After Admin Reset');

    console.log('\n================================================================');
    console.log(`🏁 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
    if (passedTests === totalTests) {
      console.log('🎉 ALL SECURITY & VERIFICATION TESTS PASSED FLAWLESSLY!');
    } else {
      console.error(`⚠️ ${totalTests - passedTests} TESTS FAILED!`);
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal Test Error:', err);
  }
}

runTestSuite();
