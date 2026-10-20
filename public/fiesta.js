// Bahria Event Portal - Client Controller

let eventFee = 1.0;
let uploadedImageBase64 = '';
let currentPollingInterval = null;
let currentTicket = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setupUploadDropzone();
  setupLookupModal();
  setupTicketActions();
  setupStallPortal();
  loadConfig();

  const submitBtn = document.getElementById('submitRegisterBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleRegistration);
  }
});

// Fetch configuration from API
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data) {
      eventFee = parseFloat(data.ticket_price || data.test_fee_pkr || 1.0);

      const displayTitle = document.getElementById('displayAccountTitle');
      const displayNum = document.getElementById('displayAccountNumber');

      if (Array.isArray(data.receiving_accounts) && data.receiving_accounts.length > 0) {
        const activeAccs = data.receiving_accounts.filter(a => a.is_active !== false);
        if (activeAccs.length > 0) {
          const primaryAcc = activeAccs.find(a => a.is_primary) || activeAccs[0];
          if (displayTitle) displayTitle.textContent = primaryAcc.title;
          if (displayNum) displayNum.textContent = primaryAcc.number;
          renderPublicAccountsList(activeAccs);
        }
      } else {
        if (displayTitle) displayTitle.textContent = data.account_title || 'MAJID ULLAH JAN';
        if (displayNum) displayNum.textContent = data.account_number || '03175230209';
      }

      const displayAmount = document.getElementById('displayAmountDue');
      if (displayAmount) displayAmount.textContent = `Rs. ${eventFee.toFixed(2)}`;

      const displayPrice = document.getElementById('displayTicketPrice');
      if (displayPrice) displayPrice.textContent = `Rs. ${eventFee.toFixed(0)}`;

      const ticketTitle = document.getElementById('ticketCardTitle');
      if (ticketTitle) ticketTitle.textContent = `${data.event_name || 'Bahria Fiesta 2026'} Official Entry Pass`;

      if (data.support_whatsapp) {
        const supportBtn = document.getElementById('eventSupportFloatBtn');
        if (supportBtn) {
          supportBtn.href = `https://wa.me/${data.support_whatsapp}?text=${encodeURIComponent('Hi Bahria Event Support, I need help with my registration')}`;
        }
      }
    }
  } catch (err) {
    console.warn('Config fetch error:', err);
  }
}

function renderPublicAccountsList(accounts) {
  const container = document.getElementById('paymentAccountsListContainer');
  if (!container) return;

  if (!accounts || accounts.length <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div style="margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid rgba(255,255,255,0.08);">
      <div style="font-size: 0.8rem; color: #a5b4fc; margin-bottom: 0.5rem; font-weight: 700; display: flex; align-items: center; gap: 4px;">
        <span>🔄</span> Alternate Verified Accounts (If primary limit is reached):
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.4rem;">
        ${accounts.slice(1).map(acc => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.82rem;">
            <div>
              <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; font-size: 0.7rem; padding: 2px 6px; margin-right: 4px;">${acc.bank || 'Account'}</span>
              <strong style="font-family: monospace; color: #fff;">${acc.number}</strong>
              <span style="color: var(--text-muted); font-size: 0.75rem;">(${acc.title})</span>
            </div>
            <button type="button" class="copy-btn" onclick="copyText('${acc.number}', this)">Copy</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 1. Clipboard Copy Helper
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.background = '#10b981';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
      btn.style.color = '';
    }, 1500);
  });
}

// 2. File Upload & Drag-and-Drop
function setupUploadDropzone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('receiptFileInput');
  const previewCard = document.getElementById('previewCard');
  const previewImage = document.getElementById('previewImage');
  const previewFileName = document.getElementById('previewFileName');
  const previewFileSize = document.getElementById('previewFileSize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const ocrStatusBadge = document.getElementById('ocrStatusBadge');

  if (!dropZone || !fileInput) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files && dt.files[0]) {
      handleFile(dt.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.value = '';
    uploadedImageBase64 = '';
    previewCard.style.display = 'none';
    dropZone.style.display = 'block';
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }

    previewFileName.textContent = file.name;
    previewFileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImageBase64 = e.target.result;
      previewImage.src = uploadedImageBase64;
      dropZone.style.display = 'none';
      previewCard.style.display = 'flex';

      // Background client-side OCR
      if (typeof Tesseract !== 'undefined') {
        ocrStatusBadge.textContent = 'Scanning for TRX ID...';
        Tesseract.recognize(uploadedImageBase64, 'eng')
          .then(({ data: { text } }) => {
            const extracted = parseReceiptTextLocally(text);
            if (extracted.trx_id) {
              ocrStatusBadge.textContent = `✓ TRX: ${extracted.trx_id}`;
              const manualInput = document.getElementById('manualTrx');
              if (manualInput && !manualInput.value) {
                manualInput.value = extracted.trx_id;
              }
            } else {
              ocrStatusBadge.textContent = 'Image attached (Ready to submit)';
            }
          })
          .catch(() => {
            ocrStatusBadge.textContent = 'Attached (Ready to submit)';
          });
      }
    };
    reader.readAsDataURL(file);
  }
}

let selectedPaymentMethod = 'EASYPAISA';

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.pm-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-method') === method);
  });

  const guideBox = document.getElementById('paymentGuideBox');
  const boxTitle = document.getElementById('pmBoxTitle');
  const uploadTitle = document.getElementById('uploadZoneTitle');

  if (method === 'EASYPAISA') {
    if (boxTitle) boxTitle.innerHTML = '<span>📱</span> Official Easypaisa Account';
    if (guideBox) guideBox.innerHTML = '💡 <strong>Easypaisa to Easypaisa:</strong> Open Easypaisa app &rarr; Send Money &rarr; Easypaisa &rarr; Enter <strong>03175230209</strong> &rarr; Confirm receiver <strong>MAJID ULLAH JAN</strong>.';
    if (uploadTitle) uploadTitle.textContent = 'Attach Easypaisa Receipt Screenshot';
  } else if (method === 'JAZZCASH') {
    if (boxTitle) boxTitle.innerHTML = '<span>🔴</span> JazzCash Transfer via Raast / Bank';
    if (guideBox) guideBox.innerHTML = '💡 <strong>JazzCash to Easypaisa:</strong> Open JazzCash &rarr; Money Transfer &rarr; Bank Transfer / Raast &rarr; Select <strong>"Easypaisa / Telenor Bank"</strong> &rarr; Enter <strong>03175230209</strong> &rarr; Confirm <strong>MAJID ULLAH JAN</strong>.';
    if (uploadTitle) uploadTitle.textContent = 'Attach JazzCash Receipt Screenshot';
  } else if (method === 'NAYAPAY') {
    if (boxTitle) boxTitle.innerHTML = '<span>🟣</span> NayaPay / SadaPay Transfer via Raast';
    if (guideBox) guideBox.innerHTML = '💡 <strong>NayaPay / SadaPay:</strong> Open app &rarr; Send Money &rarr; Raast / Bank &rarr; Select <strong>"Telenor Microfinance Bank / Easypaisa"</strong> &rarr; Enter <strong>03175230209</strong> &rarr; Confirm <strong>MAJID ULLAH JAN</strong>.';
    if (uploadTitle) uploadTitle.textContent = 'Attach NayaPay / SadaPay Receipt Screenshot';
  } else if (method === 'BANK') {
    if (boxTitle) boxTitle.innerHTML = '<span>🏦</span> Bank Transfer (Raast / IBFT)';
    if (guideBox) guideBox.innerHTML = '💡 <strong>Any Bank App (HBL, Meezan, etc.):</strong> Open Banking App &rarr; Send Money / Raast &rarr; Select <strong>"Telenor Microfinance Bank / Easypaisa"</strong> &rarr; Enter Account / Raast No <strong>03175230209</strong> &rarr; Confirm <strong>MAJID ULLAH JAN</strong>.';
    if (uploadTitle) uploadTitle.textContent = 'Attach Bank / Raast Slip Screenshot';
  }
}
window.selectPaymentMethod = selectPaymentMethod;

// Local OCR regex parser
function parseReceiptTextLocally(raw) {
  let trx_id = '';
  let amount = 0;

  const trxMatches = [
    /(?:Transaction\s*ID|TRX\s*ID|TID|Txn\s*ID|ID\s*#|Ref\s*#|Ref|Reference|STAN)[:\s#]*([A-Za-z0-9]{8,24})/i,
    /(?:with\s+ID|ID\s+is)[:\s#]*([0-9]{8,18})/i,
    /\b([1-9][0-9]{9,12})\b/
  ];
  for (const p of trxMatches) {
    const m = raw.match(p);
    if (m && m[1] && !m[1].startsWith('03')) {
      trx_id = m[1].trim().toUpperCase();
      break;
    }
  }

  const amtMatch = raw.match(/(?:Rs\.?|PKR)\s*([\d,]+(?:\.\d+)?)/i) ||
                   raw.match(/Total\s+Amount[\s\S]*?(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d+)?)/i) ||
                   raw.match(/Amount[\s:]*(?:Rs\.?|PKR)?\s*([\d,]+(?:\.\d+)?)/i);
  if (amtMatch && amtMatch[1]) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  return { trx_id, amount, raw_text: raw };
}

// 3. Form Submission Handler
async function handleRegistration() {
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const rollNo = document.getElementById('rollNo').value.trim();
  const department = document.getElementById('department').value.trim() || 'General Admission';
  const manualTrx = document.getElementById('manualTrx').value.trim();

  if (!fullName || !email || !phone || !rollNo) {
    alert('Please fill in all required fields (Name, Email, WhatsApp Phone, and Roll Number).');
    return;
  }

  if (!uploadedImageBase64 && !manualTrx) {
    alert('Please attach your payment receipt screenshot OR enter the Transaction ID (TRX ID).');
    return;
  }

  const submitBtn = document.getElementById('submitRegisterBtn');
  const stepper = document.getElementById('verificationStepper');
  const ticketCard = document.getElementById('ticketCard');
  const pendingCard = document.getElementById('pendingNoticeCard');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying Registration...';
  stepper.style.display = 'block';
  ticketCard.style.display = 'none';
  pendingCard.style.display = 'none';

  setStep(1, 'active');

  try {
    // Step 1 & 2: Local OCR extraction if screenshot provided
    let ocrData = null;
    if (uploadedImageBase64 && typeof Tesseract !== 'undefined') {
      try {
        const { data: { text } } = await Tesseract.recognize(uploadedImageBase64, 'eng');
        ocrData = parseReceiptTextLocally(text);
      } catch (e) {
        console.warn('OCR error:', e);
      }
    }

    setStep(1, 'completed');
    setStep(2, 'active');
    await waitMs(400);

    setStep(2, 'completed');
    setStep(3, 'active');

    // Submit to Cloudflare Worker
    const payload = {
      full_name: fullName,
      email,
      phone,
      roll_no: rollNo,
      department,
      ticket_type: 'OFFICIAL_ENTRY_PASS',
      expected_amount: eventFee,
      payment_method: selectedPaymentMethod,
      screenshot_base64: uploadedImageBase64 || null,
      manual_trx_id: manualTrx || (ocrData ? ocrData.trx_id : null),
      ocr_data: ocrData
    };

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setStep(3, 'failed');
      alert(`Registration Error: ${data.error || 'Verification failed'}`);
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Submit Registration & Generate Pass';
      return;
    }

    setStep(3, 'completed');
    setStep(4, 'active');
    await waitMs(300);
    setStep(4, 'completed');

    stepper.style.display = 'none';
    submitBtn.textContent = 'Registration Recorded';

    if (data.status === 'VERIFIED') {
      displayVerifiedTicket({
        id: data.registration_id,
        full_name: fullName,
        roll_no: rollNo,
        department,
        phone,
        trx_id: data.trx_id || manualTrx,
        ticket_qr: data.ticket_qr,
        expected_amount: eventFee
      });
    } else {
      // Pending state: start polling
      pendingCard.style.display = 'flex';
      startStatusPolling(data.registration_id, {
        id: data.registration_id,
        full_name: fullName,
        roll_no: rollNo,
        department,
        phone,
        trx_id: data.trx_id || manualTrx,
        expected_amount: eventFee
      });
    }

  } catch (err) {
    console.error('Registration exception:', err);
    alert('Network error communicating with server. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Submit Registration & Generate Pass';
    stepper.style.display = 'none';
  }
}

// 4. Render Verified Ticket UI
function displayVerifiedTicket(ticket) {
  currentTicket = ticket;
  const ticketCard = document.getElementById('ticketCard');
  const pendingCard = document.getElementById('pendingNoticeCard');

  if (pendingCard) pendingCard.style.display = 'none';
  if (!ticketCard) return;

  document.getElementById('ticketAttendee').textContent = ticket.full_name || 'Attendee';
  document.getElementById('ticketRoll').textContent = ticket.roll_no || '-';
  document.getElementById('ticketDept').textContent = ticket.department || 'General Admission';
  document.getElementById('ticketTrx').textContent = ticket.trx_id || 'VERIFIED';
  document.getElementById('ticketRef').textContent = ticket.id || '-';

  if (ticket.ticket_qr) {
    document.getElementById('ticketQrImage').src = ticket.ticket_qr;
  }

  ticketCard.style.display = 'block';
  ticketCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Auto-trigger luxury HD pass PNG download
  setTimeout(() => {
    generateAndDownloadTicketPng(true);
  }, 600);
}

// 5. Polling for Pending Registrations (Offline Sync Handler)
function startStatusPolling(registrationId, fallbackData) {
  if (currentPollingInterval) {
    clearInterval(currentPollingInterval);
  }

  let attempts = 0;
  const maxAttempts = 45; // Poll for 3 minutes (45 * 4s)

  currentPollingInterval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/api/status/${registrationId}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.success && data.status === 'VERIFIED') {
        clearInterval(currentPollingInterval);
        currentPollingInterval = null;

        const reg = data.registration || fallbackData;
        displayVerifiedTicket({
          id: reg.id || registrationId,
          full_name: reg.full_name || fallbackData.full_name,
          roll_no: reg.roll_no || fallbackData.roll_no,
          department: reg.department || fallbackData.department,
          phone: reg.phone || fallbackData.phone,
          trx_id: reg.trx_id || fallbackData.trx_id,
          ticket_qr: reg.ticket_qr,
          expected_amount: reg.expected_amount || eventFee
        });
      }
    } catch (e) {
      console.warn('Status poll error:', e);
    }

    if (attempts >= maxAttempts) {
      clearInterval(currentPollingInterval);
      currentPollingInterval = null;
    }
  }, 4000);
}

// 6. Real HTML5 Canvas High-Res PNG Ticket Downloader
function setupTicketActions() {
  const btnDownload = document.getElementById('btnDownloadTicketPng');
  const btnPrint = document.getElementById('btnPrintTicket');
  const btnShareWa = document.getElementById('btnShareWhatsApp');

  if (btnDownload) {
    btnDownload.addEventListener('click', () => generateAndDownloadTicketPng(false));
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnShareWa) {
    btnShareWa.addEventListener('click', shareTicketViaWhatsApp);
  }
}

async function shareTicketViaWhatsApp() {
  if (!currentTicket) {
    alert('No active ticket to share.');
    return;
  }
  const text = 
    `🎟️ *Bahria Fiesta & TechFest 2026 Official Entry Pass*\n\n` +
    `👤 *Attendee:* ${currentTicket.full_name}\n` +
    `🎓 *Roll Number:* ${currentTicket.roll_no}\n` +
    `🏛️ *Department:* ${currentTicket.department || 'General'}\n` +
    `💳 *TRX ID:* ${currentTicket.trx_id || 'CONFIRMED'}\n` +
    `🆔 *Pass ID:* ${currentTicket.id || '-'}\n\n` +
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
      // User cancelled
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

async function generateAndDownloadTicketPng(isAuto = false) {
  if (!currentTicket) {
    alert('No active ticket to download.');
    return;
  }

  const canvas = document.getElementById('ticketCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#070a13');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Outer border
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Accent corner badges
  ctx.fillStyle = '#10b981';
  ctx.fillRect(10, 10, 8, 80);
  ctx.fillRect(10, 10, 80, 8);

  // Header banner
  ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
  ctx.fillRect(20, 20, w - 40, 75);

  // Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BAHRIA FIESTA & TECHFEST 2026', 45, 62);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('OFFICIAL DIGITAL ENTRY PASS • ISLAMABAD CAMPUS', 45, 83);

  // Left Details Column
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ATTENDEE NAME', 45, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(currentTicket.full_name || 'Attendee', 45, 170);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BAHRIA ROLL NUMBER', 45, 215);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(currentTicket.roll_no || '-', 45, 245);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('DEPARTMENT / PROGRAM', 45, 290);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(currentTicket.department || 'General Admission', 45, 315);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('VERIFIED TRX ID', 45, 360);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(currentTicket.trx_id || 'CONFIRMED', 45, 385);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px monospace';
  ctx.fillText(`Pass ID: ${currentTicket.id || '-'}  •  Venue: BUIC Main Campus`, 45, 435);
  ctx.fillText(`Event Dates: October 15-17, 2026  •  Admit One Person Only`, 45, 455);

  // Divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(560, 110);
  ctx.lineTo(560, 480);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw QR Code onto Canvas
  const qrImg = document.getElementById('ticketQrImage');
  if (qrImg && qrImg.src) {
    const qrImageObj = new Image();
    qrImageObj.crossOrigin = 'anonymous';
    qrImageObj.onload = () => {
      // White container box for QR
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
    qrImageObj.src = qrImg.src;
  } else {
    triggerDownload();
  }

  function triggerDownload() {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (currentTicket.full_name || 'Attendee').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeRoll = (currentTicket.roll_no || 'Pass').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Bahria_Fiesta_Pass_${safeName}_${safeRoll}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}

// 7. Find My Pass Lookup Modal (Protected against Pass Theft)
function setupLookupModal() {
  const modal = document.getElementById('lookupModal');
  const btnOpen = document.getElementById('btnOpenLookup');
  const btnHeroOpen = document.getElementById('btnHeroLookup');
  const btnClose = document.getElementById('btnCloseLookup');
  const btnDoLookup = document.getElementById('btnDoLookup');
  const rollInput = document.getElementById('lookupRollInput');
  const phoneInput = document.getElementById('lookupPhoneInput');
  const ticketIdInput = document.getElementById('lookupTicketIdInput');
  const resultContainer = document.getElementById('lookupResultContainer');

  function openModal() {
    modal.classList.add('open');
    if (rollInput) rollInput.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    resultContainer.innerHTML = '';
  }

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (btnHeroOpen) btnHeroOpen.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (btnDoLookup) {
    btnDoLookup.addEventListener('click', async () => {
      const roll = rollInput ? rollInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const ticketId = ticketIdInput ? ticketIdInput.value.trim() : '';

      let lookupUrl = '';
      if (ticketId) {
        lookupUrl = `/api/ticket/lookup?ticket_id=${encodeURIComponent(ticketId)}`;
      } else if (roll && phone) {
        lookupUrl = `/api/ticket/lookup?roll_no=${encodeURIComponent(roll)}&phone=${encodeURIComponent(phone)}`;
      } else {
        resultContainer.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 0.85rem; color: #fca5a5; font-size: 0.85rem; line-height: 1.4;">
            🔒 <strong>Pass Theft Protection:</strong><br>
            Please provide both your <strong>Bahria Roll Number</strong> and <strong>Registered Phone Number</strong>, or enter your confidential <strong>Ticket ID</strong>.
          </div>
        `;
        return;
      }

      btnDoLookup.disabled = true;
      btnDoLookup.textContent = 'Verifying Registry...';
      resultContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Authenticating ownership & retrieving official pass...</div>';

      try {
        const res = await fetch(lookupUrl);
        const data = await res.json();
        btnDoLookup.disabled = false;
        btnDoLookup.textContent = '🔒 Verify & Retrieve My Pass';

        if (!res.ok || !data.success || !data.registration) {
          resultContainer.innerHTML = `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 1rem; color: #fca5a5; font-size: 0.85rem;">${data.error || 'No matching registration found.'}</div>`;
          return;
        }

        const reg = data.registration;
        if (reg.status === 'VERIFIED') {
          resultContainer.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 1.25rem;">
              <div style="color: #34d399; font-weight: 700; font-size: 0.95rem;">✓ Verified Pass Found</div>
              <div style="color: #fff; font-size: 1.1rem; font-weight: 700; margin-top: 4px;">${reg.full_name}</div>
              <div style="color: #94a3b8; font-size: 0.85rem;">Roll: <strong style="color: #fff;">${reg.roll_no}</strong> • Dept: ${reg.department}</div>
              <div style="color: #94a3b8; font-size: 0.85rem;">TRX: <strong style="color: #34d399;">${reg.trx_id || 'VERIFIED'}</strong></div>
              <button class="btn btn-emerald btn-sm" id="btnOpenFoundTicket" style="margin-top: 10px; width: 100%;">
                🎟️ View & Download My Pass
              </button>
            </div>
          `;
          document.getElementById('btnOpenFoundTicket').addEventListener('click', () => {
            closeModal();
            displayVerifiedTicket(reg);
          });
        } else {
          resultContainer.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 1rem; color: #fde68a; font-size: 0.85rem;">
              <strong>Registration Found:</strong> ${reg.full_name} (${reg.roll_no})<br>
              Status: <strong>${reg.status}</strong> (${reg.verification_notes || 'Awaiting bank confirmation'})
            </div>
          `;
        }
      } catch (err) {
        btnDoLookup.disabled = false;
        btnDoLookup.textContent = '🔒 Verify & Retrieve My Pass';
        resultContainer.innerHTML = '<div style="color: #ef4444; font-size: 0.85rem;">Error searching registry.</div>';
      }
    });
  }
}

// Helpers
function setStep(stepNum, status) {
  const step = document.getElementById(`step${stepNum}`);
  if (!step) return;

  step.classList.remove('active', 'completed', 'failed');
  step.classList.add(status);

  const icon = document.getElementById(`step${stepNum}Icon`);
  if (!icon) return;

  icon.classList.remove('step-spinner');
  if (status === 'completed') {
    icon.textContent = '✓';
  } else if (status === 'failed') {
    icon.textContent = '✕';
  } else if (status === 'active') {
    icon.classList.add('step-spinner');
    icon.textContent = '';
  }
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/* ==========================================================================
   PUBLIC EVENT STALLS & VENDORS CONTROLLER
   ========================================================================== */

let stallSlipBase64 = '';
let stallPollingInterval = null;

function setupStallPortal() {
  const applyModal = document.getElementById('stallApplyModal');
  const statusModal = document.getElementById('stallStatusModal');

  // Trigger buttons to open Apply Modal
  ['btnNavStall', 'btnHeroStall', 'btnBannerApplyStall'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openStallApplyModal();
      });
    }
  });

  // Trigger button to open Status Modal
  const btnCheck = document.getElementById('btnBannerCheckStall');
  if (btnCheck) {
    btnCheck.addEventListener('click', (e) => {
      e.preventDefault();
      openStallStatusModal();
    });
  }

  // Close modals
  const btnCloseApply = document.getElementById('btnCloseStallApply');
  if (btnCloseApply && applyModal) {
    btnCloseApply.addEventListener('click', closeStallApplyModal);
    applyModal.addEventListener('click', (e) => {
      if (e.target === applyModal) closeStallApplyModal();
    });
  }

  const btnCloseStatus = document.getElementById('btnCloseStallStatus');
  if (btnCloseStatus && statusModal) {
    btnCloseStatus.addEventListener('click', closeStallStatusModal);
    statusModal.addEventListener('click', (e) => {
      if (e.target === statusModal) closeStallStatusModal();
    });
  }

  // Lookup Button & Enter key
  const btnLookup = document.getElementById('btnDoStallLookup');
  const lookupInput = document.getElementById('stallLookupQuery');

  if (btnLookup) {
    btnLookup.addEventListener('click', () => handleStallLookup());
  }
  if (lookupInput) {
    lookupInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleStallLookup();
    });
  }
}

window.openStallApplyModal = function() {
  const modal = document.getElementById('stallApplyModal');
  if (modal) modal.style.display = 'flex';
};

window.closeStallApplyModal = function() {
  const modal = document.getElementById('stallApplyModal');
  if (modal) modal.style.display = 'none';
};

window.openStallStatusModal = function(presetQuery = '') {
  const modal = document.getElementById('stallStatusModal');
  if (modal) modal.style.display = 'flex';

  if (presetQuery) {
    const input = document.getElementById('stallLookupQuery');
    if (input) input.value = presetQuery;
    handleStallLookup(presetQuery);
  }
};

window.closeStallStatusModal = function() {
  const modal = document.getElementById('stallStatusModal');
  if (modal) modal.style.display = 'none';
  if (stallPollingInterval) {
    clearInterval(stallPollingInterval);
    stallPollingInterval = null;
  }
};

window.submitStallApplication = async function(e) {
  e.preventDefault();

  const stallName = document.getElementById('applyStallName').value.trim();
  const category = document.getElementById('applyStallCategory').value;
  const brand = document.getElementById('applyBrand').value.trim();
  const applicantName = document.getElementById('applyApplicantName').value.trim();
  const phone = document.getElementById('applyPhone').value.trim();
  const email = document.getElementById('applyEmail').value.trim();
  const rollNo = document.getElementById('applyRollNo').value.trim();
  const description = document.getElementById('applyDescription').value.trim();

  // Collect checked requirements
  const reqs = [];
  if (document.getElementById('reqPower')?.checked) reqs.push('Power Socket (220V)');
  if (document.getElementById('reqTables')?.checked) reqs.push('Extra Tables/Chairs');
  if (document.getElementById('reqBanner')?.checked) reqs.push('Banner / Standee Space');
  if (document.getElementById('reqFoodPrep')?.checked) reqs.push('Food Prep / Cooking Area');

  const btn = document.getElementById('btnSubmitStallApply');
  btn.disabled = true;
  btn.textContent = 'Submitting Proposal...';

  try {
    const res = await fetch('/api/stall/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stall_name: stallName,
        category,
        brand_or_society: brand,
        applicant_name: applicantName,
        applicant_phone: phone,
        applicant_email: email,
        roll_no: rollNo,
        requirements: reqs.join(', '),
        description
      })
    });
    const data = await res.json();

    if (data.success) {
      closeStallApplyModal();
      // Show confirmation in Status Modal
      openStallStatusModal(data.stall_id);
    } else {
      alert(data.error || 'Failed to submit stall application');
    }
  } catch (err) {
    alert('Network error while submitting proposal: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 Submit Stall Application (Free)';
  }
};

window.handleStallLookup = async function(presetQuery) {
  const query = (presetQuery || document.getElementById('stallLookupQuery')?.value || '').trim();
  const container = document.getElementById('stallStatusResultContainer');
  const btn = document.getElementById('btnDoStallLookup');

  if (!query) {
    if (container) {
      container.innerHTML = '<div style="color: #fbbf24; text-align: center; padding: 1.5rem;">Please enter your Stall Reference ID (e.g. STL-...) or registered Phone Number.</div>';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Checking...';
  }
  if (container) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Searching official stall registry...</div>';
  }

  try {
    const res = await fetch(`/api/stall/status/${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.success || !data.stall) {
      if (container) {
        container.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 1.25rem; color: #fca5a5; text-align: center;">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔍</div>
            <strong>No Stall Application Found</strong><br>
            <span style="font-size: 0.85rem; color: #cbd5e1;">${data.error || 'Please double check your Stall Reference ID or Mobile Number.'}</span>
          </div>
        `;
      }
      return;
    }

    const stall = data.stall;
    const accounts = data.receiving_accounts || [];
    renderStallStatusCard(stall, accounts, container);

    // Auto-polling if status is VERIFYING_PAYMENT
    if (stall.status === 'VERIFYING_PAYMENT') {
      if (!stallPollingInterval) {
        stallPollingInterval = setInterval(() => {
          handleStallLookup(stall.id);
        }, 5000);
      }
    } else {
      if (stallPollingInterval) {
        clearInterval(stallPollingInterval);
        stallPollingInterval = null;
      }
    }

  } catch (err) {
    if (container) {
      container.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 1.5rem;">Error checking stall status: ${err.message}</div>`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔍 Check Status';
    }
  }
};

function renderStallStatusCard(stall, accounts, container) {
  if (!container) return;

  // 1. PENDING_REVIEW: Waiting for admin & team to review & discuss
  if (stall.status === 'PENDING_REVIEW') {
    container.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(99, 102, 241, 0.08)); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 16px; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fde68a; font-weight: 700; padding: 4px 10px; border-radius: 20px;">
              ⏳ PROPOSAL UNDER REVIEW
            </span>
            <h3 style="font-family: var(--font-heading); font-size: 1.35rem; color: #fff; margin-top: 0.5rem; margin-bottom: 2px;">
              ${escapeHtml(stall.stall_name)}
            </h3>
            <div style="font-size: 0.82rem; color: #a5b4fc;">Category: ${escapeHtml(stall.category)} • Ref: <span style="font-family: monospace; color: #fff;">${stall.id}</span></div>
          </div>
        </div>

        <div style="background: rgba(255, 255, 255, 0.04); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            <span style="font-size: 1.5rem;">📞</span>
            <div style="font-size: 0.88rem; color: #e2e8f0; line-height: 1.5;">
              <strong style="color: #fde68a;">Next Step — Discussion & Price Agreement:</strong><br>
              Your proposal has been registered! <strong>You do not need to pay anything right now.</strong>
              Our event organizing team is reviewing your requirements and will contact you via WhatsApp at <strong style="color: #38bdf8;">${stall.applicant_phone}</strong> to discuss stall placement and agree on the stall fee.
            </div>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
          <div>Applicant: <strong style="color: #fff;">${escapeHtml(stall.applicant_name)}</strong></div>
          <div>Mobile: <strong style="color: #fff;">${stall.applicant_phone}</strong></div>
          ${stall.requirements ? `<div style="grid-column: span 2;">Requested: <span style="color: #cbd5e1;">${escapeHtml(stall.requirements)}</span></div>` : ''}
        </div>
      </div>
    `;
    return;
  }

  // 2. APPROVED_FOR_PAYMENT: Admin agreed on fee, vendor can now pay
  if (stall.status === 'APPROVED_FOR_PAYMENT') {
    const primaryAcc = accounts.find(a => a.is_primary) || accounts[0] || {
      bank: 'Easypaisa',
      title: 'MAJID ULLAH JAN',
      number: '03175230209'
    };

    container.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(16, 185, 129, 0.1)); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 16px; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: 700; padding: 4px 10px; border-radius: 20px;">
              ✓ PROPOSAL APPROVED FOR PAYMENT
            </span>
            <h3 style="font-family: var(--font-heading); font-size: 1.35rem; color: #fff; margin-top: 0.5rem; margin-bottom: 2px;">
              ${escapeHtml(stall.stall_name)}
            </h3>
            <div style="font-size: 0.82rem; color: #38bdf8;">Ref: <span style="font-family: monospace;">${stall.id}</span></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Agreed Stall Fee</div>
            <div style="font-family: monospace; font-size: 1.6rem; font-weight: 800; color: #34d399;">
              Rs. ${Number(stall.agreed_fee || 0).toLocaleString()}
            </div>
          </div>
        </div>

        ${stall.admin_notes ? `
          <div style="background: rgba(56, 189, 248, 0.1); border-left: 3px solid #38bdf8; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: #bae6fd;">
            <strong>Space & Location Allocation:</strong> ${escapeHtml(stall.admin_notes)}
          </div>
        ` : ''}

        <!-- Official Receiving Account Box -->
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.82rem; color: #a5b4fc; font-weight: 700; margin-bottom: 0.5rem;">
            💳 Transfer Fee of Rs. ${Number(stall.agreed_fee || 0).toLocaleString()} to Official Account:
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 0.75rem 1rem; border-radius: 8px;">
            <div>
              <span class="badge" style="background: rgba(99,102,241,0.2); color: #a5b4fc; font-size: 0.72rem; margin-right: 4px;">${primaryAcc.bank || 'Easypaisa'}</span>
              <strong style="font-family: monospace; font-size: 1.15rem; color: #fff;">${primaryAcc.number}</strong>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Title: <strong style="color: #cbd5e1;">${primaryAcc.title}</strong></div>
            </div>
            <button type="button" class="btn btn-outline btn-sm" onclick="copyText('${primaryAcc.number}', this)" style="padding: 6px 12px;">Copy</button>
          </div>
        </div>

        <!-- Payment Submission Form -->
        <form id="stallPaymentSubmitForm" onsubmit="submitStallPayment(event, '${stall.id}')">
          <div class="form-row" style="margin-bottom: 0.85rem;">
            <div class="form-group">
              <label for="stallTrxInput" style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">
                Transaction ID (TRX ID) *
              </label>
              <input type="text" id="stallTrxInput" class="form-control" placeholder="e.g. 89283749212" required style="height: 48px; font-family: monospace; font-weight: 700;">
            </div>
            <div class="form-group">
              <label for="stallPayMethodSelect" style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">
                Payment Method *
              </label>
              <select id="stallPayMethodSelect" class="form-control" style="height: 48px;">
                <option value="EASYPAISA">Easypaisa</option>
                <option value="JAZZCASH">JazzCash</option>
                <option value="NAYAPAY">NayaPay / SadaPay</option>
                <option value="BANK">Bank / Raast Transfer</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 4px;">
              Upload Payment Slip Screenshot (Optional)
            </label>
            <input type="file" id="stallSlipFileInput" accept="image/*" class="form-control" onchange="handleStallSlipUpload(event)">
            <div id="stallSlipPreviewBox" style="display: none; margin-top: 0.5rem; text-align: center;">
              <img id="stallSlipPreviewImg" src="" style="max-height: 120px; border-radius: 8px; border: 1px solid var(--bg-card-border);">
            </div>
          </div>

          <button type="submit" id="btnSubmitStallPay" class="btn btn-emerald" style="width: 100%; height: 50px; font-weight: 700; font-size: 1rem;">
            ✓ Submit Payment & Verify Stall
          </button>
        </form>
      </div>
    `;
    return;
  }

  // 3. VERIFYING_PAYMENT: Slip submitted, system is matching with incoming payments
  if (stall.status === 'VERIFYING_PAYMENT') {
    container.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(99, 102, 241, 0.08)); border: 1px solid rgba(249, 115, 22, 0.4); border-radius: 16px; padding: 1.5rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⏳</div>
        <span class="badge" style="background: rgba(249, 115, 22, 0.2); color: #fdba74; font-weight: 700; padding: 4px 12px; border-radius: 20px;">
          PAYMENT SLIP SUBMITTED — VERIFYING
        </span>
        <h3 style="font-family: var(--font-heading); font-size: 1.35rem; color: #fff; margin-top: 0.75rem; margin-bottom: 0.35rem;">
          ${escapeHtml(stall.stall_name)}
        </h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary); max-width: 480px; margin: 0 auto 1.25rem; line-height: 1.5;">
          Your payment with TRX <strong style="color: #38bdf8; font-family: monospace;">${stall.trx_id || '-'}</strong> (Rs. ${Number(stall.agreed_fee || 0).toLocaleString()}) has been received! Our automated system is cross-matching with incoming Easypaisa / Bank records.
        </p>

        <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.04); padding: 8px 16px; border-radius: 50px; font-size: 0.82rem; color: #a5b4fc;">
          <span class="step-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span>
          Auto-checking status... Keep this open or check back shortly.
        </div>
      </div>
    `;
    return;
  }

  // 4. VERIFIED: Official Event Stall Pass Issued with QR Code
  if (stall.status === 'VERIFIED') {
    renderStallVerifiedPass(stall, container);
    return;
  }

  // 5. REJECTED
  if (stall.status === 'REJECTED') {
    container.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 1.5rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
        <h3 style="color: #fca5a5; font-family: var(--font-heading); margin-bottom: 0.5rem;">Application Not Approved</h3>
        <p style="font-size: 0.88rem; color: #cbd5e1; max-width: 450px; margin: 0 auto 1rem;">
          We regret to inform you that your stall application for '${escapeHtml(stall.stall_name)}' could not be accommodated at this time.
        </p>
        ${stall.admin_notes ? `<div style="font-size: 0.82rem; color: #f87171;">Reason: ${escapeHtml(stall.admin_notes)}</div>` : ''}
      </div>
    `;
  }
}

window.handleStallSlipUpload = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    stallSlipBase64 = evt.target.result;
    const previewBox = document.getElementById('stallSlipPreviewBox');
    const previewImg = document.getElementById('stallSlipPreviewImg');
    if (previewBox && previewImg) {
      previewImg.src = stallSlipBase64;
      previewBox.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

window.submitStallPayment = async function(e, stallId) {
  e.preventDefault();
  const trxId = document.getElementById('stallTrxInput')?.value.trim();
  const method = document.getElementById('stallPayMethodSelect')?.value || 'EASYPAISA';
  const btn = document.getElementById('btnSubmitStallPay');

  if (!trxId) {
    alert('Please enter your Transaction ID (TRX ID).');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying Payment...';
  }

  try {
    const res = await fetch('/api/stall/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stall_id: stallId,
        trx_id: trxId,
        payment_method: method,
        screenshot_base64: stallSlipBase64 || null
      })
    });
    const data = await res.json();

    if (data.success) {
      handleStallLookup(stallId);
    } else {
      alert(data.error || 'Payment submission failed');
    }
  } catch (err) {
    alert('Network error while submitting payment: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Submit Payment & Verify Stall';
    }
  }
};

function renderStallVerifiedPass(stall, container) {
  container.innerHTML = `
    <div style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.15)); border: 2px solid #10b981; border-radius: 20px; padding: 1.5rem; text-align: center;">
      <div style="display: inline-block; background: #10b981; color: #000; font-size: 0.75rem; font-weight: 800; padding: 3px 12px; border-radius: 20px; letter-spacing: 0.5px; margin-bottom: 0.5rem;">
        OFFICIAL EVENT STALL PASS
      </div>
      <h3 style="font-family: var(--font-heading); font-size: 1.5rem; color: #fff; margin: 0.35rem 0 0.15rem;">
        ${escapeHtml(stall.stall_name)}
      </h3>
      <div style="font-size: 0.85rem; color: #38bdf8; font-weight: 600;">
        ${escapeHtml(stall.category)} • ${stall.brand_or_society ? escapeHtml(stall.brand_or_society) : 'Official Vendor'}
      </div>

      <div style="margin: 1.25rem 0;">
        <img src="${stall.stall_qr || ''}" alt="Stall QR Pass" style="width: 220px; height: 220px; background: #fff; padding: 10px; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: inline-block;">
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px;">
          Valid for gate turnstile entry & vendor stall check-in
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 0.85rem; margin-bottom: 1.25rem; font-size: 0.85rem; text-align: left; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
        <div>Vendor: <strong style="color: #fff;">${escapeHtml(stall.applicant_name)}</strong></div>
        <div>Phone: <strong style="color: #fff;">${stall.applicant_phone}</strong></div>
        <div>TRX ID: <strong style="color: #34d399; font-family: monospace;">${stall.trx_id || 'CONFIRMED'}</strong></div>
        <div>Fee: <strong style="color: #34d399; font-family: monospace;">Rs. ${Number(stall.agreed_fee || 0).toLocaleString()} (PAID)</strong></div>
        ${stall.admin_notes ? `<div style="grid-column: span 2; color: #fde68a;"><strong>Location / Setup:</strong> ${escapeHtml(stall.admin_notes)}</div>` : ''}
      </div>

      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-emerald btn-sm" style="flex: 1;" onclick="downloadPublicStallPassPng('${stall.id}')">
          💾 Download HD Pass (PNG)
        </button>
        <button class="btn btn-wa btn-sm" style="flex: 1;" onclick="sharePublicStallPassWhatsApp('${stall.id}')">
          💬 Share on WhatsApp
        </button>
        <button class="btn btn-outline btn-sm" onclick="window.print()">
          🖨️ Print
        </button>
      </div>
    </div>
  `;
}

window.downloadPublicStallPassPng = async function(stallId) {
  try {
    const res = await fetch(`/api/stall/status/${stallId}`);
    const data = await res.json();
    if (!data.success || !data.stall) return;
    const stall = data.stall;

    const canvas = document.getElementById('ticketCanvas') || document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#6366f1');
    grad.addColorStop(1, '#3b82f6');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Header
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.fillRect(20, 20, canvas.width - 40, 110);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('BAHRIA UNIVERSITY ISLAMABAD • TECHFEST & CULTURAL FIESTA 2026', 50, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px sans-serif';
    ctx.fillText('OFFICIAL STALL & VENDOR PASS', 50, 105);

    // Details
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

    ctx.fillStyle = '#64748b';
    ctx.font = '13px sans-serif';
    ctx.fillText('Verified by Bahria Event Security • Scannable by Gate Turnstiles for 3-Day Festival Access', 50, 575);

    // Draw QR
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

        const link = document.createElement('a');
        link.download = `Bahria_Stall_Pass_${stall.id}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      qrImg.src = stall.stall_qr;
    }
  } catch (err) {
    console.error('Error downloading pass:', err);
  }
};

window.sharePublicStallPassWhatsApp = async function(stallId) {
  try {
    const res = await fetch(`/api/stall/status/${stallId}`);
    const data = await res.json();
    if (!data.success || !data.stall) return;
    const stall = data.stall;

    const phoneClean = (stall.applicant_phone || '').replace(/\D/g, '');
    const waText = `Hi! Here is my official Bahria Fiesta 2026 Stall Pass for '${stall.stall_name}' (Ref: ${stall.id}). Status: VERIFIED & CONFIRMED!`;
    window.open(`https://wa.me/${phoneClean.startsWith('0') ? '92' + phoneClean.slice(1) : phoneClean}?text=${encodeURIComponent(waText)}`, '_blank');
  } catch (err) {
    console.error('Error sharing on WhatsApp:', err);
  }
};

