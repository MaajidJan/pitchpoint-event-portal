-- AI Photo & Face Indexing Tables
CREATE TABLE IF NOT EXISTS ai_photos (
    id TEXT PRIMARY KEY,
    drive_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    full_url TEXT NOT NULL,
    is_video INTEGER DEFAULT 0,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_photo_detections (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    person_name TEXT,
    box_x INTEGER,
    box_y INTEGER,
    box_w INTEGER,
    box_h INTEGER,
    face_descriptor TEXT,
    outfit_tags TEXT,
    has_hijab INTEGER DEFAULT 0,
    confidence REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(photo_id) REFERENCES ai_photos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_known_people (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    role_or_team TEXT,
    reference_photo_url TEXT,
    face_descriptor TEXT,
    outfit_tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_detections_photo ON ai_photo_detections(photo_id);
CREATE INDEX IF NOT EXISTS idx_ai_detections_person ON ai_photo_detections(person_name);
