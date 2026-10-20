// Test Suite for Cashier Desk and Finance Ledger Notebook
const BASE_URL = 'https://bahria-event-portal.bahria-event-portal.workers.dev';

async function runFinanceTests() {
  console.log('====================================================');
  console.log('🧪 TESTING CASHIER DESK & FINANCE NOTEBOOK');
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
  const testCashier = `QA_Cashier_${timestamp.toString().slice(-4)}`;

  try {
    // 1. Open a Cashier Shift
    console.log('--- 1. Open Cashier Shift ---');
    const openRes = await fetch(`${BASE_URL}/api/desk/shift/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashier_name: testCashier, desk_number: 'Desk 1' })
    });
    const openData = await openRes.json();
    assert(openData.success === true, `Cashier shift opened: ${openData.shift.id}`);
    const shiftId = openData.shift.id;

    // 2. Issue On-Spot Cash Pass
    console.log('\n--- 2. On-Spot Cash Walk-in Registration ---');
    const cashPassRes = await fetch(`${BASE_URL}/api/desk/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'QA Walkin Student',
        roll_no: `01-CASH-${timestamp.toString().slice(-4)}`,
        phone: '03009988776',
        department: 'Software Engineering',
        expected_amount: 1.0,
        cashier_name: testCashier,
        desk_number: 'Desk 1',
        shift_id: shiftId
      })
    });
    const passData = await cashPassRes.json();
    assert(passData.success === true, `Cash pass issued: ${passData.receipt_no}`);
    assert(passData.status === 'VERIFIED', `Pass status is VERIFIED immediately`);
    assert(typeof passData.ticket_qr === 'string' && passData.ticket_qr.startsWith('data:image/svg+xml'), 'Valid SVG QR pass generated');

    // 3. Log an Expense in the Finance Notebook
    console.log('\n--- 3. Log Event Expense (Outflow) ---');
    const expRes = await fetch(`${BASE_URL}/api/finance/expense/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'SOUND',
        amount: 50.0,
        description: 'QA Test Stage Microphone Rental',
        paid_to: 'Audio Master Test Vendor',
        recorded_by: 'QA Finance Lead'
      })
    });
    const expData = await expRes.json();
    assert(expData.success === true, `Expense recorded: ${expData.expense_id}`);
    const expId = expData.expense_id;

    // 4. Query Finance Ledger Summary
    console.log('\n--- 4. Query Master Finance Ledger ---');
    const ledgerRes = await fetch(`${BASE_URL}/api/finance/ledger`);
    const ledgerData = await ledgerRes.json();
    assert(ledgerData.success === true, 'Ledger endpoint returned 200 OK');
    assert(typeof ledgerData.summary.gross_revenue === 'number', `Gross Revenue computed: Rs. ${ledgerData.summary.gross_revenue}`);
    assert(typeof ledgerData.summary.total_expenses === 'number', `Total Expenses computed: Rs. ${ledgerData.summary.total_expenses}`);
    assert(typeof ledgerData.summary.net_profit === 'number', `Net Balance computed: Rs. ${ledgerData.summary.net_profit}`);

    // 5. Submit Cash Handover
    console.log('\n--- 5. Cashier Shift Handover to Finance Head ---');
    const handoverRes = await fetch(`${BASE_URL}/api/desk/shift/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: shiftId,
        handover_to: 'Majid Ullah Jan (Head of Finance)',
        notes: 'Handed over Rs. 1 cash collected'
      })
    });
    const handoverData = await handoverRes.json();
    assert(handoverData.success === true, 'Shift handover submitted for approval');

    // 6. Finance Head Approves Handover
    console.log('\n--- 6. Finance Head Approval ---');
    const approveRes = await fetch(`${BASE_URL}/api/finance/shift/approve-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: shiftId,
        approved_by: 'Majid Ullah Jan (Finance Head)',
        notes: 'Physical cash received and verified'
      })
    });
    const approveData = await approveRes.json();
    assert(approveData.success === true, `Shift handover confirmed: ${approveData.message}`);

    // 7. Verify Gate Scanner can scan this cash pass
    console.log('\n--- 7. Gate Scanner Scans Cash Pass ---');
    const gateRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: passData.registration_id, scanned_by: 'Desk Gate Test' })
    });
    const gateData = await gateRes.json();
    assert(gateData.status === 'APPROVED', `Gate scanner accepted on-spot cash pass! (Status: APPROVED)`);

  } catch (err) {
    console.error('Test error:', err);
    assert(false, `Unexpected error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

runFinanceTests();
