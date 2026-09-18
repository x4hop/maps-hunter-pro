-- Introduce true lifetime activation codes without changing legacy annual rows.
-- Legacy annual rows keep their original 365-day semantics; new Lifetime codes set is_lifetime=1.
ALTER TABLE manual_licenses
  ADD COLUMN is_lifetime INTEGER NOT NULL DEFAULT 0 CHECK(is_lifetime IN (0,1));