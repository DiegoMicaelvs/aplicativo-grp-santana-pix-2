-- Create session table if it doesn't exist
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Create index for expire column
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
