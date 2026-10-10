-- 002_ensure_columns: adds any missing columns to pre-existing tables.
-- Used when the database already contains users/foods/invoices tables from an
-- older or hand-made schema. Only missing columns are added; existing
-- columns, indexes and data are left completely untouched.
-- (A new database already has all of these from 001_init.sql.)

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE foods ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE foods ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS availability BOOLEAN;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE foods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS food_id BIGINT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS food_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Same duplicate-proof invoice numbering as 001_init.sql.
CREATE SEQUENCE IF NOT EXISTS invoice_num_seq;
