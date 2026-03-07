-- High day scheduling columns for profiles table
-- Run in Supabase SQL Editor — safe to run multiple times (IF NOT EXISTS)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_day_schedule    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_day_weekdays    text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_day_interval    integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_day_start_date  date;
