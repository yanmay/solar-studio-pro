-- Phase D: DB-backed API keys for v1 underwriting (partner integrations).
-- Keys are stored HASHED (SHA-256 hex) — plaintext is only shown once at issuance.
-- Verified server-side by the service-role client; never exposed to anon/authenticated.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     TEXT NOT NULL UNIQUE,          -- SHA-256 hex of the plaintext key
  label        TEXT,                          -- human-readable partner/name
  owner_id     UUID,                          -- optional: linked profile/installer
  scopes       TEXT[] DEFAULT '{}',           -- future: per-key permission scopes
  revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup on the hash (the verification path queries by key_hash).
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);

-- Lock down: enable RLS with NO policies for anon/authenticated. Only the
-- service-role client (which bypasses RLS) can read/write. This prevents any
-- client-side role from enumerating or exfiltrating key hashes.
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Ensure PostgREST reloads its schema cache after applying.
NOTIFY pgrst, 'reload schema';
