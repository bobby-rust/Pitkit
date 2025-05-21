DROP TABLE IF EXISTS trainers;
DROP TABLE IF EXISTS profiles;


-- Create a table for public profiles, linked to the auth.users table.
-- It's common practice to name this table 'profiles'.
CREATE TABLE IF NOT EXISTS public.profiles (
  id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to auth.users and cascade deletions
  username VARCHAR(50) UNIQUE, -- Username should still be unique
  -- email column is removed as auth.users handles it
  -- password column is removed as auth.users handles it
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now() -- Added an updated_at column, good practice
);

-- Add an index for the username for faster lookups
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username);

-- Set up Row Level Security (RLS) for the profiles table.
-- Ensure RLS is enabled for the table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to view profiles (you might restrict this based on your app)
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT USING (true);

-- Policy to allow authenticated users to insert their own profile.
-- This is typically handled by a trigger from auth.users insert,
-- but this policy ensures security if inserts happen elsewhere.
CREATE POLICY "Authenticated users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy to allow users to update their own profile.
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id); -- Restrict updates to their own profile
  -- Optional: WITH CHECK (auth.uid() = id); -- Also check on the data being inserted/updated

-- Policy to allow users to delete their own profile.
-- This is often handled by ON DELETE CASCADE from auth.users,
-- but this policy provides a direct way if needed.
CREATE POLICY "Users can delete own profile."
  ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Optional: Create a function to automatically create a profile entry for new users
-- This function is triggered after a new user is inserted into auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
begin
  insert into public.profiles (id)
  values (new.id); -- Insert the new user's auth.uid into the profiles table
  return new;
end;
$$ language plpgsql security definer;

-- Optional: Create a trigger to call the handle_new_user function
-- after a new row is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; -- Drop if exists to avoid errors
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE procedure public.handle_new_user();


-- trainers referencing profiles.id (formerly users.id)
CREATE TABLE IF NOT EXISTS public.trainers (
  id BIGSERIAL PRIMARY KEY,
  user_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Reference the new profiles table
  map TEXT NOT NULL,
  file_key TEXT NOT NULL,
  laptime  DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trainers RLS
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to insert their own trainers
CREATE POLICY "Users can insert their own trainers"
  ON public.trainers FOR INSERT
  WITH CHECK ( user_id = auth.uid() );

-- Policy to allow users to view their own trainers and potentially others' if needed (adjust SELECT policy)
-- For now, assuming users can only see their own trainers based on the RLS below
CREATE POLICY "Users can view their own trainers"
  ON public.trainers FOR SELECT
  USING ( user_id = auth.uid() ); -- Or USING (true) if you want all trainers public

-- Policy to allow users to update their own trainers
CREATE POLICY "Users can update their own trainers"
  ON public.trainers FOR UPDATE
  USING ( user_id = auth.uid() );

-- Policy to allow users to delete their own trainers
CREATE POLICY "Users can delete their own trainers"
  ON public.trainers FOR DELETE
  USING ( user_id = auth.uid() );