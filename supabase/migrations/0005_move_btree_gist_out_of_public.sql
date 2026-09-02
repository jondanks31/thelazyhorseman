-- btree_gist landed in public because `create extension` defaults
-- there. The exclusion constraint on booking depends on its operator
-- classes, but the index references them by OID, so relocating the
-- extension does not disturb it. Verified after applying: the
-- constraint definition is unchanged and still enforced.
alter extension btree_gist set schema extensions;
