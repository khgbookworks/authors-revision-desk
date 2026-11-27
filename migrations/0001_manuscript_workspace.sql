PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner_token_hash TEXT NOT NULL,
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  object_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'owner',
  UNIQUE(project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project
  ON project_versions(project_id, version_number DESC);

CREATE TABLE IF NOT EXISTS project_shares (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('author_review', 'editor')),
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_shares_project
  ON project_shares(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  suggestion_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accepted', 'rejected', 'commented')),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(share_id, version_id, suggestion_id)
);

CREATE INDEX IF NOT EXISTS idx_review_decisions_share
  ON review_decisions(share_id, version_id);

CREATE TABLE IF NOT EXISTS ai_usage (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  input_characters INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_date
  ON ai_usage(usage_date);


CREATE TABLE IF NOT EXISTS editor_submissions (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES project_versions(id) ON DELETE CASCADE,
  submission_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_editor_submissions_project
  ON editor_submissions(project_id, created_at DESC);
