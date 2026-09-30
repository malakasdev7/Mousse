-- Migration: Add profit_sharing and sharing_template kinds to audit_records safely
alter table public.audit_records drop constraint if exists audit_records_kind_check;

alter table public.audit_records add constraint audit_records_kind_check
  check(kind in (
    'ingredient',
    'packaging',
    'expense',
    'recipe',
    'product',
    'sale',
    'supplier',
    'scenario',
    'settings',
    'profit_sharing',
    'sharing_template'
  ));

create index if not exists audit_records_profit_sharing_idx
  on public.audit_records(store_id, kind, id)
  where kind in ('profit_sharing', 'sharing_template');
