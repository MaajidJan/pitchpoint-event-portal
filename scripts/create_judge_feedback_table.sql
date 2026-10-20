-- Table for Judge Event Feedback
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
