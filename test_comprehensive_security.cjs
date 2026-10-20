const https = require('https');

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

async function runAudit() {
  console.log('🔒 STARTING COMPREHENSIVE SECURITY & AUDIT VERIFICATION...\n');
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

  // 1. Security Headers Audit
  console.log('--- 1. HTTP Security Headers Audit ---');
  const homeRes = await request('/api/config');
  assert('X-Frame-Options is DENY', homeRes.headers['x-frame-options'] === 'DENY');
  assert('X-Content-Type-Options is nosniff', homeRes.headers['x-content-type-options'] === 'nosniff');
  assert('Strict-Transport-Security is present', !!homeRes.headers['strict-transport-security']);
  assert('Content-Security-Policy is present', !!homeRes.headers['content-security-policy']);
  assert('Permissions-Policy is present', !!homeRes.headers['permissions-policy']);

  // 2. Reject registration without payment proof image
  console.log('\n--- 2. Registration Proof Enforcement Audit ---');
  const noImageRes = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      team_name: 'Alpha Innovators',
      members_count: 2,
      leader_name: 'Usman Ali',
      leader_email: 'usman.test@gmail.com',
      leader_phone: '03292092724',
      leader_dept: 'CS, 3rd Year',
      member_2_name: 'Sarah Khan',
      member_2_phone: '03001234567',
      startup_name: 'SolarGrid AI',
      idea_description: 'An AI-powered grid distribution model for renewable solar microgrids.',
      problem_statement: 'High load transmission losses in urban residential areas.',
      trx_id: 'TRX99887766',
      screenshot_base64: '' // Empty screenshot proof!
    }
  });
  assert('Reject registration without screenshot proof', noImageRes.statusCode === 400 && noImageRes.json?.error?.includes('screenshot'), JSON.stringify(noImageRes.json));

  const validImageBase64 = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(25);

  // 3. Reject registration without valid TRX ID
  const noTrxRes = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      team_name: 'Alpha Innovators',
      members_count: 2,
      leader_name: 'Usman Ali',
      leader_email: 'usman.test@gmail.com',
      leader_phone: '03292092724',
      leader_dept: 'CS, 3rd Year',
      member_2_name: 'Sarah Khan',
      member_2_phone: '03001234567',
      startup_name: 'SolarGrid AI',
      idea_description: 'An AI-powered grid distribution model for renewable solar microgrids.',
      problem_statement: 'High load transmission losses in urban residential areas.',
      trx_id: '12', // Too short / invalid TRX!
      screenshot_base64: validImageBase64
    }
  });
  assert('Reject registration with invalid TRX ID if provided', noTrxRes.statusCode === 400 && noTrxRes.json?.error?.includes('Transaction ID'), JSON.stringify(noTrxRes.json));

  // 4. Reject registration with non-gmail email
  console.log('\n--- 3. Strict Gmail & Phone Validation Audit ---');
  const nonGmailRes = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      team_name: 'Alpha Innovators',
      members_count: 2,
      leader_name: 'Usman Ali',
      leader_email: 'usman.test@yahoo.com', // Non-Gmail!
      leader_phone: '03292092724',
      leader_dept: 'CS, 3rd Year',
      member_2_name: 'Sarah Khan',
      member_2_phone: '03001234567',
      startup_name: 'SolarGrid AI',
      idea_description: 'An AI-powered grid distribution model for renewable solar microgrids.',
      problem_statement: 'High load transmission losses in urban residential areas.',
      trx_id: 'TRX99887766',
      screenshot_base64: validImageBase64
    }
  });
  assert('Reject non-gmail email address', nonGmailRes.statusCode === 400 && nonGmailRes.json?.error?.includes('Gmail'), JSON.stringify(nonGmailRes.json));

  // 5. Reject invalid Pakistani phone number
  const invalidPhoneRes = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      team_name: 'Alpha Innovators',
      members_count: 2,
      leader_name: 'Usman Ali',
      leader_email: 'usman.test@gmail.com',
      leader_phone: '05123456789', // Not a 03 mobile number!
      leader_dept: 'CS, 3rd Year',
      member_2_name: 'Sarah Khan',
      member_2_phone: '03001234567',
      startup_name: 'SolarGrid AI',
      idea_description: 'An AI-powered grid distribution model for renewable solar microgrids.',
      problem_statement: 'High load transmission losses in urban residential areas.',
      trx_id: 'TRX99887766',
      screenshot_base64: validImageBase64
    }
  });
  assert('Reject non-Pakistani/invalid mobile number', invalidPhoneRes.statusCode === 400 && invalidPhoneRes.json?.error?.includes('Phone'), JSON.stringify(invalidPhoneRes.json));

  // 6. Valid Registration: Must have status PENDING and EMPTY pass QR
  console.log('\n--- 4. Valid Registration & Pass Generation Prevention ---');
  const validRegRes = await request('/api/ideacrux/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      team_name: 'Vanguard Systems',
      members_count: 2,
      leader_name: 'Taimoor Shah',
      leader_email: 'taimoor.vanguard@gmail.com',
      leader_phone: '03175230209',
      leader_dept: 'Software Engineering',
      member_2_name: 'Bilal Ahmad',
      member_2_phone: '03011234567',
      startup_name: 'MedAI Diagnostics',
      idea_description: 'Autonomous radiograph preliminary screening platform for rural health clinics in Pakistan.',
      problem_statement: 'Severe shortage of qualified radiologists in non-metropolitan districts.',
      trx_id: 'TXN' + Date.now().toString().slice(-8),
      screenshot_base64: validImageBase64
    }
  });
  assert('Valid registration succeeds', validRegRes.statusCode === 200 && validRegRes.json?.success === true, JSON.stringify(validRegRes.json));
  assert('Pending registration has PENDING status', validRegRes.json?.status === 'PENDING', `Status: ${validRegRes.json?.status}`);
  assert('Pending registration generates NO QR pass', validRegRes.json?.pitch_pass_qr === '', `Pass QR: ${validRegRes.json?.pitch_pass_qr}`);

  // Check team status query also gives no pass
  if (validRegRes.json?.team_id) {
    const statusRes = await request(`/api/ideacrux/status/${validRegRes.json.team_id}`);
    assert('Status query returns team details', statusRes.statusCode === 200);
    assert('Status query confirms team is PENDING', statusRes.json?.team?.status === 'PENDING');
    assert('Status query confirms NO pass QR is rendered', !statusRes.json?.team?.pitch_pass_qr);
  }

  // 7. Staff Authentication with Hash & Route Protection
  console.log('\n--- 5. Staff Auth & Route Access Control ---');
  // Attempt unauthorized access to admin endpoint
  const unauthRes = await request('/api/admin/ideacrux/teams');
  assert('Block unauthenticated request to admin endpoint', unauthRes.statusCode === 401);

  // Login with correct hashed password
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'maajid', password: 'admin2026' }
  });
  assert('Staff login with hashed password succeeds', loginRes.statusCode === 200 && loginRes.json?.success === true && !!loginRes.json?.token);

  // Access admin endpoint with valid token
  if (loginRes.json?.token) {
    const adminRes = await request('/api/admin/ideacrux/teams', {
      headers: { 'Authorization': `Bearer ${loginRes.json.token}` }
    });
    assert('Access admin endpoint with valid admin token', adminRes.statusCode === 200 && adminRes.json?.success === true);
  }

  // Login as cashier and attempt admin endpoint (Role-Based Access Control)
  const cashierLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'cashier1', password: 'cashier2026' }
  });
  assert('Cashier login succeeds', cashierLoginRes.statusCode === 200 && cashierLoginRes.json?.success === true);

  if (cashierLoginRes.json?.token) {
    const rbacRes = await request('/api/admin/ideacrux/teams', {
      headers: { 'Authorization': `Bearer ${cashierLoginRes.json.token}` }
    });
    assert('Cashier role is FORBIDDEN from admin endpoints (RBAC)', rbacRes.statusCode === 403);
  }

  // Cleanup test team from remote DB
  if (validRegRes.json?.team_id) {
    try {
      const { execSync } = require('child_process');
      execSync(`npx wrangler d1 execute DB --remote --command="DELETE FROM ideacrux_teams WHERE id='${validRegRes.json.team_id}'; DELETE FROM audit_logs WHERE reference_id='${validRegRes.json.team_id}';"`, { stdio: 'pipe' });
    } catch {}
  }

  console.log(`\n========================================`);
  console.log(`AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`========================================\n`);

  if (failCount > 0) process.exit(1);
}

runAudit().catch(err => {
  console.error('Audit run error:', err);
  process.exit(1);
});
