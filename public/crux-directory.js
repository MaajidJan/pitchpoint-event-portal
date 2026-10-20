/**
 * VIEW-ONLY PRESENTER DIRECTORY JAVASCRIPT CONTROLLER
 * IdeaCrux // Zindigi Prize at Bahria University
 */

let allTeams = [];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

function checkAuth() {
  const token = getAuthToken();
  const user = getStoredUser();

  if (!token || !user) {
    window.location.href = '/login.html?redirect=crux-directory.html';
    return false;
  }

  // Allowed: VIEW_ONLY, STAGE_COORDINATOR, ADMIN
  if (user.role !== 'VIEW_ONLY' && user.role !== 'STAGE_COORDINATOR' && user.role !== 'ADMIN') {
    alert('Access Denied: View-Only or Staff access required.');
    window.location.href = '/login.html';
    return false;
  }

  const badge = document.getElementById('viewerBadge');
  if (badge) {
    const roleTxt = user.role === 'VIEW_ONLY' ? 'Viewer' : (user.role === 'STAGE_COORDINATOR' ? 'Coordinator' : 'Admin');
    badge.innerHTML = `<span>👤 ${escapeHtml(user.full_name || user.username)} (${roleTxt})</span>`;
  }

  return true;
}

window.logoutViewer = function() {
  if (confirm('Sign out of the Presenter Directory?')) {
    localStorage.removeItem('bahria_auth_token');
    localStorage.removeItem('bahria_auth_user');
    localStorage.removeItem('bahria_staff_user');
    sessionStorage.removeItem('bahria_auth_token');
    sessionStorage.removeItem('bahria_auth_user');
    sessionStorage.removeItem('bahria_staff_user');
    window.location.href = '/login.html';
  }
};

window.loadDirectoryData = async function() {
  const token = getAuthToken();
  if (!token) return;

  const tbody = document.getElementById('directoryTableBody');
  if (tbody && allTeams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">Loading verified teams directory...</td></tr>';
  }

  try {
    const res = await fetch('/api/viewer/teams', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (!data.success) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #f87171; padding: 2.5rem;">Failed to load directory: ${escapeHtml(data.error || 'Server error')}</td></tr>`;
      }
      return;
    }

    allTeams = data.teams || [];

    // Compute metrics
    const total = allTeams.length;
    const slotted = allTeams.filter(t => !!(t.timing_slot && t.timing_slot.trim())).length;
    const arrived = allTeams.filter(t => !!t.checked_in_at).length;

    const elTotal = document.getElementById('metricTotal');
    const elSlotted = document.getElementById('metricSlotted');
    const elArrived = document.getElementById('metricArrived');

    if (elTotal) elTotal.textContent = total;
    if (elSlotted) elSlotted.textContent = slotted;
    if (elArrived) elArrived.textContent = arrived;

    renderTable();

  } catch (err) {
    console.error('Error fetching directory teams:', err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #f87171; padding: 2.5rem;">Network error connecting to directory server.</td></tr>';
    }
  }
};

window.renderTable = function() {
  const tbody = document.getElementById('directoryTableBody');
  if (!tbody) return;

  const q = (document.getElementById('viewerSearch')?.value || '').toLowerCase().trim();
  const filter = document.getElementById('viewerFilter')?.value || 'ALL';

  let list = allTeams.filter(t => {
    if (filter === 'SLOTTED' && !(t.timing_slot && t.timing_slot.trim())) return false;
    if (filter === 'UNSLOTTED' && !!(t.timing_slot && t.timing_slot.trim())) return false;
    if (filter === 'ARRIVED' && !t.checked_in_at) return false;

    if (q) {
      const title = (t.startup_name || '').toLowerCase();
      const team = (t.team_name || '').toLowerCase();
      const leader = (t.leader_name || '').toLowerCase();
      const phone = (t.leader_phone || '');
      const dept = (t.leader_dept || '').toLowerCase();
      const slot = (t.timing_slot || '').toLowerCase();
      return title.includes(q) || team.includes(q) || leader.includes(q) || phone.includes(q) || dept.includes(q) || slot.includes(q);
    }
    return true;
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          No matching presenters found for this filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((t, idx) => {
    const rawPhone = (t.leader_phone || '').replace(/[^0-9]/g, '');
    let waPhone = rawPhone;
    if (waPhone.startsWith('03')) waPhone = '92' + waPhone.substring(1);
    else if (!waPhone.startsWith('92') && waPhone.length === 10) waPhone = '92' + waPhone;

    const startupTitle = t.startup_name || t.team_name || 'Venture';
    const leaderName = t.leader_name || 'Team Leader';
    const deptTxt = [t.leader_dept, t.leader_semester ? `Sem ${t.leader_semester}` : ''].filter(Boolean).join(' • ') || '-';
    
    // WhatsApp direct message text
    const msg = encodeURIComponent(`Assalam-o-Alaikum ${leaderName},\n\nThis is the team coordination desk for IdeaCrux // Zindigi Prize at Bahria University regarding your project "${startupTitle}".\n\nYour assigned presentation slot: ${t.timing_slot || 'Pending announcement'}.\nPlease confirm your availability.`);
    const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${msg}` : '#';

    const slotBadge = t.timing_slot && t.timing_slot.trim()
      ? `<span class="slot-badge">${escapeHtml(t.timing_slot)}</span>`
      : `<span class="slot-badge slot-badge-empty">Slot Pending</span>`;

    const arrivalBadge = t.checked_in_at
      ? `<span class="status-badge status-arrived">🟢 Arrived</span>`
      : `<span class="status-badge status-pending">⏳ Pending</span>`;

    return `
      <tr>
        <td>
          <div class="project-title">${escapeHtml(startupTitle)}</div>
          <div class="team-sub">Team: ${escapeHtml(t.team_name || '-')}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #fff;">${escapeHtml(leaderName)}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span style="font-family: var(--font-mono); font-size: 0.8rem; color: #e2e8f0;">${escapeHtml(t.leader_phone || '-')}</span>
            ${waPhone ? `
              <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="hud-btn hud-btn-wa" style="padding: 2px 7px; font-size: 0.72rem; text-decoration: none;">
                💬 WhatsApp
              </a>
            ` : ''}
          </div>
        </td>
        <td>
          <span style="color: #cbd5e1; font-size: 0.8rem;">${escapeHtml(deptTxt)}</span>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
            ${slotBadge}
            ${arrivalBadge}
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

document.addEventListener('DOMContentLoaded', () => {
  if (checkAuth()) {
    loadDirectoryData();
    // Auto-refresh directory every 30 seconds
    setInterval(loadDirectoryData, 30000);
  }
});
