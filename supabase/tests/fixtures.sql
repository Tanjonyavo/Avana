-- Synthetic data only. The Vitest runner encloses each use in BEGIN/ROLLBACK.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.invalid', '{"role":"admin","display_name":"Customer A"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.invalid', '{"display_name":"Customer B"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'admin@example.invalid', '{}');
update public.profiles set role = 'admin' where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

insert into public.customer_addresses (
  id, user_id, label, first_name, last_name, address_line1, city, province, postal_code
) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Home A', 'A', 'Test', '1 Test Street', 'Montreal', 'QC', 'H2X 1Y4'),
  ('bbbbbbbb-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Home B', 'B', 'Test', '2 Test Street', 'Montreal', 'QC', 'H2X 1Y4');

insert into public.products (
  id, slug, name, category, short_description, description, image,
  origin, region, species, lot_code, status, active
) values
  ('test-active', 'test-active', 'Test active', 'Gousses', 'Test', 'Test', '/test.png', 'Test', 'Test', 'Test', 'TEST-LOT', 'available', true),
  ('test-inactive', 'test-inactive', 'Test inactive', 'Gousses', 'Test', 'Test', '/test.png', 'Test', 'Test', 'Test', 'TEST-LOT', 'available', false),
  ('test-waitlist', 'test-waitlist', 'Test waitlist', 'Gousses', 'Test', 'Test', '/test.png', 'Test', 'Test', 'Test', 'TEST-LOT', 'waitlist', true);
insert into public.product_variants (
  id, product_id, label, sku, price_cents, stock_on_hand, weight_grams, active
) values
  ('test-v1', 'test-active', 'Test', 'TEST-V1', 2500, 10, 25, true),
  ('test-v2', 'test-active', 'Test', 'TEST-V2', 3000, 1, 25, true),
  ('test-v-inactive', 'test-active', 'Test', 'TEST-INACTIVE', 2500, 10, 25, false),
  ('test-v-parent-inactive', 'test-inactive', 'Test', 'TEST-PARENT-INACTIVE', 2500, 10, 25, true),
  ('test-v-waitlist', 'test-waitlist', 'Test', 'TEST-WAITLIST', 2500, 10, 25, true);

insert into public.orders (
  id, number, customer_id, email, first_name, last_name, shipping_method,
  subtotal_cents, shipping_cents, total_cents
) values
  ('aaaaaaaa-2222-4222-8222-222222222222', 'TEST-ORDER-A', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.invalid', 'A', 'Test', 'standard', 2500, 800, 3300),
  ('bbbbbbbb-2222-4222-8222-222222222222', 'TEST-ORDER-B', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.invalid', 'B', 'Test', 'standard', 2500, 800, 3300),
  ('dddddddd-2222-4222-8222-222222222222', 'TEST-ORDER-GUEST', null, 'guest@example.invalid', 'Guest', 'Test', 'standard', 2500, 800, 3300);
insert into public.order_items (order_id, product_name, variant_label, sku, quantity, unit_price_cents, line_total_cents)
select id, 'Test', 'Test', 'TEST-V1', 1, 2500, 2500 from public.orders;
insert into public.order_status_events (order_id, status, message, public)
select id, 'test', 'Public event', true from public.orders;
insert into public.order_status_events (order_id, status, message, public)
select id, 'internal', 'Private event', false from public.orders;
insert into public.shipments (order_id, carrier, tracking_number)
select id, 'Test carrier', 'TEST-TRACKING' from public.orders;

insert into public.lots (id, code, country, region, species, grade, harvest_year, status, notes)
values ('test-lot', 'TEST-LOT', 'Test', 'Test', 'Test', 'Test', '2026', 'Disponible', 'Internal supplier note');
insert into public.inventory_movements (variant_id, quantity_delta, reason) values ('test-v1', 10, 'initial');
insert into public.payment_events (provider_event_id, event_type, payload) values ('evt_fixture', 'test', '{"internal":true}');
insert into public.notifications (kind, recipient_email) values ('test', 'b@example.invalid');
insert into public.newsletter_subscribers (email, consent_source) values ('b@example.invalid', 'test');
insert into public.submissions (kind, payload) values ('contact', '{"email":"b@example.invalid"}');
insert into public.analytics_events (event_name, anonymous_id, path) values ('page_view', 'fixture', '/');
insert into public.marketing_campaigns (subject, heading, body) values ('Test', 'Test', 'Test');
insert into public.operational_records (module, title, status) values ('fournisseurs', 'Test', 'Test');
insert into public.audit_logs (actor, action, entity_type, entity_id) values ('test', 'test', 'order', 'TEST-ORDER-B');
insert into public.api_rate_limits (key, reset_at) values ('fixture', now() + interval '1 hour');
