CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT users_email_not_empty CHECK (length(email) > 0),
  CONSTRAINT users_role_allowed CHECK (role IN ('USER', 'ADMIN'))
);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL CHECK (length(btrim(make)) > 0),
  model TEXT NOT NULL CHECK (length(btrim(model)) > 0),
  category TEXT NOT NULL CHECK (length(btrim(category)) > 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  price_snapshot NUMERIC(12, 2) NOT NULL CHECK (price_snapshot >= 0),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support case-insensitive make/model and category filtering during inventory search.
CREATE INDEX vehicles_make_model_idx ON vehicles (lower(make), lower(model));
CREATE INDEX vehicles_category_idx ON vehicles (lower(category));

-- Support purchase history lookups by customer, vehicle, and recent purchase time.
CREATE INDEX purchases_user_purchased_at_idx ON purchases (user_id, purchased_at DESC);
CREATE INDEX purchases_vehicle_purchased_at_idx
  ON purchases (vehicle_id, purchased_at DESC)
  WHERE vehicle_id IS NOT NULL;
