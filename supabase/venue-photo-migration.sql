-- ============================================================
-- VENUE PHOTO MIGRATION
-- Run this in the Supabase SQL editor on the live project.
-- Safe to run multiple times (ON CONFLICT / IF NOT EXISTS).
-- ============================================================

-- Public storage bucket for venue photos, uploaded by the server (service
-- role) after a signup succeeds — see app/api/owner/signup/route.ts. Public
-- so the photo can be shown on the venue's listing without a signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-photos', 'venue-photos', true, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

alter table venues add column if not exists photo_url text;
