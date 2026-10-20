-- Bahria University Event Database Schema
CREATE TABLE IF NOT EXISTS incoming_payments (
    trx_id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    sender_name TEXT,
    sender_phone TEXT,
    payment_method TEXT DEFAULT 'EASYPAISA',
    raw_text TEXT,
    source TEXT DEFAULT 'GMAIL',
    status TEXT DEFAULT 'UNCLAIMED',
    claimed_by TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    roll_no TEXT NOT NULL,
    department TEXT NOT NULL,
    ticket_type TEXT NOT NULL,
    expected_amount REAL NOT NULL,
    trx_id TEXT,
    ocr_amount REAL,
    ocr_sender TEXT,
    ocr_raw TEXT,
    screenshot_preview TEXT,
    status TEXT DEFAULT 'PENDING',
    verification_notes TEXT,
    ticket_qr TEXT,
    payment_method TEXT DEFAULT 'EASYPAISA',
    cashier_name TEXT,
    receipt_no TEXT,
    checked_in_at DATETIME,
    checkin_by TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS desk_shifts (
    id TEXT PRIMARY KEY,
    cashier_name TEXT NOT NULL,
    desk_number TEXT DEFAULT 'Desk 1',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    total_cash_collected REAL DEFAULT 0.0,
    total_tickets_sold INTEGER DEFAULT 0,
    handover_to TEXT,
    handover_status TEXT DEFAULT 'OPEN',
    handover_notes TEXT,
    approved_at DATETIME
);

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    paid_to TEXT,
    receipt_image TEXT,
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    reference_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stalls (
    id TEXT PRIMARY KEY,
    stall_name TEXT NOT NULL,
    brand_or_society TEXT,
    category TEXT NOT NULL,
    applicant_name TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    applicant_email TEXT,
    roll_no TEXT,
    requirements TEXT,
    description TEXT,
    status TEXT DEFAULT 'PENDING_REVIEW',
    agreed_fee REAL DEFAULT 0.0,
    trx_id TEXT,
    payment_method TEXT DEFAULT 'EASYPAISA',
    screenshot_preview TEXT,
    ocr_raw TEXT,
    admin_notes TEXT,
    stall_qr TEXT,
    approved_by TEXT,
    approved_at DATETIME,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    title TEXT,
    plain_passcode TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO staff_users (id, username, password_hash, full_name, role, phone, is_active) VALUES
('usr-admin-1', 'maajid', 'pbkdf2_sha256$maajidsalt123456$3Zt9-Q-cTMo1LHQ-JbCI0HAGilxPIGRnK0TAWY3t-48', 'Event Director (Maajid)', 'ADMIN', '03175230209', 1),
('usr-fin-1', 'finance', 'pbkdf2_sha256$financesalt12345$bsN5U1CEXZAXSBN-EUIbFWfADxmvlZg1GKXRUcjT6SY', 'Head of Finance', 'FINANCE', '03001234567', 1),
('usr-csh-1', 'cashier1', 'pbkdf2_sha256$cashiersalt12345$4oxBu9VhfXvmaEKVPY8HXKdfFgdXXE7V0tjRJQvaXKc', 'Cashier Station 1', 'CASHIER', '03111234567', 1),
('usr-scn-1', 'scanner1', 'pbkdf2_sha256$scannersalt12345$AdRc8Q9Dtestz3swyYSF1wYZj0La0JPJ7pU4WrrMmcg', 'Gate Monitor 1', 'GATE_SCANNER', '03221234567', 1);

INSERT OR REPLACE INTO settings (key, value) VALUES 
('easypaisa_account_title', 'MAJID ULLAH JAN'),
('easypaisa_account_number', '03175230209'),
('receiving_accounts', '[{"id":"acc-1","bank":"Easypaisa","title":"MAJID ULLAH JAN","number":"03175230209","is_active":true,"is_primary":true},{"id":"acc-ideacrux","bank":"Zindigi (JS Bank) / Raast","title":"Muhammad Huzaifa","number":"03292092724","iban":"PK43JSBL9999903292092724","is_active":true,"event":"IDEACRUX"}]'),
('sync_gmail', 'kashibro56@gmail.com'),
('test_fee_pkr', '1.0'),
('ideacrux_fee_pkr', '100.0'),
('ideacrux_account_title', 'Muhammad Huzaifa'),
('ideacrux_account_number', '0329 2092724');

CREATE TABLE IF NOT EXISTS ideacrux_teams (
    id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL,
    members_count INTEGER NOT NULL DEFAULT 2,
    leader_name TEXT NOT NULL,
    leader_email TEXT NOT NULL,
    leader_phone TEXT NOT NULL,
    leader_dept TEXT NOT NULL,
    leader_semester TEXT,
    member_2_name TEXT,
    member_2_phone TEXT,
    member_3_name TEXT,
    member_3_phone TEXT,
    startup_name TEXT NOT NULL,
    idea_description TEXT NOT NULL,
    problem_statement TEXT NOT NULL,
    startup_stage TEXT NOT NULL DEFAULT 'Idea Stage',
    revenue_model TEXT,
    pitch_deck_ready TEXT DEFAULT 'No',
    available_on_day TEXT DEFAULT 'Yes',
    pitch_deck_url TEXT,
    fee_amount REAL DEFAULT 100.0,
    payment_method TEXT DEFAULT 'ZINDIGI',
    receipt_no TEXT,
    cashier_name TEXT,
    trx_id TEXT,
    screenshot_preview TEXT,
    status TEXT DEFAULT 'PENDING',
    pitch_pass_qr TEXT,
    admin_notes TEXT,
    whatsapp_sent INTEGER DEFAULT 0,
    checked_in_at DATETIME,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS judge_scores (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    judge_id TEXT NOT NULL,
    judge_name TEXT NOT NULL,
    score_idea INTEGER NOT NULL CHECK (score_idea >= 1 AND score_idea <= 10),
    score_solution INTEGER NOT NULL CHECK (score_solution >= 1 AND score_solution <= 10),
    score_business INTEGER NOT NULL CHECK (score_business >= 1 AND score_business <= 10),
    score_impact INTEGER NOT NULL CHECK (score_impact >= 1 AND score_impact <= 10),
    score_startup INTEGER NOT NULL CHECK (score_startup >= 1 AND score_startup <= 10),
    score_judges INTEGER NOT NULL CHECK (score_judges >= 1 AND score_judges <= 10),
    total_score INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, judge_id)
);

-- =============================================================================
-- AI Face Vector & Media Retrieval Engine
-- =============================================================================
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

-- =============================================================================
-- Judge & Evaluator Event Feedback Retrospective
-- =============================================================================
CREATE TABLE IF NOT EXISTS judge_feedback (
    id TEXT PRIMARY KEY,
    judge_id TEXT NOT NULL UNIQUE,
    judge_name TEXT NOT NULL,
    judge_title TEXT,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    organization_rating INTEGER CHECK (organization_rating >= 1 AND organization_rating <= 5),
    pitch_quality_rating INTEGER CHECK (pitch_quality_rating >= 1 AND pitch_quality_rating <= 5),
    venue_rating INTEGER CHECK (venue_rating >= 1 AND venue_rating <= 5),
    best_highlights TEXT,
    areas_of_improvement TEXT,
    general_comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
