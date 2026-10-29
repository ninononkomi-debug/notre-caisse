-- =====================================================================
-- NOTRE CAISSE — Correctif 2 : notifications push (OneSignal)
-- Envoie une notification sur les téléphones, même application fermée :
--  • demande d'adhésion        → trésorières
--  • nouveau dépôt à valider   → trésorières
--  • dépôt validé              → toute la famille (avec le nouveau montant en caisse)
--  • dépôt refusé              → la personne qui l'a envoyé
--  • sortie d'argent           → toute la famille
--  • nouvelle annonce          → toute la famille
--  • adhésion acceptée         → le nouveau membre
--
-- AVANT DE LANCER : dans la ligne « values » plus bas, remplacez le texte
-- COLLEZ… par la clé « App API Key » de OneSignal (garder les apostrophes).
-- Puis Supabase > SQL Editor > Run.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_config (
  id int primary key default 1 check (id = 1),
  app_id text not null,
  api_key text not null
);
insert into private.push_config (id, app_id, api_key)
values (1, '__ONESIGNAL_APP_ID__', 'COLLEZ_LA_CLE_API_ICI')
on conflict (id) do update set app_id = excluded.app_id, api_key = excluded.api_key;

-- ---------- Envoi ----------
create or replace function private.push(p_users uuid[], p_title text, p_body text)
returns void language plpgsql security definer set search_path = public, private, extensions as $$
declare cfg private.push_config; ids text[];
begin
  select * into cfg from private.push_config where id = 1;
  if cfg.app_id is null or cfg.api_key like 'COLLEZ%' then return; end if;
  select array_agg(distinct u::text) into ids from unnest(p_users) u where u is not null;
  if ids is null or array_length(ids, 1) = 0 then return; end if;
  perform net.http_post(
    url := 'https://api.onesignal.com/notifications?c=push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Key ' || cfg.api_key),
    body := jsonb_build_object(
      'app_id', cfg.app_id,
      'target_channel', 'push',
      'include_aliases', jsonb_build_object('external_id', to_jsonb(ids)),
      'headings', jsonb_build_object('en', p_title, 'fr', p_title),
      'contents', jsonb_build_object('en', p_body, 'fr', p_body),
      'android_accent_color', 'FF7A1E3A'
    )
  );
exception when others then
  raise warning 'push: %', sqlerrm;   -- ne jamais bloquer l'action de l'utilisateur
end $$;

create or replace function private.fcfa(n numeric)
returns text language sql immutable as $$ select replace(to_char(round(coalesce(n, 0)), 'FM999,999,999,990'), ',', ' ') || ' F' $$;

create or replace function private.treasurers(cid uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from public.members where caisse_id = cid and active and role = 'tresoriere' and user_id is not null;
$$;
create or replace function private.everyone(cid uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from public.members where caisse_id = cid and active and user_id is not null;
$$;
create or replace function private.balance(cid uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select c.initial_balance
       + coalesce((select sum(amount) from public.deposits d where d.caisse_id = cid and d.status = 'valide'), 0)
       - coalesce((select sum(amount) from public.withdrawals w where w.caisse_id = cid), 0)
  from public.caisses c where c.id = cid;
$$;
create or replace function private.mname(mid uuid)
returns text language sql stable security definer set search_path = public as $$
  select display_name from public.members where id = mid;
$$;
create or replace function private.without(arr uuid[], u uuid)
returns uuid[] language sql immutable as $$ select coalesce(array_agg(x), '{}') from unnest(arr) x where x is distinct from u $$;

-- ---------- Membres : demande d'adhésion / acceptation ----------
create or replace function private.on_member()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.pending_user_id is not null and (tg_op = 'INSERT' or old.pending_user_id is distinct from new.pending_user_id) then
    perform private.push(private.treasurers(new.caisse_id), 'Nouvelle demande d''adhésion ✋',
      new.display_name || ' veut rejoindre la caisse. Ouvrez Plus › Demandes d''adhésion pour accepter.');
  end if;
  if tg_op = 'UPDATE' and old.user_id is null and new.user_id is not null then
    perform private.push(array[new.user_id], 'Bienvenue dans la caisse 💛',
      'Votre demande a été acceptée. Vous pouvez maintenant voir la caisse et déclarer vos dépôts.');
  end if;
  return new;
end $$;
drop trigger if exists push_member on public.members;
create trigger push_member after insert or update on public.members
  for each row execute function private.on_member();

-- ---------- Dépôts ----------
create or replace function private.on_deposit()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare who text;
begin
  who := private.mname(new.member_id) || coalesce(' et ' || private.mname(new.split_with), '');
  if tg_op = 'INSERT' then
    perform private.push(private.without(private.treasurers(new.caisse_id), new.submitted_by),
      'Nouveau dépôt à valider 💰', who || ' a déclaré ' || private.fcfa(new.amount) || '. Vérifiez la capture et validez.');
  elsif old.status is distinct from new.status then
    if new.status = 'valide' then
      perform private.push(private.everyone(new.caisse_id), 'Nouveau dépôt validé ✅',
        who || ' a cotisé ' || private.fcfa(new.amount) || '. Montant en caisse : ' || private.fcfa(private.balance(new.caisse_id)) || '.');
    elsif new.status = 'rejete' then
      perform private.push(array[new.submitted_by], 'Dépôt refusé',
        'Votre dépôt de ' || private.fcfa(new.amount) || ' a été refusé' || coalesce(' : ' || new.reject_reason, '') || '. Ouvrez l''application.');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists push_deposit on public.deposits;
create trigger push_deposit after insert or update on public.deposits
  for each row execute function private.on_deposit();

-- ---------- Sorties d'argent ----------
create or replace function private.on_withdrawal()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  perform private.push(private.everyone(new.caisse_id), 'Sortie de caisse 📤',
    new.motif || ' : ' || private.fcfa(new.amount) || '. Montant en caisse : ' || private.fcfa(private.balance(new.caisse_id)) || '.');
  return new;
end $$;
drop trigger if exists push_withdrawal on public.withdrawals;
create trigger push_withdrawal after insert on public.withdrawals
  for each row execute function private.on_withdrawal();

-- ---------- Annonces ----------
create or replace function private.on_announcement()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  perform private.push(private.without(private.everyone(new.caisse_id), new.author),
    'Annonce : ' || new.title, coalesce(left(new.body, 140), 'Nouvelle annonce de la famille'));
  return new;
end $$;
drop trigger if exists push_announcement on public.announcements;
create trigger push_announcement after insert on public.announcements
  for each row execute function private.on_announcement();

-- Vérification : la ligne doit afficher votre App ID et « clé enregistrée »
select app_id, case when api_key like 'COLLEZ%' then 'CLÉ MANQUANTE' else 'clé enregistrée' end as cle
from private.push_config;
