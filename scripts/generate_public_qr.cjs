const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

(async () => {
  const publicUrl = 'https://tinyurl.com/pitchpoint-bu';
  const assetsDir = path.join(__dirname, '..', 'public', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 1. High-Res PNG (1200x1200 with margin)
  const pngPath = path.join(assetsDir, 'pitchpoint_public_qr.png');
  await QRCode.toFile(pngPath, publicUrl, {
    errorCorrectionLevel: 'H',
    type: 'png',
    quality: 1,
    margin: 3,
    width: 1200,
    color: {
      dark: '#020b0e', // Pitch Point Abyss Dark
      light: '#ffffff' // Crisp White
    }
  });
  console.log('Generated PNG QR at:', pngPath);

  // 2. High-Res SVG
  const svgPath = path.join(assetsDir, 'pitchpoint_public_qr.svg');
  const svgString = await QRCode.toString(publicUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 3,
    color: {
      dark: '#020b0e',
      light: '#ffffff'
    }
  });
  fs.writeFileSync(svgPath, svgString, 'utf8');
  console.log('Generated SVG QR at:', svgPath);

  // 3. Cyber/Theme Styled QR with Cyan Accents (PNG)
  const brandedPngPath = path.join(assetsDir, 'pitchpoint_theme_qr.png');
  await QRCode.toFile(brandedPngPath, publicUrl, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 3,
    width: 1200,
    color: {
      dark: '#00f0d4', // Theme Cyan
      light: '#020b0e' // Theme Abyss Dark Background
    }
  });
  console.log('Generated Themed Dark QR at:', brandedPngPath);
})();
