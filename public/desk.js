// On-Spot Cash Desk Controller

// Authenticated Fetch Interceptor for Desk Panel
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const urlStr = String(url);
    if (urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/login')) {
      const token = localStorage.getItem('bahria_auth_token');
      if (!token) {
        window.location.replace('/login.html?redirect=desk.html');
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
        window.location.replace('/login.html?redirect=desk.html&error=session_expired');
        throw new Error('Unauthorized or session expired');
      }
      return res;
    }
    return originalFetch(url, options);
  };
})();

let currentShift = null;
let lastIssuedPass = null;
let defaultFee = 1.0;
let handoverPollingInterval = null;

// Web Audio synthesizer for immediate cashier audio feedback
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCashChime() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.16); // G5
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {}
}

function playApprovalChime() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.12); // C#5
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.24); // E5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.36); // A5
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.7);
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadEventConfig();
  setupDeskEventListeners();
  checkCashierAuth();
});

async function loadEventConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data) {
      if (data.ticket_price) {
        defaultFee = parseFloat(data.ticket_price) || 1.0;
        const amtInput = document.getElementById('cashAmount');
        const confirmText = document.getElementById('confirmFeeText');
        if (amtInput) amtInput.value = defaultFee;
        if (confirmText) confirmText.textContent = defaultFee.toFixed(1);
      }
      if (data.support_whatsapp) {
        const supportBtn = document.getElementById('deskSupportBtn');
        if (supportBtn) {
          supportBtn.href = `https://wa.me/${data.support_whatsapp}?text=${encodeURIComponent('Hi Bahria Event Support, I need assistance at Cash Desk')}`;
        }
      }
    }
  } catch (e) {
    console.warn('Config load error:', e);
  }
}

function checkCashierAuth() {
  const savedName = localStorage.getItem('bu_cashier_name');
  const savedDesk = localStorage.getItem('bu_cashier_desk') || 'Desk 1';

  if (!savedName) {
    document.getElementById('cashierLoginModal').classList.add('open');
  } else {
    initCashierShift(savedName, savedDesk);
  }
}

async function initCashierShift(cashierName, deskNumber) {
  try {
    const res = await fetch('/api/desk/shift/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashier_name: cashierName, desk_number: deskNumber })
    });
    const data = await res.json();
    if (data.success && data.shift) {
      currentShift = data.shift;
      localStorage.setItem('bu_cashier_name', cashierName);
      localStorage.setItem('bu_cashier_desk', deskNumber);
      updateDrawerUI();

      // If this shift was already pending handover, resume live sync modal
      if (currentShift.handover_status === 'PENDING_HANDOVER') {
        startHandoverSyncPolling(currentShift.id, currentShift.total_cash_collected, currentShift.handover_to);
      }
    }
  } catch (err) {
    console.error('Error opening cashier shift:', err);
  }
}

function updateDrawerUI() {
  if (!currentShift) return;

  const cashDisp = document.getElementById('drawerCashDisplay');
  const ticketsDisp = document.getElementById('drawerTicketsDisplay');
  const cashierDisp = document.getElementById('drawerCashierDisplay');

  if (cashDisp) cashDisp.textContent = `Rs. ${(currentShift.total_cash_collected || 0).toLocaleString()}`;
  if (ticketsDisp) ticketsDisp.textContent = currentShift.total_tickets_sold || 0;
  if (cashierDisp) cashierDisp.textContent = `${currentShift.cashier_name} (${currentShift.desk_number})`;
}

function setupDeskEventListeners() {
  // Amount input listener
  const amtInput = document.getElementById('cashAmount');
  if (amtInput) {
    amtInput.addEventListener('input', (e) => {
      const confirmText = document.getElementById('confirmFeeText');
      if (confirmText) confirmText.textContent = parseFloat(e.target.value || 0).toFixed(1);
    });
  }

  // Cashier Login
  document.getElementById('btnStartShift').addEventListener('click', () => {
    const name = document.getElementById('loginCashierName').value.trim();
    const desk = document.getElementById('loginDeskNumber').value;
    if (!name) {
      alert('Please enter your name to start shift.');
      return;
    }
    document.getElementById('cashierLoginModal').classList.remove('open');
    initCashierShift(name, desk);
  });

  // Switch Cashier
  document.getElementById('btnSwitchCashier').addEventListener('click', () => {
    document.getElementById('cashierLoginModal').classList.add('open');
  });

  // Submit Cash Registration
  document.getElementById('btnSubmitCashPass').addEventListener('click', handleCashRegistration);

  // Next Student
  document.getElementById('btnNextStudent').addEventListener('click', () => {
    resetRegistrationForm();
  });

  // Handover Modal Open/Close
  document.getElementById('btnOpenHandoverModal').addEventListener('click', () => {
    const modal = document.getElementById('handoverModal');
    const amt = document.getElementById('handoverCashAmount');
    if (amt && currentShift) {
      amt.textContent = `Rs. ${(currentShift.total_cash_collected || 0).toLocaleString()}`;
    }
    modal.classList.add('open');
  });

  document.getElementById('btnCloseHandover').addEventListener('click', () => {
    document.getElementById('handoverModal').classList.remove('open');
  });

  // Submit Handover -> Launches Real-Time Live Sync Modal!
  document.getElementById('btnSubmitHandover').addEventListener('click', async () => {
    if (!currentShift) return;
    const handoverTo = document.getElementById('handoverTo').value.trim();
    const notes = document.getElementById('handoverNotes').value.trim();
    const shiftId = currentShift.id;
    const amount = currentShift.total_cash_collected || 0;

    try {
      const res = await fetch('/api/desk/shift/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, handover_to: handoverTo, notes })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('handoverModal').classList.remove('open');
        startHandoverSyncPolling(shiftId, amount, handoverTo);
      } else {
        alert(data.error || 'Handover failed');
      }
    } catch (e) {
      alert('Error submitting handover');
    }
  });

  // Finish Shift after Approval
  document.getElementById('btnFinishShift').addEventListener('click', () => {
    document.getElementById('handoverSyncModal').classList.remove('open');
    if (handoverPollingInterval) clearInterval(handoverPollingInterval);
    localStorage.removeItem('bu_cashier_name');
    currentShift = null;
    checkCashierAuth();
  });

  // Ticket actions
  document.getElementById('btnDeskDownloadPng').addEventListener('click', generateDeskPng);
  document.getElementById('btnDeskShareWa').addEventListener('click', shareDeskWhatsApp);
  document.getElementById('btnDeskPrint').addEventListener('click', () => window.print());

  // IdeaCrux Walkin submit
  const btnCruxWalkin = document.getElementById('btnSubmitCruxWalkin');
  if (btnCruxWalkin) btnCruxWalkin.addEventListener('click', handleCruxCashWalkin);

  // IdeaCrux Search button & live debounce
  const btnCruxSearch = document.getElementById('btnCruxDeskSearch');
  if (btnCruxSearch) btnCruxSearch.addEventListener('click', () => {
    const q = document.getElementById('cruxDeskSearchInput')?.value || '';
    searchCruxDeskTeams(q);
  });

  const cruxSearchInput = document.getElementById('cruxDeskSearchInput');
  if (cruxSearchInput) {
    let debounceTimer;
    cruxSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchCruxDeskTeams(e.target.value);
      }, 250);
    });
  }
}

function startHandoverSyncPolling(shiftId, amount, handoverTo) {
  const syncModal = document.getElementById('handoverSyncModal');
  const waitingState = document.getElementById('syncWaitingState');
  const approvedState = document.getElementById('syncApprovedState');

  document.getElementById('syncSubmittedCash').textContent = `Rs. ${amount.toLocaleString()}`;
  document.getElementById('syncSubmittedTo').textContent = `Submitted to: ${handoverTo || 'Head of Finance'}`;

  waitingState.style.display = 'block';
  approvedState.style.display = 'none';
  syncModal.classList.add('open');

  if (handoverPollingInterval) clearInterval(handoverPollingInterval);

  handoverPollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/desk/shift/status?shift_id=${encodeURIComponent(shiftId)}`);
      const data = await res.json();

      if (data.success && data.handover_status === 'APPROVED') {
        clearInterval(handoverPollingInterval);
        playApprovalChime();

        waitingState.style.display = 'none';
        approvedState.style.display = 'block';
        document.getElementById('syncApprovedAmount').textContent = `Rs. ${(data.total_cash_collected || amount).toLocaleString()}`;
        document.getElementById('syncApprovedTime').textContent = `Approved by ${data.handover_to || 'Head of Finance'} at ${data.approved_at ? new Date(data.approved_at).toLocaleTimeString() : 'now'}`;
      }
    } catch (e) {
      console.warn('Sync poll check error:', e);
    }
  }, 3000);
}

async function handleCashRegistration() {
  const name = document.getElementById('studentName').value.trim();
  const roll = document.getElementById('studentRoll').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  const dept = document.getElementById('studentDept').value.trim() || 'General Admission';
  const amount = parseFloat(document.getElementById('cashAmount').value) || defaultFee;

  if (!name || !roll || !phone) {
    alert('Please enter Student Name, Roll Number, and WhatsApp Mobile.');
    return;
  }

  const submitBtn = document.getElementById('btnSubmitCashPass');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating Verified Pass...';

  try {
    const payload = {
      full_name: name,
      roll_no: roll,
      phone,
      department: dept,
      expected_amount: amount,
      cashier_name: currentShift ? currentShift.cashier_name : 'Desk Cashier',
      desk_number: currentShift ? currentShift.desk_number : 'Desk 1',
      shift_id: currentShift ? currentShift.id : null
    };

    const res = await fetch('/api/desk/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = '✓ Collect Cash & Generate Pass';

    if (!res.ok || !data.success) {
      alert(`Registration Error: ${data.error || 'Failed to issue pass'}`);
      return;
    }

    // Cash Register Sound!
    playCashChime();

    // Success! Update drawer numbers
    if (currentShift) {
      currentShift.total_cash_collected = (currentShift.total_cash_collected || 0) + amount;
      currentShift.total_tickets_sold = (currentShift.total_tickets_sold || 0) + 1;
      updateDrawerUI();
    }

    lastIssuedPass = data;
    displayIssuedPass(data);

    // Auto-trigger verified Cash pass PNG download
    setTimeout(() => {
      generateDeskPng(true);
    }, 500);

  } catch (e) {
    submitBtn.disabled = false;
    submitBtn.textContent = '✓ Collect Cash & Generate Pass';
    alert('Network error connecting to server');
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

window.switchDeskMode = function(mode) {
  const btnFiesta = document.getElementById('btnModeFiesta');
  const btnCrux = document.getElementById('btnModeCrux');
  const panelFiesta = document.getElementById('panelFiestaDesk');
  const panelCrux = document.getElementById('panelCruxDesk');

  if (mode === 'IDEACRUX') {
    if (btnFiesta) {
      btnFiesta.className = 'btn btn-outline btn-sm';
      btnFiesta.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      btnFiesta.style.color = 'var(--text-secondary)';
    }
    if (btnCrux) {
      btnCrux.className = 'btn btn-sm';
      btnCrux.style.background = '#00f0d4';
      btnCrux.style.color = '#020b0e';
    }
    if (panelFiesta) panelFiesta.style.display = 'none';
    if (panelCrux) panelCrux.style.display = 'block';

    // Auto-load recent teams for instant cashier action
    searchCruxDeskTeams('');
  } else {
    if (btnFiesta) {
      btnFiesta.className = 'btn btn-emerald btn-sm';
      btnFiesta.style.color = '#fff';
    }
    if (btnCrux) {
      btnCrux.className = 'btn btn-outline btn-sm';
      btnCrux.style.background = 'transparent';
      btnCrux.style.borderColor = 'rgba(0, 240, 212, 0.4)';
      btnCrux.style.color = '#00f0d4';
    }
    if (panelFiesta) panelFiesta.style.display = 'block';
    if (panelCrux) panelCrux.style.display = 'none';
  }
};

window.switchCruxSubTab = function(subTab) {
  const searchSec = document.getElementById('cruxSearchSection');
  const walkinSec = document.getElementById('cruxWalkinSection');
  const btnSearch = document.getElementById('btnCruxSubSearch');
  const btnWalkin = document.getElementById('btnCruxSubWalkin');

  if (subTab === 'WALKIN') {
    if (searchSec) searchSec.style.display = 'none';
    if (walkinSec) walkinSec.style.display = 'block';
    if (btnSearch) {
      btnSearch.className = 'btn btn-sm btn-outline';
      btnSearch.style.background = 'transparent';
      btnSearch.style.color = '#00f0d4';
    }
    if (btnWalkin) {
      btnWalkin.className = 'btn btn-sm';
      btnWalkin.style.background = '#00f0d4';
      btnWalkin.style.color = '#020b0e';
    }
  } else {
    if (searchSec) searchSec.style.display = 'block';
    if (walkinSec) walkinSec.style.display = 'none';
    if (btnSearch) {
      btnSearch.className = 'btn btn-sm';
      btnSearch.style.background = '#00f0d4';
      btnSearch.style.color = '#020b0e';
    }
    if (btnWalkin) {
      btnWalkin.className = 'btn btn-sm btn-outline';
      btnWalkin.style.background = 'transparent';
      btnWalkin.style.color = '#00f0d4';
    }
    searchCruxDeskTeams(document.getElementById('cruxDeskSearchInput')?.value || '');
  }
};

window.toggleCruxMember2Fields = function() {
  const count = document.getElementById('cruxMembersCount')?.value;
  const container = document.getElementById('cruxMember2Container');
  if (container) {
    container.style.display = count === '1' ? 'none' : 'flex';
  }
};

async function searchCruxDeskTeams(query = '') {
  const listEl = document.getElementById('cruxSearchResultsList');
  if (!listEl) return;

  try {
    const res = await fetch(`/api/desk/ideacrux/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!data.success) {
      listEl.innerHTML = `<div style="text-align: center; color: #f87171; padding: 1.5rem;">${data.error || 'Failed to search teams'}</div>`;
      return;
    }

    const teams = data.teams || [];
    if (teams.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No IdeaCrux teams found matching "${escapeHtml(query)}". You can register them as a walk-in above.</div>`;
      return;
    }

    listEl.innerHTML = teams.map(team => {
      const isVerified = team.status === 'VERIFIED';
      const phoneDigits = (team.leader_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneDigits.startsWith('0') ? '92' + phoneDigits.slice(1) : phoneDigits}?text=${encodeURIComponent(`Hi ${team.leader_name}, from IdeaCrux On-Spot Desk:`)}`;

      return `
        <div style="background: rgba(7, 33, 40, 0.6); border: 1px solid ${isVerified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 240, 212, 0.3)'}; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div>
              <div style="font-weight: 700; color: #fff; font-size: 1.05rem;">${escapeHtml(team.team_name)}</div>
              <div style="font-size: 0.82rem; color: #00f0d4; font-weight: 600;">Startup: ${escapeHtml(team.startup_name)}</div>
              <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                ID: ${team.id} • ${team.members_count} Member(s)
              </div>
            </div>
            <span class="badge" style="background: ${isVerified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${isVerified ? '#34d399' : '#fbbf24'}; font-size: 0.76rem; font-weight: 700;">
              ${team.status}
            </span>
          </div>

          <div style="font-size: 0.82rem; color: #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; background: rgba(0,0,0,0.25); padding: 0.6rem; border-radius: 8px;">
            <div>
              <span style="color: var(--text-muted);">Leader:</span> <strong>${escapeHtml(team.leader_name)}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted);">Dept:</span> ${escapeHtml(team.leader_dept || 'BSEAS H-11')}
            </div>
            <div>
              <span style="color: var(--text-muted);">WhatsApp:</span> <a href="${waUrl}" target="_blank" style="color: #38bdf8; text-decoration: none;">💬 ${team.leader_phone}</a>
            </div>
            <div>
              <span style="color: var(--text-muted);">Stage:</span> <span style="color: #67e8f9;">${escapeHtml(team.startup_stage || 'Idea Stage')}</span>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; margin-top: 2px;">
            ${isVerified ? `
              <span style="font-size: 0.78rem; color: #34d399; font-family: monospace;">Receipt: ${escapeHtml(team.receipt_no || team.trx_id || 'VERIFIED')}</span>
              <button type="button" class="btn btn-outline btn-sm" style="border-color: rgba(0, 240, 212, 0.5); color: #00f0d4;" onclick="viewCruxTeamPass('${team.id}')">
                🎟️ View / Print Pass
              </button>
            ` : `
              <button type="button" class="btn btn-sm" style="background: #00f0d4; color: #020b0e; font-weight: 800; padding: 0.5rem 1rem;" onclick="collectCruxCash('${team.id}')" id="btnCollect_${team.id}">
                💵 Collect Rs. 100 Cash & Issue Pitch Pass
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error searching IdeaCrux teams:', err);
  }
}

async function collectCruxCash(teamId) {
  const btn = document.getElementById(`btnCollect_${teamId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing Cash...';
  }

  try {
    const res = await fetch('/api/desk/ideacrux/collect-cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: teamId,
        cashier_name: currentShift ? currentShift.cashier_name : (localStorage.getItem('bu_cashier_name') || 'Desk Cashier'),
        desk_number: currentShift ? currentShift.desk_number : (localStorage.getItem('bu_cashier_desk') || 'Desk 1'),
        shift_id: currentShift ? currentShift.id : null
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(`Collection Error: ${data.error || 'Failed to collect cash'}`);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💵 Collect Rs. 100 Cash & Issue Pitch Pass';
      }
      return;
    }

    playCashChime();

    if (currentShift) {
      currentShift.total_cash_collected = (currentShift.total_cash_collected || 0) + 100;
      currentShift.total_tickets_sold = (currentShift.total_tickets_sold || 0) + 1;
      updateDrawerUI();
    }

    searchCruxDeskTeams(document.getElementById('cruxDeskSearchInput')?.value || '');
    displayIssuedPass(data.team, true);

    setTimeout(() => {
      generateDeskPng();
    }, 600);

  } catch (err) {
    alert('Network error connecting to server');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💵 Collect Rs. 100 Cash & Issue Pitch Pass';
    }
  }
}

async function handleCruxCashWalkin() {
  const teamName = document.getElementById('cruxTeamName')?.value.trim();
  const leaderName = document.getElementById('cruxLeaderName')?.value.trim();
  const leaderPhone = document.getElementById('cruxLeaderPhone')?.value.trim();
  const leaderDept = document.getElementById('cruxLeaderDept')?.value.trim();
  const leaderSemester = document.getElementById('cruxLeaderSemester')?.value.trim();
  const startupName = document.getElementById('cruxStartupName')?.value.trim();
  const startupStage = document.getElementById('cruxStartupStage')?.value || 'Idea Stage';
  const membersCount = parseInt(document.getElementById('cruxMembersCount')?.value || '2', 10);
  const member2Name = document.getElementById('cruxMember2Name')?.value.trim();
  const member2Phone = document.getElementById('cruxMember2Phone')?.value.trim();
  const pitchDeckLink = document.getElementById('cruxPitchDeckLink')?.value.trim();

  if (!teamName || !leaderName || !leaderPhone || !startupName) {
    alert('Please enter Team Name, Leader Name, Leader WhatsApp, and Startup Title.');
    return;
  }

  const submitBtn = document.getElementById('btnSubmitCruxWalkin');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating Pitch Pass...';

  try {
    const payload = {
      team_name: teamName,
      members_count: membersCount,
      leader_name: leaderName,
      leader_phone: leaderPhone,
      leader_dept: leaderDept,
      leader_semester: leaderSemester,
      startup_name: startupName,
      startup_stage: startupStage,
      member_2_name: member2Name,
      member_2_phone: member2Phone,
      pitch_deck_url: pitchDeckLink,
      cashier_name: currentShift ? currentShift.cashier_name : (localStorage.getItem('bu_cashier_name') || 'Desk Cashier'),
      desk_number: currentShift ? currentShift.desk_number : (localStorage.getItem('bu_cashier_desk') || 'Desk 1'),
      shift_id: currentShift ? currentShift.id : null
    };

    const res = await fetch('/api/desk/ideacrux/register-cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = '✓ Collect Rs. 100 Cash & Issue Pitch Pass';

    if (!res.ok || !data.success) {
      alert(`Registration Error: ${data.error || 'Failed to issue pass'}`);
      return;
    }

    playCashChime();

    if (currentShift) {
      currentShift.total_cash_collected = (currentShift.total_cash_collected || 0) + 100;
      currentShift.total_tickets_sold = (currentShift.total_tickets_sold || 0) + 1;
      updateDrawerUI();
    }

    document.getElementById('cruxWalkinForm').reset();
    displayIssuedPass(data.team, true);

    setTimeout(() => {
      generateDeskPng();
    }, 600);

  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = '✓ Collect Rs. 100 Cash & Issue Pitch Pass';
    alert('Network error connecting to server');
  }
}

async function viewCruxTeamPass(teamId) {
  try {
    const res = await fetch(`/api/ideacrux/status/${encodeURIComponent(teamId)}`);
    const data = await res.json();
    if (data.success && data.team) {
      displayIssuedPass(data.team, true);
    } else {
      alert('Could not retrieve team pitch pass.');
    }
  } catch (e) {
    alert('Error loading pass details');
  }
}

function displayIssuedPass(pass, isCrux = false) {
  document.getElementById('deskEmptyPlaceholder').style.display = 'none';
  const container = document.getElementById('issuedTicketContainer');
  container.style.display = 'block';

  const badgeEl = document.getElementById('deskTicketBadge');
  const titleEl = document.getElementById('deskTicketEventTitle');
  const subtitleEl = document.getElementById('deskTicketSubtitle');
  const label1El = document.getElementById('deskTicketLabel1');
  const label2El = document.getElementById('deskTicketLabel2');

  const isCruxPass = isCrux || pass.type === 'OFFICIAL_IDEACRUX_PITCH_PASS' || String(pass.id || '').startsWith('CRUX-');

  lastIssuedPass = {
    ...pass,
    isCrux: isCruxPass,
    full_name: isCruxPass ? (pass.leader_name || pass.team_name) : pass.full_name,
    roll_no: isCruxPass ? (pass.id || 'CRUX') : pass.roll_no,
    amount_paid: isCruxPass ? Number(pass.fee_amount || 600) : (pass.amount_paid || pass.expected_amount || 1.0),
    receipt_no: pass.receipt_no || pass.trx_id || (isCruxPass ? 'CSH-CRUX-0001' : 'CSH-0001'),
    cashier_name: pass.cashier_name || (currentShift ? currentShift.cashier_name : 'Desk Cashier')
  };

  document.getElementById('issuedReceiptNo').textContent = lastIssuedPass.receipt_no;
  document.getElementById('deskTicketName').textContent = lastIssuedPass.full_name;
  document.getElementById('deskTicketRoll').textContent = lastIssuedPass.roll_no;
  document.getElementById('deskTicketAmount').textContent = `Rs. ${lastIssuedPass.amount_paid.toFixed(1)}`;
  document.getElementById('deskTicketCashier').textContent = lastIssuedPass.cashier_name;

  if (isCruxPass) {
    if (badgeEl) {
      badgeEl.textContent = 'ZINDIGI PRIZE BSEAS-H11 • OFFICIAL PITCH PASS';
      badgeEl.style.background = 'rgba(0, 240, 212, 0.2)';
      badgeEl.style.color = '#00f0d4';
    }
    if (titleEl) titleEl.textContent = `${pass.team_name} (${pass.startup_name})`;
    if (subtitleEl) subtitleEl.textContent = 'Al-Beruni Auditorium • BSEAS H-11 Campus • Admit Team';
    if (label1El) label1El.textContent = 'Team Leader';
    if (label2El) label2El.textContent = 'Team ID';
    if (pass.pitch_pass_qr) {
      document.getElementById('deskTicketQrImg').src = pass.pitch_pass_qr;
    }
  } else {
    if (badgeEl) {
      badgeEl.textContent = 'OFFICIAL CASH ENTRY PASS';
      badgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
      badgeEl.style.color = '#34d399';
    }
    if (titleEl) titleEl.textContent = 'Bahria Fiesta 2026';
    if (subtitleEl) subtitleEl.textContent = 'BUIC Main Campus • Admit One Person';
    if (label1El) label1El.textContent = 'Attendee';
    if (label2El) label2El.textContent = 'Roll No';
    if (pass.ticket_qr) {
      document.getElementById('deskTicketQrImg').src = pass.ticket_qr;
    }
  }

  // Update next receipt estimate badge
  const num = parseInt((lastIssuedPass.receipt_no || '').replace(/\D/g, '')) || 1;
  const nextBadge = document.getElementById('nextReceiptBadge');
  if (nextBadge && !isCruxPass) {
    nextBadge.textContent = `Next: CSH-${String(num + 1).padStart(4, '0')}`;
  }

  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetRegistrationForm() {
  document.getElementById('studentName').value = '';
  document.getElementById('studentRoll').value = '';
  document.getElementById('studentPhone').value = '';
  document.getElementById('studentName').focus();
}

function generateDeskPng() {
  if (!lastIssuedPass) return;
  const canvas = document.getElementById('deskTicketCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const isCrux = lastIssuedPass.isCrux;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  if (isCrux) {
    bgGrad.addColorStop(0, '#020b0e');
    bgGrad.addColorStop(0.5, '#072128');
    bgGrad.addColorStop(1, '#03171d');
  } else {
    bgGrad.addColorStop(0, '#070a13');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#1e1b4b');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Border & Header
  ctx.strokeStyle = isCrux ? '#00f0d4' : '#10b981';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isCrux ? 'ZINDIGI PRIZE BSEAS-H11' : 'BAHRIA FIESTA & TECHFEST 2026', 45, 62);

  ctx.fillStyle = isCrux ? '#00f0d4' : '#34d399';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isCrux ? `OFFICIAL PITCH PASS • RECEIPT: ${lastIssuedPass.receipt_no}` : `OFFICIAL ON-SPOT PASS • RECEIPT: ${lastIssuedPass.receipt_no}`, 45, 83);

  // Details
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isCrux ? 'TEAM & STARTUP' : 'ATTENDEE NAME', 45, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  const displayTitle = isCrux ? `${lastIssuedPass.team_name || lastIssuedPass.full_name} (${lastIssuedPass.startup_name || 'Venture'})` : (lastIssuedPass.full_name || 'Attendee');
  ctx.fillText(displayTitle.slice(0, 32), 45, 170);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isCrux ? 'TEAM LEADER / ROSTER' : 'BAHRIA ROLL NUMBER', 45, 215);
  ctx.fillStyle = isCrux ? '#00f0d4' : '#38bdf8';
  ctx.font = 'bold 20px monospace';
  const displaySub = isCrux ? `${lastIssuedPass.leader_name || lastIssuedPass.full_name} [${lastIssuedPass.id || 'CRUX'}]` : (lastIssuedPass.roll_no || '-');
  ctx.fillText(displaySub, 45, 245);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('FEE COLLECTED', 45, 290);
  ctx.fillStyle = isCrux ? '#00f0d4' : '#34d399';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`Rs. ${lastIssuedPass.amount_paid.toFixed(1)} (Cash Paid)`, 45, 315);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ISSUING CASHIER', 45, 360);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${lastIssuedPass.cashier_name} (${lastIssuedPass.desk_number || 'Desk 1'})`, 45, 385);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px monospace';
  if (isCrux) {
    ctx.fillText(`Pass ID: ${lastIssuedPass.id || lastIssuedPass.registration_id}  •  Venue: Al-Beruni Auditorium (H-11)`, 45, 435);
    ctx.fillText(`Admit Startup Team  •  15 October 2026`, 45, 455);
  } else {
    ctx.fillText(`Pass ID: ${lastIssuedPass.registration_id}  •  Venue: BUIC Main Campus`, 45, 435);
    ctx.fillText(`Admit One  •  October 15-17, 2026`, 45, 455);
  }

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(560, 110);
  ctx.lineTo(560, 480);
  ctx.stroke();
  ctx.setLineDash([]);

  // QR
  const qrImg = document.getElementById('deskTicketQrImg');
  if (qrImg && qrImg.src) {
    const qrImageObj = new Image();
    qrImageObj.crossOrigin = 'anonymous';
    qrImageObj.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(610, 140, 230, 230);
      ctx.drawImage(qrImageObj, 620, 150, 210, 210);

      ctx.fillStyle = isCrux ? '#67e8f9' : '#a5b4fc';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isCrux ? 'SCAN AT AUDITORIUM TURNSTILE' : 'SCAN FOR GATE ADMISSION', 725, 400);

      ctx.fillStyle = isCrux ? '#00f0d4' : '#10b981';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(isCrux ? '🟢 VERIFIED PITCH PASS' : '🟢 100% VERIFIED CASH PASS', 725, 422);

      downloadBlob();
    };
    qrImageObj.src = qrImg.src;
  } else {
    downloadBlob();
  }

  function downloadBlob() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safePrefix = isCrux ? 'IdeaCrux_Pitch_Pass' : 'Bahria_Cash_Pass';
      const safeName = (lastIssuedPass.full_name || 'Attendee').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeRef = (lastIssuedPass.receipt_no || 'Pass').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safePrefix}_${safeName}_${safeRef}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}

async function shareDeskWhatsApp() {
  if (!lastIssuedPass) return;
  const isCrux = lastIssuedPass.isCrux;

  let text = '';
  if (isCrux) {
    text =
      `💡 *ZINDIGI PRIZE BSEAS-H11 • Official Turnstile Pitch Pass*\n\n` +
      `🏆 *Team:* ${lastIssuedPass.team_name || lastIssuedPass.full_name}\n` +
      `🚀 *Startup:* ${lastIssuedPass.startup_name || 'Venture'}\n` +
      `👤 *Leader:* ${lastIssuedPass.leader_name || lastIssuedPass.full_name}\n` +
      `👥 *Members:* ${lastIssuedPass.members_count || 2}\n` +
      `💵 *Fee:* Rs. ${lastIssuedPass.amount_paid.toFixed(1)} (Cash Paid)\n` +
      `🧾 *Receipt:* ${lastIssuedPass.receipt_no}\n` +
      `🆔 *Pass ID:* ${lastIssuedPass.id || lastIssuedPass.registration_id}\n` +
      `👤 *Issued By:* ${lastIssuedPass.cashier_name} (${lastIssuedPass.desk_number || 'Desk 1'})\n\n` +
      `📍 *Venue:* Al-Beruni Auditorium, BSEAS H-11 Campus\n` +
      `📅 *Date:* 15 October 2026\n` +
      `🟢 *Status:* VERIFIED & ADMITTED\n\n` +
      `View your digital pitch pass: https://bahria-event-portal.bahria-event-portal.workers.dev/ideacrux?team_id=${lastIssuedPass.id}`;
  } else {
    text = 
      `🎟️ *Bahria Fiesta & TechFest 2026 Official Cash Pass*\n\n` +
      `👤 *Attendee:* ${lastIssuedPass.full_name}\n` +
      `🎓 *Roll Number:* ${lastIssuedPass.roll_no}\n` +
      `💵 *Cash Paid:* Rs. ${lastIssuedPass.amount_paid.toFixed(1)}\n` +
      `🧾 *Receipt No:* ${lastIssuedPass.receipt_no}\n` +
      `🆔 *Pass ID:* ${lastIssuedPass.registration_id}\n` +
      `👤 *Issued By:* ${lastIssuedPass.cashier_name} (${lastIssuedPass.desk_number})\n\n` +
      `📍 *Venue:* Bahria University Islamabad Campus\n` +
      `📅 *Dates:* October 15-17, 2026\n` +
      `🟢 *Status:* VERIFIED & ADMITTED\n\n` +
      `Download your digital pass: https://bahria-event-portal.bahria-event-portal.workers.dev`;
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: isCrux ? 'Zindigi Prize BSEAS-H11 Pitch Pass' : 'Bahria Fiesta 2026 Cash Pass',
        text: text,
        url: window.location.origin
      });
      return;
    } catch (e) {}
  }

  const phone = (lastIssuedPass.leader_phone || lastIssuedPass.phone || '').replace(/\D/g, '');
  const url = phone 
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

window.logoutCashier = function() {
  localStorage.removeItem('bahria_auth_token');
  localStorage.removeItem('bahria_staff_user');
  localStorage.removeItem('bu_cashier_name');
  window.location.href = '/login.html';
};
