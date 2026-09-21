create extension if not exists pgcrypto;

create sequence if not exists public.avana_order_number_seq start 1;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avana-public',
  'avana-public',
  true,
  8000000,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avana-private',
  'avana-private',
  false,
  8000000,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin', 'founder')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists marketing_consent boolean not null default false;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  first_name text not null,
  last_name text not null,
  address_line1 text not null,
  address_line2 text not null default '',
  city text not null,
  province text not null check (char_length(province) = 2),
  postal_code text not null,
  country text not null default 'CA' check (country = 'CA'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  slug text not null unique,
  name text not null,
  eyebrow text not null default '',
  category text not null check (category in ('Gousses', 'Poudre', 'Coffret')),
  short_description text not null,
  description text not null,
  image text not null,
  gallery jsonb not null default '[]'::jsonb,
  origin text not null,
  region text not null,
  species text not null,
  lot_code text not null,
  status text not null default 'development' check (status in ('available', 'waitlist', 'development')),
  featured boolean not null default false,
  audience jsonb not null default '["B2C"]'::jsonb,
  uses jsonb not null default '[]'::jsonb,
  storage text not null default '',
  composition text not null default '',
  data_status text not null default 'Réel' check (data_status in ('Réel', 'Hypothèse', 'Démo')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  label text not null,
  sku text not null unique,
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= price_cents),
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0 and stock_reserved <= stock_on_hand),
  weight_grams integer not null check (weight_grams > 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lots (
  id text primary key,
  code text not null unique,
  country text not null,
  region text not null,
  species text not null,
  grade text not null,
  harvest_year text not null,
  quantity_kg numeric(12,3) not null default 0,
  available_kg numeric(12,3) not null default 0,
  status text not null check (status in ('Contrôle', 'Disponible', 'Archivé')),
  public_traceability_enabled boolean not null default false,
  data_status text not null default 'Réel' check (data_status in ('Réel', 'Hypothèse', 'Démo')),
  events jsonb not null default '[]'::jsonb,
  supplier_name text not null default '',
  import_date date,
  reception_date date,
  humidity_percent numeric(5,2) check (humidity_percent is null or humidity_percent between 0 and 100),
  average_length_mm numeric(8,2) check (average_length_mm is null or average_length_mm >= 0),
  public_summary text not null default '',
  public_documents jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lots add column if not exists supplier_name text not null default '';
alter table public.lots add column if not exists import_date date;
alter table public.lots add column if not exists reception_date date;
alter table public.lots add column if not exists humidity_percent numeric(5,2);
alter table public.lots add column if not exists average_length_mm numeric(8,2);
alter table public.lots add column if not exists public_summary text not null default '';
alter table public.lots add column if not exists public_documents jsonb not null default '[]'::jsonb;
alter table public.lots add column if not exists notes text not null default '';

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid references auth.users(id) on delete set null,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  shipping_address jsonb,
  shipping_method text not null check (shipping_method in ('standard', 'express')),
  currency text not null default 'CAD' check (currency = 'CAD'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null check (shipping_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0 and refunded_cents <= total_cents),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'processing', 'shipped', 'delivered', 'returned')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_invoice_id text,
  invoice_url text,
  invoice_pdf_url text,
  checkout_attempt_id uuid,
  checkout_request_hash text,
  marketing_consent boolean not null default false,
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  restocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists stripe_invoice_id text;
alter table public.orders add column if not exists invoice_url text;
alter table public.orders add column if not exists invoice_pdf_url text;
alter table public.orders add column if not exists discount_cents integer not null default 0;
alter table public.orders add column if not exists restocked_at timestamptz;
alter table public.orders add column if not exists refunded_cents integer not null default 0;
alter table public.orders add column if not exists checkout_attempt_id uuid;
alter table public.orders add column if not exists checkout_request_hash text;
create unique index if not exists orders_checkout_attempt_id_idx
  on public.orders(checkout_attempt_id)
  where checkout_attempt_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_checkout_request_hash_format'
  ) then
    alter table public.orders add constraint orders_checkout_request_hash_format
      check (checkout_request_hash is null or checkout_request_hash ~ '^[0-9a-f]{64}$');
  end if;
end;
$$;

update public.orders
set refunded_cents = total_cents
where payment_status = 'refunded' and refunded_cents <> total_cents;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_discount_cents_nonnegative'
  ) then
    alter table public.orders add constraint orders_discount_cents_nonnegative check (discount_cents >= 0);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_refunded_cents_valid'
  ) then
    alter table public.orders
      add constraint orders_refunded_cents_valid
      check (refunded_cents >= 0 and refunded_cents <= total_cents);
  end if;
end;
$$;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  variant_id text references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_label text not null,
  sku text not null,
  lot_code text,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null references public.product_variants(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (reason in ('initial', 'receipt', 'loss', 'correction_add', 'correction_remove', 'sale', 'refund_restock', 'manual_adjustment')),
  note text not null default '',
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  message text not null,
  public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text not null,
  service text,
  tracking_number text not null,
  tracking_url text,
  status text not null default 'in_transit' check (status in ('label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned')),
  label_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_event_id text not null unique,
  event_type text not null,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error text,
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.payment_events add column if not exists status text not null default 'processed' check (status in ('processing', 'processed', 'failed'));
alter table public.payment_events alter column status set default 'processing';
alter table public.payment_events add column if not exists attempt_count integer not null default 1 check (attempt_count > 0);
alter table public.payment_events add column if not exists last_error text;
alter table public.payment_events add column if not exists updated_at timestamptz not null default now();
alter table public.payment_events alter column processed_at drop not null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  kind text not null,
  recipient_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  dedupe_key text,
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_idx on public.notifications(dedupe_key) where dedupe_key is not null;
-- PostgREST upsert(onConflict: 'dedupe_key') supplies no index predicate.
-- A full unique index also permits multiple NULL keys and supports that target.
create unique index if not exists notifications_dedupe_upsert_idx on public.notifications(dedupe_key);

create table if not exists public.newsletter_subscribers (
  email text primary key,
  status text not null default 'pending' check (status in ('pending', 'subscribed', 'unsubscribed')),
  consent_source text not null,
  consent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  confirmation_token_hash text,
  confirmation_expires_at timestamptz,
  unsubscribe_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.newsletter_subscribers add column if not exists confirmation_token_hash text;
alter table public.newsletter_subscribers add column if not exists confirmation_expires_at timestamptz;
alter table public.newsletter_subscribers add column if not exists unsubscribe_token_hash text;
alter table public.newsletter_subscribers drop column if exists unsubscribe_token;
create unique index if not exists newsletter_confirmation_token_idx on public.newsletter_subscribers(confirmation_token_hash) where confirmation_token_hash is not null;
create unique index if not exists newsletter_unsubscribe_token_idx on public.newsletter_subscribers(unsubscribe_token_hash) where unsubscribe_token_hash is not null;

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'b2b', 'newsletter', 'waitlist')),
  payload jsonb not null,
  source text not null default 'avana-web',
  status text not null default 'new',
  notes text not null default '',
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.submissions add column if not exists status text not null default 'new';
alter table public.submissions add column if not exists notes text not null default '';
alter table public.submissions add column if not exists updated_at timestamptz not null default now();

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  anonymous_id text not null,
  path text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  preheader text not null default '',
  heading text not null,
  body text not null,
  action_label text not null default '',
  action_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_records (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('fournisseurs', 'importations', 'documents', 'conformite', 'roadmap', 'rappels')),
  title text not null,
  status text not null,
  data jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  key text primary key,
  request_count integer not null default 0,
  reset_at timestamptz not null
);

create index if not exists orders_email_idx on public.orders(lower(email));
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_events_order_idx on public.order_status_events(order_id, created_at);
create index if not exists customer_addresses_user_idx on public.customer_addresses(user_id, created_at);
create unique index if not exists customer_addresses_one_default_idx on public.customer_addresses(user_id) where is_default = true;
create index if not exists inventory_movements_variant_idx on public.inventory_movements(variant_id, created_at desc);
create index if not exists notifications_pending_idx on public.notifications(status, scheduled_at);
create index if not exists analytics_created_idx on public.analytics_events(created_at desc);
create index if not exists submissions_kind_received_idx on public.submissions(kind, received_at desc);
create index if not exists marketing_campaigns_created_idx on public.marketing_campaigns(created_at desc);
create index if not exists operational_records_module_idx on public.operational_records(module, archived, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists customer_addresses_updated_at on public.customer_addresses;
create trigger customer_addresses_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists variants_updated_at on public.product_variants;
create trigger variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
drop trigger if exists lots_updated_at on public.lots;
create trigger lots_updated_at before update on public.lots for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists shipments_updated_at on public.shipments;
create trigger shipments_updated_at before update on public.shipments for each row execute function public.set_updated_at();
drop trigger if exists notifications_updated_at on public.notifications;
create trigger notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
drop trigger if exists subscribers_updated_at on public.newsletter_subscribers;
create trigger subscribers_updated_at before update on public.newsletter_subscribers for each row execute function public.set_updated_at();
drop trigger if exists submissions_updated_at on public.submissions;
create trigger submissions_updated_at before update on public.submissions for each row execute function public.set_updated_at();
drop trigger if exists marketing_campaigns_updated_at on public.marketing_campaigns;
create trigger marketing_campaigns_updated_at before update on public.marketing_campaigns for each row execute function public.set_updated_at();
drop trigger if exists operational_records_updated_at on public.operational_records;
create trigger operational_records_updated_at before update on public.operational_records for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin', 'founder')
  );
$$;

drop function if exists public.reserve_order(jsonb, text, jsonb, integer, integer, integer, integer);

create or replace function public.reserve_order(
  checkout_attempt_id_value uuid,
  checkout_request_hash_value text,
  customer_data jsonb,
  shipping_method_value text,
  requested_items jsonb,
  standard_shipping_cents integer,
  express_shipping_cents integer,
  free_shipping_threshold_cents integer,
  reservation_minutes integer default 30
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  created_order_id uuid := gen_random_uuid();
  created_order_number text;
  existing_order record;
  requested_item record;
  selected_variant record;
  subtotal_value integer := 0;
  shipping_cents_value integer := 0;
  item_count integer := 0;
begin
  if checkout_attempt_id_value is null or checkout_request_hash_value !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_CHECKOUT_ATTEMPT';
  end if;
  if jsonb_typeof(requested_items) <> 'array' or jsonb_array_length(requested_items) not between 1 and 30 then
    raise exception 'INVALID_CART';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(requested_items) as item(variant_id text, quantity integer)
    group by item.variant_id
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_VARIANT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(checkout_attempt_id_value::text, 0));
  select * into existing_order
  from public.orders
  where checkout_attempt_id = checkout_attempt_id_value;

  if found then
    if existing_order.checkout_request_hash <> checkout_request_hash_value then
      raise exception 'CHECKOUT_ATTEMPT_PAYLOAD_MISMATCH';
    end if;
    if existing_order.status <> 'pending_payment' then
      raise exception 'CHECKOUT_ATTEMPT_CLOSED';
    end if;
    return jsonb_build_object(
      'id', existing_order.id,
      'number', existing_order.number,
      'subtotalCents', existing_order.subtotal_cents,
      'shippingCents', existing_order.shipping_cents,
      'totalCents', existing_order.total_cents
    );
  end if;

  if shipping_method_value not in ('standard', 'express') then
    raise exception 'INVALID_SHIPPING_METHOD';
  end if;

  if standard_shipping_cents < 0 or express_shipping_cents < 0 or free_shipping_threshold_cents < 0 then
    raise exception 'INVALID_SHIPPING_PRICE';
  end if;

  created_order_number := 'AVA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.avana_order_number_seq')::text, 6, '0');

  insert into public.orders (
    id,
    number,
    email,
    first_name,
    last_name,
    phone,
    shipping_method,
    subtotal_cents,
    shipping_cents,
    total_cents,
    marketing_consent,
    checkout_attempt_id,
    checkout_request_hash,
    reservation_expires_at
  ) values (
    created_order_id,
    created_order_number,
    lower(trim(customer_data ->> 'email')),
    trim(customer_data ->> 'firstName'),
    trim(customer_data ->> 'lastName'),
    nullif(trim(customer_data ->> 'phone'), ''),
    shipping_method_value,
    0,
    0,
    0,
    coalesce((customer_data ->> 'marketingConsent')::boolean, false),
    checkout_attempt_id_value,
    checkout_request_hash_value,
    now() + make_interval(mins => greatest(30, least(reservation_minutes, 180)))
  );

  for requested_item in
    select *
    from jsonb_to_recordset(requested_items) as item(variant_id text, quantity integer)
    order by item.variant_id
  loop
    item_count := item_count + 1;
    if requested_item.quantity < 1 or requested_item.quantity > 10 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select
      variant.id,
      variant.product_id,
      variant.label,
      variant.sku,
      variant.price_cents,
      variant.stock_on_hand,
      variant.stock_reserved,
      product.name as product_name,
      product.lot_code
    into selected_variant
    from public.product_variants variant
    join public.products product on product.id = variant.product_id
    where variant.id = requested_item.variant_id
      and variant.active = true
      and product.active = true
      and product.status = 'available'
    for update of variant;

    if not found then
      raise exception 'VARIANT_NOT_AVAILABLE';
    end if;

    if selected_variant.stock_on_hand - selected_variant.stock_reserved < requested_item.quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    subtotal_value := subtotal_value + selected_variant.price_cents * requested_item.quantity;

    update public.product_variants
    set stock_reserved = stock_reserved + requested_item.quantity
    where id = selected_variant.id;

    insert into public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      variant_label,
      sku,
      lot_code,
      quantity,
      unit_price_cents,
      line_total_cents
    ) values (
      created_order_id,
      selected_variant.product_id,
      selected_variant.id,
      selected_variant.product_name,
      selected_variant.label,
      selected_variant.sku,
      selected_variant.lot_code,
      requested_item.quantity,
      selected_variant.price_cents,
      selected_variant.price_cents * requested_item.quantity
    );
  end loop;

  if item_count = 0 then
    raise exception 'EMPTY_CART';
  end if;

  shipping_cents_value := case
    when shipping_method_value = 'express' then express_shipping_cents
    when subtotal_value >= free_shipping_threshold_cents then 0
    else standard_shipping_cents
  end;

  update public.orders
  set
    subtotal_cents = subtotal_value,
    shipping_cents = shipping_cents_value,
    total_cents = subtotal_value + shipping_cents_value
  where id = created_order_id;

  insert into public.order_status_events (order_id, status, message)
  values (created_order_id, 'pending_payment', 'Commande créée, en attente du paiement.');

  return jsonb_build_object(
    'id', created_order_id,
    'number', created_order_number,
    'subtotalCents', subtotal_value,
    'shippingCents', shipping_cents_value,
    'totalCents', subtotal_value + shipping_cents_value
  );
end;
$$;

create or replace function public.attach_stripe_session(order_id_value uuid, session_id_value text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
begin
  select id, status, stripe_checkout_session_id into selected_order
  from public.orders
  where id = order_id_value
  for update;
  if not found or selected_order.status <> 'pending_payment' then
    raise exception 'ORDER_NOT_PENDING';
  end if;
  if selected_order.stripe_checkout_session_id is not null
    and selected_order.stripe_checkout_session_id <> session_id_value then
    raise exception 'STRIPE_SESSION_ALREADY_ATTACHED';
  end if;
  update public.orders
  set stripe_checkout_session_id = session_id_value
  where id = order_id_value;
end;
$$;

create or replace function public.release_order_reservation(order_id_value uuid, cancellation_reason text default 'Paiement non complété.')
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
  selected_item record;
begin
  select * into selected_order from public.orders where id = order_id_value for update;
  if not found or selected_order.status <> 'pending_payment' then
    return false;
  end if;

  for selected_item in select * from public.order_items where order_id = order_id_value loop
    update public.product_variants
    set stock_reserved = greatest(0, stock_reserved - selected_item.quantity)
    where id = selected_item.variant_id;
  end loop;

  update public.orders
  set status = 'cancelled', payment_status = 'failed', cancelled_at = now()
  where id = order_id_value;

  insert into public.order_status_events (order_id, status, message)
  values (order_id_value, 'cancelled', cancellation_reason);
  return true;
end;
$$;

create or replace function public.complete_order_payment(
  order_id_value uuid,
  checkout_session_id_value text,
  payment_intent_id_value text,
  stripe_customer_id_value text,
  subtotal_cents_value integer,
  shipping_cents_value integer,
  tax_cents_value integer,
  total_cents_value integer,
  shipping_address_value jsonb
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
  selected_item record;
begin
  select * into selected_order from public.orders where id = order_id_value for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if selected_order.payment_status = 'paid' then
    return false;
  end if;
  if selected_order.status <> 'pending_payment' then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;
  if selected_order.stripe_checkout_session_id is null or selected_order.stripe_checkout_session_id <> checkout_session_id_value then
    raise exception 'CHECKOUT_SESSION_MISMATCH';
  end if;
  if subtotal_cents_value < 0 or shipping_cents_value < 0 or tax_cents_value < 0 or total_cents_value < 0 then
    raise exception 'INVALID_PAYMENT_TOTAL';
  end if;
  if subtotal_cents_value <> selected_order.subtotal_cents or shipping_cents_value <> selected_order.shipping_cents then
    raise exception 'PAYMENT_TOTAL_MISMATCH';
  end if;
  if total_cents_value > subtotal_cents_value + shipping_cents_value + tax_cents_value then
    raise exception 'INVALID_PAYMENT_TOTAL';
  end if;

  for selected_item in select * from public.order_items where order_id = order_id_value loop
    update public.product_variants
    set
      stock_on_hand = stock_on_hand - selected_item.quantity,
      stock_reserved = greatest(0, stock_reserved - selected_item.quantity)
    where id = selected_item.variant_id
      and stock_on_hand >= selected_item.quantity
      and stock_reserved >= selected_item.quantity;
    if not found then
      raise exception 'STOCK_COMMIT_FAILED';
    end if;
    insert into public.inventory_movements (variant_id, order_id, quantity_delta, reason, note, actor)
    values (selected_item.variant_id, order_id_value, -selected_item.quantity, 'sale', selected_order.number, 'stripe-webhook');
  end loop;

  update public.orders
  set
    status = 'paid',
    payment_status = 'paid',
    subtotal_cents = subtotal_cents_value,
    shipping_cents = shipping_cents_value,
    discount_cents = greatest(0, subtotal_cents_value + shipping_cents_value + tax_cents_value - total_cents_value),
    tax_cents = tax_cents_value,
    total_cents = total_cents_value,
    shipping_address = shipping_address_value,
    stripe_checkout_session_id = checkout_session_id_value,
    stripe_payment_intent_id = payment_intent_id_value,
    stripe_customer_id = stripe_customer_id_value,
    reservation_expires_at = null,
    paid_at = now()
  where id = order_id_value;

  insert into public.order_status_events (order_id, status, message)
  values (order_id_value, 'paid', 'Paiement confirmé. La commande est en préparation.');

  insert into public.notifications (order_id, kind, recipient_email, payload)
  values (order_id_value, 'order_paid', selected_order.email, jsonb_build_object('orderNumber', selected_order.number));

  if selected_order.marketing_consent then
    insert into public.newsletter_subscribers (email, status, consent_source, confirmed_at)
    values (lower(selected_order.email), 'subscribed', 'checkout', now())
    on conflict (email) do update set
      status = 'subscribed',
      consent_source = 'checkout',
      consent_at = now(),
      confirmed_at = now(),
      unsubscribed_at = null;
  end if;

  return true;
end;
$$;

create or replace function public.mark_order_shipped(
  order_id_value uuid,
  carrier_value text,
  service_value text,
  tracking_number_value text,
  tracking_url_value text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
begin
  select * into selected_order from public.orders where id = order_id_value for update;
  if not found or selected_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'ORDER_NOT_SHIPPABLE';
  end if;

  insert into public.shipments (order_id, carrier, service, tracking_number, tracking_url, status, shipped_at)
  values (order_id_value, carrier_value, nullif(service_value, ''), tracking_number_value, nullif(tracking_url_value, ''), 'in_transit', now());

  update public.orders
  set status = 'fulfilled', fulfillment_status = 'shipped', fulfilled_at = now()
  where id = order_id_value;

  insert into public.order_status_events (order_id, status, message, metadata)
  values (
    order_id_value,
    'shipped',
    'Commande expédiée avec ' || carrier_value || '.',
    jsonb_build_object('trackingNumber', tracking_number_value, 'trackingUrl', tracking_url_value)
  );

  insert into public.notifications (order_id, kind, recipient_email, payload)
  values (
    order_id_value,
    'order_shipped',
    selected_order.email,
    jsonb_build_object('orderNumber', selected_order.number, 'carrier', carrier_value, 'trackingNumber', tracking_number_value, 'trackingUrl', tracking_url_value)
  );
end;
$$;

create or replace function public.mark_order_processing(order_id_value uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
begin
  select * into selected_order from public.orders where id = order_id_value for update;
  if not found or selected_order.payment_status not in ('paid', 'partially_refunded') or selected_order.status in ('fulfilled', 'refunded', 'cancelled') then
    return false;
  end if;
  if selected_order.status = 'processing' then
    return false;
  end if;
  update public.orders
  set status = 'processing', fulfillment_status = 'processing'
  where id = order_id_value;
  insert into public.order_status_events (order_id, status, message)
  values (order_id_value, 'processing', 'Votre commande est en préparation.');
  return true;
end;
$$;

create or replace function public.mark_order_delivered(order_id_value uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
begin
  select * into selected_order from public.orders where id = order_id_value for update;
  if not found or selected_order.fulfillment_status <> 'shipped' then
    return false;
  end if;
  update public.orders
  set status = 'fulfilled', fulfillment_status = 'delivered'
  where id = order_id_value;
  update public.shipments
  set status = 'delivered', delivered_at = coalesce(delivered_at, now())
  where order_id = order_id_value;
  insert into public.order_status_events (order_id, status, message)
  values (order_id_value, 'delivered', 'Votre commande a été livrée.');
  insert into public.notifications (order_id, kind, recipient_email, payload)
  values (order_id_value, 'order_delivered', selected_order.email, jsonb_build_object('orderNumber', selected_order.number));
  return true;
end;
$$;

create or replace function public.update_shipment_status(
  shipment_id_value uuid,
  status_value text,
  message_value text,
  metadata_value jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_shipment record;
begin
  if status_value not in ('label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned') then
    raise exception 'INVALID_SHIPMENT_STATUS';
  end if;
  select * into selected_shipment from public.shipments where id = shipment_id_value for update;
  if not found or selected_shipment.status = status_value then
    return false;
  end if;
  update public.shipments
  set status = status_value, delivered_at = case when status_value = 'delivered' then now() else delivered_at end
  where id = shipment_id_value;
  if status_value = 'delivered' then
    perform public.mark_order_delivered(selected_shipment.order_id);
  else
    insert into public.order_status_events (order_id, status, message, metadata)
    values (selected_shipment.order_id, status_value, message_value, metadata_value);
  end if;
  return true;
end;
$$;

create or replace function public.mark_order_partially_refunded(order_id_value uuid, refunded_cents_value integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
begin
  select * into selected_order from public.orders where id = order_id_value for update;
  if not found or selected_order.payment_status not in ('paid', 'partially_refunded') then
    return false;
  end if;
  if refunded_cents_value <= selected_order.refunded_cents then
    return false;
  end if;
  if refunded_cents_value <= 0 or refunded_cents_value >= selected_order.total_cents then
    raise exception 'INVALID_REFUND_TOTAL';
  end if;

  update public.orders
  set payment_status = 'partially_refunded', refunded_cents = refunded_cents_value
  where id = order_id_value;

  insert into public.order_status_events (order_id, status, message, metadata)
  values (
    order_id_value,
    'partially_refunded',
    'Un remboursement partiel a été confirmé.',
    jsonb_build_object('refundedCents', refunded_cents_value)
  );

  insert into public.notifications (order_id, kind, recipient_email, payload, dedupe_key)
  values (
    order_id_value,
    'order_partially_refunded',
    selected_order.email,
    jsonb_build_object('orderNumber', selected_order.number, 'refundedCents', refunded_cents_value),
    'order-partially-refunded:' || order_id_value::text || ':' || refunded_cents_value::text
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return true;
end;
$$;

create or replace function public.mark_order_refunded(order_id_value uuid, restock_items boolean default false)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_order record;
  selected_item record;
  refund_changed boolean := false;
  restock_changed boolean := false;
begin
  select * into selected_order from public.orders where id = order_id_value for update;
  if not found or selected_order.payment_status not in ('paid', 'partially_refunded', 'refunded') then
    return false;
  end if;

  if restock_items and selected_order.restocked_at is null then
    for selected_item in select * from public.order_items where order_id = order_id_value loop
      update public.product_variants
      set stock_on_hand = stock_on_hand + selected_item.quantity
      where id = selected_item.variant_id;
      insert into public.inventory_movements (variant_id, order_id, quantity_delta, reason, note, actor)
      values (selected_item.variant_id, order_id_value, selected_item.quantity, 'refund_restock', selected_order.number, 'admin');
    end loop;
    update public.orders set restocked_at = now() where id = order_id_value;
    restock_changed := true;
  end if;

  if selected_order.payment_status <> 'refunded' then
    update public.orders
    set status = 'refunded', payment_status = 'refunded', refunded_cents = total_cents, refunded_at = now()
    where id = order_id_value;

    insert into public.order_status_events (order_id, status, message)
    values (order_id_value, 'refunded', 'Remboursement confirmé.');

    insert into public.notifications (order_id, kind, recipient_email, payload)
    values (order_id_value, 'order_refunded', selected_order.email, jsonb_build_object('orderNumber', selected_order.number));
    refund_changed := true;
  end if;

  return refund_changed or restock_changed;
end;
$$;

create or replace function public.release_expired_orders()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  expired_order record;
  released_count integer := 0;
begin
  for expired_order in
    select id from public.orders
    where status = 'pending_payment'
      and reservation_expires_at < now()
      and stripe_checkout_session_id is null
    for update skip locked
  loop
    if public.release_order_reservation(expired_order.id, 'Session de paiement expirée.') then
      released_count := released_count + 1;
    end if;
  end loop;
  return released_count;
end;
$$;

create or replace function public.check_rate_limit(
  key_value text,
  maximum_requests integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  resulting_count integer;
begin
  insert into public.api_rate_limits (key, request_count, reset_at)
  values (key_value, 1, now() + make_interval(secs => window_seconds))
  on conflict (key) do update set
    request_count = case
      when public.api_rate_limits.reset_at <= now() then 1
      else public.api_rate_limits.request_count + 1
    end,
    reset_at = case
      when public.api_rate_limits.reset_at <= now() then now() + make_interval(secs => window_seconds)
      else public.api_rate_limits.reset_at
    end
  returning request_count into resulting_count;

  return resulting_count <= maximum_requests;
end;
$$;

create or replace function public.claim_payment_event(
  provider_event_id_value text,
  event_type_value text,
  payload_value jsonb
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  claimed_id uuid;
begin
  insert into public.payment_events (
    provider_event_id,
    event_type,
    payload,
    status,
    attempt_count,
    processed_at,
    updated_at
  ) values (
    provider_event_id_value,
    event_type_value,
    coalesce(payload_value, '{}'::jsonb),
    'processing',
    1,
    null,
    now()
  )
  on conflict (provider_event_id) do update set
    event_type = excluded.event_type,
    payload = excluded.payload,
    status = 'processing',
    attempt_count = public.payment_events.attempt_count + 1,
    last_error = null,
    updated_at = now()
  where public.payment_events.status = 'failed'
    or (
      public.payment_events.status = 'processing'
      and public.payment_events.updated_at < now() - interval '10 minutes'
    )
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

create or replace function public.complete_payment_event(provider_event_id_value text, order_id_value uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update public.payment_events
  set
    order_id = order_id_value,
    status = 'processed',
    processed_at = now(),
    last_error = null,
    updated_at = now()
  where provider_event_id = provider_event_id_value and status = 'processing';
  return found;
end;
$$;

create or replace function public.fail_payment_event(provider_event_id_value text, error_code_value text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update public.payment_events
  set
    status = 'failed',
    last_error = left(coalesce(error_code_value, 'processing_error'), 120),
    updated_at = now()
  where provider_event_id = provider_event_id_value and status = 'processing';
  return found;
end;
$$;

create or replace function public.admin_update_variant(
  variant_id_value text,
  label_value text,
  sku_value text,
  price_cents_value integer,
  compare_at_price_cents_value integer,
  stock_on_hand_value integer,
  weight_grams_value integer,
  active_value boolean
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_variant record;
  stock_delta integer;
begin
  select * into selected_variant from public.product_variants where id = variant_id_value for update;
  if not found then
    return false;
  end if;
  if stock_on_hand_value < selected_variant.stock_reserved or stock_on_hand_value < 0 then
    raise exception 'STOCK_BELOW_RESERVED';
  end if;
  if price_cents_value < 0 or weight_grams_value <= 0 or (compare_at_price_cents_value is not null and compare_at_price_cents_value < price_cents_value) then
    raise exception 'INVALID_VARIANT_VALUE';
  end if;
  stock_delta := stock_on_hand_value - selected_variant.stock_on_hand;
  update public.product_variants
  set
    label = label_value,
    sku = sku_value,
    price_cents = price_cents_value,
    compare_at_price_cents = compare_at_price_cents_value,
    stock_on_hand = stock_on_hand_value,
    weight_grams = weight_grams_value,
    active = active_value
  where id = variant_id_value;
  if stock_delta <> 0 then
    insert into public.inventory_movements (variant_id, quantity_delta, reason, note, actor)
    values (variant_id_value, stock_delta, 'manual_adjustment', 'Modification depuis la fiche produit.', 'admin');
  end if;
  return true;
end;
$$;

create or replace function public.update_customer_profile(
  user_id_value uuid,
  email_value text,
  display_name_value text,
  phone_value text,
  marketing_consent_value boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, phone, marketing_consent)
  values (
    user_id_value,
    lower(trim(email_value)),
    trim(display_name_value),
    nullif(trim(phone_value), ''),
    marketing_consent_value
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    phone = excluded.phone,
    marketing_consent = excluded.marketing_consent;

  if marketing_consent_value then
    insert into public.newsletter_subscribers (
      email,
      status,
      consent_source,
      consent_at,
      confirmed_at,
      unsubscribed_at,
      confirmation_token_hash,
      confirmation_expires_at
    ) values (
      lower(trim(email_value)),
      'subscribed',
      'account',
      now(),
      now(),
      null,
      null,
      null
    )
    on conflict (email) do update set
      status = 'subscribed',
      consent_source = 'account',
      consent_at = now(),
      confirmed_at = now(),
      unsubscribed_at = null,
      confirmation_token_hash = null,
      confirmation_expires_at = null;
  else
    update public.newsletter_subscribers
    set status = 'unsubscribed', unsubscribed_at = now()
    where email = lower(trim(email_value));
  end if;
end;
$$;

create or replace function public.create_customer_address(user_id_value uuid, address_value jsonb)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  address_count integer;
  make_default boolean;
  created_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(user_id_value::text, 0));
  select count(*) into address_count from public.customer_addresses where user_id = user_id_value;
  if address_count >= 10 then
    raise exception 'ADDRESS_LIMIT_REACHED';
  end if;
  make_default := coalesce((address_value ->> 'isDefault')::boolean, false) or address_count = 0;
  if make_default then
    update public.customer_addresses set is_default = false where user_id = user_id_value;
  end if;
  insert into public.customer_addresses (
    user_id,
    label,
    first_name,
    last_name,
    address_line1,
    address_line2,
    city,
    province,
    postal_code,
    country,
    is_default
  ) values (
    user_id_value,
    trim(address_value ->> 'label'),
    trim(address_value ->> 'firstName'),
    trim(address_value ->> 'lastName'),
    trim(address_value ->> 'addressLine1'),
    trim(coalesce(address_value ->> 'addressLine2', '')),
    trim(address_value ->> 'city'),
    upper(trim(address_value ->> 'province')),
    regexp_replace(upper(trim(address_value ->> 'postalCode')), '\s+', ' ', 'g'),
    'CA',
    make_default
  ) returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.update_customer_address(
  user_id_value uuid,
  address_id_value uuid,
  address_value jsonb
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  selected_address record;
  make_default boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(user_id_value::text, 0));
  select * into selected_address
  from public.customer_addresses
  where id = address_id_value and user_id = user_id_value
  for update;
  if not found then
    return false;
  end if;
  make_default := coalesce((address_value ->> 'isDefault')::boolean, false) or selected_address.is_default;
  if make_default then
    update public.customer_addresses
    set is_default = false
    where user_id = user_id_value and id <> address_id_value;
  end if;
  update public.customer_addresses
  set
    label = trim(address_value ->> 'label'),
    first_name = trim(address_value ->> 'firstName'),
    last_name = trim(address_value ->> 'lastName'),
    address_line1 = trim(address_value ->> 'addressLine1'),
    address_line2 = trim(coalesce(address_value ->> 'addressLine2', '')),
    city = trim(address_value ->> 'city'),
    province = upper(trim(address_value ->> 'province')),
    postal_code = regexp_replace(upper(trim(address_value ->> 'postalCode')), '\s+', ' ', 'g'),
    country = 'CA',
    is_default = make_default
  where id = address_id_value and user_id = user_id_value;
  return true;
end;
$$;

create or replace function public.delete_customer_address(user_id_value uuid, address_id_value uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  was_default boolean;
  replacement_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(user_id_value::text, 0));
  delete from public.customer_addresses
  where id = address_id_value and user_id = user_id_value
  returning is_default into was_default;
  if not found then
    return false;
  end if;
  if was_default then
    select id into replacement_id
    from public.customer_addresses
    where user_id = user_id_value
    order by created_at asc
    limit 1
    for update;
    if replacement_id is not null then
      update public.customer_addresses set is_default = true where id = replacement_id;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.adjust_inventory(
  variant_id_value text,
  quantity_delta_value integer,
  reason_value text,
  note_value text default ''
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  selected_variant record;
  next_stock integer;
begin
  if quantity_delta_value = 0 or reason_value not in ('receipt', 'loss', 'correction_add', 'correction_remove') then
    raise exception 'INVALID_INVENTORY_ADJUSTMENT';
  end if;
  if reason_value in ('receipt', 'correction_add') and quantity_delta_value < 0 then
    raise exception 'INVALID_INVENTORY_DIRECTION';
  end if;
  if reason_value in ('loss', 'correction_remove') and quantity_delta_value > 0 then
    raise exception 'INVALID_INVENTORY_DIRECTION';
  end if;
  select * into selected_variant from public.product_variants where id = variant_id_value for update;
  if not found then
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  next_stock := selected_variant.stock_on_hand + quantity_delta_value;
  if next_stock < selected_variant.stock_reserved or next_stock < 0 then
    raise exception 'STOCK_BELOW_RESERVED';
  end if;
  update public.product_variants set stock_on_hand = next_stock where id = variant_id_value;
  insert into public.inventory_movements (variant_id, quantity_delta, reason, note, actor)
  values (variant_id_value, quantity_delta_value, reason_value, left(coalesce(note_value, ''), 1000), 'admin');
  return next_stock;
end;
$$;

create or replace function public.analytics_funnel(days_value integer default 30)
returns table(event_name text, event_count bigint)
language sql
security definer set search_path = public
as $$
  select analytics_events.event_name, count(*)::bigint
  from public.analytics_events
  where created_at >= now() - make_interval(days => greatest(1, least(days_value, 365)))
  group by analytics_events.event_name
  order by count(*) desc;
$$;

create or replace function public.analytics_daily(days_value integer default 30)
returns table(day date, event_name text, event_count bigint)
language sql
security definer set search_path = public
as $$
  select created_at::date, analytics_events.event_name, count(*)::bigint
  from public.analytics_events
  where created_at >= now() - make_interval(days => greatest(1, least(days_value, 365)))
  group by created_at::date, analytics_events.event_name
  order by created_at::date asc;
$$;

create or replace function public.analytics_top_paths(days_value integer default 30, result_limit integer default 10)
returns table(path text, view_count bigint)
language sql
security definer set search_path = public
as $$
  select analytics_events.path, count(*)::bigint
  from public.analytics_events
  where event_name = 'page_view'
    and created_at >= now() - make_interval(days => greatest(1, least(days_value, 365)))
  group by analytics_events.path
  order by count(*) desc
  limit greatest(1, least(result_limit, 50));
$$;

create or replace function public.admin_customer_summary()
returns table(
  email text,
  customer_name text,
  order_count bigint,
  paid_cents bigint,
  last_order_at timestamptz,
  marketing_consent boolean
)
language sql
security definer set search_path = public
as $$
  select
    lower(orders.email),
    max(trim(orders.first_name || ' ' || orders.last_name)),
    count(*)::bigint,
    coalesce(
      sum(
        case
          when payment_status in ('paid', 'partially_refunded', 'refunded')
            then greatest(total_cents - refunded_cents, 0)
          else 0
        end
      ),
      0
    )::bigint,
    max(created_at),
    bool_or(orders.marketing_consent)
  from public.orders
  group by lower(orders.email)
  order by max(created_at) desc;
$$;

create or replace function public.admin_inventory_summary()
returns table(variant_id text, sold_units bigint, loss_units bigint)
language sql
security definer set search_path = public
as $$
  with sold as (
    select items.variant_id, sum(items.quantity)::bigint as units
    from public.order_items items
    join public.orders on orders.id = items.order_id
    where orders.paid_at is not null and items.variant_id is not null
    group by items.variant_id
  ), losses as (
    select movements.variant_id, abs(sum(movements.quantity_delta))::bigint as units
    from public.inventory_movements movements
    where movements.reason = 'loss'
    group by movements.variant_id
  )
  select variants.id, coalesce(sold.units, 0), coalesce(losses.units, 0)
  from public.product_variants variants
  left join sold on sold.variant_id = variants.id
  left join losses on losses.variant_id = variants.id;
$$;

create or replace function public.admin_recall_impact(lot_codes_value text[])
returns table(
  lot_code text,
  email text,
  customer_name text,
  order_numbers text[],
  affected_units bigint
)
language sql
security definer set search_path = public
as $$
  select
    items.lot_code,
    lower(orders.email),
    max(trim(orders.first_name || ' ' || orders.last_name)),
    array_agg(distinct orders.number order by orders.number),
    sum(items.quantity)::bigint
  from public.order_items items
  join public.orders on orders.id = items.order_id
  where items.lot_code = any(lot_codes_value)
    and orders.payment_status in ('paid', 'partially_refunded', 'refunded')
    and orders.status <> 'cancelled'
  group by items.lot_code, lower(orders.email)
  order by items.lot_code, max(orders.created_at) desc;
$$;

create or replace function public.prune_operational_data()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  analytics_deleted integer := 0;
  limits_deleted integer := 0;
  notifications_deleted integer := 0;
  subscribers_deleted integer := 0;
begin
  delete from public.analytics_events where created_at < now() - interval '13 months';
  get diagnostics analytics_deleted = row_count;
  delete from public.api_rate_limits where reset_at < now() - interval '1 day';
  get diagnostics limits_deleted = row_count;
  delete from public.notifications where status = 'sent' and sent_at < now() - interval '90 days';
  get diagnostics notifications_deleted = row_count;
  delete from public.newsletter_subscribers
  where status = 'pending' and confirmation_expires_at < now() - interval '30 days';
  get diagnostics subscribers_deleted = row_count;
  return jsonb_build_object(
    'analytics', analytics_deleted,
    'rateLimits', limits_deleted,
    'notifications', notifications_deleted,
    'pendingSubscribers', subscribers_deleted
  );
end;
$$;

create or replace function public.commerce_schema_version()
returns integer
language sql
immutable
security definer set search_path = public
as $$
  select 6;
$$;

alter table public.profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.lots enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.shipments enable row level security;
alter table public.payment_events enable row level security;
alter table public.notifications enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.submissions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.operational_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.api_rate_limits enable row level security;

drop policy if exists "Public reads active products" on public.products;
create policy "Public reads active products" on public.products for select using (active = true);
drop policy if exists "Public reads active variants" on public.product_variants;
create policy "Public reads active variants" on public.product_variants for select using (
  active = true and exists (select 1 from public.products where products.id = product_variants.product_id and products.active = true)
);
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users read own addresses" on public.customer_addresses;
create policy "Users read own addresses" on public.customer_addresses for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Users create own addresses" on public.customer_addresses;
drop policy if exists "Users update own addresses" on public.customer_addresses;
drop policy if exists "Users delete own addresses" on public.customer_addresses;
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders" on public.orders for select using (customer_id = auth.uid() or public.is_admin());
drop policy if exists "Users read own order items" on public.order_items;
create policy "Users read own order items" on public.order_items for select using (
  exists (select 1 from public.orders where orders.id = order_items.order_id and (orders.customer_id = auth.uid() or public.is_admin()))
);
drop policy if exists "Users read own order events" on public.order_status_events;
create policy "Users read own order events" on public.order_status_events for select using (
  public = true and exists (select 1 from public.orders where orders.id = order_status_events.order_id and (orders.customer_id = auth.uid() or public.is_admin()))
);
drop policy if exists "Users read own shipments" on public.shipments;
create policy "Users read own shipments" on public.shipments for select using (
  exists (select 1 from public.orders where orders.id = shipments.order_id and (orders.customer_id = auth.uid() or public.is_admin()))
);

revoke all on function public.reserve_order(uuid, text, jsonb, text, jsonb, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.attach_stripe_session(uuid, text) from public, anon, authenticated;
revoke all on function public.release_order_reservation(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_order_payment(uuid, text, text, text, integer, integer, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.mark_order_shipped(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_order_processing(uuid) from public, anon, authenticated;
revoke all on function public.mark_order_delivered(uuid) from public, anon, authenticated;
revoke all on function public.update_shipment_status(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_order_partially_refunded(uuid, integer) from public, anon, authenticated;
revoke all on function public.mark_order_refunded(uuid, boolean) from public, anon, authenticated;
revoke all on function public.release_expired_orders() from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_payment_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.complete_payment_event(text, uuid) from public, anon, authenticated;
revoke all on function public.fail_payment_event(text, text) from public, anon, authenticated;
revoke all on function public.admin_update_variant(text, text, text, integer, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.update_customer_profile(uuid, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.create_customer_address(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_customer_address(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.delete_customer_address(uuid, uuid) from public, anon, authenticated;
revoke all on function public.adjust_inventory(text, integer, text, text) from public, anon, authenticated;
revoke all on function public.analytics_funnel(integer) from public, anon, authenticated;
revoke all on function public.analytics_daily(integer) from public, anon, authenticated;
revoke all on function public.analytics_top_paths(integer, integer) from public, anon, authenticated;
revoke all on function public.admin_customer_summary() from public, anon, authenticated;
revoke all on function public.admin_inventory_summary() from public, anon, authenticated;
revoke all on function public.admin_recall_impact(text[]) from public, anon, authenticated;
revoke all on function public.prune_operational_data() from public, anon, authenticated;
revoke all on function public.commerce_schema_version() from public, anon, authenticated;
grant execute on function public.reserve_order(uuid, text, jsonb, text, jsonb, integer, integer, integer, integer) to service_role;
grant execute on function public.attach_stripe_session(uuid, text) to service_role;
grant execute on function public.release_order_reservation(uuid, text) to service_role;
grant execute on function public.complete_order_payment(uuid, text, text, text, integer, integer, integer, integer, jsonb) to service_role;
grant execute on function public.mark_order_shipped(uuid, text, text, text, text) to service_role;
grant execute on function public.mark_order_processing(uuid) to service_role;
grant execute on function public.mark_order_delivered(uuid) to service_role;
grant execute on function public.update_shipment_status(uuid, text, text, jsonb) to service_role;
grant execute on function public.mark_order_partially_refunded(uuid, integer) to service_role;
grant execute on function public.mark_order_refunded(uuid, boolean) to service_role;
grant execute on function public.release_expired_orders() to service_role;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.claim_payment_event(text, text, jsonb) to service_role;
grant execute on function public.complete_payment_event(text, uuid) to service_role;
grant execute on function public.fail_payment_event(text, text) to service_role;
grant execute on function public.admin_update_variant(text, text, text, integer, integer, integer, integer, boolean) to service_role;
grant execute on function public.update_customer_profile(uuid, text, text, text, boolean) to service_role;
grant execute on function public.create_customer_address(uuid, jsonb) to service_role;
grant execute on function public.update_customer_address(uuid, uuid, jsonb) to service_role;
grant execute on function public.delete_customer_address(uuid, uuid) to service_role;
grant execute on function public.adjust_inventory(text, integer, text, text) to service_role;
grant execute on function public.analytics_funnel(integer) to service_role;
grant execute on function public.analytics_daily(integer) to service_role;
grant execute on function public.analytics_top_paths(integer, integer) to service_role;
grant execute on function public.admin_customer_summary() to service_role;
grant execute on function public.admin_inventory_summary() to service_role;
grant execute on function public.admin_recall_impact(text[]) to service_role;
grant execute on function public.prune_operational_data() to service_role;
grant execute on function public.commerce_schema_version() to service_role;
grant usage, select on sequence public.avana_order_number_seq to service_role;

revoke all on table public.operational_records from anon, authenticated;
revoke all on table public.inventory_movements from anon, authenticated;
revoke insert, update, delete on table public.profiles from anon, authenticated;
revoke insert, update, delete on table public.customer_addresses from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;
revoke insert, update, delete on table public.product_variants from anon, authenticated;
revoke insert, update, delete on table public.lots from anon, authenticated;
revoke insert, update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_items from anon, authenticated;
revoke insert, update, delete on table public.order_status_events from anon, authenticated;
revoke insert, update, delete on table public.shipments from anon, authenticated;
revoke insert, update, delete on table public.payment_events from anon, authenticated;
revoke insert, update, delete on table public.notifications from anon, authenticated;
revoke insert, update, delete on table public.newsletter_subscribers from anon, authenticated;
revoke insert, update, delete on table public.submissions from anon, authenticated;
revoke insert, update, delete on table public.analytics_events from anon, authenticated;
revoke insert, update, delete on table public.marketing_campaigns from anon, authenticated;
revoke insert, update, delete on table public.audit_logs from anon, authenticated;
revoke insert, update, delete on table public.api_rate_limits from anon, authenticated;

-- Administrative session authority (schema version 6).
begin;

create table if not exists public.admin_sessions (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'admin' check (role = 'admin'),
  mfa_verified boolean not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '2 hours 1 minute')
);
alter table public.admin_sessions enable row level security;
revoke all on table public.admin_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_sessions to service_role;

create or replace function public.register_admin_session(
  session_hash_value text, expires_at_value timestamptz,
  mfa_verified_value boolean, previous_hash_value text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- Credential verification happens in the server before this privileged RPC.
  -- Reauthentication rotates this browser's session in the same transaction.
  insert into public.admin_sessions(session_hash, expires_at, mfa_verified)
    values (session_hash_value, expires_at_value, mfa_verified_value);
  update public.admin_sessions set revoked_at = coalesce(revoked_at, now())
    where session_hash = previous_hash_value;
  -- Only expired authority is pruned; an unexpired revoked token stays revoked.
  delete from public.admin_sessions where expires_at < now() - interval '7 days';
end;
$$;

create or replace function public.is_admin_session_active(session_hash_value text, require_mfa boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_sessions
    where session_hash = session_hash_value and role = 'admin'
      and revoked_at is null and expires_at > now()
      and (not require_mfa or mfa_verified));
$$;

create or replace function public.revoke_admin_session(session_hash_value text)
returns boolean language sql security definer set search_path = public as $$
  with revoked as (
    update public.admin_sessions set revoked_at = now()
      where session_hash = session_hash_value and revoked_at is null
      returning session_hash
  ) select exists(select 1 from revoked);
$$;

revoke all on function public.register_admin_session(text, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.is_admin_session_active(text, boolean) from public, anon, authenticated;
revoke all on function public.revoke_admin_session(text) from public, anon, authenticated;
grant execute on function public.register_admin_session(text, timestamptz, boolean, text) to service_role;
grant execute on function public.is_admin_session_active(text, boolean) to service_role;
grant execute on function public.revoke_admin_session(text) to service_role;

create or replace function public.commerce_schema_version()
returns integer language sql immutable security definer set search_path = public as $$ select 6; $$;
revoke all on function public.commerce_schema_version() from public, anon, authenticated;
grant execute on function public.commerce_schema_version() to service_role;

commit;
