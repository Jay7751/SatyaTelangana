-- =====================================================
-- Satya Telangana — Supabase Database Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'journalist', 'admin')),
  isapproved BOOLEAN NOT NULL DEFAULT true,
  createdat  TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ARTICLES
CREATE TABLE IF NOT EXISTS public.articles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headline         TEXT NOT NULL,
  summary          TEXT NOT NULL,
  content          TEXT,
  category         TEXT NOT NULL,
  image_url        TEXT,
  image_path       TEXT,
  source_url       TEXT,
  source_link      TEXT,
  author_id        UUID REFERENCES public.users(id),
  author_name      TEXT,
  journalist_id    UUID REFERENCES public.users(id),
  journalist_name  TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','published')),
  rejectionreason  TEXT,
  is_breaking_news BOOLEAN DEFAULT false,
  likes_count      INTEGER DEFAULT 0,
  dislikes_count   INTEGER DEFAULT 0,
  shares_count     INTEGER DEFAULT 0,
  views_count      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ENGAGEMENTS (likes, dislikes, bookmarks, shares, views)
CREATE TABLE IF NOT EXISTS public.engagements (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('like','dislike','bookmark','share','view')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id, type)
);

-- REACTIONS (mirrors engagements per app design)
CREATE TABLE IF NOT EXISTS public.reactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id, type)
);

-- Counter increment stored procedure
CREATE OR REPLACE FUNCTION increment_article_counter(p_article_id UUID, p_column_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.articles SET %I = %I + 1 WHERE id = $1',
    p_column_name, p_column_name
  ) USING p_article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions   ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Read all profiles"      ON public.users FOR SELECT USING (true);
CREATE POLICY "Insert own profile"     ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile"     ON public.users FOR UPDATE USING (auth.uid() = id);

-- Articles policies
CREATE POLICY "Anyone reads approved"
  ON public.articles FOR SELECT USING (status IN ('approved','published'));

CREATE POLICY "Admins read all"
  ON public.articles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Journalists insert"
  ON public.articles FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'journalist')
  );

CREATE POLICY "Admins update any"
  ON public.articles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Journalists update own pending"
  ON public.articles FOR UPDATE
  USING (
    auth.uid() = author_id AND status = 'pending' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'journalist')
  );

-- Engagements policies
CREATE POLICY "Own engagements"
  ON public.engagements FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reactions policies
CREATE POLICY "Own reactions"
  ON public.reactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone views images"
  ON storage.objects FOR SELECT USING (bucket_id = 'article-images');

CREATE POLICY "Journalists upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'article-images' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('journalist','admin'))
  );

CREATE POLICY "Users delete own images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'article-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- AFTER RUNNING THIS SCHEMA:
-- 1. Sign up in the app with your admin email
-- 2. Run this to make yourself admin:
--    UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
-- 3. Log out and back in — the Admin tab will appear
-- =====================================================
