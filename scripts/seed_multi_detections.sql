
-- Add multiple detections for Ahmed across several event photos
INSERT OR REPLACE INTO ai_photo_detections (id, photo_id, person_name, box_x, box_y, box_w, box_h, outfit_tags, has_hijab, confidence)
VALUES 
  -- 1. Main Auditorium Stage Photo (Ahmed on right)
  ('DET-AHMED-STAGE-01', 'PH-AHMED-STAGE-TEST', 'Ahmed', 735, 295, 60, 85, 'Navy blue suit, red tie/lanyard, standing by BU flag', 0, 0.98),
  
  -- 2. Stage Photo - Maryam Iqbal
  ('DET-MARYAM-STAGE-01', 'PH-AHMED-STAGE-TEST', 'Maryam Iqbal', 415, 345, 50, 65, 'Teal/cyan printed shalwar kameez with dupatta/hijab', 1, 0.96),

  -- 3. Stage Photo - Sardar Ali
  ('DET-SARDAR-STAGE-01', 'PH-AHMED-STAGE-TEST', 'Sardar Ali', 485, 340, 50, 65, 'Brown formal three-piece suit, white shirt, red tie', 0, 0.97),

  -- 4. Stage Photo - Ahtesham Ul Haq
  ('DET-AHTESHAM-STAGE-01', 'PH-AHMED-STAGE-TEST', 'Ahtesham Ul Haq Khan', 545, 340, 50, 65, 'Black formal suit, glasses, white shirt', 0, 0.95),

  -- 5. Google Drive Photo 03C5BACF (Ahmed event coordination)
  ('DET-AHMED-DRIVE-01', 'PH-1EcQsVt5nJo_XsjXrMEz3A5wc0dcvrhXY', 'Ahmed', 420, 580, 160, 220, 'Navy blue suit, event lanyard, coordinating pitch session', 0, 0.94),

  -- 6. Google Drive Photo IMG_3019 (Ahmed stage setup)
  ('DET-AHMED-DRIVE-02', 'PH-1XXPa_WUGxkrsRuHU-byVjw61cf6D22ha', 'Ahmed', 380, 620, 150, 210, 'Navy blue suit, red tie, auditorium stage background', 0, 0.95),

  -- 7. Google Drive Photo IMG_3020 (Ahmed near podium)
  ('DET-AHMED-DRIVE-03', 'PH-1PgMqUK_AAFwLTOiVFOPbr2DShYAIovir', 'Ahmed', 450, 590, 170, 230, 'Navy blue suit, managing microphone and queue', 0, 0.96),

  -- 8. Google Drive Photo IMG_3021 (Ahmed and judges session)
  ('DET-AHMED-DRIVE-04', 'PH-1s3of6Zoql8ty04ajXiJv1xWJF3P3xDbE', 'Ahmed', 390, 640, 160, 220, 'Navy blue suit, standing by stage stairs', 0, 0.93);

-- Update ai_known_people with detailed registry
INSERT OR REPLACE INTO ai_known_people (id, full_name, role_or_team, reference_photo_url, outfit_tags)
VALUES 
  ('KP-AHMED', 'Ahmed', 'Stage Operations / Event Team', '/ahmed_face.jpg', 'Navy blue suit, red tie/lanyard'),
  ('KP-MARYAM', 'Maryam Iqbal', 'Official Judge / Evaluator', '/test_ahmed.jpg', 'Teal/cyan dress with dupatta/hijab'),
  ('KP-SARDAR', 'Sardar Ali', 'Official Judge / Evaluator', '/test_ahmed.jpg', 'Brown suit, red tie'),
  ('KP-AHTESHAM', 'Ahtesham Ul Haq Khan', 'Official Judge / Evaluator', '/test_ahmed.jpg', 'Black suit, glasses');
