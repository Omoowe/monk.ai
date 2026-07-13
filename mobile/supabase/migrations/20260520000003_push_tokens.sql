-- Store Expo push token per user
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
