-- Probe prod: ¿puede authenticated leer categories/skills/skill_requests?
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('categories', 'skills', 'skill_requests')
  and grantee in ('anon', 'authenticated')
group by 1, 2
order by 1, 2;
