-- The /capabilities page's groups of makers ("Automation & control" → Siemens,
-- ABB, …), moved out of the dictionaries so the admin panel can edit them.
--
-- Same shape and the same access rules as projects and spare parts in
-- 20260928120000_content.sql (whose is_admin() and touch_updated_at() this
-- reuses, so that file must have run first): visitors read published groups,
-- only admins read drafts or write.
--
-- The page's heading, intro and trademark note stay in the dictionaries —
-- they are page copy, not the list.

create table public.capability_groups (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  published boolean not null default false,

  -- The group's heading, e.g. "Automation & control".
  title_el text not null default '',
  title_en text not null default '',
  -- Makers, in display order. Not translated: "Siemens" is "Siemens".
  brands text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capability_groups_has_title check (title_el <> '' or title_en <> '')
);

create index capability_groups_listing on public.capability_groups (published, position);

create trigger capability_groups_touch_updated_at
  before update on public.capability_groups
  for each row execute function public.touch_updated_at();

alter table public.capability_groups enable row level security;

revoke all on table public.capability_groups from anon, authenticated;
grant select on table public.capability_groups to anon, authenticated;
grant insert, update, delete on table public.capability_groups to authenticated;

create policy "Visitors read published capability groups"
  on public.capability_groups for select to anon
  using (published);

create policy "Signed-in users read published capability groups, admins read all"
  on public.capability_groups for select to authenticated
  using (published or (select public.is_admin()));

create policy "Admins create capability groups"
  on public.capability_groups for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit capability groups"
  on public.capability_groups for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete capability groups"
  on public.capability_groups for delete to authenticated
  using ((select public.is_admin()));

-- The four groups the site launched with. Same ids as
-- src/content/snapshot/capability_groups.json.
insert into public.capability_groups (id, position, published, title_el, title_en, brands)
values
  ('7a2d3b1f-5c8e-4d2a-8b61-2e4f9c1a0b01', 1, true, 'Αυτοματισμοί & έλεγχος', 'Automation & control',
   array['Siemens', 'ABB', 'Schneider Electric', 'Allen-Bradley', 'Omron', 'Mitsubishi']),
  ('7a2d3b1f-5c8e-4d2a-8b61-2e4f9c1a0b02', 2, true, 'Alarm & monitoring', 'Alarm & monitoring',
   array['Kongsberg', 'Autronica', 'Praxis', 'Selma', 'Lyngsø Marine', 'Nabtesco']),
  ('7a2d3b1f-5c8e-4d2a-8b61-2e4f9c1a0b03', 3, true, 'Ισχύς & πρόωση', 'Power & propulsion',
   array['Wärtsilä', 'MAN Energy Solutions', 'Caterpillar', 'Cummins', 'Deif', 'Woodward']),
  ('7a2d3b1f-5c8e-4d2a-8b61-2e4f9c1a0b04', 4, true, 'Drives & κινητήρες', 'Drives & motors',
   array['Danfoss', 'Vacon', 'Yaskawa', 'Fuji Electric', 'Nidec', 'WEG'])
on conflict (id) do nothing;
