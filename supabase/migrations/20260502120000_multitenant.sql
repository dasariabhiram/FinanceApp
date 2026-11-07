-- Multi-tenant SaaS: organizations, memberships, platform admins, org-scoped data

create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.org_memberships (
  org_id uuid not null references app.organizations (id) on delete cascade,
  user_id uuid not null references app.profiles (id) on delete cascade,
  role text not null check (role in ('org_owner', 'org_member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_memberships_user_id_idx on app.org_memberships (user_id);

create table if not exists app.platform_admins (
  user_id uuid primary key references app.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table app.accounts add column if not exists org_id uuid references app.organizations (id) on delete cascade;
alter table app.transactions add column if not exists org_id uuid references app.organizations (id) on delete cascade;
alter table app.budgets add column if not exists org_id uuid references app.organizations (id) on delete cascade;

do $$
declare
  r record;
  new_org uuid;
  slug_base text;
  slug_final text;
begin
  for r in select p.id, p.email from app.profiles p loop
    if exists (select 1 from app.org_memberships m where m.user_id = r.id) then
      continue;
    end if;
    slug_base := lower(regexp_replace(split_part(coalesce(r.email, r.id::text), '@', 1), '[^a-z0-9]+', '-', 'g'));
    if slug_base = '' then slug_base := 'user'; end if;
    slug_final := slug_base || '-' || substr(replace(r.id::text, '-', ''), 1, 8);
    insert into app.organizations (name, slug)
    values (coalesce(split_part(r.email, '@', 1), 'Personal'), slug_final)
    returning id into new_org;
    insert into app.org_memberships (org_id, user_id, role)
    values (new_org, r.id, 'org_owner');
    update app.accounts set org_id = new_org where user_id = r.id and org_id is null;
    update app.transactions set org_id = new_org where user_id = r.id and org_id is null;
    update app.budgets set org_id = new_org where user_id = r.id and org_id is null;
  end loop;
end $$;

alter table app.accounts alter column org_id set not null;
alter table app.transactions alter column org_id set not null;

create index if not exists accounts_org_id_idx on app.accounts (org_id);
create index if not exists transactions_org_id_idx on app.transactions (org_id, occurred_on desc);
create index if not exists budgets_org_id_idx on app.budgets (org_id);

drop index if exists app.transactions_user_idempotency_uidx;
create unique index if not exists transactions_org_idempotency_uidx
  on app.transactions (org_id, idempotency_key);

alter table app.budgets drop constraint if exists budgets_user_id_key;
create unique index if not exists budgets_org_id_uidx on app.budgets (org_id) where org_id is not null;

create or replace function app.is_org_member(check_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, auth
as $$
  select exists (
    select 1 from app.org_memberships m
    where m.org_id = check_org_id and m.user_id = (select auth.uid())
  );
$$;

alter table app.organizations enable row level security;
alter table app.organizations force row level security;
alter table app.org_memberships enable row level security;
alter table app.org_memberships force row level security;
alter table app.platform_admins enable row level security;
alter table app.platform_admins force row level security;

create policy organizations_member_select on app.organizations
  for select using (app.is_org_member(id));

create policy org_memberships_own on app.org_memberships
  for select using (user_id = (select auth.uid()));

create policy platform_admins_self on app.platform_admins
  for select using (user_id = (select auth.uid()));

drop policy if exists accounts_own on app.accounts;
create policy accounts_org on app.accounts
  for all using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

drop policy if exists transactions_own on app.transactions;
create policy transactions_org on app.transactions
  for all using (app.is_org_member(org_id))
  with check (app.is_org_member(org_id));

drop policy if exists budgets_own on app.budgets;
create policy budgets_org on app.budgets
  for all using (org_id is not null and app.is_org_member(org_id))
  with check (org_id is not null and app.is_org_member(org_id));

grant select on app.organizations to authenticated;
grant select on app.org_memberships to authenticated;
grant select on app.platform_admins to authenticated;
