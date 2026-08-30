-- UUID generation for future domain tables.
create schema if not exists extensions;

create extension if not exists "pgcrypto" with schema extensions;

-- PostGIS enables approximate location and radius queries in the discovery phase.
create extension if not exists "postgis" with schema extensions;

-- pg_trgm enables typo-tolerant text matching in the discovery phase.
create extension if not exists "pg_trgm" with schema extensions;
