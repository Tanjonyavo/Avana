-- READ ONLY. Run with the SQL editor/administrative connection on staging.
-- Returns schema/security metadata only: no customer rows, tokens or credentials.
with app_tables as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname=any(array[
    'profiles','customer_addresses','products','product_variants','lots','orders',
    'order_items','inventory_movements','order_status_events','shipments',
    'payment_events','notifications','newsletter_subscribers','submissions',
    'analytics_events','marketing_campaigns','operational_records','audit_logs',
    'api_rate_limits','admin_sessions'])
), facts as (
  select 'schema_version' as key, to_jsonb(public.commerce_schema_version()) as value
  union all
  select 'table:'||relname, jsonb_build_object('rls',relrowsecurity,'force_rls',relforcerowsecurity)
  from app_tables
  union all
  select 'column:'||t.relname||'.'||a.attname,
    jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
      'default_hash',md5(coalesce(pg_get_expr(d.adbin,d.adrelid),'')))
  from app_tables t join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid=t.oid and d.adnum=a.attnum
  union all
  select 'constraint:'||t.relname||'.'||c.conname,to_jsonb(md5(pg_get_constraintdef(c.oid)))
    from app_tables t join pg_constraint c on c.conrelid=t.oid
  union all
  select 'index:'||t.relname||'.'||i.relname,to_jsonb(md5(pg_get_indexdef(i.oid)))
    from app_tables t join pg_index x on x.indrelid=t.oid join pg_class i on i.oid=x.indexrelid
  union all
  select 'policy:'||schemaname||'.'||tablename||'.'||policyname,
    jsonb_build_object('command',cmd,'roles',roles,'permissive',permissive,
      'using_hash',md5(coalesce(qual,'')),'check_hash',md5(coalesce(with_check,'')))
    from pg_policies where (schemaname='public' and tablename in (select relname from app_tables))
      or (schemaname='storage' and tablename='objects')
  union all
  select 'table_privilege:'||t.relname||'.'||r.rolname||'.'||p.privilege,
    to_jsonb(has_table_privilege(r.oid,t.oid,p.privilege))
    from app_tables t cross join pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
    where r.rolname in ('anon','authenticated','service_role')
  union all
  select 'function:'||p.oid::regprocedure::text,
    jsonb_build_object('security_definer',p.prosecdef,'settings',p.proconfig,
      'definition_hash',md5(pg_get_functiondef(p.oid)),
      'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  union all
  select 'trigger:'||t.relname||'.'||g.tgname,to_jsonb(md5(pg_get_triggerdef(g.oid)))
    from app_tables t join pg_trigger g on g.tgrelid=t.oid where not g.tgisinternal
  union all
  select 'bucket:'||id,jsonb_build_object('public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)
    from storage.buckets where id in ('avana-public','avana-private')
  union all
  select 'schema_create:public.'||r.rolname,to_jsonb(has_schema_privilege(r.oid,'public','CREATE'))
    from pg_roles r where r.rolname in ('anon','authenticated','service_role')
)
select jsonb_object_agg(key,value order by key) as fingerprint from facts;
