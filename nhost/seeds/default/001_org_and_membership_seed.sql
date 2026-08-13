insert into organizations (id, name, quota_calls_allowed, quota_calls_used)
values
  ('11111111-1111-1111-1111-111111111111', 'Org A — Northwind Ops', 500, 0),
  ('22222222-2222-2222-2222-222222222222', 'Org B — Southgate Labs', 500, 0);

insert into org_members (org_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111', 'bdc84b6e-8f19-4a6c-93a8-f6011eb25525', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'a041b85c-42b7-4eff-a9e3-30c10295ff9e', 'editor');

insert into org_members (org_id, user_id, role)
values
  ('22222222-2222-2222-2222-222222222222', '380f545b-6940-42c6-bbee-d975aeb5bd2e', 'owner'),
  ('22222222-2222-2222-2222-222222222222', '999f4297-4fed-43b0-a200-d02a210a09e8', 'viewer');
