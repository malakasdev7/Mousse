create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'employee', 'viewer');

create table public.profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._-]{3,32}$'),
  username_normalized text generated always as (lower(username)) stored,
  internal_email text not null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (username_normalized), unique (internal_email)
);

create table public.stores (
  id uuid primary key default extensions.gen_random_uuid(), name text not null,
  currency text not null default 'BRL', monthly_production_target integer not null default 650 check (monthly_production_target > 0),
  cmv_warning_percent numeric(5,2) not null default 35 check (cmv_warning_percent between 0 and 100),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.store_members (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role public.app_role not null default 'viewer',
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id,user_id)
);

create or replace function public.is_store_member(target_store uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.store_members sm where sm.store_id=target_store and sm.user_id=(select auth.uid()));
$$;
create or replace function public.has_store_role(target_store uuid, allowed public.app_role[]) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.store_members sm where sm.store_id=target_store and sm.user_id=(select auth.uid()) and sm.role=any(allowed));
$$;

create table public.suppliers (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  name text not null, contact text, notes text, active boolean not null default true, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ingredients (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null, name text not null, category text not null,
  purchase_unit text not null, purchased_quantity numeric(14,4) not null check(purchased_quantity>0), base_unit text not null check(base_unit in ('g','ml','un')),
  price_paid numeric(14,2) not null check(price_paid>=0), waste_percent numeric(5,2) not null default 0 check(waste_percent between 0 and 99),
  stock_quantity numeric(14,4) not null default 0 check(stock_quantity>=0), minimum_stock numeric(14,4) not null default 0 check(minimum_stock>=0),
  purchased_at date, expires_at date, lot text, notes text, active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ingredient_price_history (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade, price_paid numeric(14,2) not null check(price_paid>=0),
  purchased_quantity numeric(14,4) not null check(purchased_quantity>0), supplier_id uuid references public.suppliers(id) on delete set null,
  purchased_at date not null default current_date, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.packaging_items (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null, name text not null, category text not null,
  pack_quantity numeric(14,4) not null check(pack_quantity>0), price_paid numeric(14,2) not null check(price_paid>=0), active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recipes (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  name text not null, category text not null default 'Mousse', instructions text, yield_quantity numeric(14,4) not null check(yield_quantity>0),
  yield_unit text not null check(yield_unit in ('g','ml','portion','unit')), final_weight numeric(14,4), portion_size numeric(14,4),
  waste_percent numeric(5,2) not null default 0 check(waste_percent between 0 and 99), version integer not null default 1 check(version>0), notes text, active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recipe_items (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, ingredient_id uuid references public.ingredients(id) on delete restrict,
  subrecipe_id uuid references public.recipes(id) on delete restrict, quantity numeric(14,4) not null check(quantity>0), unit text not null,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((ingredient_id is not null)::int + (subrecipe_id is not null)::int = 1), check(recipe_id is distinct from subrecipe_id)
);
create table public.products (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete restrict, name text not null, flavor text, category text, size_label text,
  recipe_quantity numeric(14,4) not null default 1 check(recipe_quantity>0), delivery_cost numeric(14,2) not null default 0,
  labor_minutes numeric(10,2) not null default 0, labor_cost numeric(14,2) not null default 0, waste_percent numeric(5,2) not null default 0,
  fixed_allocation numeric(14,2) not null default 0, tax_percent numeric(5,2) not null default 0, card_percent numeric(5,2) not null default 0,
  marketplace_percent numeric(5,2) not null default 0, seller_commission_percent numeric(5,2) not null default 0, target_margin_percent numeric(5,2) not null default 40,
  minimum_price numeric(14,2), recommended_price numeric(14,2), promotional_price numeric(14,2), wholesale_price numeric(14,2), active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_addons (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, packaging_item_id uuid references public.packaging_items(id) on delete restrict,
  ingredient_id uuid references public.ingredients(id) on delete restrict, name text not null, quantity numeric(14,4) not null default 1 check(quantity>0), unit text,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((packaging_item_id is not null)::int + (ingredient_id is not null)::int <= 1)
);
create table public.fixed_expenses (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  name text not null, category text not null, monthly_amount numeric(14,2) not null check(monthly_amount>=0), active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.variable_expenses (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  name text not null, category text not null, amount numeric(14,2) not null default 0, percent numeric(5,2) not null default 0,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(amount>=0 and percent between 0 and 100)
);
create table public.sales_channels (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  name text not null, fee_percent numeric(5,2) not null default 0 check(fee_percent between 0 and 100), active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_scenarios (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade, name text not null, inputs jsonb not null default '{}'::jsonb, results jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  actor_id uuid references auth.users(id), entity_type text not null, entity_id uuid, action text not null, before_data jsonb, after_data jsonb,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index store_members_user_store_idx on public.store_members(user_id,store_id);
create index ingredients_store_name_idx on public.ingredients(store_id,name);
create index ingredient_history_lookup_idx on public.ingredient_price_history(store_id,ingredient_id,purchased_at desc);
create index recipes_store_name_idx on public.recipes(store_id,name);
create index recipe_items_recipe_idx on public.recipe_items(store_id,recipe_id);
create index products_store_name_idx on public.products(store_id,name);
create index audit_logs_store_created_idx on public.audit_logs(store_id,created_at desc);

do $$ declare t text; begin foreach t in array array['profiles','stores','store_members','suppliers','ingredients','ingredient_price_history','packaging_items','recipes','recipe_items','products','product_addons','fixed_expenses','variable_expenses','sales_channels','pricing_scenarios','audit_logs'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon',t); end loop; end $$;

create policy profiles_self_select on public.profiles for select to authenticated using (user_id=(select auth.uid()));
create policy stores_member_select on public.stores for select to authenticated using ((select public.is_store_member(id)));
create policy stores_admin_update on public.stores for update to authenticated using ((select public.has_store_role(id,array['admin']::public.app_role[]))) with check ((select public.has_store_role(id,array['admin']::public.app_role[])));
create policy members_select on public.store_members for select to authenticated using ((select public.is_store_member(store_id)));
create policy members_admin_write on public.store_members for all to authenticated using ((select public.has_store_role(store_id,array['admin']::public.app_role[]))) with check ((select public.has_store_role(store_id,array['admin']::public.app_role[])));

do $$ declare t text; begin foreach t in array array['suppliers','ingredients','ingredient_price_history','packaging_items','recipes','recipe_items','products','product_addons','fixed_expenses','variable_expenses','sales_channels','pricing_scenarios'] loop
  execute format('create policy %I on public.%I for select to authenticated using ((select public.is_store_member(store_id)))',t||'_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check ((select public.has_store_role(store_id,array[''admin'',''employee'']::public.app_role[])) and created_by=(select auth.uid()))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using ((select public.has_store_role(store_id,array[''admin'',''employee'']::public.app_role[]))) with check ((select public.has_store_role(store_id,array[''admin'',''employee'']::public.app_role[])))',t||'_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using ((select public.has_store_role(store_id,array[''admin'']::public.app_role[])))',t||'_delete',t);
end loop; end $$;
create policy audit_select on public.audit_logs for select to authenticated using ((select public.has_store_role(store_id,array['admin']::public.app_role[])));
create policy audit_insert on public.audit_logs for insert to authenticated with check ((select public.has_store_role(store_id,array['admin','employee']::public.app_role[])) and actor_id=(select auth.uid()));

grant select on public.profiles to authenticated;
grant select,update on public.stores to authenticated;
grant select,insert,update,delete on public.store_members to authenticated;
do $$ declare t text; begin foreach t in array array['suppliers','ingredients','ingredient_price_history','packaging_items','recipes','recipe_items','products','product_addons','fixed_expenses','variable_expenses','sales_channels','pricing_scenarios'] loop execute format('grant select,insert,update,delete on public.%I to authenticated',t); end loop; end $$;
grant select,insert on public.audit_logs to authenticated;
