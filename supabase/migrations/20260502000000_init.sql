-- FinanceApp initial schema (app schema + RLS)
create schema if not exists app;

create table if not exists app.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.profiles (id) on delete cascade,
  name text not null,
  type text not null,
  currency text not null default 'INR',
  balance_minor bigint not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on app.accounts (user_id);

create table if not exists app.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.profiles (id) on delete cascade,
  account_id uuid not null references app.accounts (id) on delete cascade,
  type text not null,
  amount_minor bigint not null,
  category text not null,
  description text,
  occurred_on date not null,
  status text not null default 'POSTED',
  idempotency_key text not null,
  transfer_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists transactions_user_idempotency_uidx
  on app.transactions (user_id, idempotency_key);
create index if not exists transactions_user_occurred_idx
  on app.transactions (user_id, occurred_on desc, id desc);
create index if not exists transactions_account_occurred_idx
  on app.transactions (account_id, occurred_on desc);

create table if not exists app.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references app.profiles (id) on delete cascade,
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = app, auth
as $$
begin
  insert into app.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

alter table app.profiles enable row level security;
alter table app.profiles force row level security;
alter table app.accounts enable row level security;
alter table app.accounts force row level security;
alter table app.transactions enable row level security;
alter table app.transactions force row level security;
alter table app.budgets enable row level security;
alter table app.budgets force row level security;

create policy profiles_own on app.profiles
  for all using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy accounts_own on app.accounts
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy transactions_own on app.transactions
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy budgets_own on app.budgets
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Keep app schema out of PostgREST Data API when possible:
-- Dashboard → Settings → API → Exposed schemas: remove `app` (leave public, graphql_public).
grant usage on schema app to authenticated;
grant select, insert, update, delete on all tables in schema app to authenticated;
