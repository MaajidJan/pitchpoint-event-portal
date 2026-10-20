// Finance Console Controller - Bahria Fiesta 2026

// Authenticated Fetch Interceptor for Finance Panel
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const urlStr = String(url);
    if (urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/login')) {
      const token = localStorage.getItem('bahria_auth_token');
      if (!token) {
        window.location.replace('/login.html?redirect=finance.html');
        throw new Error('Not authenticated');
      }
      const existingHeaders = options.headers || {};
      const headers = new Headers(existingHeaders);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const modifiedOptions = Object.assign({}, options, { headers });
      const res = await originalFetch(url, modifiedOptions);
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('bahria_auth_token');
        localStorage.removeItem('bahria_staff_user');
        window.location.replace('/login.html?redirect=finance.html&error=session_expired');
        throw new Error('Unauthorized or session expired');
      }
      return res;
    }
    return originalFetch(url, options);
  };
})();

let activeApprovalShiftId = null;
let activeApprovalShiftAmount = 0;

document.addEventListener('DOMContentLoaded', () => {
  setupStaffAuth();
  loadFinanceData();
  loadPendingVerificationQueue();

  document.getElementById('btnRefreshFinance').addEventListener('click', () => { loadFinanceData(); loadPendingVerificationQueue(); });
  document.getElementById('btnOpenExpenseModal').addEventListener('click', () => {
    document.getElementById('expenseModal').style.display = 'flex';
  });
  document.getElementById('btnConfirmApprove').addEventListener('click', submitHandoverApproval);

  // Auto-refresh every 15s
  setInterval(() => { loadFinanceData(); loadPendingVerificationQueue(); }, 15000);
});

function setupStaffAuth() {
  const staff = localStorage.getItem('bahria_staff_user');
  if (staff) {
    try {
      const u = JSON.parse(staff);
      const nameEl = document.getElementById('finUserName');
      if (nameEl) nameEl.textContent = `${u.full_name} (${u.role})`;
    } catch (e) {}
  }
}

function logoutStaff() {
  localStorage.removeItem('bahria_staff_user');
  localStorage.removeItem('bahria_auth_token');
  window.location.href = '/login.html';
}

async function loadFinanceData() {
  try {
    const res = await fetch('/api/finance/overview');
    const data = await res.json();
    if (!data.success) return;

    const s = data.summary;

    // 1. Metric Cards
    document.getElementById('valCashDrawers').textContent = `Rs. ${(s.cash_in_drawers || 0).toLocaleString()}`;
    document.getElementById('valCashVault').textContent = `Rs. ${(s.cash_in_vault || 0).toLocaleString()}`;
    document.getElementById('valOnlineRevenue').textContent = `Rs. ${(s.easypaisa_revenue || 0).toLocaleString()}`;
    document.getElementById('valTotalExpenses').textContent = `Rs. ${(s.total_expenses || 0).toLocaleString()}`;
    document.getElementById('valNetProfit').textContent = `Rs. ${(s.net_profit || 0).toLocaleString()}`;

    document.getElementById('lblActiveDrawers').textContent = `${s.open_shifts_count || 0} Cashier(s) Active | ${s.pending_handovers_count || 0} Pending Handover`;
    document.getElementById('lblOnlineTickets').textContent = `${s.easypaisa_tickets || 0} online passes issued`;
    document.getElementById('lblExpenseCount').textContent = `${s.expense_count || 0} expense vouchers`;

    const badge = document.getElementById('shiftSummaryBadge');
    if (badge) {
      badge.textContent = `Total Drawer Cash: Rs. ${(s.cash_in_drawers || 0).toLocaleString()} (Unapproved)`;
    }

    // 2. Render Cashier Drawers
    renderDrawers(data.shifts || []);

    // 3. Render Expenses Table
    renderExpenses(data.recent_expenses || []);
  } catch (err) {
    console.error('Failed to load finance data', err);
  }
}

function renderDrawers(shifts) {
  const container = document.getElementById('drawersListContainer');
  if (!shifts || shifts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 12px;">
        No active cashier shifts recorded yet. Open <a href="/desk.html" style="color: #34d399;">Cashier Desk</a> to start issuing passes.
      </div>
    `;
    return;
  }

  container.innerHTML = shifts.map(shift => {
    const isApproved = shift.handover_status === 'APPROVED';
    const isPending = shift.handover_status === 'PENDING_HANDOVER' || shift.handover_status === 'OPEN';
    const cardClass = isApproved ? 'drawer-approved' : 'drawer-unapproved';
    const badgeHtml = isApproved
      ? `<span class="badge-status badge-approved">🟢 Verified in Vault (${shift.handover_to || 'Finance'})</span>`
      : `<span class="badge-status badge-unapproved">🟡 Cash in Drawer (Unverified / Action Required)</span>`;

    const actionButton = !isApproved
      ? `<button class="btn btn-emerald btn-sm" onclick="openApprovalModal('${shift.id}', ${shift.total_cash_collected}, '${escapeHtml(shift.cashier_name)}', '${escapeHtml(shift.desk_number)}')">
          ✅ Verify & Accept Cash (Rs. ${shift.total_cash_collected})
        </button>`
      : `<span style="font-size: 0.8rem; color: var(--text-muted);">Approved at ${formatDate(shift.approved_at)}</span>`;

    return `
      <div class="drawer-card ${cardClass}">
        <div>
          <div style="display: flex; gap: 0.6rem; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap;">
            <strong style="font-size: 1.1rem; color: #fff;">${escapeHtml(shift.cashier_name)}</strong>
            <span style="font-size: 0.82rem; color: var(--text-muted);">(${escapeHtml(shift.desk_number)})</span>
            ${badgeHtml}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Started: ${formatDate(shift.started_at)} | Tickets Sold: <strong style="color: #a5b4fc;">${shift.total_tickets_sold}</strong>
            ${shift.handover_notes ? `<br><span style="color: #cbd5e1; font-style: italic;">"${escapeHtml(shift.handover_notes)}"</span>` : ''}
          </div>
        </div>

        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Drawer Cash</div>
            <div style="font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800; color: ${isApproved ? '#34d399' : '#fbbf24'};">
              Rs. ${shift.total_cash_collected.toLocaleString()}
            </div>
          </div>
          <div>
            ${actionButton}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderExpenses(expenses) {
  const tbody = document.getElementById('expensesTbody');
  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No expenses recorded yet. Click "Record New Expense" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(exp => `
    <tr>
      <td style="white-space: nowrap; font-size: 0.82rem; color: var(--text-muted);">${formatDate(exp.created_at)}</td>
      <td><span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc;">${escapeHtml(exp.category)}</span></td>
      <td style="color: var(--text-light);">${escapeHtml(exp.description || '—')}</td>
      <td style="color: var(--text-muted);">${escapeHtml(exp.paid_to || '—')}</td>
      <td style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(exp.recorded_by || 'Finance')}</td>
      <td style="font-family: monospace; font-weight: 700; color: #f87171;">Rs. ${Number(exp.amount).toLocaleString()}</td>
    </tr>
  `).join('');
}

function openApprovalModal(shiftId, amount, cashier, desk) {
  activeApprovalShiftId = shiftId;
  activeApprovalShiftAmount = amount;

  document.getElementById('modalApprovalAmount').textContent = `Rs. ${amount.toLocaleString()}`;
  document.getElementById('modalApprovalCashier').textContent = `Cashier: ${cashier} (${desk})`;
  document.getElementById('approvalModal').style.display = 'flex';
}

function closeApprovalModal() {
  document.getElementById('approvalModal').style.display = 'none';
  activeApprovalShiftId = null;
}

function closeExpenseModal() {
  document.getElementById('expenseModal').style.display = 'none';
}

async function submitHandoverApproval() {
  if (!activeApprovalShiftId) return;

  const notes = document.getElementById('approvalNotes').value.trim();
  const staff = localStorage.getItem('bahria_staff_user');
  let approverName = 'Head of Finance';
  if (staff) {
    try { approverName = JSON.parse(staff).full_name || 'Head of Finance'; } catch (e) {}
  }

  const btn = document.getElementById('btnConfirmApprove');
  btn.disabled = true;
  btn.textContent = 'Recording Approval...';

  try {
    const res = await fetch('/api/finance/shift/approve-handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shift_id: activeApprovalShiftId,
        approved_by: approverName,
        notes: notes || 'Cash physically verified & received into vault'
      })
    });
    const data = await res.json();

    if (data.success) {
      alert(`Handover Approved! Rs. ${activeApprovalShiftAmount} has been verified and moved into the Vault balance.`);
      closeApprovalModal();
      loadFinanceData();
    } else {
      alert(data.error || 'Failed to approve handover.');
    }
  } catch (err) {
    alert('Server error approving handover.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify & Move to Vault';
  }
}

async function handleExpenseSubmit(e) {
  e.preventDefault();
  const category = document.getElementById('expCategory').value;
  const amount = document.getElementById('expAmount').value;
  const paid_to = document.getElementById('expPaidTo').value.trim();
  const description = document.getElementById('expDesc').value.trim();

  const staff = localStorage.getItem('bahria_staff_user');
  let recorded_by = 'Head of Finance';
  if (staff) {
    try { recorded_by = JSON.parse(staff).full_name || 'Head of Finance'; } catch (e) {}
  }

  const btn = document.getElementById('btnSubmitExpense');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/finance/expense/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, amount, paid_to, description, recorded_by })
    });
    const data = await res.json();

    if (data.success) {
      closeExpenseModal();
      document.getElementById('expenseForm').reset();
      loadFinanceData();
    } else {
      alert(data.error || 'Could not save expense.');
    }
  } catch (err) {
    alert('Error saving expense.');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save Expense';
  }
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return d;
  }
}

window.logoutStaff = function() {
  localStorage.removeItem('bahria_auth_token');
  localStorage.removeItem('bahria_staff_user');
  window.location.href = '/login.html';
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ==========================================
// Pending Payment Slip Verification Queue Controller
// ==========================================

let allPendingRequests = [];
let currentQueueFilter = 'ALL';
let activeZoomItem = null;

async function loadPendingVerificationQueue() {
  try {
    const res = await fetch('/api/finance/pending-requests');
    const data = await res.json();
    if (!data.success) return;

    allPendingRequests = data.requests || [];

    // Update Counts
    const badge = document.getElementById('pendingQueueBadge');
    if (badge) badge.textContent = `${allPendingRequests.length} Awaiting Review`;

    const countAll = document.getElementById('countFilterAll');
    if (countAll) countAll.textContent = allPendingRequests.length;

    const countCrux = document.getElementById('countFilterCrux');
    if (countCrux) countCrux.textContent = data.crux_pending_count || 0;

    const countFiesta = document.getElementById('countFilterFiesta');
    if (countFiesta) countFiesta.textContent = data.fiesta_pending_count || 0;

    renderPendingVerificationQueue();
  } catch (err) {
    console.error('Failed to load pending queue', err);
  }
}

function setQueueFilter(filter) {
  currentQueueFilter = filter;

  const btnAll = document.getElementById('btnFilterAll');
  const btnCrux = document.getElementById('btnFilterCrux');
  const btnFiesta = document.getElementById('btnFilterFiesta');

  if (btnAll) {
    btnAll.className = filter === 'ALL' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
  }
  if (btnCrux) {
    btnCrux.className = filter === 'IDEACRUX' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
  }
  if (btnFiesta) {
    btnFiesta.className = filter === 'FIESTA' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
  }

  renderPendingVerificationQueue();
}

function applyQueueSearch() {
  renderPendingVerificationQueue();
}

function renderPendingVerificationQueue() {
  const container = document.getElementById('pendingRequestsContainer');
  if (!container) return;

  const searchVal = (document.getElementById('queueSearchInput')?.value || '').toLowerCase().trim();

  let list = allPendingRequests;
  if (currentQueueFilter !== 'ALL') {
    list = list.filter(item => item.type === currentQueueFilter);
  }

  if (searchVal) {
    list = list.filter(item => {
      return (item.title || '').toLowerCase().includes(searchVal) ||
             (item.applicant_name || '').toLowerCase().includes(searchVal) ||
             (item.phone || '').toLowerCase().includes(searchVal) ||
             (item.email || '').toLowerCase().includes(searchVal) ||
             (item.trx_id || '').toLowerCase().includes(searchVal);
    });
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: rgba(255,255,255,0.015); border-radius: 14px;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
        <strong style="color: #fff; font-size: 1.05rem;">All caught up!</strong>
        <p style="font-size: 0.85rem; margin-top: 0.35rem;">No pending payment slips match your filter. Check back when new students register.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const isCrux = item.type === 'IDEACRUX';
    const typeBadge = isCrux 
      ? '<span class="badge-crux">💡 ZINDIGI PRIZE</span>'
      : '<span class="badge-fiesta">🎪 FIESTA ATTENDEE</span>';

    const hasSlip = item.has_screenshot && item.screenshot_preview;
    const thumbHtml = hasSlip
      ? `
        <div class="slip-thumb-box" onclick="openSlipZoomModal('${item.id}')" title="Click to inspect slip">
          <img src="${item.screenshot_preview}" alt="Slip thumbnail">
          <div class="slip-thumb-hover">🔍 Zoom Slip</div>
        </div>
      `
      : `
        <div style="width: 100%; height: 95px; border-radius: 10px; border: 1px dashed rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 4px;">
          No Slip Image
        </div>
      `;

    return `
      <div class="pending-card" id="card-${item.id}">
        <div>
          <div style="display: flex; gap: 0.6rem; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap;">
            ${typeBadge}
            <span class="badge-trx">TRX: ${escapeHtml(item.trx_id)}</span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${formatDate(item.created_at)}</span>
          </div>

          <div style="margin-bottom: 0.35rem;">
            <strong style="font-size: 1.15rem; color: #fff;">${escapeHtml(item.title)}</strong>
            <span style="font-size: 0.88rem; color: var(--text-muted); margin-left: 0.4rem;">by ${escapeHtml(item.applicant_name)}</span>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45;">
            📞 <strong style="color: #f1f5f9;">${escapeHtml(item.phone)}</strong> | ✉️ ${escapeHtml(item.email)}<br>
            <span style="color: #94a3b8;">${escapeHtml(item.details)}</span>
          </div>
        </div>

        <div>
          ${thumbHtml}
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.45rem; justify-content: center;">
          <div style="text-align: right; margin-bottom: 0.2rem;">
            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Registration Fee:</span>
            <strong style="color: #34d399; font-size: 1.1rem; margin-left: 4px;">Rs. ${(item.amount || 1000).toLocaleString()}</strong>
          </div>
          <button class="btn btn-emerald btn-sm" style="font-weight: 700; width: 100%;" onclick="quickApproveRequest('${item.type}', '${item.id}', '${escapeHtml(item.title)}')">
            ✓ Accept & Approve
          </button>
          <button class="btn btn-outline btn-sm" style="color: #f87171; border-color: rgba(239, 68, 68, 0.35); width: 100%;" onclick="quickRejectRequest('${item.type}', '${item.id}', '${escapeHtml(item.title)}')">
            ✕ Reject Slip
          </button>
          <button class="btn btn-outline btn-sm" style="color: #25d366; border-color: rgba(37, 211, 102, 0.4); font-size: 0.78rem; width: 100%;" onclick="openWhatsAppChat('${item.id}')">
            📲 WhatsApp Applicant
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openSlipZoomModal(id) {
  const item = allPendingRequests.find(r => r.id === id);
  if (!item) return;

  activeZoomItem = item;

  document.getElementById('zoomModalTitle').textContent = `Payment Slip: ${item.title}`;
  document.getElementById('zoomModalSub').textContent = `Type: ${item.type_label} | Stated TRX: ${item.trx_id}`;
  document.getElementById('zoomModalApplicant').textContent = `${item.applicant_name} (${item.title})`;
  document.getElementById('zoomModalContact').textContent = `${item.phone} • ${item.email}`;
  document.getElementById('zoomModalAmount').textContent = `Rs. ${(item.amount || 100).toLocaleString()}`;

  const img = document.getElementById('zoomSlipImage');
  img.src = item.screenshot_preview || '';

  // Setup action buttons in modal
  const btnApprove = document.getElementById('btnZoomApprove');
  const btnReject = document.getElementById('btnZoomReject');

  btnApprove.onclick = () => {
    closeSlipZoomModal();
    quickApproveRequest(item.type, item.id, item.title);
  };

  btnReject.onclick = () => {
    closeSlipZoomModal();
    quickRejectRequest(item.type, item.id, item.title);
  };

  document.getElementById('slipZoomModal').style.display = 'flex';
}

function closeSlipZoomModal() {
  document.getElementById('slipZoomModal').style.display = 'none';
  activeZoomItem = null;
}

async function quickApproveRequest(type, id, title) {
  const item = allPendingRequests.find(r => r.id === id);
  const notes = prompt(`Confirm acceptance of payment for '${title}'?\nEnter verification note (optional):`, 'Payment slip verified & confirmed');
  if (notes === null) return; // User cancelled

  try {
    const res = await fetch('/api/finance/approve-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, notes })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message || 'Approved successfully!'}`);
      loadPendingVerificationQueue();
      loadFinanceData();

      // Offer immediate WhatsApp Confirmation Dispatch
      if (item && item.phone && confirm(`Payment accepted! Send WhatsApp confirmation message to ${item.applicant_name} (${item.phone}) now?`)) {
        sendPaymentConfirmedMessage(item);
      }
    } else {
      alert('Error: ' + (data.error || 'Failed to approve.'));
    }
  } catch (err) {
    alert('Server error during approval.');
  }
}

async function quickRejectRequest(type, id, title) {
  const item = allPendingRequests.find(r => r.id === id);
  const reason = prompt(`Reject payment slip for '${title}'?\nEnter rejection reason:`, 'Fake or unverified receipt screenshot');
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
      if (item && item.phone && confirm(`Send WhatsApp notice to ${item.applicant_name} (${item.phone}) explaining that payment was NOT received?`)) {
        sendPaymentRejectedMessage(item, reason);
      }
    } else {
      alert('Error: ' + (data.error || 'Failed to reject.'));
    }
  } catch (err) {
    alert('Server error during rejection.');
  }
}
