const https = require('https');
const { execSync } = require('child_process');

const BASE_URL = 'https://bahria-event-portal.bahria-event-portal.workers.dev';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Generate valid base64 image data URL (> 1000 chars)
const validFakeImageBase64 = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(25);

async function runFakeAudit() {
  console.log('🛡️ RUNNING LIVE ANTI-FRAUD & PAYMENT PROOF VALIDATION AUDIT...\n');
  let passCount = 0;
  let failCount = 0;

  function assert(name, condition, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passCount++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${extraInfo ? `-> ${extraInfo}` : ''}`);
      failCount++;
    }
  }

  // Base valid payload template
  const createPayload = (overrides = {}) => ({
    is_bu_student: true,
    team_name: 'Audit Security Venture',
    members_count: 2,
    leader_name: 'Maajid Tester',
    leader_email: 'tester.audit@gmail.com',
    leader_phone: '03129876543',
    leader_dept: 'Software Engineering',
    leader_semester: '7th',
    member_2_name: 'Zaid Co-Founder',
    member_2_phone: '03331122334',
    startup_name: 'SecurAI Enterprise',
    idea_description: 'An AI-powered zero-trust cybersecurity validation gateway for universities.',
    problem_statement: 'High risk of fake registrations and manual voucher tampering during campus hackathons.',
    startup_stage: 'Working MVP',
    revenue_model: 'B2B Annual Enterprise Subscription',
    pitch_deck_ready: 'Yes',
    available_on_day: 'Yes',
    trx_id: 'TRX987654321',
    screenshot_base64: validFakeImageBase64,
    ...overrides
  });

  // 1. Missing screenshot
  console.log('--- 1. Missing / Corrupted Screenshot Tests ---');
  const resNoScreenshot = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: createPayload({ screenshot_base64: null })
  });
  assert('Reject null screenshot_base64', resNoScreenshot.statusCode === 400 && resNoScreenshot.json?.error?.includes('Payment proof screenshot is strictly required'));

  const resShortScreenshot = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: createPayload({ screenshot_base64: 'data:image/png;base64,SHORT' })
  });
  assert('Reject tiny/fake screenshot string (< 1000 chars)', resShortScreenshot.statusCode === 400);

  const resNonImageScreenshot = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: createPayload({ screenshot_base64: 'data:text/plain;base64,' + 'A'.repeat(1200) })
  });
  assert('Reject non-image MIME type (text/plain)', resNonImageScreenshot.statusCode === 400);

  // 2. Fake / Dummy TRX Tests
  console.log('\n--- 2. Fake / Dummy / Suspicious TRX Tests ---');
  const fakeTrxTests = [
    { trx: '000000', label: 'Reject all zeros (000000)' },
    { trx: '111111', label: 'Reject repetitive digits (111111)' },
    { trx: '123456', label: 'Reject sequential numbers (123456)' },
    { trx: 'ABCDEF', label: 'Reject alphabetic dummy (ABCDEF)' },
    { trx: 'TESTING', label: 'Reject placeholder word (TESTING)' },
    { trx: 'NONE', label: 'Reject short word (NONE)' },
    { trx: 'NOTPAID', label: 'Reject fake text (NOTPAID)' }
  ];

  for (const t of fakeTrxTests) {
    const res = await request('/api/ideacrux/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: createPayload({ trx_id: t.trx })
    });
    assert(t.label, res.statusCode === 400 && res.json?.error?.includes('Transaction ID'));
  }

  // 3. Valid Registration & Duplicate TRX Detection
  console.log('\n--- 3. Legitimate Registration & Duplicate TRX Prevention ---');
  const uniqueTrx = `AUDIT${Date.now().toString().slice(-6)}`;
  const resValid = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: createPayload({ trx_id: uniqueTrx })
  });
  assert('Valid submission succeeds', resValid.statusCode === 200 && resValid.json?.success === true);
  assert('Initial status is strictly PENDING', resValid.json?.status === 'PENDING');
  assert('NO QR admission pass generated on registration', !resValid.json?.pitch_pass_qr);

  const validTeamId = resValid.json?.team_id;

  // Duplicate submission with the same TRX ID
  const resDupTrx = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: createPayload({
      team_name: 'Second Hacker Team',
      leader_phone: '03009988776',
      leader_email: 'secondteam@gmail.com',
      trx_id: uniqueTrx
    })
  });
  assert('Reject reused/duplicate TRX ID across teams', resDupTrx.statusCode === 400 && resDupTrx.json?.error?.includes('already been submitted'));

  // 4. Verify Public Pages have NO Cashier Desk QR or Internal Desk links
  console.log('\n--- 4. Public Web Pages Content Inspection ---');
  const indexHtmlRes = await request('/');
  assert('Index page does NOT contain qr_cashier_desk.svg', !indexHtmlRes.body.includes('qr_cashier_desk.svg'));
  assert('Index page does NOT contain /crux-desk.html link', !indexHtmlRes.body.includes('/crux-desk.html'));
  assert('Index page does NOT contain ON-SPOT CASHIER DESK text', !indexHtmlRes.body.includes('ON-SPOT CASHIER DESK'));

  const ideacruxHtmlRes = await request('/ideacrux.html');
  assert('Ideacrux page does NOT contain qr_cashier_desk.svg', !ideacruxHtmlRes.body.includes('qr_cashier_desk.svg'));
  assert('Ideacrux page does NOT contain /crux-desk.html link', !ideacruxHtmlRes.body.includes('/crux-desk.html'));
  assert('Ideacrux page does NOT contain ON-SPOT CASHIER DESK text', !ideacruxHtmlRes.body.includes('ON-SPOT CASHIER DESK'));

  // 5. Clean up the test registration from remote D1
  if (validTeamId) {
    console.log('\n--- 5. Remote D1 Database Cleanup ---');
    try {
      execSync(`npx wrangler d1 execute DB --remote --command="DELETE FROM ideacrux_teams WHERE id='${validTeamId}'; DELETE FROM audit_logs WHERE reference_id='${validTeamId}';"`, { stdio: 'pipe' });
      assert('Audit registration cleaned from remote D1', true);
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
  }

  console.log(`\n========================================`);
  console.log(`AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`========================================\n`);
  
  if (failCount > 0) process.exit(1);
}

runFakeAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
