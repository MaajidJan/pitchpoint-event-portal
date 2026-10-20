// Live End-to-End Test for Bahria Event Portal
const BASE_URL = 'https://bahria-event-portal.bahria-event-portal.workers.dev';

async function testLive() {
  console.log('🚀 Running Live End-to-End System Test on:', BASE_URL);

  // 1. Register a test IdeaCrux startup online
  const testPhone = '0329' + Math.floor(1000000 + Math.random() * 8999999).toString();
  const testTrx = 'ZIN' + Math.floor(100000 + Math.random() * 900000);
  const fakeSlip = 'data:image/png;base64,' + 'A'.repeat(300);

  console.log(`\n1. Testing Online IdeaCrux Registration with phone: ${testPhone}...`);
  const regRes = await fetch(`${BASE_URL}/api/ideacrux/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      team_name: 'Alpha Innovators',
      members_count: 2,
      leader_name: 'Hamza Khan',
      leader_email: 'hamza.test@gmail.com',
      leader_phone: testPhone,
      leader_dept: 'Computer Science',
      leader_semester: '6th',
      member_2_name: 'Bilal Ahmed',
      member_2_phone: '03001234567',
      startup_name: 'SolarGrid IoT',
      idea_description: 'Smart AI microgrid optimization for campus buildings',
      problem_statement: 'High energy waste in academic labs',
      startup_stage: 'MVP Ready',
      revenue_model: 'B2B SaaS',
      trx_id: testTrx,
      screenshot_base64: fakeSlip
    })
  });
  const regData = await regRes.json();
  console.log('Registration response:', {
    success: regData.success,
    team_id: regData.team_id,
    status: regData.status,
    has_qr: !!regData.pitch_pass_qr,
    message: regData.message
  });

  if (!regData.success || regData.status !== 'PENDING' || regData.pitch_pass_qr) {
    throw new Error('Registration should be PENDING with NO QR pass issued!');
  }
  console.log('✅ Online registration successfully queued in PENDING status without issuing pass.');

  // 2. Check public status lookup for this team
  console.log('\n2. Testing Public Status Lookup...');
  const statusRes = await fetch(`${BASE_URL}/api/ideacrux/status/${regData.team_id}`);
  const statusData = await statusRes.json();
  console.log('Status lookup response:', {
    status: statusData.status,
    has_qr: !!statusData.pitch_pass_qr,
    message: statusData.message
  });
  if (statusData.status !== 'PENDING') {
    throw new Error('Status poll should remain PENDING');
  }
  console.log('✅ Public status confirms team is PENDING manual review.');

  // 3. Staff Login as Finance Head
  console.log('\n3. Testing Finance Head Login...');
  const finLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'finance',
      password: 'finance2026'
    })
  });
  const finLoginData = await finLoginRes.json();
  console.log('Finance login status:', finLoginRes.status, {
    success: finLoginData.success,
    role: finLoginData.user ? finLoginData.user.role : null,
    redirect: finLoginData.redirect_url
  });

  if (!finLoginData.success || !finLoginData.token) {
    throw new Error('Finance login failed! Please check password.');
  }
  const finToken = finLoginData.token;
  console.log('✅ Finance Head authenticated successfully.');

  // 4. Finance checks Pending Verification Queue
  console.log('\n4. Testing /api/finance/pending-requests...');
  const queueRes = await fetch(`${BASE_URL}/api/finance/pending-requests`, {
    headers: { 'Authorization': `Bearer ${finToken}` }
  });
  const queueData = await queueRes.json();
  console.log('Queue count:', queueData.total_pending, 'Crux pending:', queueData.crux_pending_count);

  const foundItem = (queueData.requests || []).find(r => r.id === regData.team_id);
  if (!foundItem) {
    throw new Error(`Team ${regData.team_id} not found in pending verification queue!`);
  }
  console.log('Found pending item in queue:', {
    id: foundItem.id,
    title: foundItem.title,
    applicant: foundItem.applicant_name,
    trx: foundItem.trx_id,
    has_screenshot: foundItem.has_screenshot
  });
  console.log('✅ Pending team found in Finance Verification Queue.');

  // 5. Finance Approves Request
  console.log('\n5. Testing /api/finance/approve-request...');
  const approveRes = await fetch(`${BASE_URL}/api/finance/approve-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${finToken}`
    },
    body: JSON.stringify({
      type: 'IDEACRUX',
      id: regData.team_id,
      notes: 'Zindigi slip verified and confirmed by Finance Head'
    })
  });
  const approveData = await approveRes.json();
  console.log('Approve response:', {
    success: approveData.success,
    status: approveData.status,
    has_qr: !!approveData.pitch_pass_qr,
    message: approveData.message
  });

  if (!approveData.success || approveData.status !== 'VERIFIED' || !approveData.pitch_pass_qr) {
    throw new Error('Finance approval failed or QR pass not generated!');
  }
  console.log('✅ Finance Head successfully approved team and issued digital QR pass.');

  // 6. Verify Public Status now returns VERIFIED and the digital pass
  console.log('\n6. Verifying Public Status after approval...');
  const afterStatusRes = await fetch(`${BASE_URL}/api/ideacrux/status/${regData.team_id}`);
  const afterStatusData = await afterStatusRes.json();
  console.log('Post-approval status:', {
    status: afterStatusData.status,
    has_qr: !!afterStatusData.pitch_pass_qr,
    message: afterStatusData.message
  });
  if (afterStatusData.status !== 'VERIFIED' || !afterStatusData.pitch_pass_qr) {
    throw new Error('Public status should now be VERIFIED with digital pass QR!');
  }
  console.log('✅ Founder can now download and view their verified Pitch Pass!');

  // 7. Test Role-Based Access Control: Finance cannot access /api/admin/*
  console.log('\n7. Testing RBAC Security: Finance role restricted from Admin routes...');
  const rbacRes = await fetch(`${BASE_URL}/api/admin/staff/list`, {
    headers: { 'Authorization': `Bearer ${finToken}` }
  });
  console.log('RBAC check status for Finance accessing /api/admin/staff/list:', rbacRes.status);
  if (rbacRes.status !== 403) {
    throw new Error('Finance role should receive 403 Forbidden on /api/admin/* routes!');
  }
  console.log('✅ RBAC enforced: Finance user is blocked from admin staff/management routes.');

  console.log('\n🎉 ALL LIVE END-TO-END TESTS PASSED WITH 100% SUCCESS!');
}

testLive().catch(err => {
  console.error('\n❌ Live test failed:', err.message);
  process.exit(1);
});
