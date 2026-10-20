// IDEACRUX & PITCH POINT 2025/2026 Client Controller
// Zindigi Prize On-Campus Round | BSEAS H-11 Campus, Bahria University

document.addEventListener('DOMContentLoaded', () => {
  setupIdeaCruxEventListeners();
  checkUrlParamsForTeamId();
  pollLivePitchStagePublic();
  setInterval(pollLivePitchStagePublic, 8000);
});

function setupIdeaCruxEventListeners() {
  // Members Count Radio Toggle
  const memberCountRadios = document.querySelectorAll('input[name="membersCount"]');
  memberCountRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const member3Section = document.getElementById('member3FieldsSection');
      if (member3Section) {
        member3Section.style.display = e.target.value === '3' ? 'block' : 'none';
      }
    });
  });

  // Real-time Pakistani phone formatting (max 11 digits, starts with 03)
  ['cruxLeaderPhone', 'cruxMember2Phone', 'cruxMember3Phone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        let v = e.target.value.replace(/[^\d+]/g, '');
        if (v.startsWith('+92')) v = '0' + v.slice(3);
        else if (v.startsWith('92') && v.length === 12) v = '0' + v.slice(2);
        else if (v.length === 10 && v.startsWith('3')) v = '0' + v;
        v = v.replace(/\D/g, '').slice(0, 11);
        e.target.value = v;
      });
    }
  });

  // Slip screenshot file upload preview
  const slipInput = document.getElementById('cruxSlipFile');
  if (slipInput) {
    slipInput.addEventListener('change', handleSlipUploadPreview);
  }

  // Registration Form Submission
  const registerForm = document.getElementById('cruxRegisterForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleCruxRegistrationSubmit);
  }

  // Late Payment Submission in Status Modal
  const payForm = document.getElementById('cruxPayForm');
  if (payForm) {
    payForm.addEventListener('submit', handleCruxPaySubmit);
  }
}

// Pakistani Phone Format & Validation Helper (03XXXXXXXXX - 11 digits)
function normalizePakistaniPhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[^\d+]/g, '');
  if (clean.startsWith('+92')) clean = '0' + clean.slice(3);
  else if (clean.startsWith('92') && clean.length === 12) clean = '0' + clean.slice(2);
  else if (clean.length === 10 && clean.startsWith('3')) clean = '0' + clean;
  return clean.replace(/\D/g, '');
}

function isValidPakistaniPhone(phone) {
  const p = normalizePakistaniPhone(phone);
  return /^03[0-9]{9}$/.test(p);
}

// Check URL query parameters for direct team lookup (e.g., ?team_id=CRUX-...)
function checkUrlParamsForTeamId() {
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get('team_id') || urlParams.get('id');
  if (teamId) {
    openCruxStatusModal(teamId);
  }
}

// Modal open/close helpers
window.isRegistrationsStrictlyLocked = false;
window.isGracePeriodActive = false;

window.openCruxRegisterModal = function() {
  if (window.isRegistrationsStrictlyLocked) {
    alert('⚠️ Registrations for PITCH POINT // ZINDIGI PRIZE are officially closed (Closed on 14 October at 11:59 PM PKT).\n\nIf you have already registered, you can check your registration status using the "Check Team Status" button.');
    return;
  }
  const modal = document.getElementById('cruxRegisterModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeCruxRegisterModal = function() {
  const modal = document.getElementById('cruxRegisterModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.openCruxStatusModal = function(presetId) {
  const modal = document.getElementById('cruxStatusModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (presetId) {
      const input = document.getElementById('cruxLookupInput');
      if (input) input.value = presetId;
      lookupCruxTeam(presetId);
    }
  }
};

window.closeCruxStatusModal = function() {
  const modal = document.getElementById('cruxStatusModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

let lastRegisteredTeamId = '';
window.openCruxPendingNoticeModal = function(teamId, startupName, bracket) {
  lastRegisteredTeamId = teamId || '';
  const modal = document.getElementById('cruxPendingNoticeModal');
  const idEl = document.getElementById('pendingModalTeamId');
  const metaEl = document.getElementById('pendingModalTeamMeta');
  if (idEl) idEl.textContent = teamId || 'CRUX-REFERENCE';
  if (metaEl) metaEl.textContent = `${startupName || 'Startup'} • ${bracket || 'Idea Stage'}`;
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeCruxPendingNoticeModal = function() {
  const modal = document.getElementById('cruxPendingNoticeModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.trackFromPendingModal = function() {
  window.closeCruxPendingNoticeModal();
  if (lastRegisteredTeamId) {
    window.openCruxStatusModal(lastRegisteredTeamId);
  } else {
    window.openCruxStatusModal();
  }
};

window.openPosterPreviewModal = function(src, title) {
  const modal = document.getElementById('posterPreviewModal');
  const img = document.getElementById('previewPosterImg');
  const titleEl = document.getElementById('previewPosterTitle');
  if (modal && img) {
    img.src = src;
    if (titleEl) titleEl.textContent = title;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closePosterPreviewModal = function() {
  const modal = document.getElementById('posterPreviewModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.openPublicQrModal = function() {
  const modal = document.getElementById('publicQrModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closePublicQrModal = function() {
  const modal = document.getElementById('publicQrModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.copyCleanLink = function() {
  const cleanUrl = 'https://tinyurl.com/pitchpoint-bu';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cleanUrl).then(() => {
      alert('Official Link Copied: ' + cleanUrl);
    }).catch(() => {
      prompt('Copy this link:', cleanUrl);
    });
  } else {
    prompt('Copy this link:', cleanUrl);
  }
};

// Suspicious / Fake TRX Validator
function isInvalidOrSuspiciousTrx(trx) {
  if (!trx || typeof trx !== 'string') return true;
  const clean = trx.trim().toUpperCase();
  if (clean.length < 6 || clean.length > 40) return true;
  if (/^(.)\1+$/.test(clean)) return true;
  const fakeList = [
    '123456', '654321', '012345', '1234567', '12345678', '123456789',
    'QWERTY', 'ASDFGH', 'ZXCVBN', 'ABCDEF', 'NONE', 'NULL', 'DUMMY',
    'TEST', 'TESTING', 'FAKE', 'PENDING', 'NOTPAID', 'UNPAID', 'NIL',
    'CASH', 'UNKNOWN', 'PAYMENT', 'PROOF', 'SAMPLE', 'NOPE', 'HELLO',
    'ADMIN', 'RECEIPT', 'SCREENSHOT', 'PAIDOK', 'DONE'
  ];
  if (fakeList.includes(clean)) return true;
  if (/^[A-Z]+$/.test(clean)) return true;
  if (!/^[A-Z0-9\-_]+$/.test(clean)) return true;
  return false;
}

// Screenshot Slip upload preview & Base64 encoding
let slipBase64String = '';
function handleSlipUploadPreview(e) {
  const file = e.target.files[0];
  const previewContainer = document.getElementById('cruxSlipPreviewContainer');
  const previewImg = document.getElementById('cruxSlipPreviewImg');
  
  if (!file) {
    slipBase64String = '';
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  // Validate file type
  if (!file.type || !file.type.startsWith('image/')) {
    alert('Invalid file format: Please select a valid image screenshot (PNG, JPG, JPEG, or WebP) of your payment transfer.');
    e.target.value = '';
    slipBase64String = '';
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  // Validate size (max 6MB, min 500 bytes)
  if (file.size > 6 * 1024 * 1024) {
    alert('Image file is too large (maximum 6MB). Please upload a standard mobile screenshot.');
    e.target.value = '';
    slipBase64String = '';
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  if (file.size < 500) {
    alert('The selected file is empty or corrupted. Please upload a clear photo or screenshot.');
    e.target.value = '';
    slipBase64String = '';
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    slipBase64String = evt.target.result;
    if (previewImg && previewContainer) {
      previewImg.src = slipBase64String;
      previewContainer.style.display = 'block';
    }
  };
  reader.onerror = function() {
    alert('Failed to read image file. Please try selecting the screenshot again.');
    slipBase64String = '';
  };
  reader.readAsDataURL(file);
}

// Handle Form Submission
async function handleCruxRegistrationSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btnSubmitCruxRegister');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting Team Application...';

  try {
    const teamName = document.getElementById('cruxTeamName').value.trim();
    const membersCount = document.querySelector('input[name="membersCount"]:checked')?.value || '2';
    const leaderName = document.getElementById('cruxLeaderName').value.trim();
    const leaderEmail = document.getElementById('cruxLeaderEmail').value.trim();
    const leaderPhoneRaw = document.getElementById('cruxLeaderPhone').value.trim();
    const leaderDept = document.getElementById('cruxLeaderDept').value.trim();
    const leaderSemester = document.getElementById('cruxLeaderSemester').value.trim();

    const member2Name = document.getElementById('cruxMember2Name').value.trim();
    const member2PhoneRaw = document.getElementById('cruxMember2Phone').value.trim();
    const member3Name = document.getElementById('cruxMember3Name')?.value.trim() || '';
    const member3PhoneRaw = document.getElementById('cruxMember3Phone')?.value.trim() || '';

    // Validate Mandatory Payment Proof Screenshot
    if (!slipBase64String || slipBase64String.length < 1000) {
      alert('Payment Receipt Screenshot is strictly required! Please attach your payment transfer slip before submitting.');
      const slipInput = document.getElementById('cruxSlipFile');
      if (slipInput) {
        slipInput.focus();
        slipInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        slipInput.style.outline = '2px solid #ef4444';
        setTimeout(() => { slipInput.style.outline = ''; }, 4000);
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }



    // Validate Official Google Gmail Address
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!gmailRegex.test(leaderEmail)) {
      alert('Invalid Email: Only official Google Gmail accounts (@gmail.com) are accepted during registration.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }

    // Validate Pakistani Phone Numbers (03XXXXXXXXX - exactly 11 digits)
    if (!isValidPakistaniPhone(leaderPhoneRaw)) {
      alert('Invalid Team Leader Mobile: Please enter a valid 11-digit Pakistani phone number starting with 03 (e.g. 03292092724 or 03001234567).');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }

    if (!member2Name || member2Name.length < 3) {
      alert('Member 2 Name is required (minimum 3 characters).');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }

    if (!isValidPakistaniPhone(member2PhoneRaw)) {
      alert('Invalid Member 2 Mobile: Please enter a valid 11-digit Pakistani phone number starting with 03 (e.g. 03292092724).');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }

    if (parseInt(membersCount) === 3) {
      if (!member3Name || member3Name.length < 3) {
        alert('Member 3 Name is required for 3-member team (minimum 3 characters).');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Startup Registration Dossier';
        return;
      }
      if (!isValidPakistaniPhone(member3PhoneRaw)) {
        alert('Invalid Member 3 Mobile: Please enter a valid 11-digit Pakistani phone number starting with 03 (e.g. 03292092724).');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Startup Registration Dossier';
        return;
      }
    }

    const leaderPhone = normalizePakistaniPhone(leaderPhoneRaw);
    const member2Phone = normalizePakistaniPhone(member2PhoneRaw);
    const member3Phone = member3PhoneRaw ? normalizePakistaniPhone(member3PhoneRaw) : '';

    const startupName = document.getElementById('cruxStartupName').value.trim();
    const ideaDescription = document.getElementById('cruxIdeaDescription').value.trim();
    const problemStatement = document.getElementById('cruxProblemStatement').value.trim();
    const startupStage = document.getElementById('cruxStartupStage').value;
    const revenueModel = document.getElementById('cruxRevenueModel').value.trim();

    if (startupName.length < 3) {
      alert('Startup / Venture Name must be at least 3 characters.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }

    if (ideaDescription.length < 15) {
      alert('Please provide a brief idea description (at least 15 characters).');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }

    if (problemStatement.length < 15) {
      alert('Please identify the problem statement (at least 15 characters).');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Startup Registration Dossier';
      return;
    }

    const pitchDeckReady = document.querySelector('input[name="pitchDeckReady"]:checked')?.value || 'Yes';

    const payload = {
      is_bu_student: true,
      team_name: teamName,
      members_count: parseInt(membersCount),
      leader_name: leaderName,
      leader_email: leaderEmail,
      leader_phone: leaderPhone,
      leader_dept: leaderDept,
      leader_semester: leaderSemester,
      member_2_name: member2Name,
      member_2_phone: member2Phone,
      member_3_name: member3Name,
      member_3_phone: member3Phone,
      startup_name: startupName,
      idea_description: ideaDescription,
      problem_statement: problemStatement,
      startup_stage: startupStage,
      revenue_model: revenueModel,
      pitch_deck_ready: pitchDeckReady,
      available_on_day: 'Yes',
      pitch_deck_url: '',
      trx_id: (document.getElementById('cruxTrxId')?.value || '').trim().toUpperCase(),
      screenshot_base64: slipBase64String
    };

    const res = await fetch('/api/ideacrux/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      window.closeCruxRegisterModal();
      // Show official Pending Review modal with timing slot and verification details
      window.openCruxPendingNoticeModal(data.team_id, startupName, startupStage);
      // Clean form state
      document.getElementById('cruxRegisterForm')?.reset();
      slipBase64String = '';
      const previewContainer = document.getElementById('cruxSlipPreviewContainer');
      if (previewContainer) previewContainer.style.display = 'none';
    } else {
      alert(data.error || 'Registration failed. Please check form details.');
    }

  } catch (err) {
    alert('Network error while submitting registration: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Startup Registration Dossier';
  }
}

// Lookup Team Status
window.handleCruxLookupSubmit = function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('cruxLookupInput');
  const query = (input ? input.value : '').trim();
  if (!query) {
    alert('Please enter your Team ID (CRUX-...) or Leader Mobile Number');
    return;
  }
  lookupCruxTeam(query);
};

let currentLoadedTeam = null;

async function lookupCruxTeam(query) {
  const resultContainer = document.getElementById('cruxStatusResultContainer');
  if (!resultContainer) return;

  resultContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--accent-cyan);">🔍 Looking up IdeaCrux team details...</div>';

  try {
    const res = await fetch('/api/ideacrux/status/' + encodeURIComponent(query));
    const data = await res.json();

    if (!data.success || !data.team) {
      resultContainer.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 1.5rem; text-align: center;">
          <h4 style="color: #f87171; margin-bottom: 0.5rem;">Team Not Found</h4>
          <p style="color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(data.error || 'No registration found. Please check your Team ID or mobile number.')}</p>
        </div>
      `;
      return;
    }

    currentLoadedTeam = data.team;
    renderCruxStatusCard(data.team, data.payment_instructions);

  } catch (err) {
    resultContainer.innerHTML = `<div style="color: #f87171; text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
  }
}

function renderCruxStatusCard(team, payInfo) {
  const resultContainer = document.getElementById('cruxStatusResultContainer');
  const isVerified = team.status === 'VERIFIED';
  const phoneClean = (team.leader_phone || '').replace(/\D/g, '');
  const waContactUrl = `https://wa.me/923292092724?text=${encodeURIComponent(`Hi Muhammad Huzaifa, regarding IdeaCrux team '${team.team_name}' (${team.id}):`)}`;

  let html = `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-active); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <span style="font-family: var(--font-mono); color: var(--accent-cyan); font-size: 0.82rem; font-weight: 700; letter-spacing: 0.8px;">${team.id}</span>
          <h3 style="font-family: var(--font-display); color: #fff; font-size: 1.35rem; margin-top: 2px;">${escapeHtml(team.team_name)}</h3>
          <div style="color: var(--accent-cyan-dim); font-size: 0.88rem; font-weight: 600;">VENTURE: ${escapeHtml(team.startup_name)}</div>
        </div>
        <div>
          <span class="status-badge ${isVerified ? 'verified' : 'pending'}">
            ${isVerified ? 'VERIFIED & ADMITTED' : 'PENDING ESCROW VERIFICATION'}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; background: var(--bg-abyss); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-hairline);">
        <div>
          <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Team Leader</div>
          <div style="color: #fff; font-weight: 600; font-size: 0.9rem;">${escapeHtml(team.leader_name)}</div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">${escapeHtml(team.leader_phone)}</div>
        </div>
        <div>
          <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Roster Size</div>
          <div style="color: #fff; font-weight: 600; font-size: 0.9rem;">${team.members_count} Members</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">Dept: ${escapeHtml(team.leader_dept || 'BSEAS')}</div>
        </div>
        <div>
          <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Maturity Stage</div>
          <div style="color: var(--accent-cyan); font-weight: 600; font-size: 0.9rem;">${escapeHtml(team.startup_stage || 'Idea Stage')}</div>
        </div>
        <div>
          <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Arena & Date</div>
          <div style="color: #fff; font-weight: 600; font-size: 0.9rem;">Al-Beruni Auditorium</div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan);">15 OCT 2026</div>
        </div>
      </div>
  `;

  if (!isVerified) {
    html += `
      <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-sm); padding: 0.95rem 1.15rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 8px; color: #fbbf24; font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
          <span>⏳</span> STATUS: PENDING VERIFICATION
        </div>
        <div style="color: #cbd5e1; font-size: 0.84rem; line-height: 1.5;">
          We will shortly confirm all details and verify your payment receipt. Once verified by Finance, you will receive an official confirmation email updating you about your <strong>timing slot and presentation schedule for 15 October at Al-Beruni Auditorium</strong>, and your digital Pitch Pass QR will activate below.
        </div>
      </div>
    `;
  } else {
    html += `
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-sm); padding: 0.95rem 1.15rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 8px; color: #34d399; font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
          <span>✓</span> REGISTRATION CONFIRMED & VERIFIED
        </div>
        <div style="color: #cbd5e1; font-size: 0.84rem; line-height: 1.5;">
          Your payment and venture dossier have been verified! We will shortly update you via email about your <strong>timing slot and stage sequence</strong> for 15 October at Al-Beruni Auditorium.
        </div>
      </div>
    `;
  }

  if (isVerified) {
    html += `
      <div class="pitch-pass-container" style="text-align: center; margin: 1.5rem 0;">
        <div style="display: inline-block; background: rgba(0, 240, 212, 0.12); border: 1px solid var(--border-active); padding: 0.3rem 0.85rem; border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--accent-cyan); font-family: var(--font-mono); margin-bottom: 0.75rem; letter-spacing: 0.5px;">
          OFFICIAL PITCH PASS // AL-BERUNI AUDITORIUM
        </div>
        <h4 style="font-family: var(--font-display); color: #fff; font-size: 1.35rem;">${escapeHtml(team.team_name)}</h4>
        <div style="color: var(--text-muted); font-size: 0.85rem;">Startup: ${escapeHtml(team.startup_name)}</div>

        ${team.pitch_pass_qr ? `
          <div class="pass-qr-wrap">
            <img src="${team.pitch_pass_qr}" alt="IdeaCrux Turnstile QR">
          </div>
        ` : ''}

        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-cyan); font-weight: 700; letter-spacing: 1px;">
          PASS ID: ${team.id}
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
          Present this verified digital QR pass at the entrance turnstiles
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.25rem; flex-wrap: wrap;">
          <button class="btn btn-cyan btn-sm" onclick="downloadPitchPassBadge('${team.id}')">
            Download Digital Pitch Pass
          </button>
          <a href="${waContactUrl}" target="_blank" class="btn btn-outline-cyan btn-sm">
            Contact Coordinator
          </a>
        </div>
      </div>
    `;
  } else {
    // Payment Pending Section
    html += `
      <div class="payment-info-box" style="margin-top: 1rem;">
        <div class="payment-info-header">
          <span>Zindigi & Raast Escrow Instructions</span>
          <span style="color: var(--accent-cyan); font-family: var(--font-mono);">Rs. 1,000/-</span>
        </div>
        <div class="payment-row">
          <span class="label">Bank / Service:</span>
          <span class="val">Zindigi (Powered by JS Bank) / Raast</span>
        </div>
        <div class="payment-row">
          <span class="label">Account Number / Raast:</span>
          <span class="val" style="color: var(--accent-cyan); font-size: 1.05rem; font-weight: 700;">0329 2092724</span>
        </div>
        <div class="payment-row">
          <span class="label">Account Title:</span>
          <span class="val">Muhammad Huzaifa</span>
        </div>
        <div class="payment-row">
          <span class="label">IBAN:</span>
          <span class="val" style="font-family: var(--font-mono); font-size: 0.78rem;">PK43JSBL9999903292092724</span>
        </div>
        <div class="payment-row">
          <span class="label">Registration Fee:</span>
          <span class="val">Rs 1000/- per team</span>
        </div>

        <div style="background: rgba(1, 10, 13, 0.9); border: 1px solid var(--border-active); border-radius: 8px; padding: 0.75rem; margin: 0.85rem 0; text-align: center;">
          <div style="font-size: 0.72rem; color: var(--accent-cyan); font-family: var(--font-mono); margin-bottom: 6px;">
            OFFICIAL PAYMENT QR
          </div>
          <img src="/assets/zindigi_payment_qr.jpg" alt="Zindigi QR" style="max-height: 160px; border-radius: 6px; cursor: pointer; border: 1px solid rgba(0, 240, 212, 0.3);" onclick="openPosterPreviewModal('/assets/zindigi_payment_qr.jpg', 'Official Zindigi & Raast QR')">
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Tap QR to enlarge & scan in any banking app</div>
        </div>

        <div style="margin-top: 0.75rem; font-size: 0.78rem; color: var(--text-muted); line-height: 1.45;">
          Send Rs. 1,000 via Zindigi, Raast, EasyPaisa, JazzCash, Nayapay, or any bank app to the account above. Enter your 11-digit TRX ID below, or submit the slip to <a href="${waContactUrl}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline;">0329 2092724</a>.
        </div>
      </div>

      <div style="background: var(--bg-abyss); border: 1px dashed var(--border-active); border-radius: var(--radius-md); padding: 1.25rem; margin-top: 1rem;">
        <h5 style="color: #fff; font-family: var(--font-display); font-size: 0.95rem; margin-bottom: 0.75rem;">Submit Payment Slip / TRX ID</h5>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">Transaction ID (TRX ID) <span class="req">*</span></label>
          <input type="text" id="cruxPayTrxInput" class="form-input" placeholder="e.g. 10293847561" value="${escapeHtml(team.trx_id || '')}">
        </div>

        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">Payment Receipt Screenshot <span class="req">*</span></label>
          <input type="file" id="cruxPaySlipInput" class="form-input" accept="image/*" onchange="handleLateSlipUploadChange(event)">
          <div style="font-size: 0.72rem; color: var(--accent-cyan); margin-top: 3px;">Upload bank transfer receipt screenshot</div>
        </div>

        <div id="cruxPaySlipPreviewWrap" style="display: ${team.screenshot_preview ? 'block' : 'none'}; margin-bottom: 1rem; text-align: center;">
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 4px;">Receipt Screenshot on Record:</div>
          <img id="cruxPaySlipPreviewImg" src="${team.screenshot_preview || ''}" alt="Receipt Preview" style="max-height: 140px; border-radius: 8px; border: 1px solid var(--border-active);">
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn btn-cyan btn-sm" id="btnSubmitLatePayment" onclick="submitCruxPaymentVerification('${team.id}')">
            Submit Payment Slip
          </button>
          <a href="${waContactUrl}" target="_blank" class="btn btn-outline-cyan btn-sm">
            Share on WhatsApp
          </a>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  resultContainer.innerHTML = html;
}

// Global state for late slip upload
let lateSlipBase64String = '';
window.handleLateSlipUploadChange = function(e) {
  const file = e.target.files[0];
  const wrap = document.getElementById('cruxPaySlipPreviewWrap');
  const img = document.getElementById('cruxPaySlipPreviewImg');
  if (!file) return;

  if (!file.type || !file.type.startsWith('image/')) {
    alert('Please select a valid image file (PNG, JPG, or WebP).');
    e.target.value = '';
    return;
  }

  if (file.size > 6 * 1024 * 1024) {
    alert('File is too large (maximum 6MB). Please upload a standard mobile screenshot.');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    lateSlipBase64String = evt.target.result;
    if (img && wrap) {
      img.src = lateSlipBase64String;
      wrap.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

// Submit payment verification
window.submitCruxPaymentVerification = async function(teamId) {
  const trxInput = document.getElementById('cruxPayTrxInput');
  const trx = (trxInput ? trxInput.value : '').trim().toUpperCase();
  if (!trx || trx.length < 6 || isInvalidOrSuspiciousTrx(trx)) {
    alert('Valid Transaction ID (TRX ID, min 6 characters) is strictly required.');
    return;
  }

  const activeSlip = lateSlipBase64String || (currentLoadedTeam && currentLoadedTeam.screenshot_preview ? currentLoadedTeam.screenshot_preview : '');
  if (!activeSlip || activeSlip.length < 1000) {
    alert('Payment receipt screenshot is strictly required! Please select your payment transfer slip image.');
    const slipIn = document.getElementById('cruxPaySlipInput');
    if (slipIn) slipIn.focus();
    return;
  }

  const submitBtn = document.getElementById('btnSubmitLatePayment');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Slip...';
  }

  try {
    const res = await fetch('/api/ideacrux/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_id: teamId,
        trx_id: trx,
        screenshot_base64: activeSlip
      })
    });
    const data = await res.json();

    if (data.success) {
      alert(data.message || 'Payment submitted successfully!');
      lateSlipBase64String = '';
      lookupCruxTeam(teamId);
    } else {
      alert(data.error || 'Failed to submit payment verification.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Payment Slip';
    }
  }
};

// Download Pitch Pass Badge
window.downloadPitchPassBadge = function(teamId) {
  if (!currentLoadedTeam || !currentLoadedTeam.pitch_pass_qr) {
    alert('Pitch pass QR not available yet');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 750;
  canvas.height = 10000;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const team = currentLoadedTeam;

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
  function drawReticle(cx, cy) {
    ctx.strokeStyle = '#00f0d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();
  }
  drawReticle(35, 35);
  drawReticle(w - 35, 35);
  drawReticle(35, h - 35);
  drawReticle(w - 35, h - 35);

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
  };
  qrImg.src = team.pitch_pass_qr;
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

// Zindigi Theme Manager (Light / Dark Mode inspired by zindigi.pk)
let currentHeroPosterType = 'dark';

window.toggleCruxTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  if (next === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    switchHeroPoster('portal', false);
  } else {
    document.documentElement.removeAttribute('data-theme');
    switchHeroPoster('dark', false);
  }
  localStorage.setItem('crux_theme', next);
  updateThemeButtonUI(next);
};

function updateThemeButtonUI(theme) {
  const btn = document.getElementById('cruxThemeToggleBtn');
  if (btn) {
    const icon = btn.querySelector('.theme-icon');
    const text = btn.querySelector('.theme-text');
    if (theme === 'light') {
      if (icon) icon.textContent = '🌙';
      if (text) text.textContent = 'Dark Mode';
    } else {
      if (icon) icon.textContent = '☀️';
      if (text) text.textContent = 'Light Mode';
    }
  }
}

// Hero Dual Poster Controller
const posterConfigs = {
  dark: {
    src: '/assets/pitch_point_poster_dark.jpg',
    title: 'Where Bold Ideas Break Through',
    meta: 'PITCH POINT 2026 • Crystalline Monolith Edition',
    modalTitle: 'PITCH POINT — Poster 1 (Breakthrough Core)',
    downloadName: 'Pitch_Point_Poster_Breakthrough_Core.jpg'
  },
  portal: {
    src: '/assets/pitch_point_poster_portal.jpg',
    title: 'One Idea. One Moment.',
    meta: 'Al-Beruni Auditorium • BSEAS H-11 Campus • 15 October',
    modalTitle: 'PITCH POINT — Poster 2 (Arena Portal)',
    downloadName: 'Pitch_Point_Poster_Arena_Portal.jpg'
  }
};

window.switchHeroPoster = function(type, userClicked = true) {
  if (!posterConfigs[type]) return;
  currentHeroPosterType = type;

  const tabDark = document.getElementById('posterTabDark');
  const tabPortal = document.getElementById('posterTabPortal');
  if (tabDark && tabPortal) {
    if (type === 'dark') {
      tabDark.classList.add('active');
      tabPortal.classList.remove('active');
    } else {
      tabPortal.classList.add('active');
      tabDark.classList.remove('active');
    }
  }

  const imgEl = document.getElementById('heroPosterImg');
  const titleEl = document.getElementById('hudPosterTitle');
  const metaEl = document.getElementById('hudPosterMeta');

  if (imgEl) {
    imgEl.style.opacity = '0.3';
    setTimeout(() => {
      imgEl.src = posterConfigs[type].src;
      imgEl.style.opacity = '1';
    }, 150);
  }
  if (titleEl) titleEl.textContent = posterConfigs[type].title;
  if (metaEl) metaEl.textContent = posterConfigs[type].meta;
};

window.openActiveHeroPosterModal = function() {
  const cfg = posterConfigs[currentHeroPosterType] || posterConfigs.dark;
  openPosterPreviewModal(cfg.src, cfg.modalTitle, cfg.downloadName);
};

window.openPosterPreviewModal = function(src, title, downloadName) {
  const modal = document.getElementById('posterPreviewModal');
  const modalImg = document.getElementById('posterModalImg');
  const modalTitle = document.getElementById('posterModalTitle');
  const downloadBtn = document.getElementById('posterDownloadBtn');

  if (modalImg) modalImg.src = src;
  if (modalTitle) modalTitle.textContent = title || 'PITCH POINT Official Poster';
  if (downloadBtn) {
    downloadBtn.href = src;
    downloadBtn.download = downloadName || 'Pitch_Point_Zindigi_Prize_Poster.jpg';
  }
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closePosterPreviewModal = function() {
  const modal = document.getElementById('posterPreviewModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Initialize theme state and hero poster on load
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('crux_theme') || 'dark';
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    switchHeroPoster('portal', false);
  } else {
    switchHeroPoster('dark', false);
  }
  updateThemeButtonUI(saved);
});

// Portal QR Code Modal Handlers
window.openPortalQrModal = function() {
  const m = document.getElementById('portalQrModal');
  if (m) m.classList.add('active');
};
window.closePortalQrModal = function() {
  const m = document.getElementById('portalQrModal');
  if (m) m.classList.remove('active');
};
window.openPaymentQrZoomModal = function() {
  const m = document.getElementById('paymentQrZoomModal');
  if (m) m.classList.add('active');
};
window.closePaymentQrZoomModal = function() {
  const m = document.getElementById('paymentQrZoomModal');
  if (m) m.classList.remove('active');
};

// ==========================================
// Live Pitch Stage & Registration Deadline Poller
// ==========================================
window.pollLivePitchStagePublic = async function() {
  try {
    const res = await fetch('/api/public/pitch-stage');
    const data = await res.json();
    if (!data.success) return;

    window.isRegistrationsStrictlyLocked = !!data.registration?.is_strictly_locked;
    window.isGracePeriodActive = !!data.registration?.is_grace;

    // 1. Top Sticker Banner (Registration Deadline)
    const banner = document.getElementById('regClosedBanner');
    const graceNotice = document.getElementById('gracePeriodNotice');
    if (banner) {
      if (data.registration?.is_closed) {
        banner.style.display = 'block';
        if (graceNotice) {
          graceNotice.style.display = data.registration.is_grace ? 'inline-block' : 'none';
        }
      } else {
        banner.style.display = 'none';
      }
    }

    // 2. Live Pitch Stage Broadcast Tracker (No Scores Exposed)
    const curTeam = document.getElementById('pubStageCurrentTeam');
    const curStage = document.getElementById('pubStageCurrentStage');
    const nextTeam = document.getElementById('pubStageNextTeam');
    const nextStage = document.getElementById('pubStageNextStage');
    const statusText = document.getElementById('pubStageStatusText');

    if (data.stage?.current) {
      if (curTeam) curTeam.textContent = data.stage.current.startup_name || data.stage.current.team_name;
      if (curStage) curStage.textContent = `Team: ${data.stage.current.team_name} • ${data.stage.current.startup_stage || 'Idea Stage'}`;
    } else {
      if (curTeam) curTeam.textContent = 'Awaiting Next Pitch...';
      if (curStage) curStage.textContent = 'Al-Beruni Stage Grid';
    }

    if (data.stage?.next) {
      if (nextTeam) nextTeam.textContent = data.stage.next.startup_name || data.stage.next.team_name;
      if (nextStage) nextStage.textContent = `Team: ${data.stage.next.team_name} • ${data.stage.next.startup_stage || 'Idea Stage'}`;
    } else {
      if (nextTeam) nextTeam.textContent = 'Standing By...';
      if (nextStage) nextStage.textContent = 'Next on Deck';
    }

    if (statusText && data.stage?.status) {
      const map = {
        'PITCH_IN_PROGRESS': '🎤 Pitch In Progress',
        'JUDGE_QA': '⚖️ Q&A With Judges',
        'NEXT_TEAM_READY': '⏭️ Next Team Take Position',
        'STAGE_BREAK': '☕ Stage Short Break / Deliberation',
        'STAGE_READY': '🟢 Stage Ready'
      };
      statusText.textContent = map[data.stage.status] || data.stage.status;
    }
  } catch (err) {
    // Ignore transient network errors on polling
  }
};

