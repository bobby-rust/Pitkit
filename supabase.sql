-- users with UUID PK defaulting to auth.uid()
CREATE TABLE IF NOT EXISTS users (
  id         UUID         PRIMARY KEY DEFAULT auth.uid(),
  username   VARCHAR(50)   NOT NULL UNIQUE,
  email      VARCHAR(255)  NOT NULL UNIQUE,
  password   TEXT          NOT NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- trainers referencing UUID users.id
CREATE TABLE IF NOT EXISTS trainers (
  id          BIGSERIAL       PRIMARY KEY,
  user_id     UUID            REFERENCES users(id) ON DELETE SET NULL,
  map         TEXT            NOT NULL,
  laptime     DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Trainers RLS
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own trainers"
  ON trainers FOR INSERT
  WITH CHECK ( user_id = auth.uid() );
CREATE POLICY "Users can manage their trainers"
  ON trainers FOR ALL
  USING ( user_id = auth.uid() );

-- Users RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow signups" 
  ON users FOR INSERT WITH CHECK ( true );
CREATE POLICY "Users can see their own profile"
  ON users FOR SELECT USING ( id = auth.uid() );
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE 
  USING ( id = auth.uid() ) 
  WITH CHECK ( id = auth.uid() );
CREATE POLICY "Users can delete their own account"
  ON users FOR DELETE USING ( id = auth.uid() );