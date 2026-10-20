const fs = require('fs');
const path = require('path');

// 1. Update public/finance.html
const htmlPath = path.join(__dirname, '../public/finance.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Insert CSS styles
const cssToInsert = `
    .pending-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(251, 191, 36, 0.3);
      border-left: 5px solid #fbbf24;
      border-radius: 16px;
      padding: 1.25rem 1.4rem;
      margin-bottom: 1rem;
      display: grid;
      grid-template-columns: 1fr 130px 180px;
      gap: 1.25rem;
      align-items: center;
      transition: all 0.2s ease;
    }
    .pending-card:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(251, 191, 36, 0.6);
      transform: translateY(-2px);
    }
    @media (max-width: 900px) {
      .pending-card {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
    }
    .slip-thumb-box {
      width: 100%;
      height: 95px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.18);
      background: #000;
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slip-thumb-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.25s ease;
    }
    .slip-thumb-box:hover img {
      transform: scale(1.08);
    }
    .slip-thumb-hover {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 0.72rem;
      font-weight: 700;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .slip-thumb-box:hover .slip-thumb-hover {
      opacity: 1;
    }
    .badge-crux {
      background: rgba(0, 240, 212, 0.15);
      color: #00f0d4;
      border: 1px solid rgba(0, 240, 212, 0.35);
      padding: 3px 8px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge-fiesta {
      background: rgba(99, 102, 241, 0.18);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.35);
      padding: 3px 8px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .badge-trx {
      background: rgba(255, 255, 255, 0.06);
      color: #f1f5f9;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
`;

if (!html.includes('.pending-card {')) {
  html = html.replace('  </style>', cssToInsert + '\n  </style>');
}

// Update top nav in finance.html to include quick links
const oldNavActions = `<div class="nav-actions">
      <div class="nav-user-badge" id="finUserBadge">
        <span>👤</span> <span id="finUserName">Head of Finance</span>
      </div>
      <a href="/admin.html" class="btn btn-outline btn-sm">🛡️ Director View</a>
      <a href="/desk.html" class="btn btn-outline btn-sm">💼 Cashier Desk</a>
      <button class="btn btn-outline btn-sm" id="btnRefreshFinance">🔄 Refresh</button>
      <a href="/login.html" class="btn btn-outline btn-sm" onclick="logoutStaff()">Logout</a>
    </div>`;

const newNavActions = `<div class="nav-actions" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
      <div class="nav-user-badge" id="finUserBadge">
        <span>👤</span> <span id="finUserName">Head of Finance</span>
      </div>
      <a href="/crux-desk.html" class="btn btn-outline btn-sm" style="color: #00f0d4; border-color: rgba(0, 240, 212, 0.4);">
        💡 Crux Desk
      </a>
      <a href="/desk.html" class="btn btn-outline btn-sm">
        💼 Fiesta Desk
      </a>
      <a href="/admin.html" class="btn btn-outline btn-sm">
        🛡️ Admin Console
      </a>
      <button class="btn btn-outline btn-sm" id="btnRefreshFinance">
        🔄 Refresh
      </button>
      <button class="btn btn-outline btn-sm" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4);" onclick="logoutStaff()">
        Logout
      </button>
    </div>`;

if (html.includes(oldNavActions)) {
  html = html.replace(oldNavActions, newNavActions);
}

// Add Pending Queue Section right before Section 1
const section0Html = `    <!-- Master Section 0: Pending Payment Slip Verification Queue -->
    <div class="glass-panel" style="margin-bottom: 2rem; border-color: rgba(251, 191, 36, 0.4); background: rgba(251, 191, 36, 0.02);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.85rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <h2 class="panel-title" style="margin-bottom: 0;">
              <span>📋</span> Pending Payment Slip Verification Queue
            </h2>
            <span class="badge-status badge-unapproved" id="pendingQueueBadge">
              0 Awaiting Review
            </span>
          </div>
          <p class="panel-subtitle" style="margin-top: 0.25rem;">
            Inspect uploaded payment screenshots (Zindigi, Easypaisa, Raast). Check stated TRX ID, then approve to generate & issue official digital QR passes.
          </p>
        </div>

        <!-- Filter Pills & Search -->
        <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.35rem; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 12px; border: 1px solid var(--bg-card-border);">
            <button type="button" class="btn btn-sm btn-primary" id="btnFilterAll" onclick="setQueueFilter('ALL')">
              All (<span id="countFilterAll">0</span>)
            </button>
            <button type="button" class="btn btn-sm btn-outline" id="btnFilterCrux" onclick="setQueueFilter('IDEACRUX')" style="color: #00f0d4; border-color: rgba(0, 240, 212, 0.3);">
              💡 IdeaCrux (<span id="countFilterCrux">0</span>)
            </button>
            <button type="button" class="btn btn-sm btn-outline" id="btnFilterFiesta" onclick="setQueueFilter('FIESTA')">
              🎪 Fiesta (<span id="countFilterFiesta">0</span>)
            </button>
          </div>
          <input type="text" id="queueSearchInput" class="form-control" placeholder="Search name, phone, TRX..." style="width: 220px; height: 38px; font-size: 0.85rem;" oninput="applyQueueSearch()">
        </div>
      </div>

      <div id="pendingRequestsContainer">
        <!-- Injected via finance.js -->
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          Loading pending payment slips...
        </div>
      </div>
    </div>
`;

const section1Marker = `    <!-- Section 1: Live Cashier Drawer Status & Handover Marker -->`;
if (html.includes(section1Marker) && !html.includes('Pending Payment Slip Verification Queue')) {
  html = html.replace(section1Marker, section0Html + '\n' + section1Marker);
}

// Add Slip Zoom Lightbox Modal right before <script src="finance.js"></script>
const zoomModalHtml = `  <!-- High-Res Slip Zoom Lightbox Modal -->
  <div class="modal-overlay" id="slipZoomModal" style="z-index: 1050;">
    <div class="modal-card" style="max-width: 720px; max-height: 94vh; display: flex; flex-direction: column;">
      <div class="modal-header">
        <div>
          <h3 class="modal-title" id="zoomModalTitle">Payment Slip Verification</h3>
          <div style="font-size: 0.82rem; color: var(--text-muted);" id="zoomModalSub">TRX: Checking...</div>
        </div>
        <button class="modal-close" onclick="closeSlipZoomModal()">✕</button>
      </div>

      <div style="flex: 1; overflow-y: auto; text-align: center; background: #000; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; min-height: 280px; max-height: 52vh; display: flex; align-items: center; justify-content: center;">
        <img id="zoomSlipImage" src="" alt="Payment Receipt Screenshot" style="max-width: 100%; max-height: 50vh; object-fit: contain; border-radius: 8px;">
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid var(--bg-card-border); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Applicant Details</div>
          <strong style="color: #fff; font-size: 1rem;" id="zoomModalApplicant">Ali Raza</strong>
          <div style="font-size: 0.82rem; color: var(--text-muted);" id="zoomModalContact">03123456789</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Registration Fee</div>
          <strong style="color: #34d399; font-size: 1.25rem;" id="zoomModalAmount">Rs. 100</strong>
        </div>
      </div>

      <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
        <button type="button" class="btn btn-outline" style="flex: 1;" onclick="closeSlipZoomModal()">Close</button>
        <button type="button" class="btn btn-outline" style="color: #f87171; border-color: rgba(239, 68, 68, 0.4); flex: 1;" id="btnZoomReject">
          ✕ Reject Slip
        </button>
        <button type="button" class="btn btn-emerald" style="flex: 2; font-weight: 700;" id="btnZoomApprove">
          ✓ Approve & Issue Pass
        </button>
      </div>
    </div>
  </div>
`;

if (!html.includes('id="slipZoomModal"')) {
  html = html.replace('  <script src="finance.js"></script>', zoomModalHtml + '\n  <script src="finance.js"></script>');
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✓ Successfully updated public/finance.html');

// 2. Update public/finance.js
const jsPath = path.join(__dirname, '../public/finance.js');
let js = fs.readFileSync(jsPath, 'utf8');

const jsAppend = `
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
    if (badge) badge.textContent = \`\${allPendingRequests.length} Awaiting Review\`;

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
    container.innerHTML = \`
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: rgba(255,255,255,0.015); border-radius: 14px;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
        <strong style="color: #fff; font-size: 1.05rem;">All caught up!</strong>
        <p style="font-size: 0.85rem; margin-top: 0.35rem;">No pending payment slips match your filter. Check back when new students register.</p>
      </div>
    \`;
    return;
  }

  container.innerHTML = list.map(item => {
    const isCrux = item.type === 'IDEACRUX';
    const typeBadge = isCrux 
      ? '<span class="badge-crux">💡 IDEACRUX STARTUP</span>'
      : '<span class="badge-fiesta">🎪 FIESTA ATTENDEE</span>';

    const hasSlip = item.has_screenshot && item.screenshot_preview;
    const thumbHtml = hasSlip
      ? \`
        <div class="slip-thumb-box" onclick="openSlipZoomModal('\${item.id}')" title="Click to inspect slip">
          <img src="\${item.screenshot_preview}" alt="Slip thumbnail">
          <div class="slip-thumb-hover">🔍 Zoom Slip</div>
        </div>
      \`
      : \`
        <div style="width: 100%; height: 95px; border-radius: 10px; border: 1px dashed rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 4px;">
          No Slip Image
        </div>
      \`;

    return \`
      <div class="pending-card" id="card-\${item.id}">
        <div>
          <div style="display: flex; gap: 0.6rem; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap;">
            \${typeBadge}
            <span class="badge-trx">TRX: \${escapeHtml(item.trx_id)}</span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">\${formatDate(item.created_at)}</span>
          </div>

          <div style="margin-bottom: 0.35rem;">
            <strong style="font-size: 1.15rem; color: #fff;">\${escapeHtml(item.title)}</strong>
            <span style="font-size: 0.88rem; color: var(--text-muted); margin-left: 0.4rem;">by \${escapeHtml(item.applicant_name)}</span>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45;">
            📞 <strong style="color: #f1f5f9;">\${escapeHtml(item.phone)}</strong> | ✉️ \${escapeHtml(item.email)}<br>
            <span style="color: #94a3b8;">\${escapeHtml(item.details)}</span>
          </div>
        </div>

        <div>
          \${thumbHtml}
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; justify-content: center;">
          <div style="text-align: right; margin-bottom: 0.2rem;">
            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Amount:</span>
            <strong style="color: #34d399; font-size: 1.1rem; margin-left: 4px;">Rs. \${(item.amount || 100).toLocaleString()}</strong>
          </div>
          <button class="btn btn-emerald btn-sm" style="font-weight: 700; width: 100%;" onclick="quickApproveRequest('\${item.type}', '\${item.id}', '\${escapeHtml(item.title)}')">
            ✓ Approve & Pass
          </button>
          <button class="btn btn-outline btn-sm" style="color: #f87171; border-color: rgba(239, 68, 68, 0.35); width: 100%;" onclick="quickRejectRequest('\${item.type}', '\${item.id}', '\${escapeHtml(item.title)}')">
            ✕ Reject
          </button>
        </div>
      </div>
    \`;
  }).join('');
}

function openSlipZoomModal(id) {
  const item = allPendingRequests.find(r => r.id === id);
  if (!item) return;

  activeZoomItem = item;

  document.getElementById('zoomModalTitle').textContent = \`Payment Slip: \${item.title}\`;
  document.getElementById('zoomModalSub').textContent = \`Type: \${item.type_label} | Stated TRX: \${item.trx_id}\`;
  document.getElementById('zoomModalApplicant').textContent = \`\${item.applicant_name} (\${item.title})\`;
  document.getElementById('zoomModalContact').textContent = \`\${item.phone} • \${item.email}\`;
  document.getElementById('zoomModalAmount').textContent = \`Rs. \${(item.amount || 100).toLocaleString()}\`;

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
}

async function quickRejectRequest(type, id, title) {
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
}
`;

// Hook loadPendingVerificationQueue into loadFinanceData and DOMContentLoaded
if (!js.includes('loadPendingVerificationQueue()')) {
  js = js.replace('loadFinanceData();', 'loadFinanceData();\n  loadPendingVerificationQueue();');
  js = js.replace('document.getElementById(\'btnRefreshFinance\').addEventListener(\'click\', loadFinanceData);', 'document.getElementById(\'btnRefreshFinance\').addEventListener(\'click\', () => { loadFinanceData(); loadPendingVerificationQueue(); });');
  js = js.replace('setInterval(loadFinanceData, 15000);', 'setInterval(() => { loadFinanceData(); loadPendingVerificationQueue(); }, 15000);');
  js += '\n' + jsAppend;
}

fs.writeFileSync(jsPath, js, 'utf8');
console.log('✓ Successfully updated public/finance.js');
console.log('🎉 Finance portal completely enhanced with live Pending Verification Queue!');
