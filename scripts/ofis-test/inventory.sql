SELECT jsonb_build_object(
  'database', current_database(), 'data_directory', current_setting('data_directory'),
  'server_address', inet_server_addr(), 'server_port', current_setting('port'),
  'system_identifier', (SELECT system_identifier::text FROM pg_control_system()),
  'roles', (SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassrls',rolbypassrls,'inherit',rolinherit)) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','authenticator')),
  'memberships', (SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname)) FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member),
  'constraints', (SELECT jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE connamespace='public'::regnamespace),
  'triggers', (SELECT jsonb_agg(pg_get_triggerdef(oid)) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)),
  'tables', (SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl)) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'),
  'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
  'effective_permissions', (SELECT jsonb_agg(jsonb_build_object('role',r,'table',t,'privilege',p,'allowed',has_table_privilege(r,'public.'||t,p))) FROM unnest(ARRAY['anon','authenticated','service_role']) r CROSS JOIN unnest(ARRAY['sales_projects','sales_tasks','office_operations']) t CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p WHERE to_regclass('public.'||t) IS NOT NULL)
);
