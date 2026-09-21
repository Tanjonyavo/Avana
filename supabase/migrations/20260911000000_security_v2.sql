begin;

update storage.buckets
set
  file_size_limit = 8000000,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'avana-public';

update storage.buckets
set
  public = false,
  file_size_limit = 8000000,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
where id = 'avana-private';

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

create or replace function public.commerce_schema_version()
returns integer
language sql
immutable
security definer set search_path = public
as $$
  select 4;
$$;

revoke all on function public.reserve_order(uuid, text, jsonb, text, jsonb, integer, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.attach_stripe_session(uuid, text) from public, anon, authenticated;
revoke all on function public.commerce_schema_version() from public, anon, authenticated;

grant execute on function public.reserve_order(uuid, text, jsonb, text, jsonb, integer, integer, integer, integer)
  to service_role;
grant execute on function public.attach_stripe_session(uuid, text) to service_role;
grant execute on function public.commerce_schema_version() to service_role;

commit;
