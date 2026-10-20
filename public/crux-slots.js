/**
 * STAGE & PITCH SLOT OPERATIONS CLIENT CONTROLLER
 * Zindigi Prize BSEAS-H11 On-Campus Round
 */

// Global State
let allCoordTeams = [];
let previousArrivedIds = new Set();
let audioAlertsEnabled = true;
let currentOperator = null;
let pollTimer = null;

// Web Audio API Chime Synthesizer
let audioCtx = null;
function playArrivalChime() {
  if (!audioAlertsEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    
    // First chime tone (high harmonic)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Second chime tone (pleasant major triad finish)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.warn('Audio chime unsupported or blocked:', e);
  }
}

function showToast(title, body) {
  const toast = document.getElementById('toastNotification');
  const tTitle = document.getElementById('toastTitle');
  const tBody = document.getElementById('toastBody');
  if (!toast) return;

  if (tTitle) tTitle.textContent = title;
  if (tBody) tBody.textContent = body;

  toast.style.display = 'flex';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4500);
}

// -----------------------------------------------------------------------------
// 1. Session & Auth Verification
// -----------------------------------------------------------------------------
function getAuthToken() {
  return localStorage.getItem('bahria_auth_token') || sessionStorage.getItem('bahria_auth_token');
}

function getStoredUser() {
  const raw = localStorage.getItem('bahria_staff_user') || 
              localStorage.getItem('bahria_auth_user') || 
              sessionStorage.getItem('bahria_staff_user') || 
              sessionStorage.getItem('bahria_auth_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function checkCoordinatorAuth() {
  const token = getAuthToken();
  const user = getStoredUser();

  if (!token || !user) {
    window.location.href = '/login.html?redirect=crux-slots.html';
    return false;
  }

  // Allowed roles: STAGE_COORDINATOR or ADMIN
  if (user.role !== 'STAGE_COORDINATOR' && user.role !== 'ADMIN') {
    alert('Access Denied: This portal requires Stage Coordinator or Event Admin credentials.');
    window.location.href = '/login.html';
    return false;
  }

  currentOperator = user;

  const badge = document.getElementById('coordProfileBadge');
  if (badge) {
    badge.textContent = `${user.full_name || user.username} (${user.role === 'STAGE_COORDINATOR' ? 'Stage Coordinator' : 'Admin'})`;
  }

  return true;
}

window.logoutCoordinator = function() {
  if (confirm('Are you sure you want to sign out of the Stage & Slots Console?')) {
    localStorage.removeItem('bahria_auth_token');
    localStorage.removeItem('bahria_auth_user');
    localStorage.removeItem('bahria_staff_user');
    sessionStorage.removeItem('bahria_auth_token');
    sessionStorage.removeItem('bahria_auth_user');
    sessionStorage.removeItem('bahria_staff_user');
    window.location.href = '/login.html';
  }
};

window.toggleAudioAlerts = function() {
  audioAlertsEnabled = !audioAlertsEnabled;
  const btn = document.getElementById('btnAudioToggle');
  if (btn) {
    btn.textContent = audioAlertsEnabled ? '🔔 Sound: ON' : '🔕 Sound: OFF';
    btn.style.color = audioAlertsEnabled ? 'var(--accent-coord)' : 'var(--text-muted)';
  }
  if (audioAlertsEnabled) {
    playArrivalChime();
    showToast('Sound Alerts Enabled', 'Audio chime will sound when presenters arrive.');
  }
};

// -----------------------------------------------------------------------------
// 2. Data Loading & Polling
// -----------------------------------------------------------------------------
window.loadCoordinatorData = async function() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch('/api/coordinator/teams', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.success) {
      console.error('Failed to load coordinator data:', data.error);
      return;
    }

    const newTeams = data.teams || [];
    
    // Check for newly arrived teams to alert
    if (previousArrivedIds.size > 0) {
      newTeams.forEach(t => {
        if (t.checked_in_at && !previousArrivedIds.has(t.id)) {
          playArrivalChime();
          showToast(`Presenter Arrived!`, `${t.startup_name || t.team_name} checked in at Auditorium.`);
        }
      });
    }

    // Refresh arrived tracker
    previousArrivedIds.clear();
    newTeams.forEach(t => {
      if (t.checked_in_at) previousArrivedIds.add(t.id);
    });

    allCoordTeams = newTeams;

    // Update Live Pitch Stage Selectors
    populateStageSelectors(data.stage);

    // Compute Metrics
    const total = allCoordTeams.length;
    const arrived = allCoordTeams.filter(t => !!t.checked_in_at).length;
    const slotted = allCoordTeams.filter(t => !!(t.timing_slot && t.timing_slot.trim())).length;
    const pendingArrival = total - arrived;

    const elTotal = document.getElementById('metricTotalTeams');
    const elArrived = document.getElementById('metricArrivedTeams');
    const elPending = document.getElementById('metricPendingArrival');
    const elSlotted = document.getElementById('metricSlottedTeams');

    if (elTotal) elTotal.textContent = total;
    if (elArrived) elArrived.textContent = arrived;
    if (elPending) elPending.textContent = pendingArrival;
    if (elSlotted) elSlotted.textContent = slotted;

    filterCoordinatorTeams();

  } catch (err) {
    console.error('Network error loading coordinator teams:', err);
  }
};

function populateStageSelectors(stageState) {
  const curSelect = document.getElementById('stageCurrentTeamSelect');
  const nextSelect = document.getElementById('stageNextTeamSelect');
  const statusSelect = document.getElementById('stageStatusSelect');
  if (!curSelect || !nextSelect) return;

  const curVal = curSelect.value;
  const nextVal = nextSelect.value;

  const options = ['<option value="">-- No Team Selected (Stage Idle) --</option>'];
  allCoordTeams.forEach(t => {
    const slotTxt = t.timing_slot ? ` [${t.timing_slot}]` : '';
    const arrTxt = t.checked_in_at ? '🟢 Arrived' : '⏳ Pending';
    options.push(`<option value="${t.id}">${arrTxt} • ${escapeHtml(t.startup_name || t.team_name)} (Team: ${escapeHtml(t.team_name)})${slotTxt}</option>`);
  });

  curSelect.innerHTML = options.join('');
  nextSelect.innerHTML = options.join('');

  if (stageState?.current?.id) curSelect.value = stageState.current.id;
  else if (curVal) curSelect.value = curVal;

  if (stageState?.next?.id) nextSelect.value = stageState.next.id;
  else if (nextVal) nextSelect.value = nextVal;

  if (statusSelect && stageState?.status) {
    statusSelect.value = stageState.status;
  }
}

// -----------------------------------------------------------------------------
// 3. Filtering & Table Rendering
// -----------------------------------------------------------------------------
window.filterCoordinatorTeams = function() {
  const tbody = document.getElementById('coordinatorTeamsTableBody');
  if (!tbody) return;

  const q = (document.getElementById('coordSearchInput')?.value || '').toLowerCase().trim();
  const filter = document.getElementById('coordArrivalFilter')?.value || 'ALL';

  let list = allCoordTeams.filter(t => {
    if (filter === 'ARRIVED' && !t.checked_in_at) return false;
    if (filter === 'NOT_ARRIVED' && !!t.checked_in_at) return false;
    if (filter === 'SLOTTED' && !(t.timing_slot && t.timing_slot.trim())) return false;
    if (filter === 'UNSLOTTED' && !!(t.timing_slot && t.timing_slot.trim())) return false;

    if (q) {
      const match = (t.startup_name || '').toLowerCase().includes(q) ||
                    (t.team_name || '').toLowerCase().includes(q) ||
                    (t.leader_name || '').toLowerCase().includes(q) ||
                    (t.leader_phone || '').includes(q) ||
                    (t.timing_slot || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">No startup teams match the selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => {
    const isArrived = !!t.checked_in_at;
    const phoneDigits = (t.leader_phone || '').replace(/\D/g, '');
    const cleanWaNumber = phoneDigits.startsWith('0') ? '92' + phoneDigits.slice(1) : (phoneDigits.startsWith('92') ? phoneDigits : '92' + phoneDigits);

    const checkInTime = t.checked_in_at ? formatTimeStr(t.checked_in_at) : '';

    return `
      <tr>
        <!-- Startup & Team -->
        <td>
          <div style="font-weight: 800; color: #fff; font-size: 0.92rem;">${escapeHtml(t.startup_name || t.team_name)}</div>
          <div style="font-size: 0.75rem; color: #94a3b8; font-family: var(--font-mono); margin-top: 2px;">
            Team: <strong style="color: var(--accent-cyan);">${escapeHtml(t.team_name)}</strong>
          </div>
        </td>

        <!-- Lead Presenter -->
        <td>
          <div style="font-weight: 700; color: #e2e8f0;">${escapeHtml(t.leader_name)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(t.leader_dept || 'BSEAS')}${t.leader_semester ? ' • Sem ' + escapeHtml(t.leader_semester) : ''}</div>
        </td>

        <!-- WhatsApp & Phone -->
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <code style="font-family: var(--font-mono); color: #cbd5e1; font-size: 0.8rem;">${escapeHtml(t.leader_phone || '-')}</code>
            ${cleanWaNumber.length >= 10 ? `
              <button type="button" class="hud-btn" style="background: rgba(37, 211, 102, 0.15); border-color: rgba(37, 211, 102, 0.4); color: #25d366; padding: 2px 8px; font-size: 0.72rem;" onclick="sendSlotWhatsApp('${escapeHtml(t.leader_name)}', '${cleanWaNumber}', '${escapeHtml(t.startup_name || t.team_name)}', '${escapeHtml(t.timing_slot || '')}')" title="Send WhatsApp Message to Team Leader">
                💬 WhatsApp
              </button>
            ` : ''}
          </div>
        </td>

        <!-- Maturity Bracket -->
        <td>
          <span style="font-size: 0.75rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px; font-family: var(--font-mono); color: #cbd5e1;">
            ${escapeHtml(t.startup_stage || 'Idea Stage')}
          </span>
        </td>

        <!-- Auditorium Arrival Check-in -->
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="hud-btn" style="padding: 3px 10px; font-size: 0.75rem; ${isArrived ? 'background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #34d399;' : 'background: rgba(245, 158, 11, 0.15); border-color: #f59e0b; color: #fbbf24;'}" onclick="toggleArrival('${t.id}', ${isArrived})" title="Click to toggle arrival at auditorium">
              ${isArrived ? '✅ ARRIVED' : '⏳ NOT ARRIVED'}
            </button>
            ${isArrived && checkInTime ? `<span style="font-family: var(--font-mono); font-size: 0.7rem; color: #94a3b8;">${checkInTime}</span>` : ''}
          </div>
        </td>

        <!-- Timing Slot Assignment -->
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="text" class="slot-input" value="${escapeHtml(t.timing_slot || '')}" placeholder="e.g. 10:15 AM" onchange="saveSlot('${t.id}', this.value)" onkeydown="if(event.key==='Enter') this.blur();">
            <span style="font-size: 0.7rem; color: #64748b;" title="Press enter or click outside to save">💾</span>
          </div>
        </td>

        <!-- Actions -->
        <td>
          <div style="display: flex; gap: 4px;">
            <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.72rem; padding: 3px 8px;" onclick="setAsCurrentlyPitching('${t.id}')" title="Set this team as Currently Presenting on stage">
              🎤 Pitch
            </button>
            <button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.72rem; padding: 3px 8px; border-color: #c084fc; color: #c084fc;" onclick="setAsNextInQueue('${t.id}')" title="Set this team as Next Up In Queue">
              ⏭️ Next
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

function formatTimeStr(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// -----------------------------------------------------------------------------
// 4. Coordinator Actions (Arrivals, Slots, Stage Updates)
// -----------------------------------------------------------------------------
window.toggleArrival = async function(teamId, currentArrivedState) {
  const token = getAuthToken();
  if (!token) return;

  const targetState = !currentArrivedState;

  try {
    const res = await fetch('/api/coordinator/arrival/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ team_id: teamId, arrived: targetState })
    });
    const data = await res.json();
    if (data.success) {
      if (targetState) {
        playArrivalChime();
        showToast('Arrival Verified', 'Team marked as Arrived at Auditorium.');
      }
      loadCoordinatorData();
    } else {
      alert('Error: ' + (data.error || 'Failed to update arrival status'));
    }
  } catch (err) {
    alert('Network error updating arrival state');
  }
};

window.saveSlot = async function(teamId, newSlotVal) {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch('/api/coordinator/slot/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ team_id: teamId, timing_slot: newSlotVal })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Slot Saved', `Timing slot set to: ${newSlotVal || 'Unassigned'}`);
      loadCoordinatorData();
    } else {
      alert('Error: ' + (data.error || 'Failed to save slot'));
    }
  } catch (err) {
    alert('Network error saving timing slot');
  }
};

window.setAsCurrentlyPitching = function(teamId) {
  const curSelect = document.getElementById('stageCurrentTeamSelect');
  if (curSelect) {
    curSelect.value = teamId;
    updateLivePitchStage();
  }
};

window.setAsNextInQueue = function(teamId) {
  const nextSelect = document.getElementById('stageNextTeamSelect');
  if (nextSelect) {
    nextSelect.value = teamId;
    updateLivePitchStage();
  }
};

window.updateLivePitchStage = async function() {
  const token = getAuthToken();
  if (!token) return;

  const current_team_id = document.getElementById('stageCurrentTeamSelect')?.value || '';
  const next_team_id = document.getElementById('stageNextTeamSelect')?.value || '';
  const stage_status = document.getElementById('stageStatusSelect')?.value || 'PITCH_IN_PROGRESS';
  const send_email_to_next = document.getElementById('chkSendEmailToNext')?.checked ?? true;

  try {
    const res = await fetch('/api/coordinator/pitch-stage/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ current_team_id, next_team_id, stage_status, send_email_to_next })
    });
    const data = await res.json();
    if (data.success) {
      const emailNotice = data.email_dispatched ? '\n\n📧 Call-up notice email dispatched to next team leader!' : '';
      alert(`✅ Live Pitch Stage updated successfully!${emailNotice}`);
      loadCoordinatorData();
    } else {
      alert(`Error updating stage: ${data.error || 'Server error'}`);
    }
  } catch (err) {
    alert('Network error updating live pitch stage');
  }
};

window.sendSlotWhatsApp = function(leaderName, waPhone, startupName, timingSlot) {
  const msg = `Assalam-o-Alaikum ${leaderName},

This is the Stage Operations & Pitch Lineup Desk for IdeaCrux // Zindigi Prize at Bahria University (Al-Beruni Auditorium).

Your venture "${startupName}" has been confirmed for the presentation stage:
⏱️ Pitch Slot: ${timingSlot ? timingSlot : 'Pending Lineup (Please report to Auditorium)'}
📍 Venue: Al-Beruni Auditorium, BSEAS H-11 Campus, Islamabad

Please report to the stage entrance waiting area 10 minutes prior to your slot with your presentation clicker ready.

Best regards,
Stage Operations Desk`;

  const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -----------------------------------------------------------------------------
// 5. Initialization & Background Poller
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (checkCoordinatorAuth()) {
    loadCoordinatorData();
    // Poll every 8 seconds for new arrivals and stage updates
    pollTimer = setInterval(loadCoordinatorData, 8000);
  }
});
