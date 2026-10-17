-- Vendor review workflow tables (shared across devices; demo has no login yet)
create table public.vendor_requests (
  id uuid primary key,
  vendor_name text not null,
  use_case text not null default '',
  team text not null default '',
  portfolio_company text not null default '',
  data_sources text not null default '',
  phi_pii text not null default 'no' check (phi_pii in ('yes','no','na')),
  contract_file_name text,
  contract_file_path text,
  submitted_at timestamptz not null default now(),
  reviews jsonb not null default '{"ops":{"status":"pending"},"finance":{"status":"pending"},"compliance":{"status":"pending"},"it":{"status":"pending"}}'::jsonb,
  execution jsonb,
  created_at timestamptz not null default now()
);

create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.vendor_requests(id) on delete cascade,
  role text not null,
  text text not null,
  at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.vendor_requests(id) on delete set null,
  text text not null,
  at timestamptz not null default now()
);

-- Demo runs without login: anon visitors read and write through the app
grant select, insert, update, delete on public.vendor_requests to anon, authenticated;
grant select, insert, update, delete on public.request_messages to anon, authenticated;
grant select, insert on public.notices to anon, authenticated;
grant all on public.vendor_requests to service_role;
grant all on public.request_messages to service_role;
grant all on public.notices to service_role;

alter table public.vendor_requests enable row level security;
alter table public.request_messages enable row level security;
alter table public.notices enable row level security;

create policy "vendor requests readable" on public.vendor_requests for select to anon, authenticated using (true);
create policy "vendor requests insertable" on public.vendor_requests for insert to anon, authenticated with check (true);
create policy "vendor requests updatable" on public.vendor_requests for update to anon, authenticated using (true) with check (true);
create policy "vendor requests deletable" on public.vendor_requests for delete to anon, authenticated using (true);
create policy "messages readable" on public.request_messages for select to anon, authenticated using (true);
create policy "messages insertable" on public.request_messages for insert to anon, authenticated with check (true);
create policy "messages updatable" on public.request_messages for update to anon, authenticated using (true) with check (true);
create policy "messages deletable" on public.request_messages for delete to anon, authenticated using (true);
create policy "notices readable" on public.notices for select to anon, authenticated using (true);
create policy "notices insertable" on public.notices for insert to anon, authenticated with check (true);

-- Live updates between devices
alter publication supabase_realtime add table public.vendor_requests;
alter publication supabase_realtime add table public.request_messages;
alter publication supabase_realtime add table public.notices;

-- Storage: contract attachments live in the private 'contracts' bucket
create policy "contracts readable" on storage.objects for select to anon, authenticated using (bucket_id = 'contracts');
create policy "contracts uploadable" on storage.objects for insert to anon, authenticated with check (bucket_id = 'contracts');

-- Seed the six sample vendors
insert into public.vendor_requests (id, vendor_name, use_case, team, portfolio_company, data_sources, phi_pii, contract_file_name, submitted_at, reviews, execution) values
('11111111-1111-4111-8111-111111111111','PitchBook','Private market comps and deal sourcing for diligence.','Investment pod','','PitchBook proprietary dataset, SEC filings','no','sample-contract.pdf','2025-12-02T14:00:00Z','{"ops":{"status":"approved","updatedAt":"2025-12-10T14:00:00Z"},"finance":{"status":"approved","updatedAt":"2025-12-10T14:00:00Z"},"compliance":{"status":"approved","updatedAt":"2025-12-10T14:00:00Z"},"it":{"status":"approved","updatedAt":"2025-12-10T14:00:00Z"}}','{"executedFileName":"pitchbook-executed.pdf","executedFilePath":null,"executionDate":"2026-01-05","endDate":"2027-01-04","renewalTerms":"Auto-renews annually; 5% max uplift","cancellationTerms":"60 days written notice before renewal","signedAt":"2026-01-05T10:00:00Z"}'),
('22222222-2222-4222-8222-222222222222','Carta','Cap table management and 409A support.','Portfolio pod','Northwind Clinics','Company-provided equity records','yes','sample-contract.pdf','2026-02-11T14:00:00Z','{"ops":{"status":"approved","updatedAt":"2026-02-20T14:00:00Z"},"finance":{"status":"approved","updatedAt":"2026-02-20T14:00:00Z"},"compliance":{"status":"approved","updatedAt":"2026-02-20T14:00:00Z"},"it":{"status":"approved","updatedAt":"2026-02-20T14:00:00Z"}}','{"executedFileName":"carta-executed.pdf","executedFilePath":null,"executionDate":"2026-03-01","endDate":"2026-12-31","renewalTerms":"Annual renewal by mutual agreement","cancellationTerms":"30 days notice; no termination fee","signedAt":"2026-03-01T10:00:00Z"}'),
('33333333-3333-4333-8333-333333333333','Snowflake','Data warehouse for portfolio KPI reporting.','Portfolio pod','Harbor Logistics','Portfolio company ERP exports','no','sample-contract.pdf','2026-05-02T14:00:00Z','{"ops":{"status":"approved","updatedAt":"2026-05-12T14:00:00Z"},"finance":{"status":"approved","updatedAt":"2026-05-12T14:00:00Z"},"compliance":{"status":"approved","updatedAt":"2026-05-12T14:00:00Z"},"it":{"status":"approved","updatedAt":"2026-05-12T14:00:00Z"}}','{"executedFileName":"snowflake-executed.pdf","executedFilePath":null,"executionDate":"2026-05-20","endDate":"2028-05-19","renewalTerms":"2-year term; renewal at then-current rates","cancellationTerms":"90 days notice; unused credits forfeited","signedAt":"2026-05-20T10:00:00Z"}'),
('44444444-4444-4444-8444-444444444444','Kensho Data','NLP extraction from earnings calls for sector screens.','Investment pod','','S&P Global transcripts','no','sample-contract.pdf','2026-10-14T14:00:00Z','{"ops":{"status":"pending"},"finance":{"status":"approved","updatedAt":"2026-10-15T15:10:00Z"},"compliance":{"status":"approved","updatedAt":"2026-10-15T12:00:00Z"},"it":{"status":"pending"}}',null),
('55555555-5555-4555-8555-555555555555','Veritas Health Analytics','Claims benchmarking for healthcare portfolio company.','Portfolio pod','Northwind Clinics','De-identified claims data (CMS, payers)','yes','sample-contract.pdf','2026-10-16T13:00:00Z','{"ops":{"status":"pending"},"finance":{"status":"pending"},"compliance":{"status":"pending"},"it":{"status":"pending"}}',null),
('66666666-6666-4666-8666-666666666666','Ledgerline','Automated fund expense reconciliation.','Finance','','','na','sample-contract.pdf','2026-10-09T13:00:00Z','{"ops":{"status":"approved","updatedAt":"2026-10-16T18:20:00Z"},"finance":{"status":"approved","updatedAt":"2026-10-16T18:20:00Z"},"compliance":{"status":"approved","updatedAt":"2026-10-16T18:20:00Z"},"it":{"status":"approved","updatedAt":"2026-10-16T18:20:00Z"}}','{"executedFileName":"ledgerline-executed.pdf","executedFilePath":null,"executionDate":"2026-10-16","endDate":"2027-10-15","renewalTerms":"Annual renewal by mutual agreement","cancellationTerms":"45 days notice","signedAt":"2026-10-16T18:20:00Z"}');

insert into public.request_messages (id, request_id, role, text, at) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','44444444-4444-4444-8444-444444444444','it','Does this require SSO? We''d want it behind Okta.','2026-10-15T09:00:00Z'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','44444444-4444-4444-8444-444444444444','requester','Yes — SAML SSO is included in the enterprise tier.','2026-10-15T09:40:00Z'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','55555555-5555-4555-8555-555555555555','compliance','We''ll need a BAA before I can approve.','2026-10-16T15:00:00Z');

insert into public.notices (id, request_id, text, at) values
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','44444444-4444-4444-8444-444444444444','Finance lead approved the Kensho Data vendor contract','2026-10-15T15:10:00Z'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','55555555-5555-4555-8555-555555555555','New vendor request submitted: Veritas Health Analytics','2026-10-16T13:00:00Z'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','66666666-6666-4666-8666-666666666666','All leads approved Ledgerline — contract sent to Ops lead for execution','2026-10-16T18:20:00Z');
