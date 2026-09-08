-- Keep credentials separate so authentication works on both legacy and current user schemas.
CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO auth_credentials(user_id,password_hash,password_salt)
SELECT id,password_hash,password_salt
FROM users
WHERE password_hash IS NOT NULL AND password_salt IS NOT NULL;
