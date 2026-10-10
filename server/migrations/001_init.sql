-- 001_init: core tables for users, foods and invoices.
-- Idempotent and non-destructive: safe to run on a database that already
-- has some of these objects. Nothing here drops or modifies existing data.

-- Users (authentication + roles: admin / client)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foods (menu items)
CREATE TABLE IF NOT EXISTS foods (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL DEFAULT '',
  image TEXT,
  availability BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT foods_name_category_key UNIQUE (name, category)
);

CREATE INDEX IF NOT EXISTS foods_category_idx ON foods (category);

-- Invoices / orders. The food name, price and total are snapshots taken at
-- the time the invoice is created (stored prices can't be changed later by
-- editing the food).
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  food_id BIGINT REFERENCES foods (id) ON DELETE SET NULL,
  food_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_food_id_idx ON invoices (food_id);

-- Reliable, duplicate-proof invoice numbering (INV-0001, INV-0002, ...).
-- PostgreSQL sequences are atomic, so two concurrent invoices can never
-- receive the same number.
CREATE SEQUENCE IF NOT EXISTS invoice_num_seq;

-- Keep updated_at fresh on updates.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Do not replace any trigger that already exists on a pre-existing table.
-- The triggers below are created only for fresh installs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_touch' AND tgrelid = 'users'::regclass) THEN
    CREATE TRIGGER users_touch BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'foods_touch' AND tgrelid = 'foods'::regclass) THEN
    CREATE TRIGGER foods_touch BEFORE UPDATE ON foods
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END;
$$;
