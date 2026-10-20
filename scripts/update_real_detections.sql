
-- 1. Clean out old dummy detections
DELETE FROM ai_photo_detections;

-- 2. Update dimensions of photos
UPDATE ai_photos SET width = 1024, height = 595 WHERE id = 'PH-AHMED-STAGE-TEST';
UPDATE ai_photos SET width = 1000, height = 562 WHERE id = 'PH-178DcJ4Fl3YFObC7PhmUfYy2mPv73Fbfu';
UPDATE ai_photos SET width = 1000, height = 562 WHERE id = 'PH-1TsTKYyASzh7PuJfJpWoUrhumGbu0_f3d';

-- 3. Insert verified real detections for Ahmed
INSERT INTO ai_photo_detections (id, photo_id, person_name, box_x, box_y, box_w, box_h, outfit_tags, has_hijab, confidence)
VALUES 
  (
    'DET-REAL-AHMED-01',
    'PH-AHMED-STAGE-TEST',
    'Ahmed',
    752,
    314,
    22,
    27,
    'Navy blue suit, red tie/lanyard, standing beside Bahria University flag',
    0,
    0.99
  ),
  (
    'DET-REAL-AHMED-02',
    'PH-178DcJ4Fl3YFObC7PhmUfYy2mPv73Fbfu',
    'Ahmed',
    717,
    298,
    19,
    25,
    'Navy blue suit, red lanyard, stage management during pitch presentation',
    0,
    0.96
  ),
  (
    'DET-REAL-AHMED-03',
    'PH-1TsTKYyASzh7PuJfJpWoUrhumGbu0_f3d',
    'Ahmed',
    513,
    243,
    28,
    38,
    'Navy blue suit, coordinating event queue on stage',
    0,
    0.88
  );

-- Update ai_known_people
INSERT OR REPLACE INTO ai_known_people (id, full_name, role_or_team, reference_photo_url, outfit_tags)
VALUES ('KP-AHMED', 'Ahmed', 'Stage Operations / Event Team', '/ahmed_face.jpg', 'Navy blue suit, red tie/lanyard');
