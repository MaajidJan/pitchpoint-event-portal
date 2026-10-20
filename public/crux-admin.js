// Venture Control Console Controller — Zindigi Prize BSEAS-H11

// Authenticated Fetch Interceptor
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const urlStr = String(url);
    if (urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/login')) {
      const token = localStorage.getItem('bahria_auth_token');
      if (!token) {
        window.location.replace('/login.html?redirect=crux-admin.html');
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
        window.location.replace('/login.html?redirect=crux-admin.html&error=session_expired');
        throw new Error('Unauthorized or session expired');
      }
      return res;
    }
    return originalFetch(url, options);
  };
})();

let allCruxTeams = [];
let currentViewingTeam = null;

let adminSyncInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  displayOperatorInfo();
  loadCruxAdminData(false);

  // Live Real-Time Multi-Admin Synchronization (Polls every 10-12s so Maajid & Areeba stay identical)
  if (adminSyncInterval) clearInterval(adminSyncInterval);
  adminSyncInterval = setInterval(() => {
    if (document.hidden) return; // Save bandwidth when tab is backgrounded
    const isModalOpen = document.querySelector('.hud-modal-overlay.active, .modal.active, #cruxSlipZoomModal.active, #pitchPassModal.active');
    const isTyping = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    if (!isModalOpen && !isTyping) {
      loadCruxAdminData(true);
    }
  }, 10000);
});

function displayOperatorInfo() {
  try {
    const userStr = localStorage.getItem('bahria_staff_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const opEl = document.getElementById('operatorDisplay');
      if (opEl) {
        let label = user.full_name || user.username;
        if (user.username === 'areeba') label = 'Areeba (Deputy Admin)';
        else if (user.username === 'maajid' || user.username === 'admin') label = 'Maajid (Event Admin)';
        opEl.textContent = label;
      }
    }
  } catch(e) {}
}

window.loadCruxAdminData = async function(isBackgroundSync = false) {
  const tbody = document.getElementById('hudTeamsTbody');
  if (tbody && !isBackgroundSync && allCruxTeams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--accent-cyan); padding: 3rem; font-family: var(--font-mono);">Refreshing venture pipeline...</td></tr>';
  }

  try {
    const res = await fetch('/api/admin/ideacrux/teams');
    const data = await res.json();
    if (!data.success) {
      if (!isBackgroundSync) alert(data.error || 'Failed to load IdeaCrux pipeline');
      return;
    }

    allCruxTeams = data.teams || [];
    const metrics = data.metrics || {};
    window.unclaimedBankPayments = data.unclaimed_payments || [];

    // Update Live Forwarder Telemetry Badge
    const fDot = document.getElementById('forwarderDot');
    const fText = document.getElementById('forwarderText');
    if (fText && fDot) {
      if (metrics.forwarder_online) {
        fDot.style.background = '#10b981';
        fDot.style.boxShadow = '0 0 8px #10b981';
        fText.style.color = '#10b981';
        fText.textContent = 'BANK SYNC: ONLINE 🟢';
      } else {
        fDot.style.background = '#94a3b8';
        fDot.style.boxShadow = 'none';
        fText.style.color = '#94a3b8';
        fText.textContent = metrics.forwarder_last_seen ? 'BANK SYNC: OFFLINE ⚪' : 'BANK SYNC: STANDBY ⚪';
      }
    }

    const totalEl = document.getElementById('hudMetricTotal');
    const verifiedEl = document.getElementById('hudMetricVerified');
    const pendingEl = document.getElementById('hudMetricPending');
    const revEl = document.getElementById('hudMetricRevenue');

    if (totalEl) totalEl.textContent = metrics.total_teams || 0;
    if (verifiedEl) verifiedEl.textContent = metrics.verified_paid || 0;
    if (pendingEl) pendingEl.textContent = metrics.pending_review || 0;
    if (revEl) revEl.textContent = `Rs. ${(metrics.total_revenue || 0).toLocaleString()}`;

    // Compute Classification Bracket Counts
    const cAll = allCruxTeams.length;
    const cIdea = allCruxTeams.filter(t => (t.startup_stage || '').toLowerCase().includes('idea')).length;
    const cProto = allCruxTeams.filter(t => (t.startup_stage || '').toLowerCase().includes('proto')).length;
    const cMvp = allCruxTeams.filter(t => (t.startup_stage || '').toLowerCase().includes('mvp')).length;
    const cMarket = allCruxTeams.filter(t => {
      const s = (t.startup_stage || '').toLowerCase();
      return s.includes('market') || s.includes('launched') || s.includes('revenue') || s.includes('operational');
    }).length;

    const bAll = document.getElementById('bracketCountAll');
    const bIdea = document.getElementById('bracketCountIdea');
    const bProto = document.getElementById('bracketCountProto');
    const bMvp = document.getElementById('bracketCountMVP');
    const bMarket = document.getElementById('bracketCountMarket');

    if (bAll) bAll.textContent = cAll;
    if (bIdea) bIdea.textContent = cIdea;
    if (bProto) bProto.textContent = cProto;
    if (bMvp) bMvp.textContent = cMvp;
    if (bMarket) bMarket.textContent = cMarket;

    filterCruxTeams();
    populatePitchStageSelectors();
    loadLivePitchStageAdmin();
  } catch (err) {
    console.error('Error loading IdeaCrux admin data:', err);
    const syncInd = document.getElementById('syncIndicator');
    if (syncInd && isBackgroundSync) {
      syncInd.textContent = 'LIVE SYNC: 🟡 RETRYING...';
      syncInd.style.color = '#fbbf24';
    }
    if (!isBackgroundSync && (!allCruxTeams || allCruxTeams.length === 0)) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #f87171; padding: 3rem; font-family: var(--font-mono);">Connection failed. Please check staff session or network.</td></tr>';
    }
  }
}

window.setBracketFilter = function(stage, btn) {
  document.querySelectorAll('.bracket-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const stageSelect = document.getElementById('hudStageFilter');
  if (stageSelect) {
    stageSelect.value = stage;
  }
  filterCruxTeams();
};

function getBracketBadge(stage) {
  const s = (stage || '').toLowerCase();
  if (s.includes('idea')) {
    return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); font-family: var(--font-mono); font-size: 0.74rem; color: #38bdf8; font-weight: 600;">💡 Bracket A: Idea Stage</span>`;
  } else if (s.includes('proto')) {
    return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); font-family: var(--font-mono); font-size: 0.74rem; color: #fbbf24; font-weight: 600;">🛠️ Bracket B: Prototype</span>`;
  } else if (s.includes('mvp')) {
    return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(0, 240, 212, 0.15); border: 1px solid rgba(0, 240, 212, 0.4); font-family: var(--font-mono); font-size: 0.74rem; color: var(--accent-cyan); font-weight: 600;">⚡ Bracket C: Working MVP</span>`;
  } else {
    return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); font-family: var(--font-mono); font-size: 0.74rem; color: #c084fc; font-weight: 600;">🚀 Bracket D: Market Ready</span>`;
  }
}

function getBracketLabel(stage) {
  const s = (stage || '').toLowerCase();
  if (s.includes('idea')) return 'Bracket A (Idea Stage)';
  if (s.includes('proto')) return 'Bracket B (Prototype)';
  if (s.includes('mvp')) return 'Bracket C (Working MVP)';
  return 'Bracket D (Market Ready)';
}

window.filterCruxTeams = function() {
  const searchInput = document.getElementById('hudSearchInput');
  const statusFilter = document.getElementById('hudStatusFilter')?.value || 'ALL';
  const stageFilter = document.getElementById('hudStageFilter')?.value || 'ALL';
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  const filtered = allCruxTeams.filter(team => {
    if (statusFilter !== 'ALL' && team.status !== statusFilter) return false;
    if (stageFilter !== 'ALL') {
      const s = (team.startup_stage || '').toLowerCase();
      const target = stageFilter.toLowerCase();
      if (target === 'idea stage' && !s.includes('idea')) return false;
      else if (target === 'prototype' && !s.includes('proto')) return false;
      else if (target === 'working mvp' && !s.includes('mvp')) return false;
      else if (target === 'market ready' && !s.includes('market') && !s.includes('launched') && !s.includes('revenue') && !s.includes('operational')) return false;
      else if (target !== 'idea stage' && target !== 'prototype' && target !== 'working mvp' && target !== 'market ready' && s !== target) return false;
    }
    if (!query) return true;

    const hay = [
      team.id,
      team.team_name,
      team.startup_name,
      team.leader_name,
      team.leader_phone,
      team.leader_email,
      team.leader_dept,
      team.member_2_name,
      team.problem_statement,
      team.idea_description,
      team.startup_stage,
      team.trx_id,
      team.receipt_no
    ].join(' ').toLowerCase();

    return hay.includes(query);
  });

  const countEl = document.getElementById('hudFilteredCount');
  if (countEl) countEl.textContent = filtered.length;

  renderDossierTables(filtered);
};

function renderDossierTables(list) {
  const tbody = document.getElementById('hudTeamsTbody');
  const cardsContainer = document.getElementById('hudMobileCardsContainer');

  if (list.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem; font-family: var(--font-mono);">No startup teams match criteria.</td></tr>';
    if (cardsContainer) cardsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem; font-family: var(--font-mono);">No startup teams found.</div>';
    return;
  }

  // Desktop Table
  if (tbody) {
    tbody.innerHTML = list.map(team => {
      const isVerified = team.status === 'VERIFIED';
      const isPending = team.status === 'PENDING';
      const phoneDigits = (team.leader_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneDigits.startsWith('0') ? '92' + phoneDigits.slice(1) : phoneDigits}?text=${encodeURIComponent(`Hi ${team.leader_name}, from Zindigi Prize BSEAS-H11 Venture Control:`)}`;

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff; font-size: 0.96rem; font-family: var(--font-display); text-transform: uppercase;">
              ${escapeHtml(team.team_name)}
            </div>
            <div style="font-size: 0.82rem; color: var(--accent-cyan); font-weight: 700; margin-top: 2px;">
              ${escapeHtml(team.startup_name)}
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">
              ID: ${team.id} • ${team.members_count} Founder(s)
            </div>
          </td>
          <td>
            <div style="font-weight: 600; color: #fff; font-size: 0.88rem;">${escapeHtml(team.leader_name)}</div>
            <div style="display: flex; align-items: center; gap: 4px; margin-top: 3px;">
              <a href="${waUrl}" target="_blank" class="hud-btn hud-btn-outline" style="padding: 2px 6px; font-size: 0.72rem; text-decoration: none;">
                WA: ${team.leader_phone}
              </a>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(team.leader_dept || 'BSEAS H-11')}</div>
            ${team.member_2_name ? `<div style="font-size: 0.72rem; color: var(--accent-cyan-dim); margin-top: 2px;">Co-Founder: ${escapeHtml(team.member_2_name)}</div>` : ''}
          </td>
          <td style="max-width: 250px;">
            <div style="font-size: 0.8rem; color: #cbd5e1; line-height: 1.35;">
              <span style="color: var(--accent-cyan); font-weight: 600;">Concept:</span> ${escapeHtml(team.problem_statement || team.idea_description || '-')}<br>
            </div>
          </td>
          <td>
            ${getBracketBadge(team.startup_stage)}
            ${team.pitch_deck_url ? `
              <div style="margin-top: 5px;">
                <a href="${team.pitch_deck_url}" target="_blank" class="hud-btn hud-btn-outline" style="font-size: 0.7rem; padding: 2px 6px;">
                  [VIEW DECK ↗]
                </a>
              </div>
            ` : `<div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 3px;">No Deck URL</div>`}
          </td>
          <td>
            <strong style="color: #fff; font-family: var(--font-mono); font-size: 0.88rem;">Rs. ${Number(team.fee_amount || 1000).toLocaleString()}</strong>
            <div style="font-family: var(--font-mono); font-size: 0.74rem; color: ${team.trx_id ? '#34d399' : 'var(--text-muted)'}; margin-top: 2px;">
              ${team.trx_id ? `TRX: ${escapeHtml(team.trx_id)}` : (team.receipt_no ? `Receipt: ${escapeHtml(team.receipt_no)}` : 'UNPAID')}
            </div>
            ${(team.has_slip || (team.screenshot_preview && team.screenshot_preview.length > 50)) ? `
              <div style="margin-top: 6px;">
                <button type="button" class="hud-btn hud-btn-outline" style="padding: 2px 7px; font-size: 0.7rem; border-color: rgba(0, 240, 212, 0.45); color: var(--accent-cyan); display: inline-flex; align-items: center; gap: 4px;" onclick="openCruxSlipZoom('${team.id}')" title="Inspect applicant's payment proof screenshot">
                  🧾 [VIEW SLIP]
                </button>
              </div>
            ` : (team.receipt_no ? `
              <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 4px; font-family: var(--font-mono);">
                Desk Cash Receipt
              </div>
            ` : '')}
          </td>
          <td>
            <span class="badge-status ${team.status.toLowerCase()}">
              ${team.status}
            </span>
            <div style="margin-top: 5px; display: flex; align-items: center; gap: 4px;">
              ${team.whatsapp_sent ? `
                <button type="button" class="badge-status" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.4); cursor: pointer; padding: 2px 7px;" onclick="toggleWhatsAppSent('${team.id}', 1)" title="WhatsApp pass dispatched! Click to unmark if needed">
                  💬 WA SENT ✓
                </button>
              ` : `
                <button type="button" class="badge-status" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); cursor: pointer; padding: 2px 7px;" onclick="toggleWhatsAppSent('${team.id}', 0)" title="WhatsApp not marked yet. Click to mark as sent">
                  💬 NOT SENT
                </button>
              `}
            </div>
            ${team.checked_in_at ? `
              <div style="font-size: 0.7rem; color: #34d399; font-family: var(--font-mono); margin-top: 3px;">
                ✓ ADMITTED TO STAGE
              </div>
              <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.65rem; padding: 1px 5px; margin-top: 3px; color: #fbbf24; border-color: rgba(251, 191, 36, 0.4);" onclick="resetCruxCheckIn('${team.id}')" title="Reset Gate Check-in">
                [RESET SCAN]
              </button>
            ` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button type="button" class="hud-btn ${team.whatsapp_sent ? 'hud-btn-outline' : 'hud-btn-cyan'}" style="padding: 3px 8px; font-size: 0.72rem; color: #25d366; border-color: rgba(37, 211, 102, 0.45);" onclick="openWhatsAppAndMark('${team.id}')" title="Send WhatsApp to Team Leader & Auto-mark as Sent">
                💬 ${team.whatsapp_sent ? '[WA ✓]' : '[SEND WA]'}
              </button>
              ${(team.screenshot_preview && team.screenshot_preview.length > 50) ? `
                <button type="button" class="hud-btn hud-btn-outline" style="padding: 3px 7px; font-size: 0.72rem; color: var(--accent-cyan); border-color: rgba(0, 240, 212, 0.4);" onclick="openCruxSlipZoom('${team.id}')" title="View Payment Proof Screenshot">
                  🧾 [SLIP]
                </button>
              ` : ''}
              ${isPending ? `
                <button type="button" class="hud-btn hud-btn-cyan" style="padding: 3px 8px; font-size: 0.72rem;" onclick="approveCruxTeam('${team.id}')" title="Approve & Generate Pitch Pass">
                  [APPROVE]
                </button>
                <button type="button" class="hud-btn hud-btn-outline" style="padding: 3px 8px; font-size: 0.72rem;" onclick="markCruxCashPaid('${team.id}')" title="Mark Fee Paid">
                  [PAID]
                </button>
                <button type="button" class="hud-btn hud-btn-danger" style="padding: 3px 8px; font-size: 0.72rem;" onclick="rejectCruxTeam('${team.id}')" title="Reject Application">
                  [REJECT]
                </button>
              ` : ''}
              ${isVerified ? `
                <button type="button" class="hud-btn hud-btn-cyan" style="padding: 3px 8px; font-size: 0.72rem;" onclick="openPassModal('${team.id}')" title="View Turnstile Pitch Pass">
                  [PASS]
                </button>
              ` : ''}
              <button type="button" class="hud-btn hud-btn-danger" style="padding: 3px 6px; font-size: 0.72rem;" onclick="deleteCruxTeam('${team.id}')" title="Delete Team Record">
                ✕
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Mobile Cards View
  if (cardsContainer) {
    cardsContainer.innerHTML = list.map(team => {
      const isVerified = team.status === 'VERIFIED';
      const isPending = team.status === 'PENDING';
      const phoneDigits = (team.leader_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneDigits.startsWith('0') ? '92' + phoneDigits.slice(1) : phoneDigits}?text=${encodeURIComponent(`Hi ${team.leader_name}, from Zindigi Prize BSEAS-H11 Venture Control:`)}`;

      return `
        <div class="metric-slab" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div>
              <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; color: #fff; text-transform: uppercase;">
                ${escapeHtml(team.team_name)}
              </div>
              <div style="color: var(--accent-cyan); font-weight: 700; font-size: 0.88rem; margin-top: 2px;">
                ${escapeHtml(team.startup_name)}
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                ID: ${team.id} • ${team.members_count} Founder(s)
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
              <span class="badge-status ${team.status.toLowerCase()}">${team.status}</span>
              ${team.whatsapp_sent ? `
                <button type="button" class="badge-status" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.4); cursor: pointer; padding: 1px 6px; font-size: 0.68rem;" onclick="toggleWhatsAppSent('${team.id}', 1)" title="WhatsApp sent! Click to unmark">
                  💬 WA SENT ✓
                </button>
              ` : `
                <button type="button" class="badge-status" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); cursor: pointer; padding: 1px 6px; font-size: 0.68rem;" onclick="toggleWhatsAppSent('${team.id}', 0)" title="Click to mark as WhatsApp sent">
                  💬 NOT SENT
                </button>
              `}
              ${team.checked_in_at ? `
                <div style="font-size: 0.68rem; color: #34d399; font-family: var(--font-mono); margin-top: 2px; text-align: right;">
                  ✓ ADMITTED
                </div>
              ` : ''}
            </div>
          </div>

          <div style="background: rgba(2, 11, 14, 0.8); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 0.75rem; font-size: 0.82rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div><span style="color: var(--text-muted);">Leader:</span> <strong style="color: #fff;">${escapeHtml(team.leader_name)}</strong></div>
            <div><span style="color: var(--text-muted);">Dept:</span> <span style="color: #cbd5e1;">${escapeHtml(team.leader_dept || 'BSEAS')}</span></div>
            <div><span style="color: var(--text-muted);">Bracket:</span> <strong style="color: var(--accent-cyan); font-size: 0.76rem;">${escapeHtml(getBracketLabel(team.startup_stage))}</strong></div>
            <div>
              <span style="color: var(--text-muted);">Fee:</span> <strong style="color: #34d399;">Rs. ${Number(team.fee_amount || 1000).toLocaleString()}</strong>
              ${team.trx_id ? `<div style="font-family: var(--font-mono); font-size: 0.72rem; color: #34d399; margin-top: 2px;">TRX: ${escapeHtml(team.trx_id)}</div>` : ''}
            </div>
          </div>

          ${(team.screenshot_preview && team.screenshot_preview.length > 50) ? `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0, 240, 212, 0.05); border: 1px solid rgba(0, 240, 212, 0.25); border-radius: 8px; padding: 0.5rem 0.75rem;">
              <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="openCruxSlipZoom('${team.id}')">
                <img src="${team.screenshot_preview}" alt="Slip" style="width: 38px; height: 38px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(0, 240, 212, 0.4);">
                <div>
                  <div style="font-size: 0.78rem; font-weight: 700; color: #fff;">Payment Slip Attached</div>
                  <div style="font-size: 0.68rem; color: var(--accent-cyan); font-family: var(--font-mono);">${team.trx_id ? 'TRX: ' + escapeHtml(team.trx_id) : 'Tap to inspect'}</div>
                </div>
              </div>
              <button type="button" class="hud-btn hud-btn-cyan" style="font-size: 0.72rem; padding: 3px 8px;" onclick="openCruxSlipZoom('${team.id}')">
                🔍 [VIEW SLIP]
              </button>
            </div>
          ` : ''}

          <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
            <strong style="color: var(--accent-cyan);">Concept:</strong> ${escapeHtml(team.problem_statement || team.idea_description || '-')}
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; flex-wrap: wrap; margin-top: 4px;">
            <button type="button" class="hud-btn ${team.whatsapp_sent ? 'hud-btn-outline' : 'hud-btn-cyan'}" style="font-size: 0.74rem; color: #25d366; border-color: rgba(37, 211, 102, 0.45);" onclick="openWhatsAppAndMark('${team.id}')">
              💬 ${team.whatsapp_sent ? '[WA SENT ✓]' : '[SEND WA]'}
            </button>
            <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.72rem; padding: 3px 7px;" onclick="toggleWhatsAppSent('${team.id}', ${team.whatsapp_sent ? 1 : 0})" title="${team.whatsapp_sent ? 'Click to mark un-sent' : 'Click to mark as sent'}">
              ${team.whatsapp_sent ? '↩ Unmark' : '✓ Mark Sent'}
            </button>
            ${(team.screenshot_preview && team.screenshot_preview.length > 50) ? `
              <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.74rem; color: var(--accent-cyan); border-color: rgba(0, 240, 212, 0.4);" onclick="openCruxSlipZoom('${team.id}')" title="Inspect Payment Proof Screenshot">
                🧾 [SLIP]
              </button>
            ` : ''}
            ${team.pitch_deck_url ? `
              <a href="${team.pitch_deck_url}" target="_blank" class="hud-btn hud-btn-outline" style="font-size: 0.74rem;">
                [DECK ↗]
              </a>
            ` : ''}
            ${team.checked_in_at ? `
              <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.72rem; color: #fbbf24; border-color: rgba(251, 191, 36, 0.4);" onclick="resetCruxCheckIn('${team.id}')">
                [RESET SCAN]
              </button>
            ` : ''}
            ${isPending ? `
              <button type="button" class="hud-btn hud-btn-cyan" style="font-size: 0.74rem;" onclick="approveCruxTeam('${team.id}')">
                [APPROVE]
              </button>
              <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.74rem;" onclick="markCruxCashPaid('${team.id}')">
                [PAID]
              </button>
              <button type="button" class="hud-btn hud-btn-danger" style="font-size: 0.74rem;" onclick="rejectCruxTeam('${team.id}')">
                [REJECT]
              </button>
            ` : ''}
            ${isVerified ? `
              <button type="button" class="hud-btn hud-btn-cyan" style="font-size: 0.74rem;" onclick="openPassModal('${team.id}')">
                [PASS]
              </button>
            ` : ''}
            <button type="button" class="hud-btn hud-btn-danger" style="font-size: 0.74rem;" onclick="deleteCruxTeam('${team.id}')">
              ✕
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.approveCruxTeam = async function(teamId) {
  if (!confirm(`Approve startup team ${teamId} and generate their official Turnstile Pitch Pass?`)) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'APPROVE' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team verified! Pitch pass generated.');
      loadCruxAdminData();
    } else {
      alert(data.error || 'Failed to approve team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.markCruxCashPaid = async function(teamId) {
  if (!confirm(`Confirm Rs. 100 fee received for team ${teamId}?`)) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'MARK_PAID' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team fee marked paid!');
      loadCruxAdminData();
    } else {
      alert(data.error || 'Failed to update team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.rejectCruxTeam = async function(teamId) {
  const reason = prompt('Please enter rejection feedback or reason:');
  if (reason === null) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'REJECT', admin_notes: reason })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team marked as rejected.');
      loadCruxAdminData();
    } else {
      alert(data.error || 'Failed to reject team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.deleteCruxTeam = async function(teamId) {
  if (!confirm(`Permanently remove team ${teamId}? This action cannot be undone.`)) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'DELETE' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Team deleted.');
      loadCruxAdminData();
    } else {
      alert(data.error || 'Failed to delete team.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// Turnstile Pitch Pass Modal & Canvas Rendering
window.openPassModal = function(teamId) {
  const team = allCruxTeams.find(t => t.id === teamId);
  if (!team) return;

  currentViewingTeam = team;

  document.getElementById('modalPassTeamName').textContent = team.team_name;
  document.getElementById('modalPassStartup').textContent = `VENTURE: ${team.startup_name.toUpperCase()}`;
  document.getElementById('modalPassId').textContent = team.id;

  const qrImg = document.getElementById('modalPassQrImg');
  if (qrImg && team.pitch_pass_qr) {
    qrImg.src = team.pitch_pass_qr;
  }

  document.getElementById('btnModalDownloadPng').onclick = () => renderAndDownloadPassPng(team);
  document.getElementById('btnModalShareWa').onclick = () => sharePassWhatsApp(team);

  document.getElementById('pitchPassModal').classList.add('active');
};

window.closePassModal = function() {
  document.getElementById('pitchPassModal').classList.remove('active');
  currentViewingTeam = null;
};

function renderAndDownloadPassPng(team) {
  const canvas = document.getElementById('pitchPassCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Background Obsidian Gradient
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#020b0e');
  bg.addColorStop(0.5, '#072128');
  bg.addColorStop(1, '#020b0e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Precision Hairline Cyber Grid
  ctx.strokeStyle = 'rgba(0, 240, 212, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Double Laser Cyan Reticle Border
  ctx.strokeStyle = '#00f0d4';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.strokeStyle = 'rgba(0, 240, 212, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, w - 52, h - 52);

  // Corner Reticle Crosshairs
  drawCrosshair(ctx, 35, 35);
  drawCrosshair(ctx, w - 35, 35);
  drawCrosshair(ctx, 35, h - 35);
  drawCrosshair(ctx, w - 35, h - 35);

  // Top Telemetry Header
  ctx.fillStyle = '#00f0d4';
  ctx.font = 'bold 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ZINDIGI PRIZE ON-CAMPUS ROUND // STAGE: AL-BERUNI AUDITORIUM', w / 2, 65);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px "Space Grotesk", sans-serif';
  ctx.fillText('ZINDIGI PRIZE BSEAS-H11', w / 2, 115);

  ctx.fillStyle = '#38f9d7';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText(`OFFICIAL TURNSTILE PITCH PASS • ID: ${team.id}`, w / 2, 145);

  // Divider Line
  ctx.strokeStyle = 'rgba(0, 240, 212, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 168);
  ctx.lineTo(w - 60, 168);
  ctx.stroke();

  // Team Details Section
  ctx.fillStyle = '#849ca7';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText('REGISTERED STARTUP TEAM', w / 2, 205);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Space Grotesk", sans-serif';
  ctx.fillText((team.team_name || 'Team').toUpperCase(), w / 2, 245);

  ctx.fillStyle = '#00f0d4';
  ctx.font = 'bold 20px "Space Grotesk", sans-serif';
  ctx.fillText(`VENTURE: ${(team.startup_name || 'Venture').toUpperCase()}`, w / 2, 280);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Leader: ${team.leader_name} (${team.leader_dept || 'BSEAS H-11'})`, w / 2, 315);
  if (team.member_2_name) {
    ctx.fillText(`Co-Founder: ${team.member_2_name}`, w / 2, 340);
  }

  // Maturity Badge
  ctx.fillStyle = 'rgba(0, 240, 212, 0.15)';
  ctx.fillRect(w / 2 - 120, 360, 240, 32);
  ctx.strokeStyle = '#00f0d4';
  ctx.lineWidth = 1;
  ctx.strokeRect(w / 2 - 120, 360, 240, 32);

  ctx.fillStyle = '#00f0d4';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText(`STAGE: ${(team.startup_stage || 'Idea Stage').toUpperCase()}`, w / 2, 381);

  // Turnstile QR Box
  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous';
  qrImg.onload = function() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w / 2 - 125, 420, 250, 250);
    ctx.drawImage(qrImg, w / 2 - 115, 430, 230, 230);

    // Turnstile Scan Guidance
    ctx.fillStyle = '#00f0d4';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText('SCAN AT AUDITORIUM TURNSTILE GATES', w / 2, 705);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ADMIT AUTHORIZED FOUNDER ROSTER TO STAGE', w / 2, 730);

    // Arena Meta Block
    ctx.fillStyle = 'rgba(4, 20, 25, 0.8)';
    ctx.fillRect(60, 755, w - 120, 110);
    ctx.strokeStyle = 'rgba(0, 240, 212, 0.2)';
    ctx.strokeRect(60, 755, w - 120, 110);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#849ca7';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText('CAMPUS ARENA:', 85, 785);
    ctx.fillText('SCHEDULED DATE:', 85, 815);
    ctx.fillText('PRIZE PURSE:', 85, 845);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Al-Beruni Auditorium, BSEAS H-11 Campus', 230, 785);
    ctx.fillText('15 October 2026', 230, 815);
    ctx.fillText('PKR 30,000 + National Qualification', 230, 845);

    // Bottom Watermark
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4d6672';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('OFFICIAL ZINDIGI PRIZE ON-CAMPUS CREDENTIAL • SECURED VIA D1 CRYPTOGRAPHIC HASH', w / 2, 920);
    ctx.fillText(`HASH: ${team.id}-${Date.now().toString(36).toUpperCase()}`, w / 2, 940);

    // Download Blob
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `IDEACRUX_PITCH_PASS_${(team.team_name || 'Team').replace(/[^a-zA-Z0-9]/g, '_')}_${team.id}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  qrImg.src = team.pitch_pass_qr || '';
}

function drawCrosshair(ctx, x, y) {
  ctx.strokeStyle = '#00f0d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
  ctx.stroke();
}

function sharePassWhatsApp(team) {
  // Automatically mark this team as WhatsApp Sent in background
  if (team && team.id) {
    fetch('/api/admin/ideacrux/mark-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: team.id, whatsapp_sent: 1 })
    }).then(() => {
      team.whatsapp_sent = 1;
      renderCruxPipeline();
      renderCruxTable();
    }).catch(err => console.warn('WhatsApp mark error:', err));
  }

  const text =
    `💡 *ZINDIGI PRIZE BSEAS-H11 // OFFICIAL TURNSTILE PITCH PASS*\n` +
    `*Zindigi Prize On-Campus Round — BSEAS H-11 Campus*\n\n` +
    `🏆 *Startup Team:* ${team.team_name}\n` +
    `🚀 *Venture:* ${team.startup_name}\n` +
    `👤 *Team Leader:* ${team.leader_name} (${team.leader_dept || 'BSEAS H-11'})\n` +
    `${team.member_2_name ? `👥 *Co-Founder:* ${team.member_2_name}\n` : ''}` +
    `📊 *Maturity Stage:* ${team.startup_stage || 'Idea Stage'}\n` +
    `🆔 *Pass ID:* ${team.id}\n` +
    `🟢 *Status:* VERIFIED & ADMITTED\n\n` +
    `📍 *Venue:* Al-Beruni Auditorium, BSEAS H-11 Campus\n` +
    `📅 *Event Date:* 15 October 2026\n` +
    `⚡ *Turnstile Entry:* Present your QR pass at the entrance scanner.\n\n` +
    `View & download your verified pitch pass: https://bahria-event-portal.bahria-event-portal.workers.dev/ideacrux?team_id=${team.id}`;

  const phone = (team.leader_phone || '').replace(/\D/g, '');
  const waUrl = phone 
    ? `https://wa.me/${phone.startsWith('0') ? '92' + phone.slice(1) : phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

window.openWhatsAppAndMark = function(teamId) {
  const team = allCruxTeams.find(t => t.id === teamId);
  if (!team) return;
  sharePassWhatsApp(team);
};

window.toggleWhatsAppSent = async function(teamId, currentVal) {
  const newVal = currentVal ? 0 : 1;
  try {
    const res = await fetch('/api/admin/ideacrux/mark-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, whatsapp_sent: newVal })
    });
    const data = await res.json();
    if (data.success) {
      const team = allCruxTeams.find(t => t.id === teamId);
      if (team) team.whatsapp_sent = newVal;
      renderCruxPipeline();
      renderCruxTable();
    } else {
      alert(data.error || 'Failed to update WhatsApp status');
    }
  } catch (err) {
    alert('Error connecting to server');
  }
};

// High-Resolution Payment Proof Slip Inspection Modal
window.openCruxSlipZoom = async function(teamId) {
  const team = allCruxTeams.find(t => t.id === teamId);
  if (!team) return;

  const modal = document.getElementById('cruxSlipZoomModal');
  const title = document.getElementById('cruxSlipModalTitle');
  const sub = document.getElementById('cruxSlipModalSub');
  const img = document.getElementById('cruxSlipModalImg');
  const leader = document.getElementById('cruxSlipModalLeader');
  const phone = document.getElementById('cruxSlipModalPhone');
  const bracket = document.getElementById('cruxSlipModalBracket');
  const statusEl = document.getElementById('cruxSlipModalStatus');
  const fee = document.getElementById('cruxSlipModalFee');
  const trx = document.getElementById('cruxSlipModalTrx');
  const waBtn = document.getElementById('cruxSlipModalWaBtn');
  const fullImgBtn = document.getElementById('cruxSlipModalFullImgBtn');
  const decisionBtns = document.getElementById('cruxSlipModalDecisionBtns');

  if (title) title.textContent = `${team.team_name} — ${team.startup_name}`;
  if (sub) sub.textContent = `Team ID: ${team.id} • Submitted: ${new Date(team.created_at).toLocaleString()}`;
  
  if (modal) modal.classList.add('active');

  // Load slip on-demand if not already cached in memory
  if (!team.screenshot_preview && team.has_slip) {
    if (img) {
      img.style.display = 'block';
      img.alt = 'Loading applicant slip from secure vault...';
    }
    try {
      const res = await fetch(`/api/admin/ideacrux/team-slip?id=${encodeURIComponent(team.id)}`);
      const data = await res.json();
      if (data.success && data.screenshot_preview) {
        team.screenshot_preview = data.screenshot_preview;
      }
    } catch (e) {
      console.warn('Failed to load slip image on demand:', e);
    }
  }

  const slipSrc = team.screenshot_preview || '';
  if (img) {
    if (slipSrc) {
      img.src = slipSrc;
      img.style.display = 'block';
      img.alt = `Payment receipt slip for ${team.team_name}`;
    } else {
      img.src = '';
      img.style.display = 'none';
    }
  }

  if (fullImgBtn) {
    if (slipSrc) {
      fullImgBtn.href = slipSrc;
      fullImgBtn.style.display = 'inline-flex';
    } else {
      fullImgBtn.style.display = 'none';
    }
  }

  if (leader) leader.textContent = team.leader_name;
  if (phone) phone.textContent = `${team.leader_phone} (${team.leader_dept || 'BSEAS H-11'})`;
  if (bracket) bracket.textContent = getBracketLabel(team.startup_stage);
  if (statusEl) statusEl.innerHTML = `<span class="badge-status ${team.status.toLowerCase()}">${team.status}</span>`;
  if (fee) fee.textContent = `Rs. ${Number(team.fee_amount || 1000).toLocaleString()}`;
  if (trx) trx.textContent = team.trx_id ? `TRX: ${team.trx_id}` : (team.receipt_no ? `Receipt: ${team.receipt_no}` : 'No TRX ID');

  if (waBtn) {
    waBtn.onclick = (e) => {
      e.preventDefault();
      openWhatsAppAndMark(team.id);
    };
  }

  const matchContainer = document.getElementById('cruxSlipUnclaimedMatchContainer');
  if (matchContainer) {
    if (team.status === 'PENDING' && window.unclaimedBankPayments && window.unclaimedBankPayments.length > 0) {
      matchContainer.style.display = 'block';
      matchContainer.innerHTML = `
        <div style="font-family: var(--font-mono); font-size: 0.76rem; color: #38bdf8; font-weight: 700; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span>⚡ LIVE UNCLAIMED BANK PAYMENTS (${window.unclaimedBankPayments.length})</span>
          <span style="font-size: 0.7rem; color: var(--text-muted);">Sync from forwarder</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 5px; max-height: 140px; overflow-y: auto;">
          ${window.unclaimedBankPayments.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem;">
              <div>
                <span style="color: #fff; font-family: var(--font-mono); font-weight: 700;">TRX ${escapeHtml(p.trx_id)}</span>
                <span style="color: #34d399; font-weight: 700; margin-left: 6px;">Rs. ${Number(p.amount).toLocaleString()}</span>
                <span style="color: var(--text-muted); margin-left: 6px;">${escapeHtml(p.sender_name || p.sender_phone || p.source)}</span>
              </div>
              <button type="button" class="hud-btn hud-btn-cyan" style="font-size: 0.7rem; padding: 2px 7px;" onclick="matchCruxTeamPayment('${team.id}', '${p.trx_id}')">
                [LINK & APPROVE]
              </button>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      matchContainer.style.display = 'none';
      matchContainer.innerHTML = '';
    }
  }

  if (decisionBtns) {
    if (team.status === 'PENDING') {
      decisionBtns.innerHTML = `
        <button type="button" class="hud-btn hud-btn-danger" style="font-size: 0.76rem;" onclick="closeCruxSlipZoom(); rejectCruxTeam('${team.id}')">
          ✕ [REJECT]
        </button>
        <button type="button" class="hud-btn hud-btn-cyan" style="font-size: 0.76rem;" onclick="closeCruxSlipZoom(); approveCruxTeam('${team.id}')">
          ✓ [APPROVE & ISSUE PASS]
        </button>
      `;
    } else {
      decisionBtns.innerHTML = '';
    }
  }

  if (modal) modal.classList.add('active');
};

window.matchCruxTeamPayment = async function(teamId, paymentTrx) {
  if (!confirm(`Confirm linking Team ${teamId} with verified Bank Deposit TRX ${paymentTrx}?`)) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'MATCH_PAYMENT', payment_trx: paymentTrx })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Payment matched and official pitch pass generated!');
      closeCruxSlipZoom();
      loadCruxAdminData();
    } else {
      alert(data.error || 'Failed to match payment');
    }
  } catch(err) {
    alert('Network error: ' + err.message);
  }
};

window.closeCruxSlipZoom = function() {
  const modal = document.getElementById('cruxSlipZoomModal');
  if (modal) modal.classList.remove('active');
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCruxSlipZoom();
  }
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'cruxSlipZoomModal') {
    closeCruxSlipZoom();
  }
});

// CSV / Excel Dossier Export with Venture Maturity Classification Brackets
window.exportCruxTeamsCSV = function(targetBracket) {
  if (!allCruxTeams || allCruxTeams.length === 0) {
    alert('No startup teams available in pipeline to export.');
    return;
  }

  // Determine stage filter
  const stageFilter = targetBracket || document.getElementById('hudStageFilter')?.value || 'ALL';
  let teamsToExport = [...allCruxTeams];
  let exportTitle = 'ALL VENTURE MATURITY BRACKETS';

  if (stageFilter !== 'ALL') {
    const target = stageFilter.toLowerCase();
    teamsToExport = teamsToExport.filter(team => {
      const s = (team.startup_stage || '').toLowerCase();
      if (target === 'idea stage') return s.includes('idea');
      if (target === 'prototype') return s.includes('proto');
      if (target === 'working mvp') return s.includes('mvp');
      if (target === 'market ready') return s.includes('market') || s.includes('launched') || s.includes('revenue') || s.includes('operational');
      return s === target;
    });
    exportTitle = `CLASSIFICATION BRACKET: ${stageFilter.toUpperCase()}`;
  }

  if (teamsToExport.length === 0) {
    alert(`No teams registered under "${stageFilter}" to export.`);
    return;
  }

  // Sort by Classification Bracket, then by Startup Name
  teamsToExport.sort((a, b) => {
    const bA = getBracketLabel(a.startup_stage);
    const bB = getBracketLabel(b.startup_stage);
    if (bA !== bB) return bA.localeCompare(bB);
    return (a.startup_name || '').localeCompare(b.startup_name || '');
  });

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const cIdea = allCruxTeams.filter(t => (t.startup_stage || '').toLowerCase().includes('idea')).length;
  const cProto = allCruxTeams.filter(t => (t.startup_stage || '').toLowerCase().includes('proto')).length;
  const cMvp = allCruxTeams.filter(t => (t.startup_stage || '').toLowerCase().includes('mvp')).length;
  const cMarket = allCruxTeams.filter(t => {
    const s = (t.startup_stage || '').toLowerCase();
    return s.includes('market') || s.includes('launched') || s.includes('revenue') || s.includes('operational');
  }).length;

  const summarySection = [
    `"PITCH POINT // ZINDIGI PRIZE - OFFICIAL STARTUP PIPELINE EXPORT"`,
    `"Bahria University BSEAS H-11 Campus • Pitch Day: 15 October 2026"`,
    `"Export Generated:","${new Date().toLocaleString()}"`,
    `"Filter Scope:","${exportTitle}"`,
    `"Total Master Registered:","${allCruxTeams.length}"`,
    `"Bracket A (Idea Stage):","${cIdea}"`,
    `"Bracket B (Prototype):","${cProto}"`,
    `"Bracket C (Working MVP):","${cMvp}"`,
    `"Bracket D (Market Ready):","${cMarket}"`,
    `""`
  ];

  const headers = [
    'Classification Bracket',
    'Team ID',
    'Startup / Venture Name',
    'Team Name',
    'Team Leader Name',
    'Leader WhatsApp',
    'Leader Email',
    'Department',
    'Semester',
    'Founders Count',
    'Co-Founder 2 Name',
    'Co-Founder 2 Phone',
    'Co-Founder 3 Name',
    'Co-Founder 3 Phone',
    'Venture Maturity Stage',
    'Problem Statement',
    'Solution / Idea Description',
    'Revenue / Monetization Model',
    'Pitch Deck Ready',
    'Escrow Fee (PKR)',
    'Payment Method',
    'Receipt / TRX ID',
    'Dossier Status',
    'Gate Admitted',
    'Registration Date'
  ];

  const rows = teamsToExport.map(t => [
    escapeCsv(getBracketLabel(t.startup_stage)),
    escapeCsv(t.id),
    escapeCsv(t.startup_name),
    escapeCsv(t.team_name),
    escapeCsv(t.leader_name),
    escapeCsv(t.leader_phone),
    escapeCsv(t.leader_email),
    escapeCsv(t.leader_dept),
    escapeCsv(t.leader_semester),
    escapeCsv(t.members_count),
    escapeCsv(t.member_2_name),
    escapeCsv(t.member_2_phone),
    escapeCsv(t.member_3_name),
    escapeCsv(t.member_3_phone),
    escapeCsv(t.startup_stage || 'Idea Stage'),
    escapeCsv(t.problem_statement),
    escapeCsv(t.idea_description),
    escapeCsv(t.revenue_model),
    escapeCsv(t.pitch_deck_ready || 'Yes'),
    escapeCsv(t.fee_amount || 1000),
    escapeCsv(t.payment_method || 'EASYPAISA'),
    escapeCsv(t.receipt_no || t.trx_id),
    escapeCsv(t.status),
    escapeCsv(t.checked_in_at || 'NO'),
    escapeCsv(t.created_at)
  ].join(','));

  const csvContent = '\uFEFF' + summarySection.join('\r\n') + '\r\n' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileNameSlug = stageFilter === 'ALL' ? 'ALL_BRACKETS' : stageFilter.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  a.download = `PITCH_POINT_2026_${fileNameSlug}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.resetCruxCheckIn = async function(teamId) {
  if (!confirm('Are you sure you want to RESET gate admission for this team? This will allow the Pitch Pass QR code to be scanned again.')) return;
  try {
    const res = await fetch('/api/admin/ideacrux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, action: 'RESET_CHECKIN' })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Gate check-in status reset!');
      loadCruxDashboard();
    } else {
      alert(`Error: ${data.error || 'Failed to reset'}`);
    }
  } catch (err) {
    alert('Network error while resetting check-in');
  }
};

/* Staff & Cashier Assignment Management */
window.openStaffModal = function() {
  document.getElementById('staffModal').classList.add('active');
  loadStaffList();
};

window.closeStaffModal = function() {
  document.getElementById('staffModal').classList.remove('active');
  document.getElementById('addStaffFormContainer').style.display = 'none';
  document.getElementById('newStaffForm').reset();
  document.getElementById('staffEditId').value = '';
};

window.toggleAddStaffForm = function() {
  const container = document.getElementById('addStaffFormContainer');
  const isHidden = container.style.display === 'none';
  container.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    document.getElementById('newStaffForm').reset();
    document.getElementById('staffEditId').value = '';
    document.getElementById('staffFullName').focus();
  }
};

window.loadStaffList = async function() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;
  try {
    const res = await fetch('/api/admin/staff/list');
    const data = await res.json();
    if (!data.success || !data.staff) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 1.5rem;">Failed to load staff list</td></tr>`;
      return;
    }
    const staffList = data.staff;
    if (staffList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No staff users found. Create a cashier or gate scanner above.</td></tr>`;
      return;
    }
    tbody.innerHTML = staffList.map(u => {
      const roleColor = u.role === 'ADMIN' ? '#f43f5e' : (u.role === 'FINANCE' ? '#34d399' : (u.role === 'CASHIER' ? '#38bdf8' : '#fbbf24'));
      return `
        <tr>
          <td><strong style="color: #fff;">${escapeHtml(u.full_name)}</strong></td>
          <td><code style="color: var(--accent-cyan);">${escapeHtml(u.username)}</code></td>
          <td>
            <span style="background: rgba(255,255,255,0.06); color: ${roleColor}; border: 1px solid ${roleColor}40; padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;">
              ${escapeHtml(u.role)}
            </span>
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.8rem; color: #cbd5e1;">${escapeHtml(u.phone || '-')}</td>
          <td>
            <span style="color: ${u.is_active ? '#34d399' : '#94a3b8'}; font-weight: 700; font-size: 0.76rem;">
              ${u.is_active ? '● Active' : '○ Inactive'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.7rem; padding: 2px 6px;" onclick="editStaffUser('${u.id}', '${escapeHtml(u.username)}', '${escapeHtml(u.full_name)}', '${u.role}', '${escapeHtml(u.phone || '')}')">
                Edit
              </button>
              ${u.username !== 'maajid' && u.username !== 'admin' ? `
                <button type="button" class="hud-btn hud-btn-danger" style="font-size: 0.7rem; padding: 2px 6px;" onclick="deleteStaffUser('${u.id}', '${escapeHtml(u.username)}')">
                  ✕
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 1.5rem;">Network error fetching staff</td></tr>`;
  }
};

window.editStaffUser = function(id, username, fullName, role, phone) {
  document.getElementById('staffEditId').value = id;
  document.getElementById('staffUsername').value = username;
  document.getElementById('staffFullName').value = fullName;
  document.getElementById('staffRole').value = role;
  document.getElementById('staffPhone').value = phone;
  document.getElementById('staffPassword').placeholder = 'Leave blank to keep existing password';
  document.getElementById('addStaffFormContainer').style.display = 'block';
  document.getElementById('staffFullName').focus();
};

window.saveStaffUser = async function() {
  const id = document.getElementById('staffEditId').value.trim();
  const username = document.getElementById('staffUsername').value.trim();
  const fullName = document.getElementById('staffFullName').value.trim();
  const password = document.getElementById('staffPassword').value.trim();
  const role = document.getElementById('staffRole').value;
  const phone = document.getElementById('staffPhone').value.trim();

  if (!username || !fullName) {
    alert('Please enter Username and Full Name.');
    return;
  }
  if (!id && !password) {
    alert('Password is required when creating a new staff account.');
    return;
  }

  try {
    const payload = { id: id || undefined, username, full_name: fullName, role, phone, password: password || undefined, is_active: 1 };
    const res = await fetch('/api/admin/staff/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message || 'Staff account saved successfully!');
      document.getElementById('addStaffFormContainer').style.display = 'none';
      document.getElementById('newStaffForm').reset();
      document.getElementById('staffEditId').value = '';
      loadStaffList();
    } else {
      alert(`Error saving staff: ${data.error || 'Server error'}`);
    }
  } catch (err) {
    alert('Network error saving staff account');
  }
};

window.deleteStaffUser = async function(id, username) {
  if (!confirm(`Are you sure you want to remove staff member '${username}'?`)) return;
  try {
    const res = await fetch('/api/admin/staff/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      loadStaffList();
    } else {
      alert(`Error deleting staff: ${data.error || 'Could not delete'}`);
    }
  } catch (err) {
    alert('Network error deleting staff account');
  }
};

window.logoutAdmin = function() {
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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateString(dateStr) {
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
  } catch {
    return dateStr;
  }
}

/* ==========================================================================
   Cashier Audit & Shift Ledger Controller (Admin Console)
   ========================================================================== */
let cachedCashierAudit = null;

window.switchAdminView = function(view) {
  const teamsSec = document.getElementById('teamsPipelineSection');
  const cashiersSec = document.getElementById('cashierAuditSection');
  const btnTeams = document.getElementById('viewBtnTeams');
  const btnCashiers = document.getElementById('viewBtnCashiers');

  if (view === 'cashiers') {
    if (teamsSec) teamsSec.style.display = 'none';
    if (cashiersSec) cashiersSec.style.display = 'block';
    if (btnTeams) {
      btnTeams.className = 'hud-btn hud-btn-outline';
      btnTeams.style.color = '#cbd5e1';
      btnTeams.style.borderColor = 'var(--border-hairline)';
    }
    if (btnCashiers) {
      btnCashiers.className = 'hud-btn hud-btn-cyan';
      btnCashiers.style.color = 'var(--bg-abyss)';
      btnCashiers.style.borderColor = 'var(--accent-cyan)';
    }
    loadCashierAuditData();
  } else {
    if (cashiersSec) cashiersSec.style.display = 'none';
    if (teamsSec) teamsSec.style.display = 'block';
    if (btnTeams) {
      btnTeams.className = 'hud-btn hud-btn-cyan';
      btnTeams.style.color = 'var(--bg-abyss)';
      btnTeams.style.borderColor = 'var(--accent-cyan)';
    }
    if (btnCashiers) {
      btnCashiers.className = 'hud-btn hud-btn-outline';
      btnCashiers.style.color = '#fbbf24';
      btnCashiers.style.borderColor = 'rgba(251, 191, 36, 0.4)';
    }
  }
};

window.loadCashierAuditData = async function() {
  const rosterTbody = document.getElementById('cashierRosterTbody');
  const txTbody = document.getElementById('cashierTransactionsTbody');
  const shiftsTbody = document.getElementById('shiftsHistoryTbody');

  try {
    const res = await fetch('/api/admin/cashiers/ledger');
    const data = await res.json();
    if (!data.success) {
      if (rosterTbody) rosterTbody.innerHTML = `<tr><td colspan="7" style="color: #f87171; text-align: center; padding: 1.5rem;">Error: ${data.error || 'Failed to load'}</td></tr>`;
      return;
    }
    cachedCashierAudit = data;

    // Metrics
    const countEl = document.getElementById('cashierMetricCount');
    const cashEl = document.getElementById('cashierMetricTotalCash');
    const teamsEl = document.getElementById('cashierMetricTeamsCount');
    const openShiftsEl = document.getElementById('cashierMetricOpenShifts');

    if (countEl) countEl.textContent = (data.cashiers || []).length;
    if (cashEl) cashEl.textContent = `Rs. ${(data.overall_cash_collected || 0).toLocaleString()}`;
    if (teamsEl) teamsEl.textContent = data.overall_teams_registered || 0;
    const openShifts = (data.shifts || []).filter(s => s.handover_status === 'OPEN').length;
    if (openShiftsEl) openShiftsEl.textContent = openShifts;

    // 1. Render Cashiers Roster
    const cashiers = data.cashiers || [];
    if (rosterTbody) {
      if (cashiers.length === 0) {
        rosterTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No cashiers assigned yet. Click [+ ASSIGN NEW CASHIER] above.</td></tr>`;
      } else {
        rosterTbody.innerHTML = cashiers.map(c => {
          const hasOpenShift = c.active_shift != null;
          return `
            <tr>
              <td>
                <strong style="color: #fff; font-size: 0.92rem;">${escapeHtml(c.full_name)}</strong>
                <span style="display: block; font-size: 0.72rem; color: var(--text-muted);">ID: ${c.id}</span>
              </td>
              <td><code style="color: var(--accent-cyan); font-weight: 700;">${escapeHtml(c.username)}</code></td>
              <td style="font-family: var(--font-mono); font-size: 0.8rem; color: #cbd5e1;">${escapeHtml(c.phone || '-')}</td>
              <td><strong style="color: #34d399; font-family: var(--font-mono); font-size: 0.95rem;">Rs. ${(c.total_cash_collected || 0).toLocaleString()}</strong></td>
              <td><span style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${c.teams_registered_count || 0} teams</span></td>
              <td>
                <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; ${hasOpenShift ? 'background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid #10b981;' : 'background: rgba(255,255,255,0.06); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1);'}">
                  ${hasOpenShift ? '● SHIFT ACTIVE' : '○ OFF DUTY'}
                </span>
              </td>
              <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                  <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.7rem; padding: 3px 7px;" onclick="editCashierInline('${c.id}', '${escapeHtml(c.username)}', '${escapeHtml(c.full_name)}', '${escapeHtml(c.phone || '')}')">
                    Edit
                  </button>
                  <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.7rem; padding: 3px 7px; color: var(--accent-cyan); border-color: rgba(0,240,212,0.4);" onclick="filterBySpecificCashier('${escapeHtml(c.username)}')">
                    Ledger
                  </button>
                  <button type="button" class="hud-btn hud-btn-danger" style="font-size: 0.7rem; padding: 3px 7px;" onclick="deleteCashierAccount('${c.id}', '${escapeHtml(c.username)}')">
                    ✕ Remove
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Populate Cashier select dropdown in transaction ledger
    const sel = document.getElementById('filterCashierNameSelect');
    if (sel) {
      sel.innerHTML = `<option value="ALL">All Cashiers</option>` + cashiers.map(c => `
        <option value="${escapeHtml(c.username)}">${escapeHtml(c.full_name)} (@${escapeHtml(c.username)})</option>
      `).join('');
    }

    // 2. Render Transactions
    renderCashierTransactions(data.transactions || []);

    // 3. Render Shift Logs
    if (shiftsTbody) {
      const shifts = data.shifts || [];
      if (shifts.length === 0) {
        shiftsTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No shift logs recorded yet.</td></tr>`;
      } else {
        shiftsTbody.innerHTML = shifts.map(s => {
          const isOpen = s.handover_status === 'OPEN';
          return `
            <tr>
              <td><code style="color: var(--accent-cyan); font-size: 0.75rem;">${escapeHtml(s.id)}</code></td>
              <td><strong style="color: #fff;">${escapeHtml(s.cashier_name)}</strong></td>
              <td style="font-family: var(--font-mono); font-size: 0.8rem;">${escapeHtml(s.desk_number || 'Desk 1')}</td>
              <td style="font-family: var(--font-mono); font-size: 0.78rem; color: #cbd5e1;">${formatDateString(s.started_at)}</td>
              <td style="font-family: var(--font-mono); font-size: 0.78rem; color: #cbd5e1;">${s.closed_at ? formatDateString(s.closed_at) : '<span style="color: #34d399;">In Progress</span>'}</td>
              <td><strong style="color: #34d399; font-family: var(--font-mono);">Rs. ${(s.total_cash_collected || 0).toLocaleString()}</strong></td>
              <td style="font-family: var(--font-mono);">${s.total_tickets_sold || 0}</td>
              <td>
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; ${isOpen ? 'background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid #10b981;' : 'background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid #f59e0b;'}">
                  ${escapeHtml(s.handover_status || 'CLOSED')}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

  } catch (err) {
    if (rosterTbody) rosterTbody.innerHTML = `<tr><td colspan="7" style="color: #f87171; text-align: center; padding: 1.5rem;">Network error fetching cashier ledger</td></tr>`;
  }
};

function renderCashierTransactions(txs) {
  const txTbody = document.getElementById('cashierTransactionsTbody');
  if (!txTbody) return;
  if (!txs || txs.length === 0) {
    txTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No cash registrations found matching criteria.</td></tr>`;
    return;
  }
  txTbody.innerHTML = txs.map(t => `
    <tr>
      <td><code style="color: var(--accent-cyan); font-weight: 700; font-size: 0.78rem;">${escapeHtml(t.receipt_no || t.team_id)}</code></td>
      <td><strong style="color: #fbbf24;">${escapeHtml(t.cashier_name || 'Desk Cashier')}</strong></td>
      <td>
        <strong style="color: #fff; font-size: 0.9rem;">${escapeHtml(t.team_name)}</strong>
        <span style="display: block; font-size: 0.75rem; color: var(--accent-cyan);">${escapeHtml(t.startup_name)}</span>
      </td>
      <td>
        <span style="color: #cbd5e1; font-size: 0.82rem;">${escapeHtml(t.leader_name)}</span>
        <code style="display: block; font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(t.leader_phone)}</code>
      </td>
      <td><strong style="color: #34d399; font-family: var(--font-mono); font-size: 0.92rem;">Rs. ${(Number(t.fee_amount) || 1000).toLocaleString()}</strong></td>
      <td style="font-family: var(--font-mono); font-size: 0.78rem; color: #cbd5e1;">${formatDateString(t.created_at)}</td>
      <td>
        <span style="background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">
          ${escapeHtml(t.status || 'VERIFIED')}
        </span>
      </td>
    </tr>
  `).join('');
}

window.filterCashierLedger = function() {
  if (!cachedCashierAudit || !cachedCashierAudit.transactions) return;
  const selVal = (document.getElementById('filterCashierNameSelect')?.value || 'ALL').toLowerCase();
  const searchVal = (document.getElementById('searchCashierTxs')?.value || '').toLowerCase().trim();

  let filtered = cachedCashierAudit.transactions;
  if (selVal !== 'all') {
    filtered = filtered.filter(t => (t.cashier_name || '').toLowerCase() === selVal);
  }
  if (searchVal) {
    filtered = filtered.filter(t => {
      const target = `${t.team_name} ${t.startup_name} ${t.leader_name} ${t.receipt_no} ${t.cashier_name}`.toLowerCase();
      return target.includes(searchVal);
    });
  }
  renderCashierTransactions(filtered);
};

window.filterBySpecificCashier = function(username) {
  const sel = document.getElementById('filterCashierNameSelect');
  if (sel) {
    sel.value = username;
    filterCashierLedger();
    document.getElementById('searchCashierTxs')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

window.toggleAddCashierInline = function() {
  const formBox = document.getElementById('inlineCashierForm');
  if (!formBox) return;
  const isHidden = formBox.style.display === 'none';
  formBox.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    document.getElementById('cashierEditId').value = '';
    document.getElementById('cashierFullName').value = '';
    document.getElementById('cashierUsername').value = '';
    document.getElementById('cashierPassword').value = '';
    document.getElementById('cashierPhone').value = '';
    document.getElementById('cashierFormTitle').textContent = 'Assign New Cashier Account';
    document.getElementById('cashierFullName').focus();
  }
};

window.editCashierInline = function(id, username, fullName, phone) {
  const formBox = document.getElementById('inlineCashierForm');
  if (!formBox) return;
  formBox.style.display = 'block';
  document.getElementById('cashierEditId').value = id;
  document.getElementById('cashierUsername').value = username;
  document.getElementById('cashierFullName').value = fullName;
  document.getElementById('cashierPhone').value = phone || '';
  document.getElementById('cashierPassword').value = '';
  document.getElementById('cashierPassword').placeholder = 'Leave blank to preserve current password';
  document.getElementById('cashierFormTitle').textContent = `Update Cashier Account (@${username})`;
  formBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('cashierFullName').focus();
};

window.saveCashierAccount = async function() {
  const id = document.getElementById('cashierEditId').value.trim();
  const username = document.getElementById('cashierUsername').value.trim();
  const fullName = document.getElementById('cashierFullName').value.trim();
  const password = document.getElementById('cashierPassword').value.trim();
  const phone = document.getElementById('cashierPhone').value.trim();

  if (!username || !fullName) {
    alert('Please provide Full Name and Username.');
    return;
  }
  if (!id && !password) {
    alert('Password is required for new cashier accounts.');
    return;
  }

  try {
    const payload = {
      id: id || undefined,
      username,
      full_name: fullName,
      role: 'CASHIER',
      phone: phone || '',
      password: password || undefined,
      is_active: 1
    };
    const res = await fetch('/api/admin/staff/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(`Cashier account '${username}' saved successfully!`);
      document.getElementById('inlineCashierForm').style.display = 'none';
      loadCashierAuditData();
    } else {
      alert(`Error saving cashier: ${data.error || 'Server error'}`);
    }
  } catch (err) {
    alert('Network error saving cashier account');
  }
};

window.deleteCashierAccount = async function(id, username) {
  if (!confirm(`Are you sure you want to remove cashier '${username}'? They will no longer be able to log in to the Cashier Desk.`)) return;
  try {
    const res = await fetch('/api/admin/staff/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Cashier '${username}' has been removed.`);
      loadCashierAuditData();
    } else {
      alert(`Error deleting cashier: ${data.error || 'Could not delete'}`);
    }
  } catch (err) {
    alert('Network error deleting cashier account');
  }
};

// ==========================================
// Full Staff & Judges Modal Management
// ==========================================
window.openStaffModal = function() {
  const modal = document.getElementById('staffModal');
  if (modal) {
    modal.classList.add('active');
    loadStaffUsers();
  }
};

window.closeStaffModal = function() {
  const modal = document.getElementById('staffModal');
  if (modal) modal.classList.remove('active');
  const formBox = document.getElementById('addStaffFormContainer');
  if (formBox) formBox.style.display = 'none';
};

window.toggleStaffPasswordInput = function() {
  const input = document.getElementById('staffPassword');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
};

window.copyJudgeInvite = function(fullName, title, username, password) {
  const portalUrl = 'https://bahria-event-portal.bahria-event-portal.workers.dev/login.html';
  const text = `⚖️ *IdeaCrux 2026 - Official Judge Portal Access*
Respected *${fullName}*,
_${title || 'Official Panel Evaluator'}_

You have been granted Evaluator credentials for IdeaCrux 2026:

🌐 *Portal URL*: ${portalUrl}
👤 *Username*: ${username}
🔑 *Password*: ${password || 'Contact Admin'}

Please login, choose *Judge Portal*, and evaluate startup pitches in real-time.`;

  navigator.clipboard.writeText(text).then(() => {
    alert(`📋 Invite details for ${fullName} copied to clipboard! You can paste and send directly via WhatsApp.`);
  }).catch(() => {
    prompt('Copy invitation text:', text);
  });
};

window.toggleStaffRowPassword = function(idx) {
  const span = document.getElementById(`staffPassText_${idx}`);
  const btn = document.getElementById(`staffPassBtn_${idx}`);
  if (!span) return;
  const isHidden = span.dataset.hidden === 'true';
  if (isHidden) {
    span.textContent = span.dataset.pass;
    span.dataset.hidden = 'false';
    if (btn) btn.textContent = '🙈';
  } else {
    span.textContent = '••••••••';
    span.dataset.hidden = 'true';
    if (btn) btn.textContent = '👁️';
  }
};

window.openAddJudgeForm = function() {
  const formBox = document.getElementById('addStaffFormContainer');
  if (!formBox) return;
  formBox.style.display = 'block';
  document.getElementById('staffEditId').value = '';
  document.getElementById('staffFullName').value = '';
  document.getElementById('staffFullName').placeholder = 'e.g. Khuram Idrees';
  document.getElementById('staffUsername').value = '';
  document.getElementById('staffUsername').placeholder = 'e.g. khuram.idrees';
  document.getElementById('staffTitle').value = '';
  document.getElementById('staffTitle').placeholder = 'e.g. CEO, Icarus Incorporated & Neelas Digital | Board Member, DAN';
  document.getElementById('staffPassword').value = '';
  document.getElementById('staffPassword').placeholder = 'Set secure password for Judge';
  document.getElementById('staffPassword').type = 'text';
  document.getElementById('staffPhone').value = '';
  document.getElementById('staffRole').value = 'JUDGE';
  formBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('staffFullName').focus();
};

window.toggleAddStaffForm = function() {
  const formBox = document.getElementById('addStaffFormContainer');
  if (!formBox) return;
  const isHidden = formBox.style.display === 'none';
  formBox.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    document.getElementById('staffEditId').value = '';
    document.getElementById('staffFullName').value = '';
    document.getElementById('staffFullName').placeholder = 'e.g. Staff Full Name';
    document.getElementById('staffUsername').value = '';
    document.getElementById('staffUsername').placeholder = 'e.g. cashier2';
    document.getElementById('staffTitle').value = '';
    document.getElementById('staffPassword').value = '';
    document.getElementById('staffPassword').type = 'password';
    document.getElementById('staffPhone').value = '';
    document.getElementById('staffRole').value = 'CASHIER';
    document.getElementById('staffFullName').focus();
  }
};

window.loadStaffUsers = async function() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Loading staff and judge accounts...</td></tr>';

  try {
    const res = await fetch('/api/admin/staff/list');
    const data = await res.json();
    if (!data.success || !data.staff) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 1.5rem;">Failed to load staff list</td></tr>`;
      return;
    }

    if (data.staff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No staff or judges found. Click [+ CREATE JUDGE ID] to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    data.staff.forEach((user, idx) => {
      const tr = document.createElement('tr');
      let roleBadge = '';
      if (user.role === 'JUDGE') {
        roleBadge = '<span style="color: #c084fc; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">⚖️ JUDGE</span>';
      } else if (user.role === 'ADMIN') {
        roleBadge = '<span style="color: #00f0d4; background: rgba(0, 240, 212, 0.15); border: 1px solid rgba(0, 240, 212, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">🛡️ ADMIN</span>';
      } else if (user.role === 'FINANCE') {
        roleBadge = '<span style="color: #34d399; background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">📊 FINANCE</span>';
      } else if (user.role === 'CASHIER') {
        roleBadge = '<span style="color: #fbbf24; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">💵 CASHIER</span>';
      } else if (user.role === 'STAGE_COORDINATOR') {
        roleBadge = '<span style="color: #f472b6; background: rgba(244, 114, 182, 0.15); border: 1px solid rgba(244, 114, 182, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">📋 STAGE COORD</span>';
      } else if (user.role === 'VIEW_ONLY') {
        roleBadge = '<span style="color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">📖 VIEW ONLY</span>';
      } else {
        roleBadge = '<span style="color: #94a3b8; background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(148, 163, 184, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">🔍 SCANNER</span>';
      }

      const pass = user.plain_passcode || '';
      const safePassAttr = pass.replace(/'/g, "\\'");
      const safeTitleAttr = (user.title || '').replace(/'/g, "\\'");
      const safeNameAttr = user.full_name.replace(/'/g, "\\'");
      const safeUserAttr = user.username.replace(/'/g, "\\'");

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #fff; font-size: 0.88rem;">${escapeHtml(user.full_name)}</div>
          ${user.title ? `<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px; max-width: 260px; line-height: 1.25;">${escapeHtml(user.title)}</div>` : ''}
          ${user.phone ? `<div style="font-size: 0.7rem; color: #64748b; font-family: var(--font-mono); margin-top: 1px;">📞 ${escapeHtml(user.phone)}</div>` : ''}
        </td>
        <td>
          <code style="font-family: var(--font-mono); color: var(--accent-cyan); font-weight: 600; font-size: 0.85rem;">@${escapeHtml(user.username)}</code>
        </td>
        <td>
          ${pass ? `
            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px;">
              <span id="staffPassText_${idx}" data-pass="${escapeHtml(pass)}" data-hidden="true" style="font-family: var(--font-mono); font-size: 0.78rem; color: #e2e8f0; letter-spacing: 0.5px;">••••••••</span>
              <button type="button" id="staffPassBtn_${idx}" onclick="toggleStaffRowPassword(${idx})" title="Reveal / Hide Password" style="background: none; border: none; cursor: pointer; font-size: 0.75rem; padding: 0; color: var(--accent-cyan);">👁️</button>
            </div>
          ` : `<span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">[Hash Only]</span>`}
        </td>
        <td>${roleBadge}</td>
        <td>
          <span style="color: ${user.is_active ? '#34d399' : '#f87171'}; font-weight: 700; font-size: 0.72rem;">
            ${user.is_active ? '● Active' : '○ Inactive'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <button type="button" class="hud-btn hud-btn-outline" style="padding: 2px 7px; font-size: 0.72rem;" onclick="editStaffUser('${user.id}', '${safeUserAttr}', '${safeNameAttr}', '${user.role}', '${escapeHtml(user.phone || '')}', ${user.is_active}, '${safeTitleAttr}', '${safePassAttr}')" title="Edit Account">
              ✏️ Edit
            </button>
            ${user.role === 'JUDGE' ? `
              <button type="button" class="hud-btn" style="padding: 2px 7px; font-size: 0.72rem; background: rgba(168, 85, 247, 0.2); border-color: #a855f7; color: #d8b4fe;" onclick="copyJudgeInvite('${safeNameAttr}', '${safeTitleAttr}', '${safeUserAttr}', '${safePassAttr}')" title="Copy WhatsApp Invite Card">
                📋 Invite
              </button>
            ` : ''}
            ${user.username !== 'maajid' && user.username !== 'admin' && user.username !== 'areeba' ? `
              <button type="button" class="hud-btn hud-btn-danger" style="padding: 2px 6px; font-size: 0.72rem;" onclick="deleteStaffUser('${user.id}', '${safeUserAttr}')" title="Delete">
                ✕
              </button>
            ` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 1.5rem;">Network error loading staff</td></tr>`;
  }
};

window.editStaffUser = function(id, username, fullName, role, phone, isActive, title, plainPasscode) {
  const formBox = document.getElementById('addStaffFormContainer');
  if (!formBox) return;
  formBox.style.display = 'block';
  document.getElementById('staffEditId').value = id;
  document.getElementById('staffFullName').value = fullName;
  document.getElementById('staffUsername').value = username;
  document.getElementById('staffTitle').value = title || '';
  document.getElementById('staffRole').value = role;
  document.getElementById('staffPhone').value = phone || '';
  document.getElementById('staffPassword').value = plainPasscode || '';
  document.getElementById('staffPassword').type = 'text'; // Visible so admin can view/edit!
  document.getElementById('staffPassword').placeholder = 'Set or update password';
  formBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.saveStaffUser = async function() {
  const id = document.getElementById('staffEditId').value.trim();
  const fullName = document.getElementById('staffFullName').value.trim();
  const username = document.getElementById('staffUsername').value.trim();
  const title = document.getElementById('staffTitle').value.trim();
  const password = document.getElementById('staffPassword').value.trim();
  const role = document.getElementById('staffRole').value;
  const phone = document.getElementById('staffPhone').value.trim();

  if (!fullName || !username || !role) {
    alert('Full Name, Username, and Role are required.');
    return;
  }
  if (!id && !password) {
    alert('Password is required for new accounts.');
    return;
  }

  try {
    const payload = {
      id: id || undefined,
      username,
      full_name: fullName,
      title: title || undefined,
      role,
      phone: phone || '',
      password: password || undefined,
      is_active: 1
    };
    const res = await fetch('/api/admin/staff/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(`Account '@${username}' (${role}) saved successfully!`);
      document.getElementById('addStaffFormContainer').style.display = 'none';
      loadStaffUsers();
      if (role === 'CASHIER') loadCashierAuditData();
    } else {
      alert(`Error saving staff user: ${data.error || 'Server error'}`);
    }
  } catch (err) {
    alert('Network error saving staff account');
  }
};

window.deleteStaffUser = async function(id, username) {
  if (!confirm(`Are you sure you want to delete staff account '@${username}'?`)) return;
  try {
    const res = await fetch('/api/admin/staff/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Staff account '@${username}' deleted.`);
      loadStaffUsers();
      loadCashierAuditData();
    } else {
      alert(`Error deleting staff account: ${data.error || 'Could not delete'}`);
    }
  } catch (err) {
    alert('Network error deleting staff account');
  }
};

// ==========================================
// Live Pitch Stage & Auditorium Queue Control
// ==========================================
window.populatePitchStageSelectors = function() {
  const curSelect = document.getElementById('stageCurrentTeamSelect');
  const nextSelect = document.getElementById('stageNextTeamSelect');
  if (!curSelect || !nextSelect) return;

  const curVal = curSelect.value;
  const nextVal = nextSelect.value;

  const options = ['<option value="">-- No Team Selected (Stage Idle) --</option>'];
  allCruxTeams.forEach(t => {
    const stageBadge = t.startup_stage ? ` [${t.startup_stage}]` : '';
    const statusMark = t.status === 'VERIFIED' ? '✅' : '⏳';
    options.push(`<option value="${t.id}">${statusMark} ${escapeHtml(t.startup_name || t.team_name)} (Team: ${escapeHtml(t.team_name)})${stageBadge}</option>`);
  });

  curSelect.innerHTML = options.join('');
  nextSelect.innerHTML = options.join('');

  if (curVal) curSelect.value = curVal;
  if (nextVal) nextSelect.value = nextVal;
};

window.loadLivePitchStageAdmin = async function() {
  try {
    const res = await fetch('/api/public/pitch-stage');
    const data = await res.json();
    if (!data.success) return;

    if (data.stage?.current?.id) {
      const curSelect = document.getElementById('stageCurrentTeamSelect');
      if (curSelect) curSelect.value = data.stage.current.id;
    }
    if (data.stage?.next?.id) {
      const nextSelect = document.getElementById('stageNextTeamSelect');
      if (nextSelect) nextSelect.value = data.stage.next.id;
    }
    if (data.stage?.status) {
      const stSelect = document.getElementById('stageStatusSelect');
      if (stSelect) stSelect.value = data.stage.status;
    }

    const badge = document.getElementById('adminDeadlineBadge');
    if (badge && data.registration) {
      if (data.registration.is_strictly_locked) {
        badge.style.background = 'rgba(239, 68, 68, 0.2)';
        badge.style.borderColor = '#ef4444';
        badge.style.color = '#f87171';
        badge.textContent = '🔒 REGISTRATION CLOSED';
      } else if (data.registration.is_grace) {
        badge.style.background = 'rgba(245, 158, 11, 0.2)';
        badge.style.borderColor = '#f59e0b';
        badge.style.color = '#fbbf24';
        badge.textContent = '⏳ GRACE PERIOD ACTIVE (Closes 00:15 AM)';
      } else {
        badge.style.background = 'rgba(16, 185, 129, 0.2)';
        badge.style.borderColor = '#10b981';
        badge.style.color = '#34d399';
        badge.textContent = '🟢 REGISTRATIONS OPEN (Closes 11:59 PM PKT)';
      }
    }
  } catch (err) {
    console.error('Error fetching live stage in admin:', err);
  }
};

window.updateLivePitchStage = async function() {
  const current_team_id = document.getElementById('stageCurrentTeamSelect')?.value || '';
  const next_team_id = document.getElementById('stageNextTeamSelect')?.value || '';
  const stage_status = document.getElementById('stageStatusSelect')?.value || 'PITCH_IN_PROGRESS';
  const send_email_to_next = document.getElementById('chkSendEmailToNext')?.checked ?? true;

  try {
    const res = await fetch('/api/admin/pitch-stage/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_team_id, next_team_id, stage_status, send_email_to_next })
    });
    const data = await res.json();
    if (data.success) {
      const mailNotice = data.email_dispatched ? '\n\n📧 Call-up email dispatched to next team leader!' : '';
      alert(`✅ Live Pitch Stage updated successfully!${mailNotice}`);
      loadLivePitchStageAdmin();
    } else {
      alert(`Error updating stage: ${data.error || 'Server error'}`);
    }
  } catch (err) {
    alert('Network error updating live stage queue');
  }
};

window.resetAllJudgeScoresPrompt = async function() {
  const confirmMsg = '⚠️ WARNING: RESET ALL JUDGE SCORES?\n\nThis will permanently delete all test scores from all judges and reset the live private leaderboard to 0.\n\nAll startup teams and judge accounts will remain intact.\n\nType YES to proceed or cancel:';
  const input = prompt(confirmMsg);
  if (input !== 'YES' && input !== 'yes') {
    if (input !== null) alert('Reset cancelled.');
    return;
  }

  try {
    const res = await fetch('/api/admin/judge-scores/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert('✅ ' + (data.message || 'All judge test scores successfully reset to 0!'));
    } else {
      alert('Error: ' + (data.error || 'Failed to reset judge scores'));
    }
  } catch (err) {
    alert('Network error resetting judge scores');
  }
};

window.openDeadlineSettingsModal = async function() {
  const choice = prompt('REGISTRATION DEADLINE OVERRIDE:\n\n1 = AUTO (Closes 14 Oct 11:59 PM PKT, Grace until 00:15 AM)\n2 = FORCE OPEN (Keep registrations open indefinitely)\n3 = FORCE CLOSED (Close registrations immediately)\n\nEnter 1, 2, or 3:');
  if (!choice) return;

  let mode = 'AUTO';
  if (choice === '2') mode = 'OPEN';
  if (choice === '3') mode = 'CLOSED';

  try {
    const res = await fetch('/api/admin/registration-deadline/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Registration mode set to: ${mode}`);
      loadLivePitchStageAdmin();
    } else {
      alert(`Error: ${data.error || 'Failed to set deadline mode'}`);
    }
  } catch (err) {
    alert('Network error setting deadline mode');
  }
};

// -----------------------------------------------------------------------------
// Judge Event Feedback Admin Management
// -----------------------------------------------------------------------------
window.openJudgeFeedbackModal = function() {
  const modal = document.getElementById('adminJudgeFeedbackModal');
  if (modal) {
    modal.classList.add('active');
    loadAdminJudgeFeedback();
  }
};

window.closeJudgeFeedbackModal = function() {
  const modal = document.getElementById('adminJudgeFeedbackModal');
  if (modal) modal.classList.remove('active');
};

window.loadAdminJudgeFeedback = async function() {
  const container = document.getElementById('adminFeedbackListContainer');
  if (container) {
    container.innerHTML = '<div style="text-align: center; color: var(--accent-cyan); padding: 2rem; font-family: var(--font-mono);">Refreshing judge feedback submissions...</div>';
  }

  try {
    const res = await fetch('/api/admin/judge-feedback');
    const data = await res.json();
    if (!data.success) {
      if (container) container.innerHTML = `<div style="color: #f87171; text-align: center; padding: 2rem;">Error: ${data.error || 'Failed to load feedback'}</div>`;
      return;
    }

    const stats = data.stats || {};
    const countEl = document.getElementById('fbKpiCount');
    const overEl = document.getElementById('fbKpiOverall');
    const orgEl = document.getElementById('fbKpiOrg');
    const pitchEl = document.getElementById('fbKpiPitch');
    const venueEl = document.getElementById('fbKpiVenue');

    if (countEl) countEl.textContent = stats.total_responses || 0;
    if (overEl) overEl.textContent = stats.avg_overall ? `${stats.avg_overall} / 5` : '-';
    if (orgEl) orgEl.textContent = stats.avg_organization ? `${stats.avg_organization} / 5` : '-';
    if (pitchEl) pitchEl.textContent = stats.avg_pitch_quality ? `${stats.avg_pitch_quality} / 5` : '-';
    if (venueEl) venueEl.textContent = stats.avg_venue ? `${stats.avg_venue} / 5` : '-';

    const feedbacks = data.feedbacks || [];
    if (!container) return;

    if (feedbacks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 3rem; background: rgba(2, 11, 14, 0.5); border: 1px dashed var(--border-hairline); border-radius: var(--radius-md);">
          <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">📝</div>
          <div style="font-weight: 700; color: #fff; font-size: 1rem;">No Judge Feedback Submitted Yet</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Judges can submit feedback directly from their Judge Scoreboard portal under the <strong>[EVENT FEEDBACK]</strong> tab.</div>
        </div>
      `;
      return;
    }

    const renderStars = (num) => {
      if (!num) return '<span style="color: var(--text-dim);">-</span>';
      let stars = '';
      for (let i = 1; i <= 5; i++) {
        stars += i <= num ? '★' : '☆';
      }
      return `<span style="color: #fbbf24; font-weight: 800; letter-spacing: 2px;">${stars}</span> <span style="font-family: var(--font-mono); font-size: 0.76rem; color: #fff;">(${num}/5)</span>`;
    };

    container.innerHTML = feedbacks.map(fb => `
      <div style="background: rgba(2, 11, 14, 0.85); border: 1px solid var(--border-hairline); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
        
        <!-- Header: Judge Name & Date -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; border-bottom: 1px solid rgba(0,240,212,0.12); padding-bottom: 0.6rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.1rem;">⚖️</span>
              <h4 style="font-family: var(--font-display); color: #fff; font-size: 1.1rem; margin: 0;">${escapeHtml(fb.judge_name)}</h4>
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan); margin-top: 2px;">
              ${escapeHtml(fb.judge_title || 'Judge / Evaluator')}
            </div>
          </div>
          <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px;">
            ${new Date(fb.updated_at || fb.created_at).toLocaleString()}
          </div>
        </div>

        <!-- Ratings Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 6px;">
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Overall Experience</div>
            <div style="margin-top: 3px;">${renderStars(fb.overall_rating)}</div>
          </div>
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Stage & Organization</div>
            <div style="margin-top: 3px;">${renderStars(fb.organization_rating)}</div>
          </div>
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Pitch & Startup Quality</div>
            <div style="margin-top: 3px;">${renderStars(fb.pitch_quality_rating)}</div>
          </div>
          <div>
            <div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Venue & Facilities</div>
            <div style="margin-top: 3px;">${renderStars(fb.venue_rating)}</div>
          </div>
        </div>

        <!-- Qualitative Remarks -->
        <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.85rem; margin-top: 0.25rem;">
          ${fb.best_highlights ? `
            <div>
              <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #34d399; font-weight: 700; text-transform: uppercase;">🌟 Strengths & Highlights:</span>
              <p style="color: #e2e8f0; margin-top: 3px; line-height: 1.45; background: rgba(16, 185, 129, 0.05); padding: 6px 10px; border-left: 3px solid #10b981; border-radius: 0 4px 4px 0;">${escapeHtml(fb.best_highlights)}</p>
            </div>
          ` : ''}

          ${fb.areas_of_improvement ? `
            <div>
              <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #fbbf24; font-weight: 700; text-transform: uppercase;">💡 Recommendations / Improvements:</span>
              <p style="color: #e2e8f0; margin-top: 3px; line-height: 1.45; background: rgba(251, 191, 36, 0.05); padding: 6px 10px; border-left: 3px solid #fbbf24; border-radius: 0 4px 4px 0;">${escapeHtml(fb.areas_of_improvement)}</p>
            </div>
          ` : ''}

          ${fb.general_comments ? `
            <div>
              <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase;">💬 General Comments & Advice:</span>
              <p style="color: #e2e8f0; margin-top: 3px; line-height: 1.45; background: rgba(0, 240, 212, 0.05); padding: 6px 10px; border-left: 3px solid var(--accent-cyan); border-radius: 0 4px 4px 0;">${escapeHtml(fb.general_comments)}</p>
            </div>
          ` : ''}
        </div>

      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load admin judge feedback:', err);
    if (container) container.innerHTML = '<div style="color: #f87171; text-align: center; padding: 2rem;">Network error loading judge feedback</div>';
  }
};


