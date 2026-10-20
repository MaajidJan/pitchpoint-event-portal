// On-Spot Startup Cash Desk Controller — Zindigi Prize BSEAS-H11

(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const urlStr = String(url);
    if (urlStr.startsWith('/api/') && !urlStr.startsWith('/api/auth/login')) {
      const token = localStorage.getItem('bahria_auth_token');
      if (!token) {
        window.location.replace('/login.html?redirect=crux-desk.html');
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
        window.location.replace('/login.html?redirect=crux-desk.html&error=session_expired');
        throw new Error('Unauthorized or session expired');
      }
      return res;
    }
    return originalFetch(url, options);
  };
})();

let currentShift = null;
let lastIssuedPass = null;

// Audio Chime Synthesizer
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

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkCashierShiftAuth();
});

function checkCashierShiftAuth() {
  const savedName = localStorage.getItem('crux_cashier_name');
  const savedDesk = localStorage.getItem('crux_cashier_desk') || 'Auditorium Entry Desk';

  if (!savedName) {
    document.getElementById('cashierShiftModal').classList.add('open');
  } else {
    initShift(savedName, savedDesk);
  }
}

async function initShift(cashierName, counterLoc) {
  try {
    const res = await fetch('/api/desk/shift/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashier_name: cashierName, desk_number: counterLoc })
    });
    const data = await res.json();
    if (data.success && data.shift) {
      currentShift = data.shift;
      localStorage.setItem('crux_cashier_name', cashierName);
      localStorage.setItem('crux_cashier_desk', counterLoc);
      updateDrawerHud();
      searchDeskTeams('');
    }
  } catch (err) {
    console.error('Error opening shift:', err);
  }
}

function updateDrawerHud() {
  if (!currentShift) return;
  const cashEl = document.getElementById('drawerCashDisplay');
  const passesEl = document.getElementById('drawerPassesDisplay');
  const counterEl = document.getElementById('drawerCounterDisplay');
  const labelEl = document.getElementById('deskCashierLabel');

  if (cashEl) cashEl.textContent = `Rs. ${(currentShift.total_cash_collected || 0).toLocaleString()}`;
  if (passesEl) passesEl.textContent = currentShift.total_tickets_sold || 0;
  if (counterEl) counterEl.textContent = currentShift.desk_number || 'Auditorium Entry';
  if (labelEl) labelEl.textContent = `${currentShift.cashier_name} (${currentShift.desk_number})`;
}

function setupEventListeners() {
  // Cashier Modal Sign-in
  document.getElementById('btnStartShift').addEventListener('click', () => {
    const name = document.getElementById('shiftCashierName').value.trim();
    const loc = document.getElementById('shiftCounterLocation').value;
    if (!name) {
      alert('Please enter your name to start cashier shift.');
      return;
    }
    document.getElementById('cashierShiftModal').classList.remove('open');
    initShift(name, loc);
  });

  document.getElementById('btnSwitchCashierShift').addEventListener('click', () => {
    document.getElementById('cashierShiftModal').classList.add('open');
  });

  // Search input and debounce
  const searchInput = document.getElementById('cruxDeskSearchInput');
  let debounce;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => searchDeskTeams(e.target.value), 250);
    });
  }

  document.getElementById('btnRunSearch').addEventListener('click', () => {
    searchDeskTeams(document.getElementById('cruxDeskSearchInput')?.value || '');
  });

  // Walk-in form submit
  document.getElementById('btnSubmitWalkinPass').addEventListener('click', handleWalkinSubmit);

  // Pass actions
  document.getElementById('btnDownloadPassPng').addEventListener('click', downloadIssuedPassPng);
  document.getElementById('btnSharePassWa').addEventListener('click', shareIssuedPassWhatsApp);
  document.getElementById('btnPrintPass').addEventListener('click', () => window.print());
  document.getElementById('btnNextTeam').addEventListener('click', () => {
    document.getElementById('issuedPassCardContainer').style.display = 'none';
    document.getElementById('passEmptyPlaceholder').style.display = 'block';
    document.getElementById('cruxWalkinForm').reset();
    document.getElementById('cruxDeskSearchInput').value = '';
    searchDeskTeams('');
  });
}

window.switchDeskTab = function(tab) {
  const secSearch = document.getElementById('sectionSearch');
  const secWalkin = document.getElementById('sectionWalkin');
  const btnSearch = document.getElementById('tabBtnSearch');
  const btnWalkin = document.getElementById('tabBtnWalkin');

  if (tab === 'WALKIN') {
    secSearch.style.display = 'none';
    secWalkin.style.display = 'block';
    btnSearch.classList.remove('active');
    btnWalkin.classList.add('active');
  } else {
    secSearch.style.display = 'block';
    secWalkin.style.display = 'none';
    btnSearch.classList.add('active');
    btnWalkin.classList.remove('active');
    searchDeskTeams(document.getElementById('cruxDeskSearchInput')?.value || '');
  }
};

async function searchDeskTeams(query = '') {
  const listEl = document.getElementById('searchResultsContainer');
  if (!listEl) return;

  try {
    const res = await fetch(`/api/desk/ideacrux/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!data.success) {
      listEl.innerHTML = `<div style="text-align: center; color: #f87171; padding: 2rem; font-family: var(--font-mono);">${data.error || 'Failed to search teams'}</div>`;
      return;
    }

    const teams = data.teams || [];
    if (teams.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem; font-family: var(--font-mono);">No teams found matching "${escapeHtml(query)}". Use walk-in registration tab to add on the spot.</div>`;
      return;
    }

    listEl.innerHTML = teams.map(team => {
      const isVerified = team.status === 'VERIFIED';
      const phoneDigits = (team.leader_phone || '').replace(/\D/g, '');
      const waUrl = `https://wa.me/${phoneDigits.startsWith('0') ? '92' + phoneDigits.slice(1) : phoneDigits}?text=${encodeURIComponent(`Hi ${team.leader_name}, from Zindigi Prize BSEAS-H11 On-Spot Desk:`)}`;

      return `
        <div class="team-search-result-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <div>
              <div style="font-family: var(--font-display); font-weight: 800; color: #fff; font-size: 1.05rem; text-transform: uppercase;">
                ${escapeHtml(team.team_name)}
              </div>
              <div style="font-size: 0.84rem; color: var(--accent-cyan); font-weight: 700; margin-top: 2px;">
                VENTURE: ${escapeHtml(team.startup_name)}
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                ID: ${team.id} • ${team.members_count} Founder(s)
              </div>
            </div>
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; ${isVerified ? 'background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);' : 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);'}">
              ${team.status}
            </span>
          </div>

          <div style="background: rgba(4, 20, 25, 0.8); border: 1px solid var(--border-hairline); border-radius: 6px; padding: 0.65rem; font-size: 0.8rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
            <div><span style="color: var(--text-muted);">Leader:</span> <strong style="color: #fff;">${escapeHtml(team.leader_name)}</strong></div>
            <div><span style="color: var(--text-muted);">Dept:</span> <span style="color: #cbd5e1;">${escapeHtml(team.leader_dept || 'BSEAS H-11')}</span></div>
            <div><span style="color: var(--text-muted);">WhatsApp:</span> <a href="${waUrl}" target="_blank" style="color: var(--accent-cyan); text-decoration: none;">💬 ${team.leader_phone}</a></div>
            <div><span style="color: var(--text-muted);">Stage:</span> <span style="color: var(--accent-cyan);">${escapeHtml(team.startup_stage || 'Idea Stage')}</span></div>
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; margin-top: 2px;">
            ${isVerified ? `
              <span style="font-family: var(--font-mono); font-size: 0.76rem; color: #34d399;">RECEIPT: ${escapeHtml(team.receipt_no || team.trx_id || 'PAID')}</span>
              <button type="button" class="btn btn-outline-cyan btn-sm" style="font-size: 0.75rem;" onclick="viewTeamPass('${team.id}')">
                VIEW PITCH PASS
              </button>
            ` : `
              <button type="button" class="btn btn-cyan btn-sm" style="font-size: 0.78rem;" onclick="collectDeskCash('${team.id}')" id="btnCollect_${team.id}">
                💵 COLLECT RS. 1000 CASH & ISSUE PASS
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error searching teams:', err);
  }
}

async function collectDeskCash(teamId) {
  const btn = document.getElementById(`btnCollect_${teamId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Recording Cash...';
  }

  try {
    const res = await fetch('/api/desk/ideacrux/collect-cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: teamId,
        cashier_name: currentShift ? currentShift.cashier_name : 'Desk Cashier',
        desk_number: currentShift ? currentShift.desk_number : 'Auditorium Entry',
        shift_id: currentShift ? currentShift.id : null
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(`Collection Error: ${data.error || 'Failed to collect cash'}`);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '💵 COLLECT RS. 1000 CASH & ISSUE PASS';
      }
      return;
    }

    playCashChime();

    if (currentShift) {
      currentShift.total_cash_collected = (currentShift.total_cash_collected || 0) + 1000;
      currentShift.total_tickets_sold = (currentShift.total_tickets_sold || 0) + 1;
      updateDrawerHud();
    }

    searchDeskTeams(document.getElementById('cruxDeskSearchInput')?.value || '');
    displayIssuedPass(data.team);

    setTimeout(() => {
      downloadIssuedPassPng();
    }, 600);

  } catch (err) {
    alert('Network error connecting to server');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💵 COLLECT RS. 1000 CASH & ISSUE PASS';
    }
  }
}

async function handleWalkinSubmit() {
  const teamName = document.getElementById('walkinTeamName')?.value.trim();
  const leaderName = document.getElementById('walkinLeaderName')?.value.trim();
  const leaderPhoneRaw = document.getElementById('walkinLeaderPhone')?.value.trim();
  const leaderDept = document.getElementById('walkinLeaderDept')?.value.trim();
  const leaderSemester = document.getElementById('walkinLeaderSemester')?.value.trim();
  const startupName = document.getElementById('walkinStartupName')?.value.trim();
  const startupStage = document.getElementById('walkinStage')?.value || 'Working MVP';
  const member2Name = document.getElementById('walkinMember2Name')?.value.trim();
  const member2PhoneRaw = document.getElementById('walkinMember2Phone')?.value.trim();
  const pitchDeckUrl = document.getElementById('walkinDeckUrl')?.value.trim();

  if (!teamName || !leaderName || !leaderPhoneRaw || !startupName) {
    alert('Please enter Team Name, Leader Name, Leader WhatsApp, and Startup Title.');
    return;
  }

  // Validate Pakistani Phone (03XXXXXXXXX - 11 digits)
  const cleanLeader = leaderPhoneRaw.replace(/[^\d+]/g, '');
  let normLeader = cleanLeader.startsWith('+92') ? '0' + cleanLeader.slice(3) : (cleanLeader.startsWith('92') && cleanLeader.length === 12 ? '0' + cleanLeader.slice(2) : cleanLeader);
  normLeader = normLeader.replace(/\D/g, '');
  if (!/^03[0-9]{9}$/.test(normLeader)) {
    alert('Invalid Leader Phone: Please enter an 11-digit Pakistani mobile number starting with 03 (e.g. 03292092724).');
    return;
  }

  let normM2 = '';
  if (member2PhoneRaw) {
    const cleanM2 = member2PhoneRaw.replace(/[^\d+]/g, '');
    normM2 = cleanM2.startsWith('+92') ? '0' + cleanM2.slice(3) : (cleanM2.startsWith('92') && cleanM2.length === 12 ? '0' + cleanM2.slice(2) : cleanM2);
    normM2 = normM2.replace(/\D/g, '');
    if (!/^03[0-9]{9}$/.test(normM2)) {
      alert('Invalid Member 2 Phone: Please enter an 11-digit Pakistani mobile number starting with 03 (e.g. 03292092724).');
      return;
    }
  }

  const submitBtn = document.getElementById('btnSubmitWalkinPass');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating Turnstile Pass...';

  try {
    const payload = {
      team_name: teamName,
      members_count: member2Name ? 2 : 1,
      leader_name: leaderName,
      leader_phone: normLeader,
      leader_dept: leaderDept,
      leader_semester: leaderSemester,
      startup_name: startupName,
      startup_stage: startupStage,
      member_2_name: member2Name,
      member_2_phone: normM2,
      pitch_deck_url: pitchDeckUrl,
      cashier_name: currentShift ? currentShift.cashier_name : 'Desk Cashier',
      desk_number: currentShift ? currentShift.desk_number : 'Auditorium Entry',
      shift_id: currentShift ? currentShift.id : null
    };

    const res = await fetch('/api/desk/ideacrux/register-cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = '[COLLECT RS. 1000 CASH & GENERATE PITCH PASS]';

    if (!res.ok || !data.success) {
      alert(`Registration Error: ${data.error || 'Failed to issue pass'}`);
      return;
    }

    playCashChime();

    if (currentShift) {
      currentShift.total_cash_collected = (currentShift.total_cash_collected || 0) + 1000;
      currentShift.total_tickets_sold = (currentShift.total_tickets_sold || 0) + 1;
      updateDrawerHud();
    }

    document.getElementById('cruxWalkinForm').reset();
    displayIssuedPass(data.team);

    setTimeout(() => {
      downloadIssuedPassPng();
    }, 600);

  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = '[COLLECT RS. 1000 CASH & GENERATE PITCH PASS]';
    alert('Network error connecting to server');
  }
}

async function viewTeamPass(teamId) {
  try {
    const res = await fetch(`/api/ideacrux/status/${encodeURIComponent(teamId)}`);
    const data = await res.json();
    if (data.success && data.team) {
      displayIssuedPass(data.team);
    } else {
      alert('Could not retrieve team pitch pass.');
    }
  } catch (e) {
    alert('Error loading pass details');
  }
}

function displayIssuedPass(team) {
  lastIssuedPass = team;

  document.getElementById('passEmptyPlaceholder').style.display = 'none';
  const container = document.getElementById('issuedPassCardContainer');
  container.style.display = 'block';

  document.getElementById('passReceiptBadge').textContent = team.receipt_no || team.trx_id || 'CSH-CRUX-0001';
  document.getElementById('issuedTeamName').textContent = team.team_name;
  document.getElementById('issuedStartupName').textContent = `VENTURE: ${team.startup_name.toUpperCase()}`;
  document.getElementById('issuedPassId').textContent = team.id;
  document.getElementById('issuedLeaderName').textContent = `${team.leader_name} (${team.leader_phone})`;

  if (team.pitch_pass_qr) {
    document.getElementById('issuedPassQrImg').src = team.pitch_pass_qr;
  }

  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function downloadIssuedPassPng() {
  if (!lastIssuedPass) return;
  const canvas = document.getElementById('deskTicketCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const team = lastIssuedPass;

  // Background
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#020b0e');
  bg.addColorStop(0.5, '#072128');
  bg.addColorStop(1, '#020b0e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Hairline Reticle Border
  ctx.strokeStyle = '#00f0d4';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.strokeStyle = 'rgba(0, 240, 212, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, w - 52, h - 52);

  // Header Title
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

  // Divider
  ctx.strokeStyle = 'rgba(0, 240, 212, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 168);
  ctx.lineTo(w - 60, 168);
  ctx.stroke();

  // Team
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

  // Fee Paid
  ctx.fillStyle = 'rgba(0, 240, 212, 0.15)';
  ctx.fillRect(w / 2 - 130, 340, 260, 32);
  ctx.strokeStyle = '#00f0d4';
  ctx.lineWidth = 1;
  ctx.strokeRect(w / 2 - 130, 340, 260, 32);

  ctx.fillStyle = '#00f0d4';
  ctx.font = 'bold 13px "JetBrains Mono", monospace';
  ctx.fillText(`FEE: RS. 1000 (PHYSICAL CASH PAID)`, w / 2, 361);

  // QR
  const qrImg = document.getElementById('issuedPassQrImg');
  if (qrImg && qrImg.src) {
    const qrImageObj = new Image();
    qrImageObj.crossOrigin = 'anonymous';
    qrImageObj.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w / 2 - 125, 400, 250, 250);
      ctx.drawImage(qrImageObj, w / 2 - 115, 410, 230, 230);

      ctx.fillStyle = '#00f0d4';
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillText('SCAN AT AUDITORIUM TURNSTILE GATES', w / 2, 685);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('ADMIT AUTHORIZED FOUNDER ROSTER TO STAGE', w / 2, 710);

      // Meta Box
      ctx.fillStyle = 'rgba(4, 20, 25, 0.8)';
      ctx.fillRect(60, 740, w - 120, 110);
      ctx.strokeStyle = 'rgba(0, 240, 212, 0.2)';
      ctx.strokeRect(60, 740, w - 120, 110);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#849ca7';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('CAMPUS ARENA:', 85, 770);
      ctx.fillText('SCHEDULED DATE:', 85, 800);
      ctx.fillText('ISSUED BY:', 85, 830);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Space Grotesk", sans-serif';
      ctx.fillText('Al-Beruni Auditorium, BSEAS H-11 Campus', 220, 770);
      ctx.fillText('15 October 2026', 220, 800);
      ctx.fillText(`${team.cashier_name || 'Desk Cashier'} (${team.receipt_no || 'CSH-CRUX'})`, 220, 830);

      // Watermark
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4d6672';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('OFFICIAL ZINDIGI PRIZE ON-CAMPUS CREDENTIAL • TURNSTILE VERIFIED', w / 2, 905);

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
      a.download = `ZINDIGI_PRIZE_PITCH_PASS_${(team.team_name || 'Team').replace(/[^a-zA-Z0-9]/g, '_')}_${team.id}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}

function shareIssuedPassWhatsApp() {
  if (!lastIssuedPass) return;
  const team = lastIssuedPass;

  const text =
    `💡 *ZINDIGI PRIZE BSEAS-H11 // OFFICIAL TURNSTILE PITCH PASS*\n` +
    `*Zindigi Prize On-Campus Round — BSEAS H-11 Campus*\n\n` +
    `🏆 *Startup Team:* ${team.team_name}\n` +
    `🚀 *Venture:* ${team.startup_name}\n` +
    `👤 *Team Leader:* ${team.leader_name} (${team.leader_dept || 'BSEAS H-11'})\n` +
    `💵 *Fee Paid:* Rs. 1,000 (Physical Cash Paid at Desk)\n` +
    `🧾 *Receipt No:* ${team.receipt_no || 'CSH-CRUX'}\n` +
    `🆔 *Pass ID:* ${team.id}\n` +
    `🟢 *Status:* VERIFIED & ADMITTED\n\n` +
    `📍 *Venue:* Al-Beruni Auditorium, BSEAS H-11 Campus\n` +
    `📅 *Event Date:* 15 October 2026\n` +
    `⚡ *Turnstile Gate Entry:* Present this pass at the entrance scanner.\n\n` +
    `View digital credential: https://bahria-event-portal.bahria-event-portal.workers.dev/ideacrux?team_id=${team.id}`;

  const phone = (team.leader_phone || '').replace(/\D/g, '');
  const waUrl = phone 
    ? `https://wa.me/${phone.startsWith('0') ? '92' + phone.slice(1) : phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

window.logoutCashier = function() {
  localStorage.removeItem('bahria_auth_token');
  localStorage.removeItem('bahria_staff_user');
  localStorage.removeItem('crux_cashier_name');
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
