-- GramDB — Muundo wa Database (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Watumiaji
CREATE TABLE IF NOT EXISTS users (
  uid            VARCHAR(64) PRIMARY KEY,
  phone_number   VARCHAR(32) UNIQUE NOT NULL,
  current_token  VARCHAR(128),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index ya haraka kutafuta uid kutoka token
CREATE INDEX IF NOT EXISTS idx_users_current_token ON users (current_token);

-- Data ya "real-time" database (documents, wazi kwa kila mtumiaji mwenye token halali)
CREATE TABLE IF NOT EXISTS docs (
  doc_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     VARCHAR(64) REFERENCES users(uid) ON DELETE SET NULL,
  collection   VARCHAR(128) NOT NULL DEFAULT 'default',
  data         JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_collection ON docs (collection);
CREATE INDEX IF NOT EXISTS idx_docs_owner ON docs (owner_id);

-- Faili zilizo-upload (Media Storage)
CREATE TABLE IF NOT EXISTS files (
  file_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by   VARCHAR(64) REFERENCES users(uid) ON DELETE SET NULL,
  file_name     VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL UNIQUE,
  file_type     VARCHAR(128),
  size_bytes    BIGINT,
  public_url    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files (uploaded_by);
