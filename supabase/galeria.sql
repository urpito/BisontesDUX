-- ============================================================
-- BISONTES DUX — Galería de fotos (Supabase)
-- ------------------------------------------------------------
-- Pégalo entero en Supabase → SQL Editor → Run.
-- Se puede volver a ejecutar sin perder fotos ni cuentas.
--
-- Quién puede hacer qué (lo impone la base de datos, no la web):
--   · Cualquiera: ver las fotos marcadas como públicas.
--   · Jugadores, invitados con acceso vigente y admins: ver todas.
--   · Admins: subir, editar, publicar, borrar y gestionar accesos.
--   · Cuentas pendientes, caducadas o sin acceso: nada privado.
-- ============================================================


-- 1. ACCESOS: una fila por cuenta, se crea sola al registrarse ----
create table if not exists public.gallery_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text,
  player_slug text,              -- ficha asociada (jugadores/<slug>/): filtro «Solo mis fotos»
  role        text not null default 'pending'
              check (role in ('pending', 'player', 'guest', 'admin', 'blocked')),
  expires_at  timestamptz,       -- acceso puntual: deja de ver fotos a partir de aquí
  created_at  timestamptz not null default now()
);


-- 2. FOTOS ---------------------------------------------------------
create table if not exists public.gallery_photos (
  id          uuid primary key default gen_random_uuid(),
  full_path   text not null,     -- archivo grande dentro del bucket
  thumb_path  text not null,     -- miniatura
  width       integer,
  height      integer,
  event       text,              -- p. ej. «Jornada 3 · Bisontes DUX – Rival»
  taken_on    date,
  caption     text,
  players     text[] not null default '{}',   -- slugs de las fichas que salen
  is_public   boolean not null default false, -- destacada: sale en /galeria/
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists gallery_photos_public_idx  on public.gallery_photos (is_public, taken_on desc);
create index if not exists gallery_photos_players_idx on public.gallery_photos using gin (players);


-- 3. ¿QUÉ PUEDE HACER QUIEN PREGUNTA? -------------------------------
-- security definer: las políticas pueden leer gallery_members sin
-- que esa tabla quede abierta.
create or replace function public.gallery_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.gallery_members m
  where m.user_id = auth.uid()
    and m.role in ('player', 'guest', 'admin')
    and (m.expires_at is null or m.expires_at > now())
$$;

create or replace function public.gallery_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.gallery_role() is not null
$$;

create or replace function public.gallery_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.gallery_role() = 'admin', false)
$$;


-- 4. ALTA AUTOMÁTICA AL REGISTRARSE (queda «pendiente») -------------
create or replace function public.gallery_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.gallery_members (user_id, email, name, player_slug)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'player_slug'), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.gallery_handle_new_user() from public, anon, authenticated;

drop trigger if exists gallery_on_auth_user_created on auth.users;
create trigger gallery_on_auth_user_created
  after insert on auth.users
  for each row execute function public.gallery_handle_new_user();

-- Cuentas que ya existieran antes de este script.
insert into public.gallery_members (user_id, email, name, player_slug)
select u.id,
       coalesce(u.email, ''),
       nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
       nullif(trim(u.raw_user_meta_data ->> 'player_slug'), '')
from auth.users u
on conflict (user_id) do nothing;


-- 5. PERMISOS DE LAS TABLAS (RLS) ------------------------------------
alter table public.gallery_members enable row level security;
alter table public.gallery_photos  enable row level security;

revoke all on public.gallery_members from anon, authenticated;
grant select, delete on public.gallery_members to authenticated;
grant update (name, player_slug, role, expires_at) on public.gallery_members to authenticated;

revoke all on public.gallery_photos from anon, authenticated;
grant select on public.gallery_photos to anon, authenticated;
grant insert, update, delete on public.gallery_photos to authenticated;

drop policy if exists gallery_members_select on public.gallery_members;
create policy gallery_members_select on public.gallery_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.gallery_is_admin()));

drop policy if exists gallery_members_update on public.gallery_members;
create policy gallery_members_update on public.gallery_members
  for update to authenticated
  using ((select public.gallery_is_admin()))
  with check ((select public.gallery_is_admin()));

drop policy if exists gallery_members_delete on public.gallery_members;
create policy gallery_members_delete on public.gallery_members
  for delete to authenticated
  using ((select public.gallery_is_admin()));

drop policy if exists gallery_photos_select on public.gallery_photos;
create policy gallery_photos_select on public.gallery_photos
  for select to anon, authenticated
  using (is_public or (select public.gallery_is_member()));

drop policy if exists gallery_photos_insert on public.gallery_photos;
create policy gallery_photos_insert on public.gallery_photos
  for insert to authenticated
  with check ((select public.gallery_is_admin()));

drop policy if exists gallery_photos_update on public.gallery_photos;
create policy gallery_photos_update on public.gallery_photos
  for update to authenticated
  using ((select public.gallery_is_admin()))
  with check ((select public.gallery_is_admin()));

drop policy if exists gallery_photos_delete on public.gallery_photos;
create policy gallery_photos_delete on public.gallery_photos
  for delete to authenticated
  using ((select public.gallery_is_admin()));


-- 6. ARCHIVOS: privado (todas las fotos) y público (copia de las destacadas)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('galeria-privada', 'galeria-privada', false, 10485760, array['image/jpeg', 'image/webp', 'image/png']),
  ('galeria-publica', 'galeria-publica', true,  10485760, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists galeria_privada_miembros on storage.objects;
create policy galeria_privada_miembros on storage.objects
  for select to authenticated
  using (bucket_id = 'galeria-privada' and (select public.gallery_is_member()));

drop policy if exists galeria_admins on storage.objects;
create policy galeria_admins on storage.objects
  for all to authenticated
  using (bucket_id in ('galeria-privada', 'galeria-publica') and (select public.gallery_is_admin()))
  with check (bucket_id in ('galeria-privada', 'galeria-publica') and (select public.gallery_is_admin()));


-- 7. CONTRASEÑA NUEVA PUESTA POR UN ADMIN ------------------------------
-- Sin servidor de correo propio, «he olvidado la contraseña» se
-- resuelve así: un admin pone una nueva y se la pasa al jugador.
create or replace function public.gallery_admin_set_password(target_user uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gallery_is_admin() then
    raise exception 'Solo un admin puede cambiar contraseñas' using errcode = '42501';
  end if;
  if new_password is null or length(new_password) < 8 then
    raise exception 'La contraseña tiene que tener al menos 8 caracteres' using errcode = '22023';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target_user;
  if not found then
    raise exception 'No existe esa cuenta' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.gallery_admin_set_password(uuid, text) from public, anon;
grant execute on function public.gallery_admin_set_password(uuid, text) to authenticated;


-- 8. PRIMER ADMIN --------------------------------------------------------
-- Después de crear tu cuenta en /galeria/privada/, ejecuta esta línea
-- con tu correo (quita los dos guiones del principio). Los demás admins
-- se nombran luego desde la propia web, en «Accesos».
-- update public.gallery_members set role = 'admin' where email = 'TU_CORREO@gmail.com';
