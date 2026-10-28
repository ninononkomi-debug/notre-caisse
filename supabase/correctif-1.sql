-- =====================================================================
-- NOTRE CAISSE — Correctif 1
-- 1) Garde UNE seule caisse : celle créée par Orly. Les caisses créées
--    par erreur (Nelle, Dane…) sont supprimées : ces personnes rejoindront
--    ensuite la vraie caisse avec le code.
-- 2) Empêche de créer une deuxième caisse à l'avenir.
-- À coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

do $$
declare keep uuid; n int;
begin
  select count(*) into n from public.caisses c
   where exists (select 1 from public.members m
                 where m.caisse_id = c.id and m.user_id = c.created_by and m.display_name ilike '%orly%');
  if n = 1 then
    select c.id into keep from public.caisses c
     where exists (select 1 from public.members m
                   where m.caisse_id = c.id and m.user_id = c.created_by and m.display_name ilike '%orly%');
  elsif n > 1 then
    -- plusieurs caisses créées par Orly : on garde la plus ancienne
    select c.id into keep from public.caisses c
     where exists (select 1 from public.members m
                   where m.caisse_id = c.id and m.user_id = c.created_by and m.display_name ilike '%orly%')
     order by c.created_at asc limit 1;
  else
    raise exception 'Aucune caisse créée par Orly trouvée : rien n''a été supprimé.';
  end if;
  delete from public.caisses where id <> keep;
  raise notice 'Caisse conservée : %', keep;
end $$;

-- Une seule caisse par base de données
create or replace function public.caisse_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.caisses);
$$;
grant execute on function public.caisse_exists() to authenticated;

create or replace function public.create_caisse(p_name text, p_member_name text, p_start_month text)
returns public.caisses language plpgsql security definer set search_path = public as $$
declare c public.caisses; code text;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from public.caisses) then raise exception 'Caisse existe déjà'; end if;
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

select c.name as caisse_conservee, c.invite_code as code_famille,
       (select count(*) from public.members m where m.caisse_id = c.id) as membres
from public.caisses c;
