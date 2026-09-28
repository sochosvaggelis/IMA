-- Content backend for imagreece.gr: the projects and spare-parts collections
-- the admin panel edits, the photo bucket, and the rules deciding who may do
-- what with them.
--
-- There is no server of ours in front of this database. The public site and
-- the admin panel both talk to Supabase's REST API straight from the browser,
-- carrying the PUBLIC key — so these row-level-security policies are the whole
-- of the security model, not a second layer behind one. Read them as such.
--
--   anon (every visitor)   reads published rows. Nothing else.
--   authenticated          reads published rows. Being logged in grants
--                          nothing by itself…
--   … listed in admins     reads drafts too, and writes everything.
--
-- The admins table is what makes the last line hold even if public sign-up is
-- ever switched on by mistake: a stranger who registers is `authenticated`,
-- but not an admin.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Deliberately no insert/update/delete policy: membership is granted from the
-- Supabase SQL editor (which runs as the table owner), never from the browser.
-- The one thing the admin panel needs is to ask "am I on the list?".
create policy "Users can see their own admin membership"
  on public.admins for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.admins from anon, authenticated;
grant select on table public.admins to authenticated;

-- SECURITY DEFINER so it can read admins regardless of the caller's own
-- grants — the policies below call it for visitors who have no access to that
-- table at all. The empty search_path is what makes a definer function safe:
-- every name inside is schema-qualified, so a caller cannot shadow one.
create function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  )
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared plumbing
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Projects — the case studies on /projects (and the first two on the home page)
-- ---------------------------------------------------------------------------

-- The three service levels on /services. A project's badge is picked from
-- these rather than typed, so it is translated by the site's own dictionaries
-- and cannot drift from the services page.
create type public.service_level as enum ('component', 'systems', 'retrofit');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  -- Display order, ascending. New rows are given one less than the current
  -- minimum, so they land at the top.
  position integer not null default 0,
  published boolean not null default false,
  scope public.service_level not null default 'systems',

  -- Every text field exists once per language. An empty one falls back to the
  -- other language on the site, so a Greek-only draft still renders.
  title_el text not null default '',
  title_en text not null default '',
  vessel_el text not null default '',
  vessel_en text not null default '',
  location_el text not null default '',
  location_en text not null default '',
  problem_el text not null default '',
  problem_en text not null default '',
  solution_el text not null default '',
  solution_en text not null default '',
  downtime_el text not null default '',
  downtime_en text not null default '',

  -- [{ "full": "projects/<uuid>.webp", "thumb": "projects/<uuid>-thumb.webp",
  --    "w": 2000, "h": 1500 }, …] — paths inside the media bucket; the first
  -- entry is the cover.
  photos jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint projects_photos_is_array check (jsonb_typeof(photos) = 'array'),
  constraint projects_has_title check (title_el <> '' or title_en <> '')
);

create index projects_listing on public.projects (published, position);

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Spare parts — the photo showcase of units repaired in the workshop
-- ---------------------------------------------------------------------------

create table public.spare_parts (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  published boolean not null default false,

  title_el text not null default '',
  title_en text not null default '',
  -- Not translated: a maker's name and a part number read the same in both
  -- languages.
  manufacturer text not null default '',
  model text not null default '',
  description_el text not null default '',
  description_en text not null default '',

  photos jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint spare_parts_photos_is_array check (jsonb_typeof(photos) = 'array'),
  constraint spare_parts_has_title check (title_el <> '' or title_en <> '')
);

create index spare_parts_listing on public.spare_parts (published, position);

create trigger spare_parts_touch_updated_at
  before update on public.spare_parts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access rules for both collections
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.spare_parts enable row level security;

-- Grants first: RLS filters rows, but only once a role may touch the table at
-- all. Spelled out rather than trusting the project's default privileges, so
-- anon can never write here even if a policy is got wrong later.
revoke all on table public.projects, public.spare_parts from anon, authenticated;
grant select on table public.projects, public.spare_parts to anon, authenticated;
grant insert, update, delete on table public.projects, public.spare_parts to authenticated;

create policy "Visitors read published projects"
  on public.projects for select to anon
  using (published);

create policy "Signed-in users read published projects, admins read all"
  on public.projects for select to authenticated
  using (published or (select public.is_admin()));

create policy "Admins create projects"
  on public.projects for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit projects"
  on public.projects for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete projects"
  on public.projects for delete to authenticated
  using ((select public.is_admin()));

create policy "Visitors read published spare parts"
  on public.spare_parts for select to anon
  using (published);

create policy "Signed-in users read published spare parts, admins read all"
  on public.spare_parts for select to authenticated
  using (published or (select public.is_admin()));

create policy "Admins create spare parts"
  on public.spare_parts for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit spare parts"
  on public.spare_parts for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete spare parts"
  on public.spare_parts for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Photo storage
-- ---------------------------------------------------------------------------

-- Public bucket: anyone can fetch a photo by its URL (that is the point of a
-- showcase), with no policy needed for it. The size and type limits are a
-- backstop — the admin panel already shrinks every photo to a few hundred KB
-- of WebP or JPEG in the browser before it uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Admins upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));

-- Storage's delete endpoint needs select as well as delete on the object.
create policy "Admins see media objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

create policy "Admins replace media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

create policy "Admins delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
