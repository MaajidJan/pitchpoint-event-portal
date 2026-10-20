const fs = require('fs');
const path = require('path');

console.log('--- 🚀 ISOLATING IDEACRUX & UPDATING FEE TO RS. 1,000 ---');

// 1. Update src/index.ts
const indexPath = path.join(__dirname, '../src/index.ts');
let indexCode = fs.readFileSync(indexPath, 'utf8');

// Update Root routes
const oldRoot = `// Root & Portal Pages
app.get('/', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Bahria Portal Active');
});

app.get('/ideacrux', (c) => c.redirect('/ideacrux.html'));`;

const newRoot = `// Root & Portal Pages - Isolated strictly for IDEACRUX 2025 (Zindigi Prize)
app.get('/', (c) => c.redirect('/ideacrux.html'));
app.get('/ideacrux', (c) => c.redirect('/ideacrux.html'));
app.get('/desk', (c) => c.redirect('/crux-desk.html'));
app.get('/admin', (c) => c.redirect('/crux-admin.html'));
app.get('/finance', (c) => c.redirect('/finance.html'));
app.get('/scanner', (c) => c.redirect('/scanner.html'));`;

if (indexCode.includes(oldRoot)) {
  indexCode = indexCode.replace(oldRoot, newRoot);
  console.log('✓ Updated root routes in src/index.ts');
}

// Update fee to 1000 in src/index.ts
indexCode = indexCode.replace(`const feeAmount = 100.0;`, `const feeAmount = 1000.0;`);
indexCode = indexCode.replace(`fee_pkr: 100,`, `fee_pkr: 1000,`);
indexCode = indexCode.replace(`Hard cash Rs. 100 collected by`, `Hard cash Rs. 1000 collected by`);
indexCode = indexCode.replace(`total_cash_collected + 100`, `total_cash_collected + 1000`);
indexCode = indexCode.replace(`Collected Rs. 100 cash for IdeaCrux`, `Collected Rs. 1000 cash for IdeaCrux`);
indexCode = indexCode.replace(`?, 100.0, 'CASH', ?, ?,`, `?, 1000.0, 'CASH', ?, ?,`);
indexCode = indexCode.replace(`registered with Rs. 100 cash`, `registered with Rs. 1000 cash`);
indexCode = indexCode.replace(`Rs. 100 cash received!`, `Rs. 1000 cash received!`);
indexCode = indexCode.replace(`amount: t.fee_amount || 100,`, `amount: t.fee_amount || 1000,`);

// In config endpoint, default to 1000.0
indexCode = indexCode.replace(`ideacrux_fee_pkr: '100.0'`, `ideacrux_fee_pkr: '1000.0'`);
indexCode = indexCode.replace(`ideacrux_fee_pkr: settingsMap['ideacrux_fee_pkr'] || '100.0'`, `ideacrux_fee_pkr: settingsMap['ideacrux_fee_pkr'] || '1000.0'`);

fs.writeFileSync(indexPath, indexCode, 'utf8');
console.log('✓ Successfully updated src/index.ts');

// 2. Update public/ideacrux.html
const cruxHtmlPath = path.join(__dirname, '../public/ideacrux.html');
let cruxHtml = fs.readFileSync(cruxHtmlPath, 'utf8');

// Replace Rs. 100 with Rs. 1,000 in HTML
cruxHtml = cruxHtml.replaceAll('Rs. 100', 'Rs. 1,000');
cruxHtml = cruxHtml.replaceAll('RS. 100', 'RS. 1,000');
cruxHtml = cruxHtml.replaceAll('100 PKR', '1,000 PKR');
cruxHtml = cruxHtml.replaceAll('Rs 100', 'Rs 1,000');

// Embed Zindigi Payment QR image inside payment instruction box in ideacrux.html
const oldPayDetailsBox = `<div class="payment-details-grid">`;
const newPayDetailsBox = `<div style="text-align: center; margin-bottom: 1.5rem; background: rgba(2, 11, 14, 0.9); border: 1px solid var(--border-active); border-radius: 16px; padding: 1.25rem;">
          <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 0.5rem;">
            ⚡ Instant Scan & Pay via Any Banking App (Zindigi / Raast)
          </div>
          <div style="display: inline-block; background: #fff; padding: 10px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 240, 212, 0.25); cursor: pointer;" onclick="openPaymentQrZoomModal()" title="Click to zoom QR Code">
            <img src="/assets/zindigi_payment_qr.jpg" alt="Official Zindigi / Raast Payment QR" style="max-width: 240px; width: 100%; height: auto; border-radius: 8px; display: block;">
          </div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.5rem;">
            Scan using <strong>Zindigi, Easypaisa, JazzCash, NayaPay, SadaPay</strong> or any bank app
          </div>
        </div>
        <div class="payment-details-grid">`;

if (cruxHtml.includes(oldPayDetailsBox) && !cruxHtml.includes('/assets/zindigi_payment_qr.jpg')) {
  cruxHtml = cruxHtml.replace(oldPayDetailsBox, newPayDetailsBox);
}

// Add Nav button for "📱 Portal QR Codes"
const oldNavCta = `<a href="#register" class="hud-btn hud-btn-cyan" onclick="openCruxRegisterModal()">
          [REGISTER STARTUP]
        </a>`;

const newNavCta = `<button type="button" class="hud-btn hud-btn-outline" style="font-size: 0.8rem; border-color: rgba(0, 240, 212, 0.4); color: var(--accent-cyan);" onclick="openPortalQrModal()">
          📱 [PORTAL QR CODES]
        </button>
        <a href="#register" class="hud-btn hud-btn-cyan" onclick="openCruxRegisterModal()">
          [REGISTER STARTUP]
        </a>`;

if (cruxHtml.includes(oldNavCta) && !cruxHtml.includes('openPortalQrModal()')) {
  cruxHtml = cruxHtml.replace(oldNavCta, newNavCta);
}

// Add Portal QR Modal and Payment QR Lightbox Modal before </body>
const modalsHtml = `
  <!-- QR Codes Hub Modal (Separate Public & Cashier QR Codes) -->
  <div class="hud-modal-overlay" id="portalQrModal">
    <div class="hud-modal-card" style="max-width: 700px; text-align: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-hairline); padding-bottom: 1rem;">
        <div>
          <h3 style="font-family: var(--font-display); color: #fff; font-size: 1.4rem;">📱 Portal Access & Payment QR Codes</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">Separated mobile access QR codes for public founders & on-spot cashier desk</p>
        </div>
        <button type="button" class="hud-modal-close" onclick="closePortalQrModal()">✕</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
        <!-- 1. Public Portal QR -->
        <div style="background: rgba(4, 20, 25, 0.8); border: 1px solid var(--border-active); border-radius: 14px; padding: 1.25rem;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700; margin-bottom: 0.5rem;">
            🌐 PUBLIC REGISTRATION
          </div>
          <div style="background: #fff; padding: 8px; border-radius: 10px; display: inline-block; margin-bottom: 0.75rem;">
            <img src="/assets/qr_public_portal.svg" alt="Public Registration QR" style="width: 150px; height: 150px; display: block;">
          </div>
          <div style="font-size: 0.8rem; color: #fff; font-weight: 600;">Scan to Register Online</div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Opens IdeaCrux public registration portal</p>
          <a href="/assets/qr_public_portal.svg" download="IdeaCrux_Registration_QR.svg" class="hud-btn hud-btn-outline" style="font-size: 0.72rem; margin-top: 0.5rem; display: inline-block;">
            Download QR
          </a>
        </div>

        <!-- 2. Cashier Desk QR -->
        <div style="background: rgba(4, 20, 25, 0.8); border: 1px solid rgba(251, 191, 36, 0.4); border-radius: 14px; padding: 1.25rem;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #fbbf24; font-weight: 700; margin-bottom: 0.5rem;">
            💼 ON-SPOT CASHIER DESK
          </div>
          <div style="background: #fff; padding: 8px; border-radius: 10px; display: inline-block; margin-bottom: 0.75rem;">
            <img src="/assets/qr_cashier_desk.svg" alt="Cashier Desk QR" style="width: 150px; height: 150px; display: block;">
          </div>
          <div style="font-size: 0.8rem; color: #fff; font-weight: 600;">Cashier Terminal Access</div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Opens on-spot cash desk for counter staff</p>
          <a href="/assets/qr_cashier_desk.svg" download="IdeaCrux_Cashier_Desk_QR.svg" class="hud-btn hud-btn-outline" style="font-size: 0.72rem; margin-top: 0.5rem; display: inline-block;">
            Download QR
          </a>
        </div>

        <!-- 3. Payment QR -->
        <div style="background: rgba(4, 20, 25, 0.8); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 1.25rem;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #34d399; font-weight: 700; margin-bottom: 0.5rem;">
            💳 ZINDIGI / RAAST (RS. 1,000)
          </div>
          <div style="background: #fff; padding: 4px; border-radius: 10px; display: inline-block; margin-bottom: 0.75rem; cursor: pointer;" onclick="openPaymentQrZoomModal()">
            <img src="/assets/zindigi_payment_qr.jpg" alt="Payment QR" style="width: 150px; height: 150px; object-fit: contain; display: block; border-radius: 8px;">
          </div>
          <div style="font-size: 0.8rem; color: #fff; font-weight: 600;">Muhammad Huzaifa</div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">0329 2092724 (Raast)</p>
          <a href="/assets/zindigi_payment_qr.jpg" download="Zindigi_Raast_Payment_QR.jpg" class="hud-btn hud-btn-outline" style="font-size: 0.72rem; margin-top: 0.5rem; display: inline-block;">
            Download QR Card
          </a>
        </div>
      </div>

      <button type="button" class="hud-btn hud-btn-cyan" style="width: 100%;" onclick="closePortalQrModal()">
        Close
      </button>
    </div>
  </div>

  <!-- High-Res Payment QR Zoom Modal -->
  <div class="hud-modal-overlay" id="paymentQrZoomModal">
    <div class="hud-modal-card" style="max-width: 480px; text-align: center; background: #020b0e; border: 2px solid var(--accent-cyan);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="font-family: var(--font-display); color: #fff; font-size: 1.15rem;">Official Zindigi / Raast Payment Card</h4>
        <button type="button" class="hud-modal-close" onclick="closePaymentQrZoomModal()">✕</button>
      </div>
      <img src="/assets/zindigi_payment_qr.jpg" alt="Zindigi Payment Card" style="width: 100%; border-radius: 12px; margin-bottom: 1rem; box-shadow: 0 8px 30px rgba(0,240,212,0.3);">
      <div style="font-size: 0.85rem; color: #fff; margin-bottom: 1rem;">
        Entry Fee: <strong style="color: var(--accent-cyan); font-size: 1.1rem;">Rs. 1,000</strong>
      </div>
      <button type="button" class="hud-btn hud-btn-outline" style="width: 100%;" onclick="closePaymentQrZoomModal()">
        Back to Registration
      </button>
    </div>
  </div>
`;

if (!cruxHtml.includes('id="portalQrModal"')) {
  cruxHtml = cruxHtml.replace('</body>', modalsHtml + '\n</body>');
}

fs.writeFileSync(cruxHtmlPath, cruxHtml, 'utf8');
console.log('✓ Successfully updated public/ideacrux.html');

// Copy updated ideacrux.html to public/index.html so root is 100% IdeaCrux
const rootIndexPath = path.join(__dirname, '../public/index.html');
fs.writeFileSync(rootIndexPath, cruxHtml, 'utf8');
console.log('✓ Replaced public/index.html with IdeaCrux portal');

// 3. Update public/ideacrux.js
const cruxJsPath = path.join(__dirname, '../public/ideacrux.js');
let cruxJs = fs.readFileSync(cruxJsPath, 'utf8');

cruxJs = cruxJs.replaceAll('Rs. 100', 'Rs. 1,000');
cruxJs = cruxJs.replaceAll('100', '1000'); // carefully in fee contexts
// Modal helper functions
const qrModalHelpers = `
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
`;

if (!cruxJs.includes('openPortalQrModal')) {
  cruxJs += '\n' + qrModalHelpers;
}
fs.writeFileSync(cruxJsPath, cruxJs, 'utf8');
console.log('✓ Successfully updated public/ideacrux.js');

// 4. Update public/crux-desk.html & public/crux-desk.js
const deskHtmlPath = path.join(__dirname, '../public/crux-desk.html');
let deskHtml = fs.readFileSync(deskHtmlPath, 'utf8');
deskHtml = deskHtml.replaceAll('Rs. 100', 'Rs. 1,000');
deskHtml = deskHtml.replaceAll('RS. 100', 'RS. 1,000');
deskHtml = deskHtml.replaceAll('100 Cash', '1,000 Cash');
deskHtml = deskHtml.replaceAll('100 CASH', '1,000 CASH');
fs.writeFileSync(deskHtmlPath, deskHtml, 'utf8');

const deskJsPath = path.join(__dirname, '../public/crux-desk.js');
let deskJs = fs.readFileSync(deskJsPath, 'utf8');
deskJs = deskJs.replaceAll('Rs. 100', 'Rs. 1,000');
deskJs = deskJs.replaceAll('100', '1000');
fs.writeFileSync(deskJsPath, deskJs, 'utf8');
console.log('✓ Successfully updated crux-desk.html & crux-desk.js with Rs. 1,000 fee');

// 5. Update public/finance.html & public/finance.js
const finHtmlPath = path.join(__dirname, '../public/finance.html');
let finHtml = fs.readFileSync(finHtmlPath, 'utf8');
finHtml = finHtml.replaceAll('Rs. 100', 'Rs. 1,000');
finHtml = finHtml.replaceAll('Bahria Fiesta 2026', 'IDEACRUX 2025 // ZINDIGI PRIZE');
fs.writeFileSync(finHtmlPath, finHtml, 'utf8');

const finJsPath = path.join(__dirname, '../public/finance.js');
let finJs = fs.readFileSync(finJsPath, 'utf8');
finJs = finJs.replaceAll('Rs. 100', 'Rs. 1,000');
fs.writeFileSync(finJsPath, finJs, 'utf8');
console.log('✓ Successfully updated finance.html & finance.js with IdeaCrux branding and Rs. 1,000 fee');

console.log('🎉 Isolation & Fee update script completed successfully!');
