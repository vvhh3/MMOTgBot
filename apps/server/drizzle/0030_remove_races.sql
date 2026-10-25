-- race was added by the legacy startup compatibility code, not SQL migrations.
-- Fresh databases never had it. initializeDatabase conditionally drops it after
-- migrations, since SQLite has no DROP COLUMN IF EXISTS.
SELECT 1;
