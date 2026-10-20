/**
 * ZINDIGI PRIZE CAMPUS ROUNDS 2026-2027
 * OFFICIAL JUDGE SCOREBOARD & PRIVATE LEADERBOARD CLIENT
 * 
 * Powered by Cloudflare D1 & Worker Backend
 */

// Global State
let currentJudge = null;
let cachedTeams = [];
let cachedLeaderboard = [];
let currentFilterStage = 'ALL';
let selectedTeamId = '';
const currentScores = {
  idea: 0,
  solution: 0,
  business: 0,
  impact: 0,
  startup: 0,
  judges: 0
};

// -----------------------------------------------------------------------------
// 1. Authentication & Session Validation
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
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

function checkJudgeAuth() {
  const token = getAuthToken();
  const user = getStoredUser();

  if (!token || !user) {
    window.location.href = '/login.html?redirect=crux-judge.html';
    return false;
  }

  // Allow both JUDGE and ADMIN roles to access judge portal
  if (user.role !== 'JUDGE' && user.role !== 'ADMIN') {
    alert('Access Denied: This portal requires verified Judge or Venture Admin credentials.');
    window.location.href = '/login.html';
    return false;
  }

  currentJudge = user;

  // Update UI Elements with Judge info
  const judgeBadge = document.getElementById('judgeProfileBadge');
  if (judgeBadge) {
    if (user.title) {
      judgeBadge.textContent = `${user.full_name || user.username} • ${user.title}`;
    } else {
      judgeBadge.textContent = `${user.full_name || user.username} (${user.role})`;
    }
  }

  const judgeNameInput = document.getElementById('judgeNameInput');
  if (judgeNameInput) {
    judgeNameInput.value = user.full_name || user.username;
  }

  return true;
}

function logoutJudge() {
  if (confirm('Are you sure you want to sign out of the Judge Portal?')) {
    localStorage.removeItem('bahria_auth_token');
    localStorage.removeItem('bahria_auth_user');
    localStorage.removeItem('bahria_staff_user');
    sessionStorage.removeItem('bahria_auth_token');
    sessionStorage.removeItem('bahria_auth_user');
    sessionStorage.removeItem('bahria_staff_user');
    window.location.href = '/login.html';
  }
}

// -----------------------------------------------------------------------------
// 2. Tab Navigation
// -----------------------------------------------------------------------------
function switchJudgeTab(tabId) {
  const views = {
    'scorecard': document.getElementById('viewScorecard'),
    'my-evals': document.getElementById('viewMyEvals'),
    'leaderboard': document.getElementById('viewLeaderboard'),
    'feedback': document.getElementById('viewFeedback')
  };

  const btns = {
    'scorecard': document.getElementById('tabBtnScorecard'),
    'my-evals': document.getElementById('tabBtnMyEvals'),
    'leaderboard': document.getElementById('tabBtnLeaderboard'),
    'feedback': document.getElementById('tabBtnFeedback')
  };

  // Toggle View Display
  Object.keys(views).forEach(key => {
    if (views[key]) {
      views[key].style.display = key === tabId ? 'block' : 'none';
    }
  });

  // Toggle Button Active State
  Object.keys(btns).forEach(key => {
    if (btns[key]) {
      if (key === tabId) {
        btns[key].classList.add('active');
      } else {
        btns[key].classList.remove('active');
      }
    }
  });

  // Lazy-load data when switching
  if (tabId === 'my-evals') {
    loadMyEvaluations();
  } else if (tabId === 'leaderboard') {
    loadLeaderboard();
  } else if (tabId === 'feedback') {
    loadJudgeFeedback();
  }
}

// -----------------------------------------------------------------------------
// 3. Startup List & Filtering
// -----------------------------------------------------------------------------
async function loadJudgeStartupList() {
  const select = document.getElementById('startupSelect');
  if (!select) return;

  try {
    const res = await fetchWithAuth('/api/judge/teams');
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch confirmed startups');
    }

    cachedTeams = data.teams || [];
    renderStartupSelectOptions(cachedTeams);

    // If a team was previously selected, restore it
    if (selectedTeamId && cachedTeams.some(t => t.id === selectedTeamId)) {
      select.value = selectedTeamId;
      onStartupSelected(selectedTeamId);
    }
  } catch (err) {
    console.error('Error loading startups:', err);
    select.innerHTML = `<option value="">⚠️ Error loading startups: ${err.message}</option>`;
  }
}

function renderStartupSelectOptions(teams, filterQuery = '') {
  const select = document.getElementById('startupSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose Startup to Evaluate --</option>';

  const query = filterQuery.toLowerCase().trim();

  teams.forEach(t => {
    const match = !query || 
      t.startup_name.toLowerCase().includes(query) ||
      t.team_name.toLowerCase().includes(query) ||
      t.leader_name.toLowerCase().includes(query) ||
      t.id.toLowerCase().includes(query);

    if (match) {
      const opt = document.createElement('option');
      opt.value = t.id;
      const statusIcon = t.has_evaluated ? `[✓ SCORED: ${t.my_total_score}/60]` : '[PENDING]';
      opt.textContent = `${statusIcon} ${t.startup_name} — Team ${t.team_name} (${t.startup_stage || 'Idea Stage'})`;
      select.appendChild(opt);
    }
  });

  if (currentVal && teams.some(t => t.id === currentVal)) {
    select.value = currentVal;
  }
}

function filterStartupDropdown(query) {
  renderStartupSelectOptions(cachedTeams, query);
}

async function onStartupSelected(teamId) {
  selectedTeamId = teamId;
  const dossierCard = document.getElementById('startupDossierCard');

  if (!teamId) {
    if (dossierCard) dossierCard.style.display = 'none';
    resetScorecardForm();
    return;
  }

  const team = cachedTeams.find(t => t.id === teamId);
  if (!team) return;

  // 1. Populate Dossier Card
  if (dossierCard) {
    dossierCard.style.display = 'grid';
    document.getElementById('dossierTeamId').textContent = team.id;
    document.getElementById('dossierStartupName').textContent = team.startup_name;
    document.getElementById('dossierTeamName').textContent = `Team: ${team.team_name}`;
    document.getElementById('dossierConcept').textContent = team.idea_description || 'No description provided';
    document.getElementById('dossierProblem').textContent = team.problem_statement || 'No problem statement specified';
    document.getElementById('dossierLeader').textContent = team.leader_name;
    document.getElementById('dossierDept').textContent = `${team.leader_dept || 'BSEAS'} ${team.leader_semester ? `• Semester ${team.leader_semester}` : ''}`;
    document.getElementById('dossierStage').textContent = team.startup_stage || 'Idea Stage';

    const deckContainer = document.getElementById('dossierDeckContainer');
    const deckBtn = document.getElementById('dossierDeckBtn');
    if (team.pitch_deck_url) {
      deckContainer.style.display = 'block';
      deckBtn.href = team.pitch_deck_url;
      deckBtn.textContent = '📂 [OPEN PITCH DECK ↗]';
    } else {
      deckContainer.style.display = 'none';
    }
  }

  // 2. Fetch existing score if any
  try {
    const res = await fetchWithAuth(`/api/judge/score/${teamId}`);
    const data = await res.json();

    if (data.success && data.score) {
      // Pre-fill existing evaluation
      const s = data.score;
      setScore('idea', s.score_idea, false);
      setScore('solution', s.score_solution, false);
      setScore('business', s.score_business, false);
      setScore('impact', s.score_impact, false);
      setScore('startup', s.score_startup, false);
      setScore('judges', s.score_judges, false);

      const notesField = document.getElementById('notesInput');
      if (notesField) notesField.value = s.notes || '';

      updateLiveTotal();

      const btnSubmit = document.getElementById('btnSubmitScore');
      if (btnSubmit) {
        btnSubmit.textContent = '💾 UPDATE SCORECARD & RECORD EVALUATION';
      }
    } else {
      // Brand new evaluation
      resetScoresOnly();
      const btnSubmit = document.getElementById('btnSubmitScore');
      if (btnSubmit) {
        btnSubmit.textContent = '💾 SUBMIT SCORECARD & RECORD EVALUATION';
      }
    }
  } catch (err) {
    console.error('Error fetching existing score:', err);
  }
}

// -----------------------------------------------------------------------------
// 4. Interactive Rubric Pills & Total Calculation
// -----------------------------------------------------------------------------
function setScore(criteria, value, recalculate = true) {
  currentScores[criteria] = parseInt(value, 10);

  // Update UI Pills in the corresponding row
  const row = document.querySelector(`.pills-row[data-criteria="${criteria}"]`);
  if (row) {
    const btns = row.querySelectorAll('.score-pill-btn');
    btns.forEach(btn => {
      if (parseInt(btn.textContent.trim(), 10) === currentScores[criteria]) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  if (recalculate) {
    updateLiveTotal();
  }
}

function updateLiveTotal() {
  const total = Object.values(currentScores).reduce((acc, val) => acc + (val || 0), 0);
  const totalDisplay = document.getElementById('liveTotalDisplay');
  if (totalDisplay) {
    totalDisplay.textContent = total;
    // Highlight effect based on score
    if (total >= 48) {
      totalDisplay.style.color = '#38f9d7';
    } else if (total >= 30) {
      totalDisplay.style.color = '#fbbf24';
    } else {
      totalDisplay.style.color = '#f87171';
    }
  }
}

function resetScoresOnly() {
  Object.keys(currentScores).forEach(key => currentScores[key] = 0);
  document.querySelectorAll('.score-pill-btn').forEach(btn => btn.classList.remove('active'));
  const notesField = document.getElementById('notesInput');
  if (notesField) notesField.value = '';
  updateLiveTotal();
}

function resetScorecardForm() {
  resetScoresOnly();
  selectedTeamId = '';
  const select = document.getElementById('startupSelect');
  if (select) select.value = '';
  const dossierCard = document.getElementById('startupDossierCard');
  if (dossierCard) dossierCard.style.display = 'none';
  const btnSubmit = document.getElementById('btnSubmitScore');
  if (btnSubmit) {
    btnSubmit.textContent = '💾 SUBMIT SCORECARD & RECORD EVALUATION';
  }
}

// -----------------------------------------------------------------------------
// 5. Scorecard Submission
// -----------------------------------------------------------------------------
async function handleScoreSubmit(event) {
  event.preventDefault();

  if (!selectedTeamId) {
    alert('Please select a Startup from the dropdown before submitting.');
    const select = document.getElementById('startupSelect');
    if (select) select.focus();
    return;
  }

  // Validate all 6 dimensions
  const missingCriteria = [];
  const criteriaLabels = {
    idea: '💡 IDEA',
    solution: '⚙️ SOLUTION',
    business: '💼 BUSINESS',
    impact: '🌍 IMPACT',
    startup: '👥 STARTUP',
    judges: '⚖️ JUDGES'
  };

  Object.entries(currentScores).forEach(([key, val]) => {
    if (!val || val < 1 || val > 10) {
      missingCriteria.push(criteriaLabels[key]);
    }
  });

  if (missingCriteria.length > 0) {
    alert(`Please provide a rating (1-10) for all 6 dimensions.\n\nMissing ratings for:\n• ${missingCriteria.join('\n• ')}`);
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitScore');
  const originalText = btnSubmit ? btnSubmit.textContent : '';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = '⏳ RECORDING EVALUATION IN D1 DATABASE...';
  }

  const notes = document.getElementById('notesInput')?.value || '';

  try {
    const payload = {
      team_id: selectedTeamId,
      score_idea: currentScores.idea,
      score_solution: currentScores.solution,
      score_business: currentScores.business,
      score_impact: currentScores.impact,
      score_startup: currentScores.startup,
      score_judges: currentScores.judges,
      notes: notes.trim()
    };

    const res = await fetchWithAuth('/api/judge/submit-score', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to submit score');
    }

    alert(`✅ Scorecard Recorded Successfully!\n\nStartup: ${data.startup_name}\nTotal Score: ${data.total_score} / 60 points\n\nYour evaluation has been saved to the Consensus Database.`);

    // Refresh startup list so dropdown indicator updates to [✓ SCORED: XX/60]
    await loadJudgeStartupList();

    // Switch to My Evaluations view so judge can review their entries
    switchJudgeTab('my-evals');

  } catch (err) {
    alert(`❌ Error submitting evaluation: ${err.message}`);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalText;
    }
  }
}

// -----------------------------------------------------------------------------
// 6. My Evaluations Tab
// -----------------------------------------------------------------------------
async function loadMyEvaluations() {
  const tbody = document.getElementById('myEvalsTbody');
  const badge = document.getElementById('myEvalsCountBadge');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading your evaluations...</td></tr>';

  try {
    const res = await fetchWithAuth('/api/judge/my-evaluations');
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch evaluations');
    }

    const evals = data.evaluations || [];
    if (badge) {
      badge.textContent = `${evals.length} Startups Evaluated`;
    }

    if (evals.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            You have not submitted any evaluations yet.<br>
            <button type="button" class="btn-hud" style="margin-top: 1rem;" onclick="switchJudgeTab('scorecard')">
              📋 Go to Scorecard
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    evals.forEach(ev => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(ev.startup_name)}</div>
          <div style="font-size: 0.76rem; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(ev.team_name)} [${escapeHtml(ev.team_id)}]</div>
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 0.76rem; color: #34d399; background: rgba(52, 211, 153, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.3);">
            ${escapeHtml(ev.startup_stage || 'Idea Stage')}
          </span>
        </td>
        <td>
          <div style="color: #fff; font-size: 0.85rem;">${escapeHtml(ev.leader_name)}</div>
          <div style="font-size: 0.74rem; color: var(--text-dim);">${escapeHtml(ev.leader_dept || 'BSEAS')}</div>
        </td>
        <td>
          <div style="font-family: var(--font-mono); font-size: 0.74rem; display: flex; gap: 4px; flex-wrap: wrap;">
            <span title="Idea" style="background: rgba(0, 240, 212, 0.1); border: 1px solid var(--border-hairline); padding: 2px 5px; border-radius: 4px;">💡${ev.score_idea}</span>
            <span title="Solution" style="background: rgba(0, 240, 212, 0.1); border: 1px solid var(--border-hairline); padding: 2px 5px; border-radius: 4px;">⚙️${ev.score_solution}</span>
            <span title="Business" style="background: rgba(0, 240, 212, 0.1); border: 1px solid var(--border-hairline); padding: 2px 5px; border-radius: 4px;">💼${ev.score_business}</span>
            <span title="Impact" style="background: rgba(0, 240, 212, 0.1); border: 1px solid var(--border-hairline); padding: 2px 5px; border-radius: 4px;">🌍${ev.score_impact}</span>
            <span title="Startup" style="background: rgba(0, 240, 212, 0.1); border: 1px solid var(--border-hairline); padding: 2px 5px; border-radius: 4px;">👥${ev.score_startup}</span>
            <span title="Judges" style="background: rgba(0, 240, 212, 0.1); border: 1px solid var(--border-hairline); padding: 2px 5px; border-radius: 4px;">⚖️${ev.score_judges}</span>
          </div>
        </td>
        <td>
          <div style="font-family: var(--font-mono); font-size: 1.05rem; font-weight: 800; color: var(--accent-cyan);">
            ${ev.total_score} <span style="font-size: 0.75rem; color: var(--text-dim);">/ 60</span>
          </div>
        </td>
        <td style="max-width: 220px; font-size: 0.8rem; color: #cbd5e1;">
          ${ev.notes ? escapeHtml(ev.notes.slice(0, 80)) + (ev.notes.length > 80 ? '...' : '') : '<span style="color: var(--text-dim);">-</span>'}
        </td>
        <td>
          <button type="button" class="btn-hud" style="padding: 4px 10px; font-size: 0.75rem;" onclick="editEvaluation('${ev.team_id}')">
            ✏️ Edit
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Error loading evaluations:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171; padding: 2rem;">Error: ${err.message}</td></tr>`;
  }
}

function editEvaluation(teamId) {
  switchJudgeTab('scorecard');
  const select = document.getElementById('startupSelect');
  if (select) {
    select.value = teamId;
    onStartupSelected(teamId);
  }
}

// -----------------------------------------------------------------------------
// 7. Consensus Private Leaderboard
// -----------------------------------------------------------------------------
async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboardTbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading consensus leaderboard...</td></tr>';

  try {
    const res = await fetchWithAuth('/api/judge/leaderboard');
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch leaderboard');
    }

    cachedLeaderboard = data.leaderboard || [];
    renderLeaderboard();

  } catch (err) {
    console.error('Error loading leaderboard:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171; padding: 2rem;">Error: ${err.message}</td></tr>`;
  }
}

function filterLeaderboardByStage(stage, btn) {
  currentFilterStage = stage;

  // Toggle active button style
  const buttons = btn?.parentElement?.querySelectorAll('button');
  if (buttons) {
    buttons.forEach(b => {
      b.style.background = 'rgba(0, 240, 212, 0.12)';
      b.style.color = 'var(--accent-cyan)';
    });
    if (btn) {
      btn.style.background = 'var(--accent-cyan)';
      btn.style.color = '#020b0e';
    }
  }

  renderLeaderboard();
}

function renderLeaderboard() {
  const tbody = document.getElementById('leaderboardTbody');
  if (!tbody) return;

  let filtered = cachedLeaderboard;

  if (currentFilterStage !== 'ALL') {
    filtered = cachedLeaderboard.filter(item => {
      const stage = (item.startup_stage || '').toUpperCase();
      if (currentFilterStage === 'IDEA') return stage.includes('IDEA');
      if (currentFilterStage === 'PROTO') return stage.includes('PROTO');
      if (currentFilterStage === 'MVP') return stage.includes('MVP');
      if (currentFilterStage === 'LAUNCH') return stage.includes('LAUNCH') || stage.includes('MARKET');
      return true;
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          No evaluated startups found for this classification filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach((item, index) => {
    const rank = index + 1;
    let rankBadge = '';
    if (rank === 1) rankBadge = '<span style="font-size: 1.1rem; color: #fbbf24; font-weight: 800;">🥇 1ST</span>';
    else if (rank === 2) rankBadge = '<span style="font-size: 1.05rem; color: #cbd5e1; font-weight: 800;">🥈 2ND</span>';
    else if (rank === 3) rankBadge = '<span style="font-size: 1rem; color: #f97316; font-weight: 800;">🥉 3RD</span>';
    else rankBadge = `<span style="font-family: var(--font-mono); color: var(--text-dim); font-weight: 700;">#${rank}</span>`;

    const scorePercent = Math.min(100, Math.round((item.avg_total_score / 60) * 100));

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">${rankBadge}</td>
      <td>
        <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">${escapeHtml(item.startup_name)}</div>
        <div style="font-size: 0.74rem; color: var(--accent-cyan); font-family: var(--font-mono);">Team: ${escapeHtml(item.team_name)} [${escapeHtml(item.team_id)}]</div>
      </td>
      <td>
        <span style="font-family: var(--font-mono); font-size: 0.74rem; color: #34d399; background: rgba(52, 211, 153, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.3);">
          ${escapeHtml(item.startup_stage || 'Idea Stage')}
        </span>
      </td>
      <td>
        <div style="color: #fff; font-size: 0.85rem;">${escapeHtml(item.leader_name)}</div>
        <div style="font-size: 0.74rem; color: var(--text-dim);">${escapeHtml(item.leader_dept || 'BSEAS')}</div>
      </td>
      <td>
        <div style="font-family: var(--font-mono); font-size: 0.8rem; color: #fbbf24; font-weight: 700;">
          👥 ${item.judge_count} Judge${item.judge_count === 1 ? '' : 's'}
        </div>
      </td>
      <td>
        <div style="display: flex; align-items: baseline; gap: 4px;">
          <span style="font-family: var(--font-mono); font-size: 1.15rem; font-weight: 800; color: #38f9d7;">
            ${item.avg_total_score}
          </span>
          <span style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-dim);">/ 60</span>
        </div>
        <div style="width: 100%; height: 4px; background: rgba(255, 255, 255, 0.08); border-radius: 2px; margin-top: 4px; overflow: hidden;">
          <div style="width: ${scorePercent}%; height: 100%; background: linear-gradient(90deg, #00f0d4, #38f9d7); border-radius: 2px;"></div>
        </div>
      </td>
      <td>
        <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px;">
          <span>💡 Idea: <b style="color: #fff;">${item.avg_idea}</b> • ⚙️ Sol: <b style="color: #fff;">${item.avg_solution}</b></span>
          <span>💼 Biz: <b style="color: #fff;">${item.avg_business}</b> • 🌍 Imp: <b style="color: #fff;">${item.avg_impact}</b></span>
          <span>👥 Start: <b style="color: #fff;">${item.avg_startup}</b> • ⚖️ Jdg: <b style="color: #fff;">${item.avg_judges}</b></span>
        </div>
      </td>
      <td>
        <button type="button" class="btn-hud" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openScorecardDetailModal('${item.team_id}')">
          📊 Inspect Judges
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -----------------------------------------------------------------------------
// 8. Individual Judge Assessments Modal
// -----------------------------------------------------------------------------
function openScorecardDetailModal(teamId) {
  const modal = document.getElementById('scorecardDetailModal');
  const container = document.getElementById('modalScorecardsContainer');
  if (!modal || !container) return;

  const item = cachedLeaderboard.find(t => t.team_id === teamId);
  if (!item) return;

  document.getElementById('modalStartupTitle').textContent = item.startup_name;
  document.getElementById('modalTeamSub').textContent = `Team: ${item.team_name} • ${item.startup_stage || 'Idea Stage'} • Avg: ${item.avg_total_score}/60 (${item.judge_count} Judges)`;

  container.innerHTML = '';

  const scorecards = item.scorecards || [];
  if (scorecards.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem; text-align: center;">No individual scorecards found.</div>';
  } else {
    scorecards.forEach(sc => {
      const card = document.createElement('div');
      card.style.background = 'rgba(2, 11, 14, 0.8)';
      card.style.border = '1px solid var(--border-hairline)';
      card.style.borderRadius = '8px';
      card.style.padding = '1rem';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">⚖️ Judge: ${escapeHtml(sc.judge_name)}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">${sc.updated_at ? new Date(sc.updated_at).toLocaleString() : ''}</div>
          </div>
          <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 800; color: var(--accent-cyan);">
            ${sc.total_score} <span style="font-size: 0.74rem; color: var(--text-dim);">/ 60</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; font-family: var(--font-mono); font-size: 0.72rem; text-align: center; margin-bottom: 8px;">
          <div style="background: rgba(0, 240, 212, 0.08); padding: 4px; border-radius: 4px;">
            <div style="color: var(--text-dim);">IDEA</div>
            <div style="font-weight: 700; color: #fff;">${sc.score_idea}</div>
          </div>
          <div style="background: rgba(0, 240, 212, 0.08); padding: 4px; border-radius: 4px;">
            <div style="color: var(--text-dim);">SOL</div>
            <div style="font-weight: 700; color: #fff;">${sc.score_solution}</div>
          </div>
          <div style="background: rgba(0, 240, 212, 0.08); padding: 4px; border-radius: 4px;">
            <div style="color: var(--text-dim);">BIZ</div>
            <div style="font-weight: 700; color: #fff;">${sc.score_business}</div>
          </div>
          <div style="background: rgba(0, 240, 212, 0.08); padding: 4px; border-radius: 4px;">
            <div style="color: var(--text-dim);">IMP</div>
            <div style="font-weight: 700; color: #fff;">${sc.score_impact}</div>
          </div>
          <div style="background: rgba(0, 240, 212, 0.08); padding: 4px; border-radius: 4px;">
            <div style="color: var(--text-dim);">START</div>
            <div style="font-weight: 700; color: #fff;">${sc.score_startup}</div>
          </div>
          <div style="background: rgba(0, 240, 212, 0.08); padding: 4px; border-radius: 4px;">
            <div style="color: var(--text-dim);">JDG</div>
            <div style="font-weight: 700; color: #fff;">${sc.score_judges}</div>
          </div>
        </div>

        ${sc.notes ? `
          <div style="font-size: 0.82rem; color: #cbd5e1; background: rgba(0, 0, 0, 0.3); border-left: 2px solid var(--accent-cyan); padding: 6px 10px; border-radius: 0 4px 4px 0; margin-top: 6px;">
            <strong style="color: var(--accent-cyan); font-size: 0.74rem;">Judge Notes:</strong> ${escapeHtml(sc.notes)}
          </div>
        ` : ''}
      `;
      container.appendChild(card);
    });
  }

  modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('scorecardDetailModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// -----------------------------------------------------------------------------
// 9. Utility Functions
// -----------------------------------------------------------------------------
function refreshJudgeData() {
  loadJudgeStartupList();
  const activeTab = document.querySelector('.nav-tab-btn.active')?.id;
  if (activeTab === 'tabBtnMyEvals') {
    loadMyEvaluations();
  } else if (activeTab === 'tabBtnLeaderboard') {
    loadLeaderboard();
  } else if (activeTab === 'tabBtnFeedback') {
    loadJudgeFeedback();
  }
}

// -----------------------------------------------------------------------------
// 9b. Judge Event Feedback Functions
// -----------------------------------------------------------------------------
function setFeedbackRating(dim, val) {
  val = parseInt(val);
  const inputMap = {
    'overall': 'fbRatingOverall',
    'org': 'fbRatingOrg',
    'pitch': 'fbRatingPitch',
    'venue': 'fbRatingVenue'
  };
  const groupMap = {
    'overall': 'groupOverallRating',
    'org': 'groupOrgRating',
    'pitch': 'groupPitchRating',
    'venue': 'groupVenueRating'
  };

  const inputId = inputMap[dim];
  const groupId = groupMap[dim];
  if (!inputId || !groupId) return;

  const input = document.getElementById(inputId);
  if (input) input.value = val;

  const container = document.getElementById(groupId);
  if (container) {
    const btns = container.querySelectorAll('button');
    btns.forEach((btn, idx) => {
      if (idx + 1 === val) {
        btn.style.background = 'var(--accent-cyan)';
        btn.style.color = '#020b0e';
        btn.style.borderColor = 'var(--accent-cyan)';
        btn.style.fontWeight = '800';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-main)';
        btn.style.borderColor = 'var(--border-hairline)';
        btn.style.fontWeight = '600';
      }
    });
  }
}

async function loadJudgeFeedback() {
  try {
    const res = await fetchWithAuth('/api/judge/feedback');
    const data = await res.json();
    if (!data.success) return;

    if (data.feedback) {
      const fb = data.feedback;
      setFeedbackRating('overall', fb.overall_rating || 5);
      setFeedbackRating('org', fb.organization_rating || 5);
      setFeedbackRating('pitch', fb.pitch_quality_rating || 5);
      setFeedbackRating('venue', fb.venue_rating || 5);

      if (document.getElementById('fbHighlights')) document.getElementById('fbHighlights').value = fb.best_highlights || '';
      if (document.getElementById('fbImprovements')) document.getElementById('fbImprovements').value = fb.areas_of_improvement || '';
      if (document.getElementById('fbComments')) document.getElementById('fbComments').value = fb.general_comments || '';

      const badge = document.getElementById('feedbackSavedBadge');
      if (badge) badge.style.display = 'inline-block';

      const status = document.getElementById('feedbackStatusText');
      if (status && fb.updated_at) {
        status.textContent = `✓ Feedback recorded on ${new Date(fb.updated_at).toLocaleString()}. You can update your submission anytime.`;
        status.style.color = '#34d399';
      }
    } else {
      setFeedbackRating('overall', 5);
      setFeedbackRating('org', 5);
      setFeedbackRating('pitch', 5);
      setFeedbackRating('venue', 5);
    }
  } catch (err) {
    console.error('Failed to load judge feedback:', err);
  }
}

async function submitJudgeFeedback() {
  const status = document.getElementById('feedbackStatusText');
  const badge = document.getElementById('feedbackSavedBadge');

  const payload = {
    overall_rating: parseInt(document.getElementById('fbRatingOverall')?.value || 5),
    organization_rating: parseInt(document.getElementById('fbRatingOrg')?.value || 5),
    pitch_quality_rating: parseInt(document.getElementById('fbRatingPitch')?.value || 5),
    venue_rating: parseInt(document.getElementById('fbRatingVenue')?.value || 5),
    best_highlights: document.getElementById('fbHighlights')?.value.trim() || '',
    areas_of_improvement: document.getElementById('fbImprovements')?.value.trim() || '',
    general_comments: document.getElementById('fbComments')?.value.trim() || ''
  };

  if (status) {
    status.textContent = '⏳ Saving your feedback to secure registry...';
    status.style.color = 'var(--accent-cyan)';
  }

  try {
    const res = await fetchWithAuth('/api/judge/feedback', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save feedback');
    }

    if (badge) badge.style.display = 'inline-block';
    if (status) {
      status.textContent = `✓ Feedback successfully saved at ${new Date().toLocaleTimeString()}! Thank you for your leadership and insights.`;
      status.style.color = '#34d399';
    }
    alert('Thank you! Your event evaluation and feedback has been securely recorded.');
  } catch (err) {
    console.error('Submit feedback error:', err);
    if (status) {
      status.textContent = `❌ Error saving feedback: ${err.message}`;
      status.style.color = '#f87171';
    }
    alert(`Could not save feedback: ${err.message}`);
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

// Close modal on Escape or background click
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

document.addEventListener('click', (e) => {
  const modal = document.getElementById('scorecardDetailModal');
  if (modal && e.target === modal) {
    closeModal();
  }
});

// -----------------------------------------------------------------------------
// 10. Initialization
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (checkJudgeAuth()) {
    loadJudgeStartupList();
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = (urlParams.get('tab') || hash).toLowerCase();
    if (tabParam === 'feedback' || tabParam === 'event-feedback') {
      switchJudgeTab('feedback');
    } else if (tabParam === 'leaderboard') {
      switchJudgeTab('leaderboard');
    } else if (tabParam === 'my-evals') {
      switchJudgeTab('my-evals');
    }
  }
});
