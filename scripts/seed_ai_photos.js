import fs from 'node:fs';

async function seed() {
  const files = JSON.parse(fs.readFileSync('scripts/extracted_gdrive_files.json', 'utf8'));
  console.log('Seeding', files.length, 'photos into D1...');

  const sqlStatements = [];

  // 1. Add test_ahmed photo
  sqlStatements.push(`
    INSERT OR REPLACE INTO ai_photos (id, drive_file_id, file_name, thumbnail_url, full_url, is_video, width, height, tags)
    VALUES (
      'PH-AHMED-STAGE-TEST',
      'test_ahmed',
      'PitchPoint_Stage_Auditorium_Test.jpg',
      '/test_ahmed.jpg',
      '/test_ahmed.jpg',
      0,
      1024,
      595,
      'auditorium, stage, judges panel, ahmed'
    );
  `);

  // 2. Add Ahmed detection on test_ahmed
  sqlStatements.push(`
    INSERT OR REPLACE INTO ai_photo_detections (id, photo_id, person_name, box_x, box_y, box_w, box_h, outfit_tags, has_hijab, confidence)
    VALUES (
      'DET-AHMED-01',
      'PH-AHMED-STAGE-TEST',
      'Ahmed',
      735,
      295,
      60,
      85,
      'Navy blue suit, red tie and event lanyard, standing beside BU crest',
      0,
      0.98
    );
  `);

  // 3. Register Ahmed in ai_known_people
  sqlStatements.push(`
    INSERT OR REPLACE INTO ai_known_people (id, full_name, role_or_team, reference_photo_url, outfit_tags)
    VALUES (
      'KP-AHMED',
      'Ahmed',
      'Stage Operations / Event Team',
      '/ahmed_face.jpg',
      'Navy blue suit, red tie/lanyard'
    );
  `);

  // 4. Ingest extracted Google Drive files
  files.forEach((f, idx) => {
    const rawId = f.id.replace(/-0$/, '');
    const thumbUrl = `https://drive.google.com/thumbnail?id=${rawId}&sz=w800`;
    const fullUrl = `https://drive.google.com/uc?export=view&id=${rawId}`;
    const safeName = f.name.replace(/'/g, "''");
    const photoId = `PH-${rawId}`;

    sqlStatements.push(`
      INSERT OR REPLACE INTO ai_photos (id, drive_file_id, file_name, thumbnail_url, full_url, is_video, tags)
      VALUES (
        '${photoId}',
        '${rawId}',
        '${safeName}',
        '${thumbUrl}',
        '${fullUrl}',
        ${f.is_video ? 1 : 0},
        'pitch_point_2026, google_drive'
      );
    `);
  });

  fs.writeFileSync('scripts/seed_ai_photos.sql', sqlStatements.join('\n'));
  console.log('Generated scripts/seed_ai_photos.sql with', sqlStatements.length, 'statements');
}

seed().catch(console.error);
