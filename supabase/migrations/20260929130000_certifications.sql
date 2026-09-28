-- The /certifications page's cards (DNV, ISO 9001:2015, …), moved out of the
-- dictionaries so the admin panel can edit them.
--
-- Same access rules as the other content tables, and it reuses is_admin() and
-- touch_updated_at() from 20260928120000_content.sql, so that file must have
-- run first. The page's heading and intro stay in the dictionaries.

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  published boolean not null default false,

  -- The body or standard. Not translated: "DNV" is "DNV" in Greek too.
  name text not null default '',
  -- What the approval covers, per language.
  detail_el text not null default '',
  detail_en text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint certifications_has_name check (name <> '')
);

create index certifications_listing on public.certifications (published, position);

create trigger certifications_touch_updated_at
  before update on public.certifications
  for each row execute function public.touch_updated_at();

alter table public.certifications enable row level security;

revoke all on table public.certifications from anon, authenticated;
grant select on table public.certifications to anon, authenticated;
grant insert, update, delete on table public.certifications to authenticated;

create policy "Visitors read published certifications"
  on public.certifications for select to anon
  using (published);

create policy "Signed-in users read published certifications, admins read all"
  on public.certifications for select to authenticated
  using (published or (select public.is_admin()));

create policy "Admins create certifications"
  on public.certifications for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins edit certifications"
  on public.certifications for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete certifications"
  on public.certifications for delete to authenticated
  using ((select public.is_admin()));

-- The six cards the site launched with — PLACEHOLDERS, not IMA's real
-- approvals (see the README). Same ids as
-- src/content/snapshot/certifications.json.
insert into public.certifications (id, position, published, name, detail_el, detail_en)
values
  ('4c6e8a2d-1b3f-4e5a-9c7d-3f5b7d9e1a01', 1, true, 'DNV',
   'Αναγνωρισμένος πάροχος υπηρεσιών', 'Approved service supplier'),
  ('4c6e8a2d-1b3f-4e5a-9c7d-3f5b7d9e1a02', 2, true, 'ABS',
   'Αναγνωρισμένο εξωτερικό συνεργείο', 'Recognised external specialist'),
  ('4c6e8a2d-1b3f-4e5a-9c7d-3f5b7d9e1a03', 3, true, 'Lloyd''s Register',
   'Έγκριση υπηρεσιών', 'Service approval'),
  ('4c6e8a2d-1b3f-4e5a-9c7d-3f5b7d9e1a04', 4, true, 'Bureau Veritas',
   'Αναγνωρισμένο συνεργείο', 'Approved service supplier'),
  ('4c6e8a2d-1b3f-4e5a-9c7d-3f5b7d9e1a05', 5, true, 'ISO 9001:2015',
   'Σύστημα διαχείρισης ποιότητας', 'Quality management system'),
  ('4c6e8a2d-1b3f-4e5a-9c7d-3f5b7d9e1a06', 6, true, 'ISO 45001',
   'Υγεία & ασφάλεια στην εργασία', 'Occupational health & safety')
on conflict (id) do nothing;
