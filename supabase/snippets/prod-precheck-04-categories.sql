-- Probe prod: ¿hay rubros activos para el select del formulario?
select count(*) as active_categories
from public.categories
where is_active = true;
