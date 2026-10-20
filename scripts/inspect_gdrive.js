import fs from 'node:fs';

async function main() {
  const url = 'https://drive.google.com/drive/folders/1lDH2kgH5Kp2YpLjHm_u1SjFriR6d3026';
  const res = await fetch(url);
  const text = await res.text();
  fs.writeFileSync('scripts/gdrive_page.html', text);
  console.log('Saved gdrive_page.html, size:', text.length);

  // Look for data payload in window._DRIVE_data or JSON arrays
  const regex = /"([a-zA-Z0-9_-]{28,35})"/g;
  const ids = new Set();
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (!m[1].includes('http') && !m[1].includes('drive') && !m[1].includes('folders')) {
      ids.add(m[1]);
    }
  }
  console.log('Found candidate Drive IDs count:', ids.size);
  console.log('Sample IDs:', Array.from(ids).slice(0, 15));
}

main().catch(console.error);
