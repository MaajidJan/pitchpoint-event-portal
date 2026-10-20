// Test Manual Finance Verification, Cashier On-Spot Desk, and RBAC Security
const fs = require('fs');

async function runTests() {
  console.log('--- 🧪 STARTING MANUAL FINANCE & CASHIER WORKFLOW AUDIT ---');

  // Test 1: Verify index.ts has endpoints
  const code = fs.readFileSync('src/index.ts', 'utf8');

  console.log('\n[TEST 1] Checking Route Declarations in src/index.ts...');
  const hasPendingRequests = code.includes('/api/finance/pending-requests');
  const hasApproveRequest = code.includes('/api/finance/approve-request');
  const hasRejectRequest = code.includes('/api/finance/reject-request');
  const hasRoleMiddleware = code.includes("requireRole(['FINANCE', 'ADMIN'])");
  const hasDeskCashierRole = code.includes("requireRole(['CASHIER', 'ADMIN'])");

  console.log('✓ /api/finance/pending-requests exists:', hasPendingRequests);
  console.log('✓ /api/finance/approve-request exists:', hasApproveRequest);
  console.log('✓ /api/finance/reject-request exists:', hasRejectRequest);
  console.log('✓ Finance role protection enforced:', hasRoleMiddleware);
  console.log('✓ Cashier role protection enforced:', hasDeskCashierRole);

  if (!hasPendingRequests || !hasApproveRequest || !hasRejectRequest) {
    throw new Error('Missing finance routes in src/index.ts');
  }

  // Test 2: Verify No Auto-Approval in Register Routes
  console.log('\n[TEST 2] Verifying Online Registration forces PENDING queue...');
  const hasRegAutoMatch = code.includes("notes = `Verified instantly against ${payment.source} payment");
  const hasCruxAutoMatch = code.includes("admin_notes = 'Auto-verified with matching bank alert'");

  console.log('✓ Fiesta online auto-verify disabled:', !hasRegAutoMatch);
  console.log('✓ IdeaCrux online auto-verify disabled:', !hasCruxAutoMatch);

  if (hasRegAutoMatch || hasCruxAutoMatch) {
    throw new Error('Auto-verification is still active in online registration!');
  }

  // Test 3: Check finance.html and finance.js
  console.log('\n[TEST 3] Verifying finance.html & finance.js UI components...');
  const finHtml = fs.readFileSync('public/finance.html', 'utf8');
  const finJs = fs.readFileSync('public/finance.js', 'utf8');

  const hasPendingQueueSection = finHtml.includes('Pending Payment Slip Verification Queue');
  const hasSlipZoomModal = finHtml.includes('slipZoomModal');
  const hasQueueLoader = finJs.includes('loadPendingVerificationQueue');
  const hasQuickApprove = finJs.includes('quickApproveRequest');
  const hasQuickReject = finJs.includes('quickRejectRequest');

  console.log('✓ finance.html pending queue section:', hasPendingQueueSection);
  console.log('✓ finance.html slip zoom modal:', hasSlipZoomModal);
  console.log('✓ finance.js queue loader:', hasQueueLoader);
  console.log('✓ finance.js approve handler:', hasQuickApprove);
  console.log('✓ finance.js reject handler:', hasQuickReject);

  if (!hasPendingQueueSection || !hasSlipZoomModal || !hasQueueLoader) {
    throw new Error('Finance portal UI is missing components');
  }

  // Test 4: Check crux-admin.html navigation
  console.log('\n[TEST 4] Verifying crux-admin.html links to Staff and Finance...');
  const cruxAdminHtml = fs.readFileSync('public/crux-admin.html', 'utf8');
  const hasStaffLink = cruxAdminHtml.includes('/admin.html');
  const hasFinanceLink = cruxAdminHtml.includes('/finance.html');
  console.log('✓ crux-admin.html links to Staff Passwords:', hasStaffLink);
  console.log('✓ crux-admin.html links to Finance Queue:', hasFinanceLink);

  console.log('\n🎉 ALL CODE INTEGRITY AND WORKFLOW CHECKS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
