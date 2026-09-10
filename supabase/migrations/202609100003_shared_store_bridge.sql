alter table public.stores add column legacy_owner_id text;
create index stores_legacy_owner_idx on public.stores(legacy_owner_id) where legacy_owner_id is not null;
