import fs from 'node:fs';

const html = fs.readFileSync('scripts/gdrive_page.html', 'utf8');

// Match filename and ssk containing file ID
const regex = /aria-label="([^"]+\.(?:jpg|jpeg|png|mp4|mov|webp))[^"]*"[^>]*ssk='[^']*?:([a-zA-Z0-9_-]{28,35})[^']*'/gi;
const files = [];
const seen = new Set();
let m;
while ((m = regex.exec(html)) !== null) {
  const name = m[1];
  const id = m[2];
  if (!seen.has(id)) {
    seen.add(id);
    files.push({ name, id, is_video: name.endsWith('.mp4') || name.endsWith('.mov') });
  }
}

console.log('Total extracted files from page:', files.length);
fs.writeFileSync('scripts/extracted_gdrive_files.json', JSON.stringify(files, null, 2));
console.log('Sample files:', files.slice(0, 10));
