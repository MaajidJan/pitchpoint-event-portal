const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../public/finance.js');
let js = fs.readFileSync(jsPath, 'utf8');

// Replace card rendering action buttons to include WhatsApp quick contact
const oldCardActions = `        <div style="display: flex; flex-direction: column; gap: 0.5rem; justify-content: center;">
          <div style="text-align: right; margin-bottom: 0.2rem;">
            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Amount:</span>
            <strong style="color: #34d399; font-size: 1.1rem; margin-left: 4px;">Rs. \${(item.amount || 1000).toLocaleString()}</strong>
          </div>
          <button class="btn btn-emerald btn-sm" style="font-weight: 700; width: 100%;" onclick="quickApproveRequest('\${item.type}', '\${item.id}', '\${escapeHtml(item.title)}')">
            ✓ Approve & Pass
          </button>
          <button class="btn btn-outline btn-sm" style="color: #f87171; border-color: rgba(239, 68, 68, 0.35); width: 100%;" onclick="quickRejectRequest('\${item.type}', '\${item.id}', '\${escapeHtml(item.title)}')">
            ✕ Reject
          </button>
        </div>`;

const newCardActions = `        <div style="display: flex; flex-direction: column; gap: 0.45rem; justify-content: center;">
          <div style="text-align: right; margin-bottom: 0.2rem;">
            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Fee:</span>
            <strong style="color: #34d399; font-size: 1.1rem; margin-left: 4px;">Rs. \${(item.amount || 1000).toLocaleString()}</strong>
          </div>
          <button class="btn btn-emerald btn-sm" style="font-weight: 700; width: 100%;" onclick="quickApproveRequest('\${item.type}', '\${item.id}', '\${escapeHtml(item.title)}')">
            ✓ Accept & Approve
          </button>
          <button class="btn btn-outline btn-sm" style="color: #f87171; border-color: rgba(239, 68, 68, 0.35); width: 100%;" onclick="quickRejectRequest('\${item.type}', '\${item.id}', '\${escapeHtml(item.title)}')">
            ✕ Reject Slip
          </button>
          <button class="btn btn-outline btn-sm" style="color: #25d366; border-color: rgba(37, 211, 102, 0.4); font-size: 0.78rem;" onclick="openWhatsAppChat('\${item.id}')">
            📲 WhatsApp Applicant
          </button>
        </div>`;

if (js.includes(oldCardActions)) {
  js = js.replace(oldCardActions, newCardActions);
  console.log('✓ Updated card action buttons with WhatsApp button');
} else {
  console.warn('Could not find oldCardActions directly, will check variations');
}

// Update quickApproveRequest and quickRejectRequest to trigger WhatsApp confirmation prompt
const oldApproveFunc = `async function quickApproveRequest(type, id, title) {
  const notes = prompt(\`Confirm approval for '\${title}'?\\nEnter verification note (optional):\`, 'Payment slip verified & confirmed');
  if (notes === null) return; // User cancelled

  try {
    const res = await fetch('/api/finance/approve-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, notes })
    });
    const data = await res.json();
    if (data.success) {
      alert(\`✅ \${data.message || 'Approved successfully!'}\`);
      loadPendingVerificationQueue();
      loadFinanceData();
    } else {
      alert('Error: ' + (data.error || 'Failed to approve.'));
    }
  } catch (err) {
    alert('Server error during approval.');
  }
}`;

const newApproveFunc = `async function quickApproveRequest(type, id, title) {
  const item = allPendingRequests.find(r => r.id === id);
  const notes = prompt(\`Confirm acceptance of payment for '\${title}'?\\nEnter verification note (optional):\`, 'Payment slip verified & confirmed');
  if (notes === null) return; // User cancelled

  try {
    const res = await fetch('/api/finance/approve-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, notes })
    });
    const data = await res.json();
    if (data.success) {
      alert(\`✅ \${data.message || 'Approved successfully!'}\`);
      loadPendingVerificationQueue();
      loadFinanceData();

      // Offer immediate WhatsApp Confirmation Dispatch
      if (item && item.phone && confirm(\`Payment accepted! Send WhatsApp confirmation message to \${item.applicant_name} (\${item.phone}) now?\`)) {
        sendPaymentConfirmedMessage(item);
      }
    } else {
      alert('Error: ' + (data.error || 'Failed to approve.'));
    }
  } catch (err) {
    alert('Server error during approval.');
  }
}`;

if (js.includes(oldApproveFunc)) {
  js = js.replace(oldApproveFunc, newApproveFunc);
  console.log('✓ Updated quickApproveRequest with WhatsApp prompt');
}

const oldRejectFunc = `async function quickRejectRequest(type, id, title) {
  const reason = prompt(\`Reject payment slip for '\${title}'?\\nEnter rejection reason:\`, 'Fake or unverified receipt screenshot');
  if (reason === null) return; // User cancelled
  if (!reason.trim()) {
    alert('Please enter a rejection reason.');
    return;
  }

  try {
    const res = await fetch('/api/finance/reject-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, reason })
    });
    const data = await res.json();
    if (data.success) {
      alert('✕ Request rejected.');
      loadPendingVerificationQueue();
      loadFinanceData();
    } else {
      alert('Error: ' + (data.error || 'Failed to reject.'));
    }
  } catch (err) {
    alert('Server error during rejection.');
  }
}`;

const newRejectFunc = `async function quickRejectRequest(type, id, title) {
  const item = allPendingRequests.find(r => r.id === id);
  const reason = prompt(\`Reject payment slip for '\${title}'?\\nEnter rejection reason:\`, 'Fake or unverified receipt screenshot');
  if (reason === null) return; // User cancelled
  if (!reason.trim()) {
    alert('Please enter a rejection reason.');
    return;
  }

  try {
    const res = await fetch('/api/finance/reject-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, reason })
    });
    const data = await res.json();
    if (data.success) {
      alert('✕ Request rejected.');
      loadPendingVerificationQueue();
      loadFinanceData();

      // Offer immediate WhatsApp Rejection Notice Dispatch
      if (item && item.phone && confirm(\`Send WhatsApp notice to \${item.applicant_name} (\${item.phone}) explaining that payment was NOT received?\`)) {
        sendPaymentRejectedMessage(item, reason);
      }
    } else {
      alert('Error: ' + (data.error || 'Failed to reject.'));
    }
  } catch (err) {
    alert('Server error during rejection.');
  }
}`;

if (js.includes(oldRejectFunc)) {
  js = js.replace(oldRejectFunc, newRejectFunc);
  console.log('✓ Updated quickRejectRequest with WhatsApp notice prompt');
}

// Append WhatsApp messaging functions
const messagingFunctions = `
// ==========================================
// WhatsApp Direct Messaging Dispatches for Finance
// ==========================================

function cleanPakPhoneForWa(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\\D/g, '');
  if (digits.startsWith('0')) digits = '92' + digits.slice(1);
  if (!digits.startsWith('92') && digits.length === 10) digits = '92' + digits;
  return digits;
}

function sendPaymentConfirmedMessage(item) {
  const waPhone = cleanPakPhoneForWa(item.phone);
  if (!waPhone) {
    alert('No valid phone number for this applicant.');
    return;
  }

  const msg = [
    '🎉 *IDEACRUX 2025 // PAYMENT RECEIVED & APPROVED*',
    '',
    \`Assalam-o-Alaikum \${item.applicant_name},\`,
    '',
    \`We have verified and received your registration fee of *Rs. 1,000* for team: *\${item.title}*.\`,
    \`Transaction Reference: \${item.trx_id || 'VERIFIED'}\`,
    '',
    '✅ *Your official digital Pitch Pass is now active!*',
    'You can view and download your verified entry pass here:',
    'https://bahria-event-portal.bahria-event-portal.workers.dev/ideacrux',
    '',
    '📅 *Event Date:* 15 October 2026',
    '📍 *Venue:* Al-Beruni Auditorium, BSEAS H-11 Campus',
    '',
    'Regards,',
    'Head of Finance & Treasury',
    'IDEACRUX 2025 | Zindigi Prize'
  ].join('\\n');

  window.open(\`https://wa.me/\${waPhone}?text=\${encodeURIComponent(msg)}\`, '_blank');
}

function sendPaymentRejectedMessage(item, reason) {
  const waPhone = cleanPakPhoneForWa(item.phone);
  if (!waPhone) {
    alert('No valid phone number for this applicant.');
    return;
  }

  const msg = [
    '⚠️ *IDEACRUX 2025 // PAYMENT NOTIFICATION*',
    '',
    \`Assalam-o-Alaikum \${item.applicant_name},\`,
    '',
    \`Regarding your registration for team: *\${item.title}*:\`,
    'We could *NOT* verify your payment of Rs. 1,000 with the provided slip.',
    \`*Reason:* \${reason || 'Slip unverified / amount mismatch'}\`,
    '',
    'Please send the Rs. 1,000 registration fee to our official account:',
    '🔹 *Bank:* Zindigi (Powered by JS Bank) / Raast',
    '🔹 *Account Title:* Muhammad Huzaifa',
    '🔹 *Mobile / Raast:* 0329 2092724',
    '🔹 *IBAN:* PK43JSBL9999903292092724',
    '',
    'After sending, upload your valid receipt screenshot on the portal:',
    'https://bahria-event-portal.bahria-event-portal.workers.dev/ideacrux',
    '',
    'Regards,',
    'Head of Finance & Treasury',
    'IDEACRUX 2025 | Zindigi Prize'
  ].join('\\n');

  window.open(\`https://wa.me/\${waPhone}?text=\${encodeURIComponent(msg)}\`, '_blank');
}

function openWhatsAppChat(id) {
  const item = allPendingRequests.find(r => r.id === id);
  if (!item) return;
  const waPhone = cleanPakPhoneForWa(item.phone);
  if (!waPhone) {
    alert('No phone number recorded for this applicant.');
    return;
  }
  const msg = \`Hi \${item.applicant_name}, this is from IDEACRUX 2025 Finance Desk regarding team '\${item.title}' (TRX: \${item.trx_id}):\`;
  window.open(\`https://wa.me/\${waPhone}?text=\${encodeURIComponent(msg)}\`, '_blank');
}
`;

if (!js.includes('sendPaymentConfirmedMessage')) {
  js += '\n' + messagingFunctions;
  console.log('✓ Appended WhatsApp messaging dispatch functions');
}

fs.writeFileSync(jsPath, js, 'utf8');
console.log('🎉 public/finance.js updated with instant messaging confirmation & rejection system!');
