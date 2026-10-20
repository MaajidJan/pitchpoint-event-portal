// Automated Verification Test for Production Pre-Live Hardening & Real-time Handover Sync
const BASE_URL = 'https://bahria-event-portal.bahria-event-portal.workers.dev';

async function runTests() {
  console.log('🚀 Starting Pre-Live Production Hardening & Handover Sync QA Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // TEST 1: Config & Dynamic Support Check
    console.log('--- TEST 1: Public Config & Support Settings ---');
    const configRes = await fetch(`${BASE_URL}/api/config`);
    const configData = await configRes.json();
    assert(configRes.ok && configData.support_phone, `Config endpoint returned support phone: ${configData.support_phone}`);
    assert(configData.support_whatsapp, `Config endpoint returned support WhatsApp: ${configData.support_whatsapp}`);

    // TEST 2: Double-Submit Idempotency in Online Registration
    console.log('\n--- TEST 2: Double-Submit Idempotency (Online Registration) ---');
    const testRoll1 = `QA-ROLL-${Date.now().toString(36).toUpperCase()}`;
    const regPayload = {
      full_name: 'Zeeshan Ali Test',
      email: `${testRoll1.toLowerCase()}@student.bahria.edu.pk`,
      phone: '03001234567',
      roll_no: testRoll1,
      department: 'Software Engineering',
      ticket_type: 'OFFICIAL_ENTRY_PASS',
      expected_amount: 1.0,
      manual_trx_id: `TRX${Date.now()}`
    };

    const reg1Res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    const reg1Data = await reg1Res.json();
    assert(reg1Res.ok && reg1Data.success, `First registration created: ID ${reg1Data.registration_id}`);

    // Immediate second submit with same roll number (simulating student double-tap on mobile)
    const reg2Res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    const reg2Data = await reg2Res.json();
    assert(reg2Data.success && reg2Data.registration_id === reg1Data.registration_id, 
      `Second registration returned existing ID (Double-submit prevented, zero duplicate rows)`);

    // TEST 3: Cash Desk Double-Submit Idempotency & Distinct V2 QR Payload
    console.log('\n--- TEST 3: Cash Desk Walk-in Registration & Distinct QR Payload ---');
    const testRoll2 = `QA-CASH-${Date.now().toString(36).toUpperCase()}`;
    const deskPayload = {
      full_name: 'Fatima Noor Test',
      roll_no: testRoll2,
      phone: '03119876543',
      department: 'Computer Science',
      expected_amount: 1.0,
      cashier_name: 'Bilal Cashier',
      desk_number: 'Desk 1'
    };

    const cash1Res = await fetch(`${BASE_URL}/api/desk/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deskPayload)
    });
    const cash1Data = await cash1Res.json();
    assert(cash1Res.ok && cash1Data.success, `Cash desk pass issued: Receipt ${cash1Data.receipt_no}`);
    assert(cash1Data.ticket_qr && cash1Data.ticket_qr.startsWith('data:image/svg+xml'), 'Valid SVG QR ticket generated');

    // Immediate duplicate submit
    const cash2Res = await fetch(`${BASE_URL}/api/desk/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deskPayload)
    });
    const cash2Data = await cash2Res.json();
    assert(cash2Data.success && cash2Data.receipt_no === cash1Data.receipt_no, 
      `Cash desk double-click prevented: Returned same receipt ${cash2Data.receipt_no}`);

    // TEST 4: Gate Scanner Verification with Channel Badging & Anti-Fraud
    console.log('\n--- TEST 4: Gate Scanner Verification (Both Pass Types) ---');
    // Verify cash pass at gate
    const gateCashRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: cash1Data.registration_id, scanned_by: 'Turnstile 1' })
    });
    const gateCashData = await gateCashRes.json();
    assert(gateCashData.status === 'APPROVED', `Cash pass entry granted: ${gateCashData.message}`);
    assert(gateCashData.student.channel === 'DESK_CASH', `Gate correctly identified channel: DESK_CASH`);
    assert(gateCashData.student.receipt_no === cash1Data.receipt_no, `Gate surfaced receipt number: ${gateCashData.student.receipt_no}`);

    // Anti-Fraud Re-Scan attempt
    const gateReScanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: cash1Data.registration_id, scanned_by: 'Turnstile 1' })
    });
    const gateReScanData = await gateReScanRes.json();
    assert(gateReScanData.status === 'ALREADY_USED', `Anti-fraud alarm triggered on reused pass: ${gateReScanData.status}`);

    // TEST 5: Cashier Shift Handover & Real-Time Finance Approval Sync
    console.log('\n--- TEST 5: Cashier Handover <-> Finance Head Live Sync Flow ---');
    const cashierName = `ShiftCashier_${Date.now().toString(36)}`;
    
    // 5a. Open shift
    const openRes = await fetch(`${BASE_URL}/api/desk/shift/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashier_name: cashierName, desk_number: 'Desk 2' })
    });
    const openData = await openRes.json();
    const shiftId = openData.shift.id;
    assert(openData.success && shiftId, `Shift opened: ${shiftId} for ${cashierName}`);

    // 5b. Cashier submits handover
    const handoverRes = await fetch(`${BASE_URL}/api/desk/shift/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: shiftId,
        handover_to: 'Majid Ullah Jan (Finance Head)',
        notes: 'Handing over test drawer cash'
      })
    });
    const handoverData = await handoverRes.json();
    assert(handoverData.success, `Cashier submitted handover: status is PENDING_HANDOVER`);

    // 5c. Cashier screen polling checks status
    const poll1Res = await fetch(`${BASE_URL}/api/desk/shift/status?shift_id=${shiftId}`);
    const poll1Data = await poll1Res.json();
    assert(poll1Data.handover_status === 'PENDING_HANDOVER', `Cashier poll confirms PENDING_HANDOVER state`);

    // 5d. Finance Head clicks "Accept Physical Cash" in Admin
    const approveRes = await fetch(`${BASE_URL}/api/finance/shift/approve-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: shiftId,
        approved_by: 'Majid Ullah Jan (Head of Finance)',
        notes: 'Counted and verified physical notes'
      })
    });
    const approveData = await approveRes.json();
    assert(approveData.success, `Finance Head accepted cash handover: ${approveData.message}`);

    // 5e. Cashier screen poll detects approval
    const poll2Res = await fetch(`${BASE_URL}/api/desk/shift/status?shift_id=${shiftId}`);
    const poll2Data = await poll2Res.json();
    assert(poll2Data.handover_status === 'APPROVED', `Cashier screen receives APPROVED state (Drawer officially balanced!)`);

    // TEST 6: Audit Logs & Attendee Life-Cycle Micro-Trace
    console.log('\n--- TEST 6: Granular Audit Trail & Student Life-Cycle Micro-Trace ---');
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?limit=10`);
    const auditData = await auditRes.json();
    assert(auditData.success && Array.isArray(auditData.logs) && auditData.logs.length > 0, 
      `Retrieved ${auditData.logs.length} granular audit trail records`);

    const traceRes = await fetch(`${BASE_URL}/api/admin/student-trace/${testRoll2}`);
    const traceData = await traceRes.json();
    assert(traceData.success && traceData.student && traceData.student.roll_no === testRoll2, 
      `Student life-cycle micro-trace found for ${testRoll2}`);
    assert(Array.isArray(traceData.audit_logs) && traceData.audit_logs.length > 0,
      `Student micro-trace contains ${traceData.audit_logs.length} chronological audit milestones`);

    // Summary
    console.log('\n========================================');
    console.log(`QA Test Suite Completed: ${passed} Passed, ${failed} Failed`);
    console.log('========================================\n');

  } catch (err) {
    console.error('Fatal test execution error:', err);
  }
}

runTests();
