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
