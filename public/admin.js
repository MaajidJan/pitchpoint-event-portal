// Admin & Finance Console Controller

// Authenticated Fetch Interceptor for Admin Panel
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const urlStr = String(url);
    if (urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/login')) {
      const token = localStorage.getItem('bahria_auth_token');
      if (!token) {
        window.location.replace('/login.html?redirect=admin.html');
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
        window.location.replace('/login.html?redirect=admin.html&error=session_expired');
        throw new Error('Unauthorized or session expired');
      }
      return res;
    }
    return originalFetch(url, options);
  };
})();

let allRegistrations = [];
let currentActiveReg = null;
let currentLedgerData = null;
let currentAuditFilter = '';
let currentIssuedAdminPass = null;
let allStalls = [];
let currentActiveStall = null;

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadAdminData();
});

function setupEventListeners() {
  document.getElementById('refreshAdminBtn').addEventListener('click', () => {
    loadAdminData();
    loadFinanceLedger();
    loadAuditLogs(currentAuditFilter);
  });

  // View Switcher Tabs
  const tabReg = document.getElementById('tabBtnRegistrations');
  const tabIdeaCrux = document.getElementById('tabBtnIdeaCrux');
  const tabStalls = document.getElementById('tabBtnStalls');
  const tabFin = document.getElementById('tabBtnFinance');
  const tabStaff = document.getElementById('tabBtnStaff');
  const tabAud = document.getElementById('tabBtnAudit');
  const tabSet = document.getElementById('tabBtnSettings');

  const viewReg = document.getElementById('viewRegistrations');
  const viewIdeaCrux = document.getElementById('viewIdeaCrux');
  const viewStalls = document.getElementById('viewStalls');
  const viewFin = document.getElementById('viewFinance');
  const viewStaff = document.getElementById('viewStaff');
  const viewAud = document.getElementById('viewAudit');
  const viewSettings = document.getElementById('viewSettings');

  function switchTab(activeBtn, showView) {
    [tabReg, tabIdeaCrux, tabStalls, tabFin, tabStaff, tabAud, tabSet].forEach(b => {
      if (b) b.className = 'btn btn-sm btn-outline';
    });
    activeBtn.className = 'btn btn-sm btn-primary';

    viewReg.style.display = 'none';
    if (viewIdeaCrux) viewIdeaCrux.style.display = 'none';
    if (viewStalls) viewStalls.style.display = 'none';
    viewFin.style.display = 'none';
    if (viewStaff) viewStaff.style.display = 'none';
    viewAud.style.display = 'none';
    if (viewSettings) viewSettings.style.display = 'none';

    showView.style.display = 'block';
  }

  tabReg.addEventListener('click', () => {
    switchTab(tabReg, viewReg);
  });

  if (tabIdeaCrux && viewIdeaCrux) {
    tabIdeaCrux.addEventListener('click', () => {
      switchTab(tabIdeaCrux, viewIdeaCrux);
      loadIdeaCruxData();
    });
  }

  if (tabStalls && viewStalls) {
    tabStalls.addEventListener('click', () => {
      switchTab(tabStalls, viewStalls);
      loadStallsData();
    });
  }

  tabFin.addEventListener('click', () => {
    switchTab(tabFin, viewFin);
    loadFinanceLedger();
  });

  if (tabStaff) {
    tabStaff.addEventListener('click', () => {
      switchTab(tabStaff, viewStaff);
      loadStaffList();
    });
  }

  tabAud.addEventListener('click', () => {
    switchTab(tabAud, viewAud);
    loadAuditLogs(currentAuditFilter);
  });

  if (tabSet && viewSettings) {
    tabSet.addEventListener('click', () => {
      switchTab(tabSet, viewSettings);
      loadSettingsView();
    });
  }

  const btnOpenAddAcc = document.getElementById('btnOpenAddAccountModal');
  if (btnOpenAddAcc) {
    btnOpenAddAcc.addEventListener('click', openAddAccountModal);
  }

  // Stalls Search & Filter Listeners
  const stallSearch = document.getElementById('stallSearchInput');
  if (stallSearch) {
    stallSearch.addEventListener('input', () => renderStallsTable());
  }
  const stallFilter = document.getElementById('stallFilterStatus');
  if (stallFilter) {
    stallFilter.addEventListener('change', () => renderStallsTable());
  }
  const btnRefStalls = document.getElementById('btnRefreshStallsList');
  if (btnRefStalls) {
    btnRefStalls.addEventListener('click', () => loadStallsData());
  }

  // Modal listeners for Receipt viewer
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('slipModal').addEventListener('click', (e) => {
    if (e.target.id === 'slipModal') closeModal();
  });

  document.getElementById('modalApproveBtn').addEventListener('click', () => {
    if (currentActiveReg) {
      approveRegistration(currentActiveReg.id);
      closeModal();
    }
  });

  // Search filter for Registrations
  document.getElementById('tableSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    renderTable(allRegistrations.filter(r => 
      r.full_name.toLowerCase().includes(q) || 
      r.roll_no.toLowerCase().includes(q) || 
      (r.trx_id && r.trx_id.toLowerCase().includes(q)) ||
      (r.receipt_no && r.receipt_no.toLowerCase().includes(q)) ||
      (r.cashier_name && r.cashier_name.toLowerCase().includes(q))
    ));
  });

  // Expense Logger Form
  document.getElementById('btnSaveExpense').addEventListener('click', handleAddExpense);

  // CSV Export
  document.getElementById('btnExportCsv').addEventListener('click', exportAuditCsv);

  // Student Micro-Trace Search
  document.getElementById('btnTraceStudent').addEventListener('click', handleTraceStudent);
  document.getElementById('traceSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTraceStudent();
  });

  // Audit Filter Buttons
  document.querySelectorAll('.audit-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.audit-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAuditFilter = btn.dataset.type || '';
      loadAuditLogs(currentAuditFilter);
    });
  });

  // Direct Pass Registration Modal (Desktop button & Mobile Phone FAB)
  const btnOpenDir = document.getElementById('btnOpenDirectRegister');
  const fabOpenDir = document.getElementById('mobileFabDirectRegister');
  if (btnOpenDir) btnOpenDir.addEventListener('click', openDirectRegisterModal);
  if (fabOpenDir) fabOpenDir.addEventListener('click', openDirectRegisterModal);

  const btnCloseDir = document.getElementById('closeDirectRegisterBtn');
  const btnCancelDir = document.getElementById('btnCancelDirectRegister');
  if (btnCloseDir) btnCloseDir.addEventListener('click', closeDirectRegisterModal);
  if (btnCancelDir) btnCancelDir.addEventListener('click', closeDirectRegisterModal);

  const btnSubmitDir = document.getElementById('btnSubmitDirectRegister');
  if (btnSubmitDir) btnSubmitDir.addEventListener('click', handleDirectRegister);

  // Issued Pass Modal Actions
  const btnCloseIssued = document.getElementById('closeIssuedPassBtn');
  if (btnCloseIssued) btnCloseIssued.addEventListener('click', closeIssuedPassModal);

  const btnDownloadIssued = document.getElementById('btnDownloadIssuedPng');
  if (btnDownloadIssued) btnDownloadIssued.addEventListener('click', () => {
    if (currentIssuedAdminPass) generateAndDownloadAdminPassPng(currentIssuedAdminPass, false);
  });

  const btnShareIssued = document.getElementById('btnShareIssuedWa');
  if (btnShareIssued) btnShareIssued.addEventListener('click', shareIssuedPass);

  // Direct modal outside click dismiss
  const dirModal = document.getElementById('directRegisterModal');
  if (dirModal) dirModal.addEventListener('click', (e) => {
    if (e.target === dirModal) closeDirectRegisterModal();
  });

  const issuedModal = document.getElementById('issuedPassModal');
  if (issuedModal) issuedModal.addEventListener('click', (e) => {
    if (e.target === issuedModal) closeIssuedPassModal();
  });

  // URL Hash Auto-Switch (e.g. admin.html#staff)
  if (window.location.hash === '#staff' && tabStaff) {
    tabStaff.click();
  } else if (window.location.hash === '#finance' && tabFin) {
    tabFin.click();
  } else if (window.location.hash === '#ideacrux' && tabIdeaCrux) {
    tabIdeaCrux.click();
  }
}

// 1. Load Registrations
async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/overview');
    const data = await res.json();
    if (!data.success) return;

    allRegistrations = data.registrations || [];

    // Calculate metrics
    const total = allRegistrations.length;
    const verified = allRegistrations.filter(r => r.status === 'VERIFIED').length;
    const pending = allRegistrations.filter(r => r.status === 'PENDING').length;
    const revenue = allRegistrations
      .filter(r => r.status === 'VERIFIED')
      .reduce((sum, r) => sum + (r.expected_amount || 0), 0);

    document.getElementById('metricTotal').textContent = total;
    document.getElementById('metricVerified').textContent = verified;
    document.getElementById('metricPending').textContent = pending;
    document.getElementById('metricRevenue').textContent = `Rs. ${revenue.toLocaleString()}`;

    renderTable(allRegistrations);
  } catch (err) {
    console.error('Error loading admin data:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.logout = function() {
  localStorage.removeItem('bahria_auth_token');
  localStorage.removeItem('bahria_staff_user');
  window.location.href = '/login.html';
};

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
}

function renderTable(list) {
  const tbody = document.getElementById('adminTbody');
  const mobileContainer = document.getElementById('adminMobileCardsContainer');

  if (list.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">No registrations found</td></tr>';
    if (mobileContainer) mobileContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 14px;">No registrations found</div>';
    return;
  }

  const getMethodBadge = (reg) => {
    if (reg.payment_method === 'CASH') {
      return `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: 700; font-size: 0.72rem;">💵 CASH DESK</span>`;
    }
    if (reg.payment_method === 'COMPLIMENTARY' || (reg.expected_amount === 0)) {
      return `<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700; font-size: 0.72rem;">FREE PASS</span>`;
    }
    if (reg.payment_method === 'ADMIN_WAIVED') {
      return `<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-weight: 700; font-size: 0.72rem;">WAIVED</span>`;
    }
    return `<span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; font-weight: 700; font-size: 0.72rem;">📱 EASYPAISA</span>`;
  };

  const getCategoryLabel = () => 'Official Event Pass';

  // 1. Desktop Table View
  if (tbody) {
    tbody.innerHTML = list.map(reg => {
      const isPending = reg.status === 'PENDING';
      const isVerified = reg.status === 'VERIFIED';
      const isCash = reg.payment_method === 'CASH';
      const hasImage = reg.screenshot_preview && reg.screenshot_preview.length > 50;

      return `
        <tr>
          <td>
            ${isCash ? `
              <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: 700; font-size: 0.75rem;">
                💵 CASH DESK
              </span>
              ${reg.cashier_name ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">By: ${escapeHtml(reg.cashier_name)}</div>` : ''}
            ` : (hasImage ? `
              <img class="slip-thumb" src="${reg.screenshot_preview}" alt="Slip" onclick="viewReceipt('${reg.id}')" title="Click to view full receipt">
            ` : getMethodBadge(reg))}
          </td>
          <td>
            <div style="font-weight: 700; color: #fff;">${escapeHtml(reg.full_name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(reg.phone || reg.email || '-')}</div>
            <div style="font-size: 0.75rem; color: #94a3b8;">Dept: ${escapeHtml(reg.department || 'BU')}</div>
          </td>
          <td>
            <span style="font-family: monospace; font-size: 0.85rem; color: #38bdf8;">${escapeHtml(reg.roll_no)}</span>
            <div style="font-size: 0.7rem; color: #64748b;">${getCategoryLabel(reg.ticket_type)}</div>
          </td>
          <td>
            <span style="font-family: monospace; font-weight: 700; color: ${reg.trx_id ? '#34d399' : 'var(--text-muted)'};">
              ${escapeHtml(reg.receipt_no || reg.trx_id || 'Pending')}
            </span>
          </td>
          <td>
            <span style="font-weight: 700; color: #fff;">Rs. ${(reg.expected_amount || 0).toLocaleString()}</span>
          </td>
          <td>
            <span class="badge badge-${(reg.status || 'pending').toLowerCase()}">${reg.status}</span>
            ${reg.checked_in_at ? `
              <div style="margin-top: 4px;">
                <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.68rem;" title="Checked in at ${new Date(reg.checked_in_at).toLocaleTimeString()}">
                  ✓ Admitted
                </span>
              </div>
            ` : ''}
          </td>
          <td>
            <div style="font-size: 0.82rem; color: #cbd5e1; font-weight: 600;">
              ${formatDateTime(reg.created_at)}
            </div>
            ${reg.verified_at ? `
              <div style="font-size: 0.72rem; color: #34d399; margin-top: 2px;">
                ✅ ${formatDateTime(reg.verified_at)}
              </div>
            ` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${hasImage ? `
                <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 3px 8px;" onclick="viewReceipt('${reg.id}')">
                  View Slip
                </button>
              ` : ''}
              ${isPending ? `
                <button class="btn btn-emerald btn-sm" style="font-size: 0.75rem; padding: 3px 8px;" onclick="approveRegistration('${reg.id}')">
                  ✓ Approve
                </button>
                <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 3px 8px; color: #f87171;" onclick="rejectRegistration('${reg.id}')">
                  ✕
                </button>
              ` : ''}
              ${isVerified ? `
                <button class="btn btn-primary btn-sm" style="font-size: 0.75rem; padding: 3px 8px; font-weight: 700;" onclick="viewAttendeePass('${reg.id}')" title="View & Download Official Pass">
                  🎟️ Pass
                </button>
                <button class="btn btn-emerald btn-sm" style="font-size: 0.75rem; padding: 3px 6px;" onclick="shareStudentTicketWa('${reg.id}')" title="Send WhatsApp Confirmation">
                  📲 WA
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 2. Mobile Phone Native Cards (No horizontal scroll)
  if (mobileContainer) {
    mobileContainer.innerHTML = list.map(reg => {
      const isPending = reg.status === 'PENDING';
      const isVerified = reg.status === 'VERIFIED';
      const hasImage = reg.screenshot_preview && reg.screenshot_preview.length > 50;

      return `
        <div class="attendee-mobile-card">
          <div class="card-top-row">
            <div>
              <div class="card-name">${escapeHtml(reg.full_name)}</div>
              <div class="card-roll">${escapeHtml(reg.roll_no)}</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <span class="badge badge-${(reg.status || 'pending').toLowerCase()}">${reg.status}</span>
              ${getMethodBadge(reg)}
            </div>
          </div>

          <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.6rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 8px;">
            <span>🕒 Submitted: <strong style="color: #cbd5e1;">${formatDateTime(reg.created_at)}</strong></span>
            ${reg.verified_at ? `<span style="color: #34d399;">✅ Verified: ${formatDateTime(reg.verified_at)}</span>` : ''}
          </div>

          <div class="card-details-grid">
            <div>
              <div style="color: var(--text-muted); font-size: 0.7rem;">REF / TRX</div>
              <div style="font-family: monospace; font-weight: 700; color: #34d399;">${escapeHtml(reg.receipt_no || reg.trx_id || '-')}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.7rem;">FEE AMOUNT</div>
              <div style="font-weight: 700; color: #fff;">Rs. ${(reg.expected_amount || 0).toLocaleString()}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.7rem;">DEPARTMENT</div>
              <div style="color: #cbd5e1; font-size: 0.78rem;">${escapeHtml(reg.department || 'BU')}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.7rem;">GATE STATUS</div>
              <div style="color: ${reg.checked_in_at ? '#34d399' : '#94a3b8'}; font-weight: 600; font-size: 0.78rem;">
                ${reg.checked_in_at ? '✓ Admitted' : 'Awaiting Gate'}
              </div>
            </div>
          </div>

          <div class="card-actions">
            ${isVerified ? `
              <button class="btn btn-primary" onclick="viewAttendeePass('${reg.id}')">
                🎟️ View Pass
              </button>
              <button class="btn btn-emerald" onclick="shareStudentTicketWa('${reg.id}')">
                📲 Send WA
              </button>
            ` : ''}
            ${isPending ? `
              <button class="btn btn-emerald" onclick="approveRegistration('${reg.id}')">
                ✓ Approve
              </button>
              <button class="btn btn-outline" style="color: #f87171;" onclick="rejectRegistration('${reg.id}')">
                ✕ Reject
              </button>
            ` : ''}
            ${hasImage ? `
              <button class="btn btn-outline" onclick="viewReceipt('${reg.id}')">
                🖼️ Slip
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

// 2. Load Finance Ledger & Digital Notebook
async function loadFinanceLedger() {
  try {
    const res = await fetch('/api/finance/ledger');
    const data = await res.json();
    if (!data.success) return;

    currentLedgerData = data;
    const s = data.summary;

    document.getElementById('finGrossRevenue').textContent = `Rs. ${s.gross_revenue.toLocaleString()}`;
    document.getElementById('finTicketsCount').textContent = `${s.total_tickets} total passes issued`;

    document.getElementById('finCashRevenue').textContent = `Rs. ${s.cash_revenue.toLocaleString()}`;
    document.getElementById('finCashTickets').textContent = `${s.cash_tickets} cash passes`;

    document.getElementById('finEpRevenue').textContent = `Rs. ${s.easypaisa_revenue.toLocaleString()}`;
    document.getElementById('finEpTickets').textContent = `${s.easypaisa_tickets} online passes`;

    document.getElementById('finTotalExpenses').textContent = `Rs. ${s.total_expenses.toLocaleString()}`;
    document.getElementById('finExpenseCount').textContent = `${s.expense_count} expenses logged`;

    const netElem = document.getElementById('finNetProfit');
    netElem.textContent = `Rs. ${s.net_profit.toLocaleString()}`;
    if (s.net_profit < 0) {
      netElem.style.color = '#f87171';
    } else {
      netElem.style.color = '#10b981';
    }

    // Handover Notice Banner for Finance Head
    const pendingShifts = (data.shifts || []).filter(sh => sh.handover_status === 'PENDING_HANDOVER');
    const alertBanner = document.getElementById('handoverAlertBanner');
    if (pendingShifts.length > 0) {
      const sh = pendingShifts[0];
      alertBanner.style.display = 'flex';
      document.getElementById('handoverAlertTitle').textContent = `⚠️ Handover Pending: Rs. ${sh.total_cash_collected.toLocaleString()} from ${sh.cashier_name}`;
      document.getElementById('handoverAlertDesc').textContent = `Cashier ${sh.cashier_name} (${sh.desk_number}) has submitted drawer cash. Please count the physical currency and click below to confirm.`;
      document.getElementById('handoverAlertActions').innerHTML = `
        <button class="btn btn-emerald btn-sm" style="font-weight: 700; padding: 0.6rem 1.2rem; font-size: 0.9rem;" onclick="approveShiftHandover('${sh.id}', '${sh.cashier_name}', ${sh.total_cash_collected})">
          ✓ Count & Accept Rs. ${sh.total_cash_collected.toLocaleString()}
        </button>
      `;
    } else {
      alertBanner.style.display = 'none';
    }

    renderShiftsTable(data.shifts || []);
    renderExpensesTable(data.recent_expenses || []);

  } catch (err) {
    console.error('Error loading finance ledger:', err);
  }
}

function renderShiftsTable(shifts) {
  const tbody = document.getElementById('shiftsTbody');
  if (shifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No cashier shifts opened yet</td></tr>';
    return;
  }

  tbody.innerHTML = shifts.map(sh => {
    const isPending = sh.handover_status === 'PENDING_HANDOVER';
    const isApproved = sh.handover_status === 'APPROVED';

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #fff;">${sh.cashier_name}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${new Date(sh.started_at).toLocaleDateString()}</div>
        </td>
        <td>
          <span style="font-size: 0.82rem; color: #a5b4fc;">${sh.desk_number || 'Desk 1'}</span>
        </td>
        <td>
          <strong style="color: #34d399; font-size: 0.95rem;">Rs. ${(sh.total_cash_collected || 0).toLocaleString()}</strong>
        </td>
        <td>
          <span style="font-size: 0.85rem;">${sh.total_tickets_sold || 0}</span>
        </td>
        <td>
          ${isApproved ? `
            <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.72rem;">
              ✓ APPROVED
            </span>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Received by: ${sh.handover_to || 'Head'}</div>
          ` : (isPending ? `
            <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-size: 0.72rem;">
              ⏳ AWAITING VERIFICATION
            </span>
          ` : `
            <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 0.72rem;">
              🟢 ACTIVE SHIFT
            </span>
          `)}
        </td>
        <td>
          ${isPending ? `
            <button class="btn btn-emerald btn-sm" style="font-size: 0.75rem; padding: 4px 10px;" onclick="approveShiftHandover('${sh.id}', '${sh.cashier_name}', ${sh.total_cash_collected})">
              ✓ Accept Rs. ${sh.total_cash_collected}
            </button>
          ` : (isApproved ? `
            <span style="color: #34d399; font-size: 0.8rem;">Balanced ✓</span>
          ` : `
            <span style="color: var(--text-muted); font-size: 0.75rem;">In Progress</span>
          `)}
        </td>
      </tr>
    `;
  }).join('');
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesTbody');
  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No expenses logged yet</td></tr>';
    return;
  }

  tbody.innerHTML = expenses.map(exp => `
    <tr>
      <td>
        <div style="font-size: 0.82rem; color: #fff;">${new Date(exp.created_at).toLocaleDateString()}</div>
        <div style="font-size: 0.72rem; color: var(--text-muted);">${new Date(exp.created_at).toLocaleTimeString()}</div>
      </td>
      <td>
        <span class="badge" style="background: rgba(248, 113, 113, 0.15); color: #f87171; font-weight: 700; font-size: 0.75rem;">
          ${exp.category}
        </span>
      </td>
      <td>
        <div style="color: #fff; font-weight: 600;">${exp.description}</div>
      </td>
      <td>
        <span style="color: #a5b4fc; font-size: 0.85rem;">${exp.paid_to || 'N/A'}</span>
      </td>
      <td>
        <strong style="color: #f87171; font-size: 1rem;">Rs. ${Number(exp.amount).toLocaleString()}</strong>
      </td>
      <td>
        <span style="font-size: 0.82rem; color: var(--text-secondary);">${exp.recorded_by || 'Finance Head'}</span>
      </td>
    </tr>
  `).join('');
}

// 3. Add Expense Handler
async function handleAddExpense() {
  const category = document.getElementById('expCategory').value;
  const amount = parseFloat(document.getElementById('expAmount').value);
  const paidTo = document.getElementById('expPaidTo').value.trim();
  const recordedBy = document.getElementById('expRecordedBy').value.trim();
  const desc = document.getElementById('expDesc').value.trim();

  if (!category || isNaN(amount) || amount <= 0 || !desc) {
    alert('Please enter a valid expense category, amount, and description.');
    return;
  }

  const btn = document.getElementById('btnSaveExpense');
  btn.disabled = true;
  btn.textContent = 'Recording Expense...';

  try {
    const res = await fetch('/api/finance/expense/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        amount,
        description: desc,
        paid_to: paidTo,
        recorded_by: recordedBy
      })
    });

    const data = await res.json();
    btn.disabled = false;
    btn.textContent = '➕ Log Expense in Ledger';

    if (data.success) {
      document.getElementById('expAmount').value = '';
      document.getElementById('expDesc').value = '';
      document.getElementById('expPaidTo').value = '';
      loadFinanceLedger();
    } else {
      alert(data.error || 'Failed to log expense');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '➕ Log Expense in Ledger';
    alert('Network error communicating with server');
  }
}

// 4. Shift Handover Approval
window.approveShiftHandover = async function(shiftId, cashierName, amount) {
  if (!confirm(`Confirm that you have physically received Rs. ${amount.toLocaleString()} cash from Cashier ${cashierName}?`)) {
    return;
  }

  try {
    const res = await fetch('/api/finance/shift/approve-handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId, approved_by: 'Majid Ullah Jan (Finance Head)' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Cash handover approved successfully!');
      loadFinanceLedger();
    } else {
      alert(data.error || 'Failed to approve shift');
    }
  } catch (e) {
    alert('Error communicating with server');
  }
};

// 5. 1-Click Export Complete Financial Statement to CSV / Excel
function exportAuditCsv() {
  if (!currentLedgerData) {
    alert('Please open the Finance Notebook first to load data.');
    return;
  }

  const s = currentLedgerData.summary;
  let csv = 'BAHRIA FIESTA 2026 - OFFICIAL FINANCIAL AUDIT REPORT\n';
  csv += `Generated At:,"${new Date().toLocaleString()}"\n`;
  csv += `Generated By:,"Majid Ullah Jan (Head of Finance)"\n\n`;

  csv += 'EXECUTIVE SUMMARY\n';
  csv += `Gross Total Inflow (PKR),Rs. ${s.gross_revenue}\n`;
  csv += `Hard Cash Collected (Desks),Rs. ${s.cash_revenue} (${s.cash_tickets} passes)\n`;
  csv += `Easypaisa Online Received,Rs. ${s.easypaisa_revenue} (${s.easypaisa_tickets} passes)\n`;
  csv += `Total Outflow (Expenses),Rs. ${s.total_expenses} (${s.expense_count} expense entries)\n`;
  csv += `Net Event Profit / Balance,Rs. ${s.net_profit}\n\n`;

  csv += 'EXPENSES BREAKDOWN\n';
  csv += 'Date,Category,Description,Paid To / Vendor,Amount (PKR),Recorded By\n';
  (currentLedgerData.recent_expenses || []).forEach(exp => {
    csv += `"${exp.created_at}","${exp.category}","${(exp.description || '').replace(/"/g, '""')}","${exp.paid_to || ''}",${exp.amount},"${exp.recorded_by || ''}"\n`;
  });

  csv += '\nCASHIER SHIFT HANDOVERS\n';
  csv += 'Cashier,Desk,Started At,Closed At,Cash Collected (PKR),Tickets Sold,Status,Handover To\n';
  (currentLedgerData.shifts || []).forEach(sh => {
    csv += `"${sh.cashier_name}","${sh.desk_number}","${sh.started_at}","${sh.closed_at || 'Active'}",${sh.total_cash_collected},${sh.total_tickets_sold},"${sh.handover_status}","${sh.handover_to || ''}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `Bahria_Event_Financial_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Receipt Modal Controls
window.viewReceipt = function(regId) {
  const reg = allRegistrations.find(r => r.id === regId);
  if (!reg) return;

  currentActiveReg = reg;
  document.getElementById('modalStudentName').textContent = `${reg.full_name} (${reg.roll_no})`;
  document.getElementById('modalSlipImage').src = reg.screenshot_preview || '';
  document.getElementById('modalTrxId').textContent = reg.receipt_no || reg.trx_id || 'No TRX Extracted';
  document.getElementById('modalSenderInfo').textContent = reg.ocr_sender ? `Sender: ${reg.ocr_sender}` : `Fee: Rs. ${reg.expected_amount}`;

  const approveBtn = document.getElementById('modalApproveBtn');
  if (reg.status === 'VERIFIED') {
    approveBtn.style.display = 'none';
  } else {
    approveBtn.style.display = 'block';
  }

  document.getElementById('slipModal').classList.add('active');
};

function closeModal() {
  document.getElementById('slipModal').classList.remove('active');
  currentActiveReg = null;
}

window.approveRegistration = async function(regId) {
  try {
    const res = await fetch('/api/admin/manual-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId, action: 'APPROVE', notes: 'Approved by organizer via Admin Panel' })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    } else {
      alert(data.error || 'Could not approve registration');
    }
  } catch (e) {
    alert('Error connecting to server');
  }
};

window.rejectRegistration = async function(regId) {
  if (!confirm('Are you sure you want to reject this registration?')) return;
  try {
    const res = await fetch('/api/admin/manual-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId, action: 'REJECT', notes: 'Rejected by organizer' })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminData();
    } else {
      alert(data.error || 'Could not approve rejection');
    }
  } catch (e) {
    alert('Error connecting to server');
  }
};

// 6. System Activity & Audit Trail (Micro-Traces)
async function loadAuditLogs(filterType = '') {
  const tbody = document.getElementById('auditTbody');
  try {
    const url = filterType ? `/api/admin/audit-logs?type=${encodeURIComponent(filterType)}` : '/api/admin/audit-logs';
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.logs || data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">No audit entries found</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs.map(log => {
      let badgeColor = 'rgba(148, 163, 184, 0.2)';
      let textColor = '#cbd5e1';
      let icon = '📝';

      const type = log.event_type || '';
      if (type.includes('GATE_ENTRY')) {
        badgeColor = 'rgba(16, 185, 129, 0.2)';
        textColor = '#34d399';
        icon = '🚪';
      } else if (type.includes('FRAUD') || type.includes('DENIED')) {
        badgeColor = 'rgba(239, 68, 68, 0.2)';
        textColor = '#f87171';
        icon = '⚠️';
      } else if (type.includes('CASH')) {
        badgeColor = 'rgba(16, 185, 129, 0.25)';
        textColor = '#10b981';
        icon = '💵';
      } else if (type.includes('PAYMENT') || type.includes('MATCH')) {
        badgeColor = 'rgba(99, 102, 241, 0.2)';
        textColor = '#a5b4fc';
        icon = '📱';
      } else if (type.includes('SHIFT')) {
        badgeColor = 'rgba(168, 85, 247, 0.2)';
        textColor = '#c084fc';
        icon = '💼';
      } else if (type.includes('EXPENSE')) {
        badgeColor = 'rgba(245, 158, 11, 0.2)';
        textColor = '#fbbf24';
        icon = '📉';
      }

      return `
        <tr>
          <td>
            <div style="font-size: 0.82rem; color: #fff;">${new Date(log.created_at).toLocaleDateString()}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${new Date(log.created_at).toLocaleTimeString()}</div>
          </td>
          <td>
            <span class="badge" style="background: ${badgeColor}; color: ${textColor}; font-weight: 700; font-size: 0.72rem; white-space: nowrap;">
              ${icon} ${log.event_type}
            </span>
          </td>
          <td>
            <span style="font-family: monospace; font-size: 0.8rem; color: #38bdf8; word-break: break-all;">
              ${log.reference_id || '-'}
            </span>
          </td>
          <td>
            <div style="font-size: 0.84rem; color: #e2e8f0; line-height: 1.4;">${log.details}</div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading audit logs:', err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #f87171; padding: 2rem;">Error connecting to server</td></tr>';
  }
}

// 7. Student Life-Cycle Micro-Trace Quick Search
async function handleTraceStudent() {
  const query = document.getElementById('traceSearchInput').value.trim();
  if (!query) {
    alert('Please enter a Roll Number, Pass Reference ID, or Phone Number to inspect.');
    return;
  }

  const container = document.getElementById('traceResultContainer');
  const btn = document.getElementById('btnTraceStudent');
  btn.disabled = true;
  btn.textContent = 'Tracing...';

  try {
    const res = await fetch(`/api/admin/student-trace/${encodeURIComponent(query)}`);
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = 'Trace Attendee';

    if (!data.success || !data.student) {
      alert(`No record found for '${query}'. Please check the roll number or pass ID.`);
      container.style.display = 'none';
      return;
    }

    const s = data.student;
    container.style.display = 'block';

    document.getElementById('traceStudentName').textContent = s.full_name;
    document.getElementById('traceStudentRoll').textContent = `Roll No: ${s.roll_no} • Dept: ${s.department || 'BU'}`;
    document.getElementById('traceStudentMeta').textContent = `Phone: ${s.phone || 'N/A'} • Email: ${s.email} • Pass Type: ${s.ticket_type} • Fee: Rs. ${s.expected_amount} (${s.payment_method || 'EASYPAISA'})`;

    const badge = document.getElementById('traceStatusBadge');
    badge.textContent = s.status;
    badge.className = `badge badge-${s.status.toLowerCase()}`;

    const gateStatus = document.getElementById('traceGateStatus');
    if (s.checked_in_at) {
      gateStatus.innerHTML = `<span style="color: #34d399; font-weight: 700;">✓ Admitted at Gate: ${new Date(s.checked_in_at).toLocaleString()}</span> (Scanned by: ${s.checkin_by || 'Gate 1'})`;
    } else {
      gateStatus.innerHTML = '<span style="color: #f59e0b;">⏳ Not Admitted Yet (Has not scanned at gate)</span>';
    }

    const timeline = document.getElementById('traceTimeline');
    if (!data.audit_logs || data.audit_logs.length === 0) {
      timeline.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No historical trace logs recorded yet.</div>';
    } else {
      timeline.innerHTML = data.audit_logs.map(log => `
        <div style="background: rgba(255,255,255,0.03); border-left: 3px solid #38bdf8; padding: 0.6rem 0.85rem; border-radius: 0 8px 8px 0; font-size: 0.82rem;">
          <div style="display: flex; justify-content: space-between; gap: 1rem; color: var(--text-muted); font-size: 0.72rem; margin-bottom: 2px;">
            <strong style="color: #a5b4fc;">${log.event_type}</strong>
            <span>${new Date(log.created_at).toLocaleString()}</span>
          </div>
          <div style="color: #f1f5f9;">${log.details}</div>
        </div>
      `).join('');
    }

  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Trace Attendee';
    alert('Error connecting to server for attendee trace');
  }
}

// 8. Event Settings Modal Handlers
async function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data) {
      document.getElementById('cfgSupportPhone').value = data.support_phone || '03175230209';
      document.getElementById('cfgSupportWhatsapp').value = data.support_whatsapp || '923175230209';
      document.getElementById('cfgTicketFee').value = data.ticket_price || 1.0;
      document.getElementById('cfgEasypaisaNumber').value = data.account_number || '03175230209';
      document.getElementById('cfgEasypaisaTitle').value = data.account_title || 'MAJID ULLAH JAN';
    }
  } catch (e) {
    console.warn('Config fetch error:', e);
  }
  modal.classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

async function handleSaveSettings() {
  const phone = document.getElementById('cfgSupportPhone').value.trim();
  const whatsapp = document.getElementById('cfgSupportWhatsapp').value.trim();
  const fee = parseFloat(document.getElementById('cfgTicketFee').value) || 1.0;
  const epNum = document.getElementById('cfgEasypaisaNumber').value.trim();
  const epTitle = document.getElementById('cfgEasypaisaTitle').value.trim();

  const btn = document.getElementById('btnSaveSettings');
  btn.disabled = true;
  btn.textContent = 'Saving Settings...';

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          support_phone: phone,
          support_whatsapp: whatsapp,
          test_fee_pkr: fee.toString(),
          easypaisa_account_number: epNum,
          easypaisa_account_title: epTitle
        }
      })
    });

    const data = await res.json();
    btn.disabled = false;
    btn.textContent = '✓ Save Settings';

    if (data.success) {
      alert('Event & Support settings updated successfully!');
      closeSettingsModal();
      loadAdminData();
      loadFinanceLedger();
    } else {
      alert(data.error || 'Failed to save settings');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '✓ Save Settings';
    alert('Error saving settings to server');
  }
}

// 9. Master Direct Attendee Registration (Anyone: VIP, Staff, Students, Cash, Free)
function openDirectRegisterModal() {
  const modal = document.getElementById('directRegisterModal');
  if (modal) {
    document.getElementById('dirFullName').value = '';
    document.getElementById('dirRollNo').value = '';
    document.getElementById('dirPhone').value = '';
    document.getElementById('dirDepartment').value = 'General Admission';
    document.getElementById('dirTicketType').value = 'OFFICIAL_ENTRY_PASS';
    document.getElementById('dirPaymentMethod').value = 'COMPLIMENTARY';
    document.getElementById('dirAmount').value = '0.0';
    document.getElementById('dirNotes').value = '';
    modal.classList.add('active');
    setTimeout(() => {
      const f = document.getElementById('dirFullName');
      if (f) f.focus();
    }, 100);
  }
}

function closeDirectRegisterModal() {
  const modal = document.getElementById('directRegisterModal');
  if (modal) modal.classList.remove('active');
}

async function handleDirectRegister() {
  const name = document.getElementById('dirFullName').value.trim();
  const roll = document.getElementById('dirRollNo').value.trim();
  const phone = document.getElementById('dirPhone').value.trim();
  const dept = document.getElementById('dirDepartment').value.trim() || 'General Admission';
  const ticketType = document.getElementById('dirTicketType').value;
  const payMethod = document.getElementById('dirPaymentMethod').value;
  const amount = parseFloat(document.getElementById('dirAmount').value) || 0.0;
  const notes = document.getElementById('dirNotes').value.trim();

  if (!name || !roll) {
    alert('Please enter Attendee Full Name and Roll No / Identification ID.');
    return;
  }

  const btn = document.getElementById('btnSubmitDirectRegister');
  btn.disabled = true;
  btn.textContent = '⚡ Issuing Verified Pass...';

  try {
    const res = await fetch('/api/admin/direct-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: name,
        roll_no: roll,
        phone,
        department: dept,
        ticket_type: ticketType,
        payment_method: payMethod,
        expected_amount: amount,
        admin_notes: notes,
        issued_by: 'Admin / Director Desk'
      })
    });

    const data = await res.json();
    btn.disabled = false;
    btn.textContent = '⚡ Issue Verified Pass & Auto-Download';

    if (!res.ok || !data.success) {
      alert(`Pass Issue Error: ${data.error || 'Failed to issue direct pass'}`);
      return;
    }

    closeDirectRegisterModal();
    openIssuedPassModal(data);

    // Auto-trigger luxury HD pass PNG download!
    setTimeout(() => {
      generateAndDownloadAdminPassPng(data, true);
    }, 400);

    // Refresh background registrations table & ledger
    loadAdminData();
    loadFinanceLedger();

  } catch (err) {
    btn.disabled = false;
    btn.textContent = '⚡ Issue Verified Pass & Auto-Download';
    alert('Network error communicating with server.');
  }
}

// 10. Issued Pass Modal & Attendee Pass Viewer
function openIssuedPassModal(pass) {
  currentIssuedAdminPass = pass;
  const modal = document.getElementById('issuedPassModal');
  if (!modal) return;

  const typeBadge = document.getElementById('issuedPassTypeBadge');
  if (typeBadge) {
    typeBadge.textContent = 'BAHRIA FIESTA 2026 OFFICIAL PASS';
    typeBadge.style.color = '#34d399';
  }

  document.getElementById('issuedPassName').textContent = pass.full_name || 'Attendee';
  document.getElementById('issuedPassRoll').textContent = pass.roll_no || '-';
  const feeAmt = pass.amount_paid !== undefined ? pass.amount_paid : (pass.expected_amount || 0);
  document.getElementById('issuedPassMeta').textContent = `Dept: ${pass.department || 'General'} • Fee: Rs. ${feeAmt.toLocaleString()} (${pass.payment_method || 'VERIFIED'})`;
  document.getElementById('issuedPassRef').textContent = pass.receipt_no || pass.trx_id || pass.id || pass.registration_id || '-';

  const qrImg = document.getElementById('issuedPassQrImg');
  if (qrImg && pass.ticket_qr) {
    qrImg.src = pass.ticket_qr;
  }

  modal.classList.add('active');
}

function closeIssuedPassModal() {
  const modal = document.getElementById('issuedPassModal');
  if (modal) modal.classList.remove('active');
}

function viewAttendeePass(regId) {
  const reg = allRegistrations.find(r => r.id === regId);
  if (!reg) {
    alert('Registration not found.');
    return;
  }
  openIssuedPassModal(reg);
}

// 11. Luxury HD Canvas Pass PNG Generator & Auto-Downloader
function generateAndDownloadAdminPassPng(pass, isAuto) {
  if (!pass) return;

  const canvas = document.getElementById('adminTicketCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Background gradient: Sleek dark luxury festival aesthetic
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#070a13');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Border styling (Standard clean vibrant emerald)
  const borderColor = '#10b981';

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Decorative corner accents
  ctx.fillStyle = borderColor;
  ctx.fillRect(10, 10, 10, 80);
  ctx.fillRect(10, 10, 80, 10);
  ctx.fillRect(w - 90, 10, 80, 10);
  ctx.fillRect(w - 20, 10, 10, 80);
  ctx.fillRect(10, h - 90, 10, 80);
  ctx.fillRect(10, h - 20, 80, 10);
  ctx.fillRect(w - 90, h - 20, 80, 10);
  ctx.fillRect(w - 20, h - 90, 10, 80);

  // Top Header Banner
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(20, 20, w - 40, 75);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BAHRIA FIESTA 2026', 45, 62);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('OFFICIAL DIGITAL ENTRY PASS • ISLAMABAD CAMPUS', 45, 83);

  // Attendee Details Column (Left side)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ATTENDEE NAME', 45, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 25px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(pass.full_name || 'Attendee', 45, 172);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('IDENTIFICATION / ROLL NO', 45, 215);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(pass.roll_no || '-', 45, 245);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('DEPARTMENT / AFFILIATION', 45, 290);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(pass.department || 'General Admission', 45, 315);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PASS REFERENCE & BILLING', 45, 360);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 20px monospace';
  const refCode = pass.receipt_no || pass.trx_id || pass.id || 'CONFIRMED';
  const payDesc = pass.payment_method ? `(${pass.payment_method})` : '';
  ctx.fillText(`${refCode} ${payDesc}`, 45, 385);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px monospace';
  const passId = pass.registration_id || pass.id || '-';
  ctx.fillText(`Pass ID: ${passId}  •  Venue: BUIC Main Campus`, 45, 435);
  ctx.fillText(`Admit One  •  October 15-17, 2026  •  Verified By Authority`, 45, 455);

  // Dashed separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(560, 110);
  ctx.lineTo(560, 480);
  ctx.stroke();
  ctx.setLineDash([]);

  // Right side QR code container
  const qrSrc = pass.ticket_qr || (document.getElementById('issuedPassQrImg') ? document.getElementById('issuedPassQrImg').src : '');
  if (qrSrc && qrSrc.length > 50) {
    const qrImageObj = new Image();
    qrImageObj.crossOrigin = 'anonymous';
    qrImageObj.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(610, 140, 230, 230);
      ctx.drawImage(qrImageObj, 620, 150, 210, 210);

      ctx.fillStyle = '#a5b4fc';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN FOR GATE ADMISSION', 725, 400);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('🟢 100% VERIFIED PASS', 725, 422);

      triggerDownload();
    };
    qrImageObj.src = qrSrc;
  } else {
    triggerDownload();
  }

  function triggerDownload() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (pass.full_name || 'Attendee').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeRoll = (pass.roll_no || 'Pass').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Bahria_Fiesta_Pass_${safeName}_${safeRoll}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}

// 12. Instant Sharing via Web Share API & WhatsApp
async function shareIssuedPass() {
  if (!currentIssuedAdminPass) {
    alert('No pass available to share.');
    return;
  }

  const p = currentIssuedAdminPass;
  const text = 
    `🎟️ *Bahria Fiesta & TechFest 2026 Official Entry Pass*\n\n` +
    `👤 *Attendee:* ${p.full_name}\n` +
    `🎓 *ID / Roll:* ${p.roll_no}\n` +
    `🏛️ *Category:* ${p.ticket_type || 'Official Pass'}\n` +
    `💳 *Reference:* ${p.receipt_no || p.trx_id || p.id}\n` +
    `📍 *Venue:* Bahria University Islamabad Campus\n` +
    `📅 *Dates:* October 15-17, 2026\n` +
    `🟢 *Status:* 100% VERIFIED PASS (Admit One)\n\n` +
    `Official Event Portal: https://bahria-event-portal.bahria-event-portal.workers.dev`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Bahria Fiesta 2026 Official Pass',
        text: text,
        url: window.location.origin
      });
      return;
    } catch (e) {
      // User cancelled or share dismissed
    }
  }

  const phone = (p.phone || '').replace(/\D/g, '');
  const url = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function shareStudentTicketWa(regId) {
  const reg = allRegistrations.find(r => r.id === regId);
  if (!reg) return;

  const text = 
    `🎟️ *Bahria Fiesta & TechFest 2026 Official Entry Pass*\n\n` +
    `Hello ${reg.full_name},\n` +
    `Your official verified admission pass has been issued!\n\n` +
    `🎓 *Roll Number:* ${reg.roll_no}\n` +
    `💳 *Receipt / TRX:* ${reg.receipt_no || reg.trx_id || 'CONFIRMED'}\n` +
    `🏛️ *Department:* ${reg.department || 'BU'}\n` +
    `🟢 *Status:* 100% VERIFIED PASS\n\n` +
    `Present this pass or your QR at the gate for admission.\n` +
    `View pass online: https://bahria-event-portal.bahria-event-portal.workers.dev`;

  const phone = (reg.phone || '').replace(/\D/g, '');
  const url = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// -------------------------------------------------------------
// STAFF & PASSWORDS MANAGEMENT (FROM PHONE)
// -------------------------------------------------------------
let allStaffUsers = [];

async function loadStaffList() {
  const container = document.getElementById('staffListContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading staff accounts...</div>';

  try {
    const res = await fetch('/api/admin/staff/list');
    const data = await res.json();
    if (!data.success) {
      container.innerHTML = '<div style="color: #f87171; padding: 1rem;">Failed to load staff list.</div>';
      return;
    }

    allStaffUsers = data.staff || [];
    renderStaffList(allStaffUsers);
  } catch (err) {
    container.innerHTML = '<div style="color: #f87171; padding: 1rem;">Network error loading staff.</div>';
  }
}

function renderStaffList(staff) {
  const container = document.getElementById('staffListContainer');
  if (!container) return;

  if (!staff || staff.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No staff users found. Click "Add New Staff User" to create one.</div>';
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
      ${staff.map((u, sIdx) => {
        let roleBadge = '<span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc;">' + escapeHtml(u.role) + '</span>';
        if (u.role === 'JUDGE') roleBadge = '<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">⚖️ JUDGE</span>';
        else if (u.role === 'ADMIN') roleBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">👑 ADMIN</span>';
        else if (u.role === 'FINANCE') roleBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">📒 FINANCE</span>';
        else if (u.role === 'CASHIER') roleBadge = '<span class="badge" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24;">💼 CASHIER</span>';
        else if (u.role === 'GATE_SCANNER') roleBadge = '<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">📷 SCANNER</span>';

        const pass = u.plain_passcode || '';
        return `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--bg-card-border); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.85rem;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                <div>
                  <strong style="font-size: 1.1rem; color: #fff;">${escapeHtml(u.full_name)}</strong>
                  ${u.title ? `<div style="font-size: 0.78rem; color: #94a3b8; margin-top: 2px;">${escapeHtml(u.title)}</div>` : ''}
                </div>
                ${roleBadge}
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                Username: <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 6px; color: #38bdf8;">${escapeHtml(u.username)}</code>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
                Password: 
                ${pass ? `
                  <span id="legacyStaffPass_${sIdx}" data-pass="${escapeHtml(pass)}" data-hidden="true" style="color: #cbd5e1; font-family: monospace; letter-spacing: 1px;">••••••••</span>
                  <button type="button" onclick="const el=document.getElementById('legacyStaffPass_${sIdx}'); const btn=this; if(el.dataset.hidden==='true'){ el.textContent=el.dataset.pass; el.dataset.hidden='false'; btn.textContent='🙈'; }else{ el.textContent='••••••••'; el.dataset.hidden='true'; btn.textContent='👁️'; }" style="background:none; border:none; color:#38bdf8; cursor:pointer; font-size:0.75rem;">👁️</button>
                ` : `<span style="color: #64748b; font-size: 0.75rem;">[PBKDF2 Hash]</span>`}
              </div>
              ${u.phone ? `<div style="font-size: 0.8rem; color: var(--text-muted);">Phone: ${escapeHtml(u.phone)}</div>` : ''}
            </div>

            <div style="display: flex; gap: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem;">
              <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="openEditStaffModal('${u.id}')">
                ✏️ Change Password / Edit
              </button>
              ${u.username !== 'admin' && u.username !== 'maajid' ? `
                <button class="btn btn-outline btn-sm" style="color: #f87171; border-color: rgba(239,68,68,0.3);" onclick="deleteStaffUser('${u.id}', '${escapeHtml(u.username)}')">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Hook up Add Staff Button
document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('btnOpenAddStaffModal');
  if (addBtn) addBtn.addEventListener('click', openAddStaffModal);

  // Hook up Expense Form Save in Admin
  const saveExpBtn = document.getElementById('btnSaveExpense');
  if (saveExpBtn) {
    saveExpBtn.addEventListener('click', async () => {
      const category = document.getElementById('expCategory').value;
      const amount = document.getElementById('expAmount').value;
      const paid_to = document.getElementById('expPaidTo').value.trim();
      const recorded_by = document.getElementById('expRecordedBy').value.trim() || 'Admin';
      const description = document.getElementById('expDesc').value.trim();

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        alert('Please enter a valid expense amount');
        return;
      }

      saveExpBtn.disabled = true;
      saveExpBtn.textContent = 'Saving...';

      try {
        const res = await fetch('/api/finance/expense/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, amount, paid_to, recorded_by, description })
        });
        const data = await res.json();
        if (data.success) {
          alert('Expense logged successfully!');
          document.getElementById('expAmount').value = '';
          document.getElementById('expPaidTo').value = '';
          document.getElementById('expDesc').value = '';
          loadFinanceLedger();
        } else {
          alert(data.error || 'Could not save expense');
        }
      } catch (e) {
        alert('Server connection error');
      } finally {
        saveExpBtn.disabled = false;
        saveExpBtn.textContent = '➕ Log Expense in Ledger';
      }
    });
  }
});

function openAddStaffModal() {
  document.getElementById('staffId').value = '';
  document.getElementById('staffFullName').value = '';
  document.getElementById('staffUsername').value = '';
  document.getElementById('staffPassword').value = '';
  document.getElementById('staffPassword').placeholder = 'Assign password (required)';
  document.getElementById('staffPassword').required = true;
  document.getElementById('staffRole').value = 'CASHIER';
  document.getElementById('staffPhone').value = '';
  document.getElementById('staffModalTitle').textContent = '➕ Add New Staff Account';
  document.getElementById('staffModal').style.display = 'flex';
}

function openEditStaffModal(id) {
  const u = allStaffUsers.find(s => s.id === id);
  if (!u) return;

  document.getElementById('staffId').value = u.id;
  document.getElementById('staffFullName').value = u.full_name;
  document.getElementById('staffUsername').value = u.username;
  document.getElementById('staffPassword').value = u.plain_passcode || '';
  document.getElementById('staffPassword').placeholder = 'Set or update password';
  document.getElementById('staffPassword').required = false;
  document.getElementById('staffRole').value = u.role;
  document.getElementById('staffPhone').value = u.phone || '';
  document.getElementById('staffModalTitle').textContent = `✏️ Edit ${u.full_name}`;
  document.getElementById('staffModal').style.display = 'flex';
}

function closeStaffModal() {
  document.getElementById('staffModal').style.display = 'none';
}

async function handleStaffSave(e) {
  e.preventDefault();
  const id = document.getElementById('staffId').value.trim();
  const full_name = document.getElementById('staffFullName').value.trim();
  const username = document.getElementById('staffUsername').value.trim();
  const password = document.getElementById('staffPassword').value.trim();
  const role = document.getElementById('staffRole').value;
  const phone = document.getElementById('staffPhone').value.trim();

  const btn = document.getElementById('btnSaveStaff');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/admin/staff/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, full_name, username, password, role, phone, is_active: 1 })
    });
    const data = await res.json();

    if (data.success) {
      alert(data.message || 'Staff account saved successfully!');
      closeStaffModal();
      loadStaffList();
    } else {
      alert(data.error || 'Failed to save staff account');
    }
  } catch (err) {
    alert('Server error saving staff account');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save Account';
  }
}

async function deleteStaffUser(id, username) {
  if (!confirm(`Are you sure you want to delete staff account '${username}'?`)) return;

  try {
    const res = await fetch('/api/admin/staff/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Staff user '${username}' deleted.`);
      loadStaffList();
    } else {
      alert(data.error || 'Failed to delete staff user');
    }
  } catch (e) {
    alert('Error connecting to server.');
  }
}

// -------------------------------------------------------------
// SETTINGS & MULTI-NUMBER RECEIVING ACCOUNTS CONTROLLER
// -------------------------------------------------------------
let currentReceivingAccounts = [];

async function loadSettingsView() {
  const container = document.getElementById('receivingAccountsContainer');
  if (container) container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading receiving accounts...</div>';

  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      const s = data.settings;
      if (document.getElementById('cfgSupportPhone')) document.getElementById('cfgSupportPhone').value = s.support_phone || '03175230209';
      if (document.getElementById('cfgSupportWhatsapp')) document.getElementById('cfgSupportWhatsapp').value = s.support_whatsapp || '923175230209';
      if (document.getElementById('cfgTicketFee')) document.getElementById('cfgTicketFee').value = s.test_fee_pkr || '1.0';

      currentReceivingAccounts = Array.isArray(s.receiving_accounts) ? s.receiving_accounts : [];
      if (currentReceivingAccounts.length === 0) {
        currentReceivingAccounts = [
          {
            id: 'acc-1',
            bank: 'Easypaisa',
            title: s.easypaisa_account_title || 'MAJID ULLAH JAN',
            number: s.easypaisa_account_number || '03175230209',
            is_active: true,
            is_primary: true
          }
        ];
      }
      renderReceivingAccounts(currentReceivingAccounts);
    }
  } catch (err) {
    if (container) container.innerHTML = '<div style="color: #f87171; padding: 1rem;">Failed to load settings.</div>';
  }
}

function renderReceivingAccounts(accounts) {
  const container = document.getElementById('receivingAccountsContainer');
  if (!container) return;

  if (!accounts || accounts.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No receiving accounts configured. Click "+ Add Another Receiving Number" to add one.</div>';
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
      ${accounts.map((acc, idx) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid ${acc.is_active ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.08)'}; border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; font-weight: 700;">
                ${escapeHtml(acc.bank || 'Easypaisa')}
              </span>
              <span class="badge" style="background: ${acc.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)'}; color: ${acc.is_active ? '#34d399' : '#94a3b8'};">
                ${acc.is_active ? '🟢 Active (Visible)' : '⚪ Inactive'}
              </span>
            </div>
            <div style="font-size: 1.2rem; font-family: monospace; font-weight: 800; color: #fff; letter-spacing: 0.5px; margin-bottom: 4px;">
              ${escapeHtml(acc.number)}
            </div>
            <div style="font-size: 0.9rem; color: #cbd5e1; font-weight: 600;">
              Title: ${escapeHtml(acc.title)}
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.25rem;">
            <button class="btn btn-outline btn-sm" onclick="toggleAccountActive('${acc.id}')" style="font-size: 0.75rem;">
              ${acc.is_active ? 'Disable' : 'Enable'}
            </button>
            <button class="btn btn-outline btn-sm" onclick="openEditAccountModal('${acc.id}')" style="font-size: 0.75rem;">
              ✏️ Edit
            </button>
            ${accounts.length > 1 ? `
              <button class="btn btn-outline btn-sm" onclick="deleteAccount('${acc.id}')" style="font-size: 0.75rem; color: #f87171;">
                🗑️ Remove
              </button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.openAddAccountModal = function() {
  document.getElementById('accId').value = '';
  document.getElementById('accBank').value = 'Easypaisa';
  document.getElementById('accTitle').value = 'MAJID ULLAH JAN';
  document.getElementById('accNumber').value = '';
  document.getElementById('accIsActive').checked = true;
  document.getElementById('accountModalTitle').textContent = '➕ Add Receiving Number';
  document.getElementById('accountModal').style.display = 'flex';
};

window.openEditAccountModal = function(id) {
  const acc = currentReceivingAccounts.find(a => a.id === id);
  if (!acc) return;
  document.getElementById('accId').value = acc.id;
  document.getElementById('accBank').value = acc.bank || 'Easypaisa';
  document.getElementById('accTitle').value = acc.title || '';
  document.getElementById('accNumber').value = acc.number || '';
  document.getElementById('accIsActive').checked = acc.is_active !== false;
  document.getElementById('accountModalTitle').textContent = `✏️ Edit Account ${acc.number}`;
  document.getElementById('accountModal').style.display = 'flex';
};

window.closeAccountModal = function() {
  document.getElementById('accountModal').style.display = 'none';
};

window.handleAccountSave = async function(e) {
  e.preventDefault();
  const id = document.getElementById('accId').value.trim();
  const bank = document.getElementById('accBank').value;
  const title = document.getElementById('accTitle').value.trim();
  const number = document.getElementById('accNumber').value.trim();
  const is_active = document.getElementById('accIsActive').checked;

  const btn = document.getElementById('btnSaveAccount');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (id) {
      // Update existing
      const idx = currentReceivingAccounts.findIndex(a => a.id === id);
      if (idx !== -1) {
        currentReceivingAccounts[idx] = { id, bank, title, number, is_active };
      }
    } else {
      // Add new
      const newId = `acc-${Date.now().toString(36)}`;
      currentReceivingAccounts.push({ id: newId, bank, title, number, is_active });
    }

    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'receiving_accounts', value: currentReceivingAccounts })
    });
    const data = await res.json();
    if (data.success) {
      closeAccountModal();
      renderReceivingAccounts(currentReceivingAccounts);
      alert('Receiving accounts updated successfully!');
    } else {
      alert(data.error || 'Failed to update accounts');
    }
  } catch (err) {
    alert('Server error updating receiving accounts');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save Account Number';
  }
};

window.toggleAccountActive = async function(id) {
  const acc = currentReceivingAccounts.find(a => a.id === id);
  if (!acc) return;
  acc.is_active = !acc.is_active;

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'receiving_accounts', value: currentReceivingAccounts })
    });
    const data = await res.json();
    if (data.success) {
      renderReceivingAccounts(currentReceivingAccounts);
    }
  } catch (e) {
    alert('Error updating account status');
  }
};

window.deleteAccount = async function(id) {
  if (currentReceivingAccounts.length <= 1) {
    alert('You must keep at least one receiving account active.');
    return;
  }
  if (!confirm('Are you sure you want to remove this receiving account number?')) return;

  currentReceivingAccounts = currentReceivingAccounts.filter(a => a.id !== id);

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'receiving_accounts', value: currentReceivingAccounts })
    });
    const data = await res.json();
    if (data.success) {
      renderReceivingAccounts(currentReceivingAccounts);
    }
  } catch (e) {
    alert('Error deleting account');
  }
};

window.saveGeneralSettings = async function(e) {
  e.preventDefault();
  const phone = document.getElementById('cfgSupportPhone').value.trim();
  const whatsapp = document.getElementById('cfgSupportWhatsapp').value.trim();
  const fee = document.getElementById('cfgTicketFee').value.trim();

  const btn = document.getElementById('btnSaveGeneralSettings');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          support_phone: phone,
          support_whatsapp: whatsapp,
          test_fee_pkr: fee
        }
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Event settings saved successfully!');
    } else {
      alert(data.error || 'Failed to save settings');
    }
  } catch (e) {
    alert('Error saving settings');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save Event Settings';
  }
};

/* ==========================================================================
   STALLS & VENDORS MANAGEMENT CONTROLLER
   ========================================================================== */

async function loadStallsData() {
  const tbody = document.getElementById('stallsTbody');
  const cardsContainer = document.getElementById('adminStallMobileCardsContainer');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⏳</div>
          Loading stall proposals...
        </td>
      </tr>
    `;
  }
  if (cardsContainer) {
    cardsContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Loading stalls...</div>';
  }

  try {
    const res = await fetch('/api/admin/stalls');
    const data = await res.json();

    if (!data.success) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#f87171;padding:2rem;">${data.error || 'Failed to load stalls'}</td></tr>`;
      return;
    }

    allStalls = data.stalls || [];

    // Update KPI metrics
    const m = data.metrics || {};
    const setElem = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElem('metricStallTotal', m.total_stalls || 0);
    setElem('metricStallPending', m.pending_review || 0);
    setElem('metricStallApproved', m.approved_for_payment || 0);
    setElem('metricStallVerifying', m.verifying_payment || 0);
    setElem('metricStallVerified', m.verified_paid || 0);
    setElem('metricStallRevenue', 'Rs. ' + Number(m.total_stall_revenue || 0).toLocaleString());

    renderStallsTable();
  } catch (err) {
    console.error('Failed to load stalls:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#f87171;padding:2rem;">Failed to load stall proposals: ${err.message}</td></tr>`;
    }
  }
}

function renderStallsTable() {
  const tbody = document.getElementById('stallsTbody');
  const cardsContainer = document.getElementById('adminStallMobileCardsContainer');
  if (!tbody) return;

  const searchQuery = (document.getElementById('stallSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('stallFilterStatus')?.value || 'ALL';

  let filtered = allStalls.filter(stall => {
    if (statusFilter !== 'ALL' && stall.status !== statusFilter) return false;
    if (!searchQuery) return true;

    const hay = [
      stall.stall_name,
      stall.brand_or_society,
      stall.applicant_name,
      stall.applicant_phone,
      stall.applicant_email,
      stall.roll_no,
      stall.category,
      stall.id,
      stall.trx_id,
      stall.requirements,
      stall.description
    ].join(' ').toLowerCase();

    return hay.includes(searchQuery);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          No stall applications found matching the selected filter.
        </td>
      </tr>
    `;
    if (cardsContainer) {
      cardsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No stalls found.</div>';
    }
    return;
  }

  // Render Desktop Table Rows
  tbody.innerHTML = filtered.map(stall => {
    const categoryBadge = getCategoryBadge(stall.category);
    const statusBadge = getStallStatusBadge(stall.status);
    const phoneClean = (stall.applicant_phone || '').replace(/\D/g, '');
    const waUrl = `https://wa.me/${phoneClean.startsWith('0') ? '92' + phoneClean.slice(1) : phoneClean}?text=${encodeURIComponent(`Hi ${stall.applicant_name}, regarding your stall application '${stall.stall_name}' for Bahria Fiesta 2026:`)}`;

    const feeDisplay = (stall.agreed_fee && stall.agreed_fee > 0)
      ? `<strong style="color: #34d399; font-family: monospace; font-size: 1rem;">Rs. ${Number(stall.agreed_fee).toLocaleString()}</strong>`
      : `<span style="color: #fbbf24; font-size: 0.8rem; font-style: italic;">Under Discussion</span>`;

    const paymentDisplay = stall.status === 'VERIFIED'
      ? `<div style="font-family: monospace; color: #34d399; font-size: 0.85rem;">TRX: ${stall.trx_id || 'CONFIRMED'}</div><span class="badge" style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 0.72rem;">${stall.payment_method || 'PAID'}</span>`
      : stall.status === 'VERIFYING_PAYMENT'
      ? `<div style="font-family: monospace; color: #fb923c; font-size: 0.85rem;">TRX: ${stall.trx_id || 'PENDING'}</div><span class="badge" style="background: rgba(249,115,22,0.2); color: #fb923c; font-size: 0.72rem;">Verifying Slip</span>`
      : `<span style="color: var(--text-muted); font-size: 0.8rem;">Not Paid</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${escapeHtml(stall.stall_name)}</div>
          ${stall.brand_or_society ? `<div style="font-size: 0.78rem; color: #a5b4fc;">${escapeHtml(stall.brand_or_society)}</div>` : ''}
          <div style="margin-top: 4px;">${categoryBadge}</div>
          <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">ID: ${stall.id}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #fff;">${escapeHtml(stall.applicant_name)}</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
            <a href="${waUrl}" target="_blank" class="btn btn-wa btn-sm" style="padding: 2px 7px; font-size: 0.75rem; text-decoration: none; border-radius: 4px;" title="Chat with applicant on WhatsApp">
              💬 ${stall.applicant_phone}
            </a>
          </div>
          ${stall.applicant_email ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(stall.applicant_email)}</div>` : ''}
          ${stall.roll_no ? `<div style="font-family: monospace; font-size: 0.75rem; color: #38bdf8;">Roll: ${escapeHtml(stall.roll_no)}</div>` : ''}
        </td>
        <td style="max-width: 250px;">
          <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.3;">
            ${stall.requirements ? `<strong style="color: #fde68a;">Req:</strong> ${escapeHtml(stall.requirements)}<br>` : ''}
            ${stall.description ? `<span style="color: var(--text-muted); font-size: 0.78rem;">${escapeHtml(stall.description)}</span>` : ''}
          </div>
          ${stall.admin_notes ? `<div style="margin-top: 4px; padding: 4px 8px; background: rgba(56,189,248,0.1); border-left: 2px solid #38bdf8; font-size: 0.75rem; color: #bae6fd;"><strong>Note:</strong> ${escapeHtml(stall.admin_notes)}</div>` : ''}
        </td>
        <td>${statusBadge}</td>
        <td>${feeDisplay}</td>
        <td>${paymentDisplay}</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <a href="${waUrl}" target="_blank" class="btn btn-wa btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" title="Open WhatsApp Chat">
              💬 Chat
            </a>

            ${stall.status !== 'VERIFIED' ? `
              <button class="btn btn-primary btn-sm" onclick="openStallApproveModal('${stall.id}')" style="padding: 4px 8px; font-size: 0.75rem;">
                ⚙️ Approve & Fee
              </button>
              <button class="btn btn-emerald btn-sm" onclick="markStallCashPaid('${stall.id}', '${escapeAttr(stall.stall_name)}', ${stall.agreed_fee || 0})" style="padding: 4px 8px; font-size: 0.75rem;" title="Vendor paid in cash directly">
                💵 Mark Cash Paid
              </button>
            ` : ''}

            ${stall.status === 'VERIFIED' ? `
              <button class="btn btn-emerald btn-sm" onclick="openStallPassModal('${stall.id}')" style="padding: 4px 8px; font-size: 0.75rem;">
                🎟️ View Pass
              </button>
            ` : ''}

            ${stall.status !== 'REJECTED' && stall.status !== 'VERIFIED' ? `
              <button class="btn btn-outline btn-sm" onclick="rejectStall('${stall.id}', '${escapeAttr(stall.stall_name)}')" style="padding: 4px 8px; font-size: 0.75rem; color: #f87171; border-color: rgba(248,113,113,0.3);">
                ✕ Reject
              </button>
            ` : ''}

            <button class="btn btn-outline btn-sm" onclick="deleteStall('${stall.id}', '${escapeAttr(stall.stall_name)}')" style="padding: 4px 6px; font-size: 0.75rem; color: #94a3b8; border-color: rgba(255,255,255,0.1);" title="Delete Record">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Render Mobile Phone Cards (Optimized touch interface)
  if (cardsContainer) {
    cardsContainer.innerHTML = filtered.map(stall => {
      const categoryBadge = getCategoryBadge(stall.category);
      const statusBadge = getStallStatusBadge(stall.status);
      const phoneClean = (stall.applicant_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneClean.startsWith('0') ? '92' + phoneClean.slice(1) : phoneClean}?text=${encodeURIComponent(`Hi ${stall.applicant_name}, regarding your stall application '${stall.stall_name}' for Bahria Fiesta 2026:`)}`;

      return `
        <div class="mobile-stall-card" style="background: var(--bg-card); border: 1px solid var(--bg-card-border); border-radius: 16px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
            <div>
              <div style="font-weight: 800; color: #fff; font-size: 1.1rem;">${escapeHtml(stall.stall_name)}</div>
              ${stall.brand_or_society ? `<div style="font-size: 0.8rem; color: #a5b4fc;">${escapeHtml(stall.brand_or_society)}</div>` : ''}
            </div>
            <div>${statusBadge}</div>
          </div>

          <div style="display: flex; gap: 6px; margin-bottom: 0.75rem; flex-wrap: wrap;">
            ${categoryBadge}
            <span class="badge" style="background: rgba(255,255,255,0.06); color: #cbd5e1; font-family: monospace; font-size: 0.72rem;">ID: ${stall.id}</span>
          </div>

          <div style="background: rgba(255,255,255,0.02); border-radius: 10px; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.85rem;">
            <div style="color: var(--text-secondary); margin-bottom: 2px;">
              Contact: <strong style="color: #fff;">${escapeHtml(stall.applicant_name)}</strong>
              ${stall.roll_no ? ` (${stall.roll_no})` : ''}
            </div>
            ${stall.requirements ? `<div style="color: #fde68a; margin-top: 4px;"><strong>Req:</strong> ${escapeHtml(stall.requirements)}</div>` : ''}
            ${stall.admin_notes ? `<div style="color: #38bdf8; margin-top: 4px; font-size: 0.8rem;"><strong>Space/Notes:</strong> ${escapeHtml(stall.admin_notes)}</div>` : ''}
            <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted);">Agreed Fee:</span>
              <strong style="color: #34d399; font-size: 1.05rem; font-family: monospace;">
                ${stall.agreed_fee > 0 ? `Rs. ${Number(stall.agreed_fee).toLocaleString()}` : 'Under Discussion'}
              </strong>
            </div>
            ${stall.trx_id ? `<div style="font-family: monospace; color: #a5b4fc; font-size: 0.78rem; margin-top: 4px;">TRX: ${stall.trx_id} (${stall.payment_method || 'EASYPAISA'})</div>` : ''}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <a href="${waUrl}" target="_blank" class="btn btn-wa" style="text-align: center; text-decoration: none; font-size: 0.85rem; padding: 0.6rem;">
              💬 WhatsApp
            </a>

            ${stall.status !== 'VERIFIED' ? `
              <button class="btn btn-primary" onclick="openStallApproveModal('${stall.id}')" style="font-size: 0.85rem; padding: 0.6rem;">
                ⚙️ Set Fee & Space
              </button>
            ` : `
              <button class="btn btn-emerald" onclick="openStallPassModal('${stall.id}')" style="font-size: 0.85rem; padding: 0.6rem;">
                🎟️ View Pass
              </button>
            `}
          </div>

          ${stall.status !== 'VERIFIED' ? `
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
              <button class="btn btn-emerald btn-sm" onclick="markStallCashPaid('${stall.id}', '${escapeAttr(stall.stall_name)}', ${stall.agreed_fee || 0})" style="flex: 2; font-size: 0.78rem;">
                💵 Mark Cash Paid
              </button>
              <button class="btn btn-outline btn-sm" onclick="rejectStall('${stall.id}', '${escapeAttr(stall.stall_name)}')" style="flex: 1; font-size: 0.78rem; color: #f87171;">
                Reject
              </button>
              <button class="btn btn-outline btn-sm" onclick="deleteStall('${stall.id}', '${escapeAttr(stall.stall_name)}')" style="font-size: 0.78rem;">
                🗑️
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }
}

function getCategoryBadge(category) {
  const cat = (category || 'OTHER').toUpperCase();
  const map = {
    FOOD: { label: '🍔 Food & Drink', bg: 'rgba(239,68,68,0.2)', text: '#fca5a5' },
    TECH: { label: '💻 Tech / AI Project', bg: 'rgba(56,189,248,0.2)', text: '#7dd3fc' },
    GAMING: { label: '🎮 Gaming & VR', bg: 'rgba(168,85,247,0.2)', text: '#d8b4fe' },
    MERCHANDISE: { label: '👕 Apparel & Crafts', bg: 'rgba(16,185,129,0.2)', text: '#6ee7b7' },
    SOCIETY: { label: '🎓 Student Club', bg: 'rgba(99,102,241,0.2)', text: '#a5b4fc' },
    BOOKFAIR: { label: '📚 Book / Stationery', bg: 'rgba(245,158,11,0.2)', text: '#fde68a' },
    OTHER: { label: '🎪 General Stall', bg: 'rgba(148,163,184,0.2)', text: '#cbd5e1' }
  };
  const b = map[cat] || map.OTHER;
  return `<span class="badge" style="background: ${b.bg}; color: ${b.text}; font-size: 0.72rem; padding: 2px 7px; border-radius: 4px;">${b.label}</span>`;
}

function getStallStatusBadge(status) {
  switch (status) {
    case 'PENDING_REVIEW':
      return `<span class="badge" style="background: rgba(245,158,11,0.2); color: #fde68a; border: 1px solid rgba(245,158,11,0.4);">⏳ Under Review</span>`;
    case 'APPROVED_FOR_PAYMENT':
      return `<span class="badge" style="background: rgba(56,189,248,0.2); color: #7dd3fc; border: 1px solid rgba(56,189,248,0.4);">💳 Approved (Unpaid)</span>`;
    case 'VERIFYING_PAYMENT':
      return `<span class="badge" style="background: rgba(249,115,22,0.2); color: #fdba74; border: 1px solid rgba(249,115,22,0.4);">🔍 Verifying Slip</span>`;
    case 'VERIFIED':
      return `<span class="badge" style="background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.4);">🟢 Paid & Pass Issued</span>`;
    case 'REJECTED':
      return `<span class="badge" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4);">❌ Rejected</span>`;
    default:
      return `<span class="badge">${status || 'PENDING'}</span>`;
  }
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Modal Handlers
window.openStallApproveModal = function(stallId) {
  const stall = allStalls.find(s => s.id === stallId);
  if (!stall) return;

  currentActiveStall = stall;

  document.getElementById('apprStallId').value = stall.id;
  document.getElementById('apprStallName').textContent = stall.stall_name;
  document.getElementById('apprStallCategory').textContent = `${stall.category} • ${stall.brand_or_society || 'Independent'}`;
  document.getElementById('apprStallIdBadge').textContent = stall.id;
  document.getElementById('apprApplicantName').textContent = stall.applicant_name;
  document.getElementById('apprApplicantPhone').textContent = stall.applicant_phone;
  document.getElementById('apprRequirements').textContent = stall.requirements ? `Requirements: ${stall.requirements}` : 'No special equipment requested';

  document.getElementById('apprAgreedFee').value = stall.agreed_fee > 0 ? stall.agreed_fee : 5000;
  document.getElementById('apprAdminNotes').value = stall.admin_notes || 'Spot approved by committee. 1 Table, 2 Chairs provided.';

  document.getElementById('stallApproveModal').style.display = 'flex';
};

window.closeStallApproveModal = function() {
  document.getElementById('stallApproveModal').style.display = 'none';
  currentActiveStall = null;
};

window.setFeePreset = function(amount) {
  const input = document.getElementById('apprAgreedFee');
  if (input) input.value = amount;
};

window.submitStallApproval = async function(e) {
  e.preventDefault();
  const stallId = document.getElementById('apprStallId').value;
  const agreedFee = parseFloat(document.getElementById('apprAgreedFee').value);
  const adminNotes = document.getElementById('apprAdminNotes').value.trim();

  if (isNaN(agreedFee) || agreedFee <= 0) {
    alert('Please enter a valid agreed fee amount in PKR.');
    return;
  }

  try {
    const res = await fetch('/api/admin/stall/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stall_id: stallId,
        action: 'APPROVE_FOR_PAYMENT',
        agreed_fee: agreedFee,
        admin_notes: adminNotes
      })
    });
    const data = await res.json();

    if (data.success) {
      alert(`Stall approved successfully! Fee set to Rs. ${agreedFee}. The vendor can now proceed to pay via the portal.`);
      closeStallApproveModal();
      loadStallsData();
    } else {
      alert(data.error || 'Failed to approve stall');
    }
  } catch (err) {
    alert('Network error while approving stall: ' + err.message);
  }
};

window.markStallCashPaid = async function(stallId, stallName, currentFee) {
  const promptFee = prompt(`Confirm Cash Payment for '${stallName}':\nEnter cash amount collected (PKR):`, currentFee > 0 ? currentFee : 5000);
  if (!promptFee) return;

  const fee = parseFloat(promptFee);
  if (isNaN(fee) || fee <= 0) {
    alert('Invalid amount entered.');
    return;
  }

  try {
    const res = await fetch('/api/admin/stall/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stall_id: stallId,
        action: 'MARK_CASH_PAID',
        agreed_fee: fee,
        admin_notes: `Cash fee of Rs. ${fee} received directly by event admin`
      })
    });
    const data = await res.json();

    if (data.success) {
      alert(`Stall '${stallName}' verified! Official QR pass generated.`);
      loadStallsData();
    } else {
      alert(data.error || 'Failed to mark cash paid');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
};

window.rejectStall = async function(stallId, stallName) {
  const reason = prompt(`Reject Stall Application for '${stallName}':\nEnter reason for rejection:`, 'Space full / Proposal not aligned with event theme');
  if (reason === null) return;

  try {
    const res = await fetch('/api/admin/stall/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stall_id: stallId,
        action: 'REJECT',
        admin_notes: reason.trim() || 'Declined by committee'
      })
    });
    const data = await res.json();

    if (data.success) {
      alert(`Stall '${stallName}' marked as Rejected.`);
      loadStallsData();
    } else {
      alert(data.error || 'Failed to reject stall');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
};

window.deleteStall = async function(stallId, stallName) {
  if (!confirm(`Are you sure you want to permanently delete the application for '${stallName}'? This action cannot be undone.`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/stall/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stall_id: stallId,
        action: 'DELETE'
      })
    });
    const data = await res.json();

    if (data.success) {
      loadStallsData();
    } else {
      alert(data.error || 'Failed to delete stall');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
};

window.openStallPassModal = function(stallId) {
  const stall = allStalls.find(s => s.id === stallId);
  if (!stall) return;

  currentActiveStall = stall;

  document.getElementById('passStallName').textContent = stall.stall_name;
  document.getElementById('passStallCategory').textContent = `${stall.category} • ${stall.brand_or_society || 'Vendor Pass'}`;
  document.getElementById('passApplicantName').textContent = stall.applicant_name;
  document.getElementById('passApplicantPhone').textContent = stall.applicant_phone;
  document.getElementById('passFeeAndTrx').textContent = `FEE: Rs. ${Number(stall.agreed_fee || 0).toLocaleString()} • TRX: ${stall.trx_id || 'CONFIRMED'}`;
  document.getElementById('passLocationNote').textContent = stall.admin_notes || 'Official Turnstile Scannable Event Pass';

  const qrImg = document.getElementById('passStallQrImg');
  if (qrImg) {
    qrImg.src = stall.stall_qr || '';
  }

  const phoneClean = (stall.applicant_phone || '').replace(/\D/g, '');
  const waBtn = document.getElementById('btnStallWaShare');
  if (waBtn) {
    const waText = `Hi ${stall.applicant_name}! Congratulations, your stall '${stall.stall_name}' for Bahria Fiesta & TechFest 2026 has been officially confirmed and verified! You can view and download your official turnstile QR badge at: ${window.location.origin}/#stallPortal`;
    waBtn.onclick = () => {
      window.open(`https://wa.me/${phoneClean.startsWith('0') ? '92' + phoneClean.slice(1) : phoneClean}?text=${encodeURIComponent(waText)}`, '_blank');
    };
  }

  document.getElementById('stallPassModal').style.display = 'flex';
};

window.closeStallPassModal = function() {
  document.getElementById('stallPassModal').style.display = 'none';
  currentActiveStall = null;
};

window.downloadStallPassPng = function() {
  if (!currentActiveStall) return;
  const stall = currentActiveStall;

  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 620;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border with gradient
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(0.5, '#6366f1');
  grad.addColorStop(1, '#3b82f6');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 10;
  ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

  // Header banner
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.fillRect(20, 20, canvas.width - 40, 110);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('BAHRIA UNIVERSITY ISLAMABAD • TECHFEST & CULTURAL FIESTA 2026', 50, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px sans-serif';
  ctx.fillText('OFFICIAL STALL & VENDOR PASS', 50, 105);

  // Stall Details
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('STALL / BRAND NAME:', 50, 175);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(stall.stall_name, 50, 215);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('CATEGORY & SOCIETY:', 50, 265);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${stall.category} • ${stall.brand_or_society || 'Independent Vendor'}`, 50, 295);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('VENDOR / CONTACT PERSON:', 50, 345);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${stall.applicant_name} (${stall.applicant_phone})`, 50, 375);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('STALL REFERENCE & FEE:', 50, 425);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`${stall.id} • Rs. ${Number(stall.agreed_fee || 0).toLocaleString()} (PAID)`, 50, 455);

  if (stall.admin_notes) {
    ctx.fillStyle = '#fde68a';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText(`Location: ${stall.admin_notes}`, 50, 505);
  }

  // Security Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '13px sans-serif';
  ctx.fillText('Verified by Bahria Event Security • Scannable by Gate Turnstiles for 3-Day Festival Access', 50, 575);

  // Draw QR Code
  if (stall.stall_qr) {
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(690, 160, 260, 260);
      ctx.drawImage(qrImg, 700, 170, 240, 240);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN AT GATE ENTRY', 820, 450);

      // Trigger download
      const link = document.createElement('a');
      link.download = `Bahria_Stall_Pass_${stall.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = stall.stall_qr;
  }
};

// ==========================================
// IDEACRUX & PITCH POINT ADMIN CONTROLLER
// ==========================================
let allCruxTeams = [];

async function loadIdeaCruxData() {
  try {
    const res = await fetch('/api/admin/ideacrux/teams');
    const data = await res.json();
    if (!data.success) return;

    allCruxTeams = data.teams || [];
    const metrics = data.metrics || {};

    const totalEl = document.getElementById('metricCruxTotal');
    const pendingEl = document.getElementById('metricCruxPending');
    const verifiedEl = document.getElementById('metricCruxVerified');
    const revEl = document.getElementById('metricCruxRevenue');

    if (totalEl) totalEl.textContent = metrics.total_teams || 0;
    if (pendingEl) pendingEl.textContent = metrics.pending_review || 0;
    if (verifiedEl) verifiedEl.textContent = metrics.verified_paid || 0;
    if (revEl) revEl.textContent = `Rs. ${(metrics.total_revenue || 0).toLocaleString()}`;

    filterCruxTeamsAdmin();
  } catch (err) {
    console.error('Error loading IdeaCrux admin data:', err);
  }
}

window.filterCruxTeamsAdmin = function() {
  const searchInput = document.getElementById('cruxAdminSearchInput');
  const statusFilter = document.getElementById('cruxAdminStatusFilter')?.value || 'ALL';
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  let filtered = allCruxTeams.filter(team => {
    if (statusFilter !== 'ALL' && team.status !== statusFilter) return false;
    if (!query) return true;

    const hay = [
      team.id,
      team.team_name,
      team.startup_name,
      team.leader_name,
      team.leader_phone,
      team.leader_email,
      team.leader_dept,
      team.idea_description,
      team.problem_statement,
      team.startup_stage,
      team.trx_id
    ].join(' ').toLowerCase();

    return hay.includes(query);
  });

  renderCruxTable(filtered);
};

function renderCruxTable(list) {
  const tbody = document.getElementById('cruxAdminTbody');
  const cardsContainer = document.getElementById('adminCruxMobileCardsContainer');

  if (list.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">No IdeaCrux teams found matching the selected filter.</td></tr>';
    if (cardsContainer) cardsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No IdeaCrux teams found.</div>';
    return;
  }

  if (tbody) {
    tbody.innerHTML = list.map(team => {
      const isVerified = team.status === 'VERIFIED';
      const isPending = team.status === 'PENDING';
      const phoneClean = (team.leader_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneClean.startsWith('0') ? '92' + phoneClean.slice(1) : phoneClean}?text=${encodeURIComponent(`Hi ${team.leader_name}, regarding your IdeaCrux team '${team.team_name}' (Startup: ${team.startup_name}):`)}`;

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${escapeHtml(team.team_name)}</div>
            <div style="font-size: 0.8rem; color: #00f0d4; font-weight: 600;">Startup: ${escapeHtml(team.startup_name)}</div>
            <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">ID: ${team.id} (${team.members_count} Members)</div>
          </td>
          <td>
            <div style="font-weight: 600; color: #fff;">${escapeHtml(team.leader_name)}</div>
            <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
              <a href="${waUrl}" target="_blank" class="btn btn-wa btn-sm" style="padding: 2px 7px; font-size: 0.75rem; text-decoration: none; border-radius: 4px;" title="Chat with Leader on WhatsApp">
                💬 ${team.leader_phone}
              </a>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(team.leader_email || '')}</div>
            <div style="font-size: 0.72rem; color: #94a3b8;">${escapeHtml(team.leader_dept || 'BSEAS')}</div>
          </td>
          <td style="max-width: 260px;">
            <div style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.35;">
              <strong style="color: #67e8f9;">Problem:</strong> ${escapeHtml(team.problem_statement || '-')}<br>
              <span style="color: var(--text-muted); font-size: 0.78rem;"><strong>Idea:</strong> ${escapeHtml(team.idea_description || '-')}</span>
            </div>
          </td>
          <td>
            <span class="badge" style="background: rgba(0, 240, 212, 0.15); color: #00f0d4; font-size: 0.75rem; font-weight: 600;">
              ${escapeHtml(team.startup_stage || 'Idea Stage')}
            </span>
            ${team.pitch_deck_url ? `
              <div style="margin-top: 6px;">
                <a href="${team.pitch_deck_url}" target="_blank" class="btn btn-outline btn-sm" style="font-size: 0.72rem; padding: 2px 6px; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
                  📊 View Deck ↗
                </a>
              </div>
            ` : `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">No Deck Link</div>`}
          </td>
          <td>
            <strong style="color: #fff; font-family: monospace;">Rs. ${Number(team.fee_amount || 600).toLocaleString()}</strong>
            <div style="font-family: monospace; font-size: 0.78rem; color: ${team.trx_id ? '#34d399' : 'var(--text-muted)'}; margin-top: 2px;">
              ${team.trx_id ? `TRX: ${escapeHtml(team.trx_id)}` : (team.receipt_no ? `Receipt: ${escapeHtml(team.receipt_no)}` : 'Unpaid')}
            </div>
          </td>
          <td>
            <span class="badge" style="background: ${isVerified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${isVerified ? '#34d399' : '#fbbf24'}; font-size: 0.75rem; font-weight: 700;">
              ${team.status}
            </span>
            ${team.checked_in_at ? `
              <div style="font-size: 0.7rem; color: #34d399; margin-top: 4px;">
                ✓ Admitted to Auditorium
              </div>
            ` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <a href="${waUrl}" target="_blank" class="btn btn-wa btn-sm" style="padding: 3px 6px; font-size: 0.75rem;" title="WhatsApp Leader">
                💬
              </a>
              ${isPending ? `
                <button class="btn btn-emerald btn-sm" style="padding: 3px 7px; font-size: 0.75rem;" onclick="approveCruxTeam('${team.id}')" title="Approve & Generate Pitch Pass">
                  ✓
                </button>
                <button class="btn btn-primary btn-sm" style="padding: 3px 7px; font-size: 0.75rem;" onclick="markCruxCashPaid('${team.id}')" title="Mark Paid">
                  💵
                </button>
                <button class="btn btn-outline btn-sm" style="padding: 3px 6px; font-size: 0.75rem; color: #f87171;" onclick="rejectCruxTeam('${team.id}')" title="Reject Application">
                  ✕
                </button>
              ` : ''}
              ${isVerified ? `
                <a href="/ideacrux?team_id=${team.id}" target="_blank" class="btn btn-primary btn-sm" style="padding: 3px 7px; font-size: 0.75rem;" title="View Live Pitch Pass">
                  🎟️ Pass
                </a>
              ` : ''}
              <button class="btn btn-outline btn-sm" style="padding: 3px 6px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteCruxTeam('${team.id}')" title="Delete Team Record">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render Mobile Cards View for Phone Screens
  if (cardsContainer) {
    cardsContainer.innerHTML = list.map(team => {
      const isVerified = team.status === 'VERIFIED';
      const isPending = team.status === 'PENDING';
      const phoneDigits = (team.leader_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneDigits.startsWith('0') ? '92' + phoneDigits.slice(1) : phoneDigits}?text=${encodeURIComponent(`Hi ${team.leader_name}, regarding IdeaCrux team '${team.team_name}':`)}`;

      return `
        <div style="background: rgba(7, 33, 40, 0.6); border: 1px solid ${isVerified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 240, 212, 0.3)'}; border-radius: 14px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div>
              <div style="font-weight: 800; color: #fff; font-size: 1.1rem;">${escapeHtml(team.team_name)}</div>
              <div style="font-size: 0.85rem; color: #00f0d4; font-weight: 600;">Startup: ${escapeHtml(team.startup_name)}</div>
              <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                ID: ${team.id} • ${team.members_count} Member(s)
              </div>
            </div>
            <span class="badge" style="background: ${isVerified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${isVerified ? '#34d399' : '#fbbf24'}; font-size: 0.78rem; font-weight: 700;">
              ${team.status}
            </span>
          </div>

          <div style="font-size: 0.82rem; color: #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; background: rgba(0,0,0,0.3); padding: 0.65rem; border-radius: 8px;">
            <div><span style="color: var(--text-muted);">Leader:</span> <strong>${escapeHtml(team.leader_name)}</strong></div>
            <div><span style="color: var(--text-muted);">Dept:</span> ${escapeHtml(team.leader_dept || 'BSEAS H-11')}</div>
            <div><span style="color: var(--text-muted);">Stage:</span> <span style="color: #67e8f9;">${escapeHtml(team.startup_stage || 'Idea Stage')}</span></div>
            <div><span style="color: var(--text-muted);">Fee:</span> <strong style="color: #34d399;">Rs. 100</strong></div>
          </div>

          <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.35;">
            <strong style="color: #67e8f9;">Concept:</strong> ${escapeHtml(team.problem_statement || team.idea_description || 'No description provided')}
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; flex-wrap: wrap; margin-top: 4px;">
            <a href="${waUrl}" target="_blank" class="btn btn-wa btn-sm" style="text-decoration: none;">
              💬 WhatsApp
            </a>
            ${team.pitch_deck_url ? `
              <a href="${team.pitch_deck_url}" target="_blank" class="btn btn-outline btn-sm" style="border-color: rgba(56, 189, 248, 0.5); color: #38bdf8;">
                📊 Deck ↗
              </a>
            ` : ''}
            ${isPending ? `
              <button class="btn btn-emerald btn-sm" onclick="approveCruxTeam('${team.id}')">
                ✓ Approve
              </button>
              <button class="btn btn-primary btn-sm" onclick="markCruxCashPaid('${team.id}')">
                💵 Mark Paid
              </button>
              <button class="btn btn-outline btn-sm" style="color: #f87171;" onclick="rejectCruxTeam('${team.id}')">
                ✕ Reject
              </button>
            ` : ''}
            ${isVerified ? `
              <a href="/ideacrux?team_id=${team.id}" target="_blank" class="btn btn-primary btn-sm">
                🎟️ View Pass
              </a>
            ` : ''}
            <button class="btn btn-outline btn-sm" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" onclick="deleteCruxTeam('${team.id}')">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.approveCruxTeam = async function(teamId) {
  if (!confirm('Approve this startup team and issue their official IdeaCrux Pitch Pass?')) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'APPROVE' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team approved!');
      loadIdeaCruxData();
    } else {
      alert(data.error || 'Failed to approve team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.markCruxCashPaid = async function(teamId) {
  if (!confirm('Mark Rs. 100 registration fee as PAID for this team?')) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'MARK_PAID' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team marked as paid and verified!');
      loadIdeaCruxData();
    } else {
      alert(data.error || 'Failed to update team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.rejectCruxTeam = async function(teamId) {
  const reason = prompt('Please enter rejection reason (optional):');
  if (reason === null) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'REJECT', admin_notes: reason })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team application rejected.');
      loadIdeaCruxData();
    } else {
      alert(data.error || 'Failed to reject team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.deleteCruxTeam = async function(teamId) {
  if (!confirm(`Are you sure you want to permanently delete IdeaCrux team (${teamId})? This cannot be undone.`)) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'DELETE' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team record deleted.');
      loadIdeaCruxData();
    } else {
      alert(data.error || 'Failed to delete team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.exportCruxTeamsCSV = function() {
  if (!allCruxTeams || allCruxTeams.length === 0) {
    alert('No IdeaCrux teams available to export.');
    return;
  }

  const headers = [
    'Team ID',
    'Team Name',
    'Startup Name',
    'Leader Name',
    'Leader Phone',
    'Leader Email',
    'Leader Department',
    'Leader Semester',
    'Roster Count',
    'Member 2 Name',
    'Member 2 Phone',
    'Startup Stage',
    'Problem Statement',
    'Idea Summary',
    'Pitch Deck URL',
    'Fee Amount (PKR)',
    'Payment Method',
    'Receipt / TRX',
    'Status',
    'Cashier / Approver',
    'Registered At',
    'Admitted To Auditorium'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = allCruxTeams.map(t => [
    escapeCsv(t.id),
    escapeCsv(t.team_name),
    escapeCsv(t.startup_name),
    escapeCsv(t.leader_name),
    escapeCsv(t.leader_phone),
    escapeCsv(t.leader_email),
    escapeCsv(t.leader_dept),
    escapeCsv(t.leader_semester),
    escapeCsv(t.members_count),
    escapeCsv(t.member_2_name),
    escapeCsv(t.member_2_phone),
    escapeCsv(t.startup_stage),
    escapeCsv(t.problem_statement),
    escapeCsv(t.idea_description),
    escapeCsv(t.pitch_deck_url),
    escapeCsv(t.fee_amount || 600),
    escapeCsv(t.payment_method || 'EASYPAISA'),
    escapeCsv(t.receipt_no || t.trx_id),
    escapeCsv(t.status),
    escapeCsv(t.cashier_name || t.admin_notes),
    escapeCsv(t.created_at),
    escapeCsv(t.checked_in_at || 'NO')
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IdeaCrux_2025_Teams_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};


