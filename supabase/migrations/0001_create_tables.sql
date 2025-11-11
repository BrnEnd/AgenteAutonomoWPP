create extension if not exists "pgcrypto";

create table if not exists sessions (
  session_id text primary key,
  display_name text,
  context text,
  status text not null default 'created',
  tokens_path text,
  auto_restart boolean not null default true,
  last_qr text,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references sessions(session_id) on delete cascade,
  direction text not null check (direction in ('incoming', 'outgoing')),
  remote_jid text not null,
  body text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists events (
  id bigserial primary key,
  session_id text references sessions(session_id) on delete cascade,
  type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_messages_session_id on messages(session_id);
create index if not exists idx_events_session_id on events(session_id);
