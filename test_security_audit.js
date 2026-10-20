// Comprehensive Penetration & Security Verification Suite
const BASE_URL = 'https://bahria-event-portal.bahria-event-portal.workers.dev';

async function runSecurityTests() {
  console.log('🛡️ Starting Comprehensive Security & Anti-Fraud Penetration Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --- SECTION 1: Unauthenticated Browser Console / Serverless Attacks ---
  console.log('--- 1. Testing Unauthenticated Serverless API Invocations (Must be 401) ---');
  
  const protectedEndpoints = [
    { method: 'GET', path: '/api/admin/overview', desc: 'Admin Overview' },
    { method: 'POST', path: '/api/admin/manual-verify', body: { id: 'test' }, desc: 'Admin Manual Verify' },
    { method: 'POST', path: '/api/admin/direct-register', body: { full_name: 'Hacker' }, desc: 'Admin Direct Register' },
    { method: 'GET', path: '/api/admin/staff/list', desc: 'Staff User List' },
    { method: 'POST', path: '/api/admin/staff/save', body: { username: 'hacker' }, desc: 'Staff Create/Save' },
    { method: 'POST', path: '/api/admin/staff/delete', body: { id: 'usr-1' }, desc: 'Staff Delete' },
    { method: 'GET', path: '/api/finance/overview', desc: 'Finance Overview' },
    { method: 'GET', path: '/api/finance/ledger', desc: 'Finance Ledger' },
    { method: 'POST', path: '/api/finance/expense/add', body: { amount: 100 }, desc: 'Finance Add Expense' },
    { method: 'POST', path: '/api/finance/shift/approve-handover', body: { shift_id: 'sh-1' }, desc: 'Finance Approve Handover' },
    { method: 'POST', path: '/api/desk/shift/open', body: { cashier_name: 'Hacker' }, desc: 'Desk Shift Open' },
    { method: 'POST', path: '/api/desk/register', body: { full_name: 'Hacker' }, desc: 'Desk Cash Register' },
    { method: 'POST', path: '/api/ticket/verify-gate', body: { ticket_id: 'BU-123' }, desc: 'Gate Check-in Turnstile' },
    { method: 'POST', path: '/api/webhook/payment', body: { trx_id: 'FAKE123', amount: 100 }, desc: 'Payment Webhook without secret' }
  ];

  for (const ep of protectedEndpoints) {
    const opts = {
      method: ep.method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (ep.body) opts.body = JSON.stringify(ep.body);

    const res = await fetch(`${BASE_URL}${ep.path}`, opts);
    assert(res.status === 401, `${ep.desc} (${ep.method} ${ep.path}) strictly returned 401 Unauthorized`);
  }

  // --- SECTION 2: Forged / Tampered Token Attack ---
  console.log('\n--- 2. Testing Cryptographic HMAC Token Forgery Attack ---');
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJ1c2VybmFtZSI6ImhhY2tlciIsInJvbGUiOiJBRE1JTiIsImV4cCI6OTk5OTk5OTk5OX0.fake_forged_signature_123';
  const forgedRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { 'Authorization': `Bearer ${fakeToken}` }
  });
  assert(forgedRes.status === 401, `Forged HMAC token was rejected with 401 Unauthorized`);

  // --- SECTION 3: Role Separation & Privilege Escalation ---
  console.log('\n--- 3. Testing Role Separation & Unauthorized Privilege Escalation ---');

  // Login as Head of Finance
  const finLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'finance', password: 'finance2026' })
  });
  const finLoginData = await finLoginRes.json();
  assert(finLoginRes.ok && finLoginData.success && finLoginData.token, 'Finance user logged in successfully and received signed HMAC token');

  const finToken = finLoginData.token;

  // Finance tries accessing Admin-only staff list
  const finAdminRes = await fetch(`${BASE_URL}/api/admin/staff/list`, {
    headers: { 'Authorization': `Bearer ${finToken}` }
  });
  assert(finAdminRes.status === 403, `Finance token blocked from Admin staff list with 403 Forbidden`);

  // Finance tries accessing Cashier-only desk register
  const finDeskRes = await fetch(`${BASE_URL}/api/desk/register`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${finToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Test' })
  });
  assert(finDeskRes.status === 403, `Finance token blocked from Cashier desk with 403 Forbidden`);

  // Finance accesses Finance overview (Permitted)
  const finOverviewRes = await fetch(`${BASE_URL}/api/finance/overview`, {
    headers: { 'Authorization': `Bearer ${finToken}` }
  });
  assert(finOverviewRes.status === 200, `Finance token successfully accesses Finance overview (200 OK)`);

  // Login as Cashier
  const cashLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cashier1', password: 'cash123' })
  });
  const cashLoginData = await cashLoginRes.json();
  const cashToken = cashLoginData.token;

  // Cashier tries accessing Finance ledger
  const cashLedgerRes = await fetch(`${BASE_URL}/api/finance/ledger`, {
    headers: { 'Authorization': `Bearer ${cashToken}` }
  });
  assert(cashLedgerRes.status === 403, `Cashier token blocked from Finance ledger with 403 Forbidden`);

  // --- SECTION 4: Legitimate Admin Access ---
  console.log('\n--- 4. Testing Legitimate Admin Login & Full Privileges ---');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maajid', password: '@jan987' })
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.ok && adminLoginData.success && adminLoginData.token, 'Admin (maajid) logged in successfully with new password');

  const adminToken = adminLoginData.token;
  const adminOverviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminOverviewRes.status === 200, 'Admin token successfully accessed Admin Overview (200 OK)');

  // --- SECTION 5: Webhook Authentication with Secret ---
  console.log('\n--- 5. Testing Payment Webhook Secret Verification ---');
  const validTrx = `TRX${Date.now()}`;
  const validWebhookRes = await fetch(`${BASE_URL}/api/webhook/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': 'bahria-secret-token-2026'
    },
    body: JSON.stringify({
      trx_id: validTrx,
      amount: 1000.0,
      sender_name: 'TEST SENDER',
      source: 'SMS'
    })
  });
  const webhookData = await validWebhookRes.json();
  assert(validWebhookRes.ok && webhookData.success, `Payment webhook accepted valid x-webhook-secret header (TRX: ${validTrx})`);

  // --- SECTION 6: Anti-Pass-Theft 2-Factor Pass Retrieval ---
  console.log('\n--- 6. Testing Pass Theft & Confidential Lookup Protection ---');
  const studentRoll = `01-134211-${Math.floor(100 + Math.random() * 900)}`;
  const studentPhone = '03175230209';

  // Register a student with cash ticket via authenticated desk
  const cashRegRes = await fetch(`${BASE_URL}/api/desk/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cashToken}`
    },
    body: JSON.stringify({
      full_name: 'Ali Ahmed Secured',
      roll_no: studentRoll,
      phone: studentPhone,
      department: 'CS',
      ticket_type: 'OFFICIAL_ENTRY_PASS',
      amount_received: 1000.0,
      cashier_name: 'Station 1'
    })
  });
  const cashRegData = await cashRegRes.json();
  assert(cashRegRes.ok && cashRegData.success, `Cash pass created for student (${studentRoll})`);

  const ticketId = cashRegData.registration_id;

  // Attack: Classmate attempts to steal pass by searching roll number alone
  const theftRes = await fetch(`${BASE_URL}/api/ticket/lookup?query=${encodeURIComponent(studentRoll)}`);
  const theftData = await theftRes.json();
  assert(theftRes.status === 400 && theftData.requires_phone_verification === true, 
    'Roll-only search blocked! Rejects unauthorized access and requires phone verification');

  // Legitimate: Student enters both Roll Number AND Phone
  const legitRes = await fetch(`${BASE_URL}/api/ticket/lookup?roll_no=${encodeURIComponent(studentRoll)}&phone=${encodeURIComponent(studentPhone)}`);
  const legitData = await legitRes.json();
  assert(legitRes.ok && legitData.success && legitData.registration.id === ticketId, 
    '2-Factor verified search succeeded! Student retrieved their own pass');

  // Legitimate: Student enters confidential Ticket ID
  const ticketIdRes = await fetch(`${BASE_URL}/api/ticket/lookup?ticket_id=${encodeURIComponent(ticketId)}`);
  const ticketIdData = await ticketIdRes.json();
  assert(ticketIdRes.ok && ticketIdData.success && ticketIdData.registration.id === ticketId, 
    'Direct Ticket ID search succeeded');

  // --- SECTION 7: Gate Scanner Turnstile Anti-Fraud ---
  console.log('\n--- 7. Testing Gate Turnstile Admission & Anti-Fraud Duplicate Protection ---');
  
  // Login as gate scanner
  const scanLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'scanner1', password: 'gate123' })
  });
  const scanLoginData = await scanLoginRes.json();
  const scannerToken = scanLoginData.token;

  // Turnstile Attack: Someone tries to admit using just roll number on gate scanner
  const rollGateRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scannerToken}`
    },
    body: JSON.stringify({ ticket_id: studentRoll, allow_manual_roll: false })
  });
  assert(rollGateRes.status === 403, 'Bare roll number at turnstile rejected with 403 Security Alert');

  // Legitimate Gate Check-in with authentic ticket ID
  const gateCheckinRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scannerToken}`
    },
    body: JSON.stringify({ ticket_id: ticketId, scanned_by: 'Gate Turnstile 1' })
  });
  const gateCheckinData = await gateCheckinRes.json();
  assert(gateCheckinRes.ok && gateCheckinData.status === 'APPROVED', 
    'First-time genuine pass admission GRANTED (Status: APPROVED)');

  // Fraudulent Re-use Attack: Attendee tries passing ticket back to friend
  const gateRescanRes = await fetch(`${BASE_URL}/api/ticket/verify-gate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scannerToken}`
    },
    body: JSON.stringify({ ticket_id: ticketId, scanned_by: 'Gate Turnstile 1' })
  });
  const gateRescanData = await gateRescanRes.json();
  assert(gateRescanData.status === 'ALREADY_USED', 
    'Duplicate entry attempt BLOCKED (Status: ALREADY_USED, Fraud Alert Recorded)');

  // --- SUMMARY ---
  console.log('\n======================================================');
  console.log(`🎯 TOTAL TESTS: ${passed + failed}`);
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log('======================================================');

  if (failed === 0) {
    console.log('\n🏆 ALL SECURITY CHECKS PASSED: Enterprise hardening 100% verified!\n');
    process.exit(0);
  } else {
    console.error('\n⚠️ Some security checks failed.\n');
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
