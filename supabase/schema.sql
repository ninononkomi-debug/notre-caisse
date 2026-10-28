-- =====================================================================
-- NOTRE CAISSE — Base de données Supabase
-- À coller en entier dans Supabase > SQL Editor > New query > Run
-- (peut être relancé sans risque)
-- =====================================================================

-- ---------- Profils ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- La caisse (le groupe) ----------
create table if not exists public.caisses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  initial_balance numeric not null default 0,
  initial_date date not null default current_date,
  start_month text not null,                         -- 'YYYY-MM' : premier mois suivi dans l'appli
  settings jsonb not null default '{}'::jsonb,       -- montants, numéros de dépôt, jour limite, publicité
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Membres ----------
-- user_id : compte relié ; pending_user_id : demande d'adhésion en attente
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  caisse_id uuid not null references public.caisses on delete cascade,
  display_name text not null,
  user_id uuid references auth.users on delete set null,
  pending_user_id uuid references auth.users on delete set null,
  role text not null default 'membre' check (role in ('membre','tresoriere')),
  category text not null default 'travailleur',      -- travailleur | sans_emploi | couple | autre
  custom_amount numeric,                              -- montant mensuel particulier (sinon selon catégorie)
  couple_with uuid references public.members on delete set null,
  start_month text,                                   -- sinon celui de la caisse
  opening_due numeric not null default 0,             -- retard au départ (FCFA)
  active boolean not null default true,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists members_caisse_idx on public.members (caisse_id);
create unique index if not exists members_user_unique on public.members (caisse_id, user_id) where user_id is not null;

-- ---------- Versements ----------
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  caisse_id uuid not null references public.caisses on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  split_with uuid references public.members on delete set null,  -- versement pour le couple : partagé en 2
  amount numeric not null check (amount > 0),
  operator text,
  sender_phone text,
  reference text,
  note text,
  proof_path text not null,                                      -- capture obligatoire
  status text not null default 'en_attente' check (status in ('en_attente','valide','rejete')),
  reject_reason text,
  submitted_by uuid not null default auth.uid() references auth.users on delete set null,
  validated_by uuid references auth.users on delete set null,
  validated_at timestamptz,
  paid_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists deposits_caisse_idx on public.deposits (caisse_id, created_at desc);

-- ---------- Sorties d'argent ----------
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  caisse_id uuid not null references public.caisses on delete cascade,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  category text not null default 'aide',
  motif text not null,
  beneficiary text,
  proof_path text,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Annonces ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  caisse_id uuid not null references public.caisses on delete cascade,
  author uuid default auth.uid() references auth.users on delete set null,
  kind text not null default 'info',
  title text not null,
  body text,
  image_path text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Fonctions de contrôle ----------
create or replace function public.is_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where caisse_id = cid and user_id = auth.uid() and active);
$$;
create or replace function public.is_treasurer(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where caisse_id = cid and user_id = auth.uid() and active and role = 'tresoriere');
$$;
create or replace function public.is_pending(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where caisse_id = cid and pending_user_id = auth.uid());
$$;
create or replace function public.shares_caisse(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members a join public.members b on a.caisse_id = b.caisse_id
                 where a.user_id = auth.uid() and a.active
                   and (b.user_id = other or b.pending_user_id = other));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un membre ne peut pas valider lui-même : statut forcé à « en attente » à l'envoi
create or replace function public.deposits_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'en_attente';
    new.validated_by := null;
    new.validated_at := null;
    new.submitted_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    if new.status <> old.status and new.status in ('valide','rejete') then
      new.validated_by := auth.uid();
      new.validated_at := now();
    end if;
    new.submitted_by := old.submitted_by;
    new.caisse_id := old.caisse_id;
  end if;
  return new;
end $$;
drop trigger if exists deposits_guard on public.deposits;
create trigger deposits_guard before insert or update on public.deposits
  for each row execute function public.deposits_guard();

-- ---------- Créer la caisse / rejoindre / accepter ----------
create or replace function public.create_caisse(p_name text, p_member_name text, p_start_month text)
returns public.caisses language plpgsql security definer set search_path = public as $$
declare c public.caisses; code text;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.caisses where invite_code = code);
  end loop;
  insert into public.caisses (name, invite_code, start_month, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Notre caisse'), code, p_start_month, auth.uid()) returning * into c;
  insert into public.members (caisse_id, display_name, user_id, role)
  values (c.id, coalesce(nullif(trim(p_member_name), ''), 'Trésorière'), auth.uid(), 'tresoriere');
  return c;
end $$;

-- liste des noms pas encore reliés à un compte (pour « Je suis… »)
create or replace function public.caisse_preview(p_code text)
returns table (caisse_id uuid, caisse_name text, member_id uuid, member_name text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, m.id, m.display_name
  from public.caisses c left join public.members m
    on m.caisse_id = c.id and m.user_id is null and m.pending_user_id is null and m.active
  where c.invite_code = upper(trim(p_code));
$$;

create or replace function public.join_caisse(p_code text, p_member_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.caisses; mid uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into c from public.caisses where invite_code = upper(trim(p_code));
  if c.id is null then raise exception 'Code invalide'; end if;
  if exists (select 1 from public.members where caisse_id = c.id and user_id = auth.uid()) then
    raise exception 'Déjà membre';
  end if;
  update public.members set pending_user_id = null where caisse_id = c.id and pending_user_id = auth.uid();
  if p_member_id is not null then
    update public.members set pending_user_id = auth.uid()
     where id = p_member_id and caisse_id = c.id and user_id is null and pending_user_id is null
     returning id into mid;
    if mid is null then raise exception 'Ce nom est déjà pris'; end if;
  else
    insert into public.members (caisse_id, display_name, pending_user_id, active)
    values (c.id, coalesce(nullif(trim(p_name), ''), 'Nouveau membre'), auth.uid(), true) returning id into mid;
  end if;
  return mid;
end $$;

create or replace function public.approve_member(p_member_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m public.members;
begin
  select * into m from public.members where id = p_member_id;
  if m.id is null or not public.is_treasurer(m.caisse_id) then raise exception 'Accès refusé'; end if;
  if p_accept then
    update public.members set user_id = pending_user_id, pending_user_id = null where id = p_member_id;
  elsif m.user_id is null and not exists (select 1 from public.deposits where member_id = m.id) and m.created_at > now() - interval '1 day' then
    delete from public.members where id = p_member_id;   -- demande d'un inconnu : supprimée
  else
    update public.members set pending_user_id = null where id = p_member_id;
  end if;
end $$;

create or replace function public.renew_code(p_caisse uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_treasurer(p_caisse) then raise exception 'Accès refusé'; end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  update public.caisses set invite_code = code where id = p_caisse;
  return code;
end $$;

revoke all on function public.create_caisse(text, text, text) from anon;
revoke all on function public.join_caisse(text, uuid, text) from anon;
revoke all on function public.approve_member(uuid, boolean) from anon;
revoke all on function public.renew_code(uuid) from anon;
revoke all on function public.caisse_preview(text) from anon;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.caisses enable row level security;
alter table public.members enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.announcements enable row level security;

drop policy if exists p_profiles_sel on public.profiles;
create policy p_profiles_sel on public.profiles for select to authenticated using (id = auth.uid() or public.shares_caisse(id));
drop policy if exists p_profiles_ins on public.profiles;
create policy p_profiles_ins on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists p_caisses_sel on public.caisses;
create policy p_caisses_sel on public.caisses for select to authenticated using (public.is_member(id) or public.is_pending(id));
drop policy if exists p_caisses_upd on public.caisses;
create policy p_caisses_upd on public.caisses for update to authenticated using (public.is_treasurer(id)) with check (public.is_treasurer(id));

drop policy if exists p_members_sel on public.members;
create policy p_members_sel on public.members for select to authenticated
  using (public.is_member(caisse_id) or pending_user_id = auth.uid());
drop policy if exists p_members_ins on public.members;
create policy p_members_ins on public.members for insert to authenticated with check (public.is_treasurer(caisse_id));
drop policy if exists p_members_upd on public.members;
create policy p_members_upd on public.members for update to authenticated
  using (public.is_treasurer(caisse_id)) with check (public.is_treasurer(caisse_id));
drop policy if exists p_members_del on public.members;
create policy p_members_del on public.members for delete to authenticated using (public.is_treasurer(caisse_id));

drop policy if exists p_dep_sel on public.deposits;
create policy p_dep_sel on public.deposits for select to authenticated using (public.is_member(caisse_id));
drop policy if exists p_dep_ins on public.deposits;
create policy p_dep_ins on public.deposits for insert to authenticated with check (public.is_member(caisse_id));
drop policy if exists p_dep_upd on public.deposits;
create policy p_dep_upd on public.deposits for update to authenticated
  using (public.is_treasurer(caisse_id) or (submitted_by = auth.uid() and status = 'en_attente'))
  with check (public.is_treasurer(caisse_id) or status = 'en_attente');
drop policy if exists p_dep_del on public.deposits;
create policy p_dep_del on public.deposits for delete to authenticated
  using (public.is_treasurer(caisse_id) or (submitted_by = auth.uid() and status = 'en_attente'));

drop policy if exists p_wd_sel on public.withdrawals;
create policy p_wd_sel on public.withdrawals for select to authenticated using (public.is_member(caisse_id));
drop policy if exists p_wd_all on public.withdrawals;
create policy p_wd_all on public.withdrawals for all to authenticated
  using (public.is_treasurer(caisse_id)) with check (public.is_treasurer(caisse_id));

drop policy if exists p_ann_sel on public.announcements;
create policy p_ann_sel on public.announcements for select to authenticated using (public.is_member(caisse_id));
drop policy if exists p_ann_ins on public.announcements;
create policy p_ann_ins on public.announcements for insert to authenticated with check (public.is_member(caisse_id) and author = auth.uid());
drop policy if exists p_ann_upd on public.announcements;
create policy p_ann_upd on public.announcements for update to authenticated
  using (author = auth.uid() or public.is_treasurer(caisse_id)) with check (public.is_member(caisse_id));
drop policy if exists p_ann_del on public.announcements;
create policy p_ann_del on public.announcements for delete to authenticated
  using (author = auth.uid() or public.is_treasurer(caisse_id));

-- ---------- Temps réel ----------
do $$ begin alter publication supabase_realtime add table public.deposits; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.members; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.announcements; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.withdrawals; exception when others then null; end $$;

-- ---------- Stockage des captures et images ----------
-- chemin : <caisse_id>/<user_id>/<fichier>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('preuves', 'preuves', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists st_preuves_ins on storage.objects;
create policy st_preuves_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'preuves' and (storage.foldername(name))[2] = auth.uid()::text
              and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists st_preuves_sel on storage.objects;
create policy st_preuves_sel on storage.objects for select to authenticated
  using (bucket_id = 'preuves' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists st_preuves_del on storage.objects;
create policy st_preuves_del on storage.objects for delete to authenticated
  using (bucket_id = 'preuves' and ((storage.foldername(name))[2] = auth.uid()::text
         or public.is_treasurer(((storage.foldername(name))[1])::uuid)));
