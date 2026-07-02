BEGIN;

TRUNCATE TABLE stock_requests, stock_movements, supplies RESTART IDENTITY CASCADE;

COMMIT;
