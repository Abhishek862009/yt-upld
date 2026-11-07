-- ClipForge schema. Run this once in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  videos_used int not null default 0,
  period_start timestamptz not null default date_trunc('month', now()),
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('youtube', 'upload')),
  source_url text not null,
  title text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  stage text,
  error text,
  duration_sec int,
  created_at timestamptz not null default now()
);

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_sec numeric not null,
  end_sec numeric not null,
  title text not null,
  hook text,
  reason text,
  score int not null default 0,
  transcript text,
  video_url text,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.clips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok')),
  caption text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'posted', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists videos_user_idx on public.videos(user_id, created_at desc);
create index if not exists clips_video_idx on public.clips(video_id, score desc);
create index if not exists scheduled_due_idx on public.scheduled_posts(status, scheduled_at);

-- Row level security: users only see their own rows.
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.clips enable row level security;
alter table public.scheduled_posts enable row level security;

create policy "own profile" on public.profiles for select using (auth.uid() = id);
create policy "own videos" on public.videos for select using (auth.uid() = user_id);
create policy "own clips" on public.clips for select using (auth.uid() = user_id);
create policy "own posts" on public.scheduled_posts for select using (auth.uid() = user_id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage: create a PUBLIC bucket named "clips" in the Supabase dashboard
-- (Storage -> New bucket -> name: clips -> Public). The worker uploads rendered files there.
