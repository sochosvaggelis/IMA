-- The Greek ports listed on /coverage, each under "Permanent presence" or
-- "Regular coverage", moved out of the dictionaries so the admin panel can
-- edit them.
--
-- Not the globe: its routes to Rotterdam, Singapore, … are a drawing with
-- coordinates, in src/components/coverage/CoverageGlobe.tsx, and the page
-- itself calls them indicative. Nor the page's copy, which stays in the
-- dictionaries.
--
-- Same access rules as the other content tables; reuses is_admin() and
-- touch_updated_at() from 20260928120000_content.sql, which must run first.

create type public.coverage_tier as enum ('primary', 'secondary');

create table public.ports (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  published boolean not null default false,
  -- primary: "Permanent presence"; secondary: "Regular coverage".
  tier public.coverage_tier not null default 'secondary',

  -- The port's name, per language: Πειραιάς / Piraeus.
  title_el text not null default '',
  title_en text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ports_has_title check (title_el <> '' or title_en <> '')
);

create index ports_listing on public.ports (published, position);

create trigger ports_touch_updated_at
  before update on public.ports
  for each row execute function public.touch_updated_at();

alter table public.ports enable row level security;

revoke all on table public.ports from anon, authenticated;
grant select on table public.ports to anon, authenticated;
grant insert, update, delete on table public.ports to authenticated;

create policy "Visitors read published ports"
  on public.ports for select to anon
  using (published);

create policy "Signed-in users read published ports, admins read all"
  on public.ports for select to authenticated
  using (published or (select public.is_admin()));

create policy "Admins create ports"
  on public.ports for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit ports"
  on public.ports for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete ports"
  on public.ports for delete to authenticated
  using ((select public.is_admin()));

-- The nine ports the site launched with. Same ids as
-- src/content/snapshot/ports.json.
insert into public.ports (id, position, published, tier, title_el, title_en)
values
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f01', 1, true, 'primary', 'Πειραιάς', 'Piraeus'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f02', 2, true, 'primary', 'Ελευσίνα', 'Elefsina'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f03', 3, true, 'primary', 'Πέραμα', 'Perama'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f04', 4, true, 'primary', 'Σαλαμίνα', 'Salamina'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f05', 5, true, 'secondary', 'Θεσσαλονίκη', 'Thessaloniki'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f06', 6, true, 'secondary', 'Βόλος', 'Volos'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f07', 7, true, 'secondary', 'Πάτρα', 'Patras'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f08', 8, true, 'secondary', 'Ηράκλειο', 'Heraklion'),
  ('9e1f3a5c-7d2b-4a6e-8f10-5b7c9d1e3f09', 9, true, 'secondary', 'Ρόδος', 'Rhodes')
on conflict (id) do nothing;
