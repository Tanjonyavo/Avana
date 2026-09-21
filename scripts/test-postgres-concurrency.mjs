import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { before, after, test } from "node:test";
import pg from "pg";

// Only a disposable local PostgreSQL service is accepted. Never use a Supabase
// connection here: the platform contract creates test roles/auth/storage tables.
const target = new URL(
  process.env.AVANA_TEST_POSTGRES_URL || "postgres://postgres@127.0.0.1:55432/avana_security_test",
);
assert(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "Only loopback PostgreSQL is allowed");
assert.equal(target.pathname, "/avana_security_test", "A dedicated test database is required");
const database = `avana_test_${randomUUID().replaceAll("-", "")}`;
const owner = new pg.Client({ connectionString: target.href });
const clients = [];
let observer,
  left,
  right,
  created = false;

before(
  async () => {
    await owner.connect();
    assert.match(database, /^avana_test_[a-f0-9]{32}$/);
    await owner.query(`create database ${database}`);
    created = true;
    const url = new URL(target);
    url.pathname = `/${database}`;
    for (let i = 0; i < 3; i++) {
      const client = new pg.Client({ connectionString: url.href });
      await client.connect();
      clients.push(client);
      await client.query("set statement_timeout = '10s'");
    }
    [observer, left, right] = clients;
    // Roles are cluster-wide. This disposable service is shared by this runner's
    // temporary databases, so reuse only their exact non-login role definitions.
    const platform = readFileSync("supabase/tests/platform-contract.sql", "utf8");
    const existing = await owner.query(
      "select rolname,rolsuper,rolbypassrls,rolcanlogin from pg_roles where rolname=any($1)",
      [["anon", "authenticated", "service_role"]],
    );
    for (const role of existing.rows) {
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolcanlogin, false);
      assert.equal(role.rolbypassrls, role.rolname === "service_role");
    }
    await observer.query(
      platform.replace(/^create role (anon|authenticated|service_role) [^;]+;$/gm, (line, role) =>
        existing.rows.some((row) => row.rolname === role) ? "" : line,
      ),
    );
    await observer.query(readFileSync("supabase/commerce.sql", "utf8"));
    await observer.query(readFileSync("supabase/submissions.sql", "utf8"));
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await observer.query(readFileSync(`supabase/migrations/${file}`, "utf8"));
    }
    await observer.query(readFileSync("supabase/tests/fixtures.sql", "utf8"));
    const metadata = await observer.query(readFileSync("supabase/tests/schema-fingerprint.sql", "utf8"));
    mkdirSync("docs/security/phase2", { recursive: true });
    writeFileSync(
      "docs/security/phase2/local-schema.json",
      JSON.stringify(metadata.rows[0].fingerprint, null, 2) + "\n",
    );
    await left.query("set role service_role");
    await right.query("set role service_role");
  },
  { timeout: 30_000 },
);

after(async () => {
  await Promise.allSettled(clients.map((client) => client.end()));
  if (created) await owner.query(`drop database ${database}`); // This runner's own generated database only.
  await owner.end();
});

async function variant() {
  const id = `concurrent-${randomUUID()}`;
  await observer.query(
    "insert into public.product_variants(id,product_id,label,sku,price_cents,stock_on_hand,weight_grams,active) values ($1,'test-active','Concurrency',$1,2500,1,25,true)",
    [id],
  );
  return id;
}
function reserve(client, id, attempt = randomUUID()) {
  return client.query("select public.reserve_order($1,$2,$3,'standard',$4,800,1600,6000,30) as value", [
    attempt,
    "c".repeat(64),
    JSON.stringify({ email: "concurrency@example.invalid", firstName: "Test", lastName: "Local" }),
    JSON.stringify([{ variant_id: id, quantity: 1 }]),
  ]);
}
async function waitForLock() {
  const pid = (
    await observer.query(
      "select pid from pg_stat_activity where datname=$1 and pid<>pg_backend_pid() and wait_event_type='Lock'",
      [database],
    )
  ).rows;
  if (pid.length) return;
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await observer.query(
      "select 1 from pg_stat_activity where datname=$1 and wait_event_type='Lock'",
      [database],
    );
    if (result.rowCount) return;
  }
  assert.fail("Expected a real PostgreSQL lock wait between independent connections");
}
async function stock(id) {
  return (
    await observer.query("select stock_on_hand,stock_reserved from public.product_variants where id=$1", [id])
  ).rows[0];
}
async function overlap(first, second) {
  await left.query("begin");
  await right.query("begin");
  let pending;
  try {
    const a = await first();
    pending = second().then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    await waitForLock();
    await left.query("commit");
    const b = await pending;
    await right.query(b.error ? "rollback" : "commit");
    return [a, b];
  } catch (error) {
    await left.query("rollback");
    if (pending) await pending;
    await right.query("rollback");
    throw error;
  }
}

test("two customers cannot both reserve the last unit", async () => {
  const id = await variant();
  const [, second] = await overlap(
    () => reserve(left, id),
    () => reserve(right, id),
  );
  assert.match(second.error?.message || "", /INSUFFICIENT_STOCK/);
  assert.deepEqual(await stock(id), { stock_on_hand: 1, stock_reserved: 1 });
  assert.equal(
    (
      await observer.query(
        "select sum(quantity)::integer as total from public.order_items where variant_id=$1",
        [id],
      )
    ).rows[0].total,
    1,
  );
});

test("concurrent retries of one checkout attempt return one order and one reservation", async () => {
  const id = await variant(),
    attempt = randomUUID();
  const [first, second] = await overlap(
    () => reserve(left, id, attempt),
    () => reserve(right, id, attempt),
  );
  assert.equal(second.error, undefined);
  assert.equal(first.rows[0].value.id, second.value.rows[0].value.id);
  assert.deepEqual(await stock(id), { stock_on_hand: 1, stock_reserved: 1 });
});

test("concurrent payment and refund deliveries each adjust inventory only once", async () => {
  const id = await variant();
  const order = (await reserve(left, id)).rows[0].value;
  const session = `cs_local_${randomUUID()}`;
  await left.query("select public.attach_stripe_session($1,$2)", [order.id, session]);
  const pay = (client) =>
    client.query(
      "select public.complete_order_payment($1,$2,'pi_local','cus_local',2500,800,0,3300,$3) as value",
      [order.id, session, JSON.stringify({ country: "CA" })],
    );
  const [, payment] = await overlap(
    () => pay(left),
    () => pay(right),
  );
  assert.equal(payment.error, undefined);
  assert.deepEqual(await stock(id), { stock_on_hand: 0, stock_reserved: 0 });
  assert.equal(
    (
      await observer.query(
        "select count(*)::integer as total from public.inventory_movements where order_id=$1 and reason='sale'",
        [order.id],
      )
    ).rows[0].total,
    1,
  );
  const refund = (client) => client.query("select public.mark_order_refunded($1,true) as value", [order.id]);
  const [, refunded] = await overlap(
    () => refund(left),
    () => refund(right),
  );
  assert.equal(refunded.error, undefined);
  assert.deepEqual(await stock(id), { stock_on_hand: 1, stock_reserved: 0 });
  assert.equal(
    (
      await observer.query(
        "select count(*)::integer as total from public.inventory_movements where order_id=$1 and reason='refund_restock'",
        [order.id],
      )
    ).rows[0].total,
    1,
  );
});

test("session revocation is visible on another database connection after commit", async () => {
  const hash = "e".repeat(64);
  await left.query("select public.register_admin_session($1,now()+interval '1 hour',true,null)", [hash]);
  assert.equal(
    (await right.query("select public.is_admin_session_active($1,true) as active", [hash])).rows[0].active,
    true,
  );
  await left.query("select public.revoke_admin_session($1)", [hash]);
  assert.equal(
    (await right.query("select public.is_admin_session_active($1,true) as active", [hash])).rows[0].active,
    false,
  );
});
