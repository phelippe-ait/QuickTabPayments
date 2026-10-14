-- QuickTab core schema, reconstructed from Supabase schema/constraint/RLS exports
-- 2026-10-14. Apply ONLY to a fresh database after 0001_profiles.sql.
-- DO NOT run against the shared QuickTab Supabase project: these tables already exist.
-- No RLS policies are granted here: access is denied by default to anon/authenticated.

BEGIN;

CREATE TABLE public.restaurants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL CONSTRAINT restaurants_slug_key UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.restaurant_tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL,
    table_number integer NOT NULL,
    qr_token uuid NOT NULL CONSTRAINT restaurant_tables_qr_token_key UNIQUE DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT restaurant_tables_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT restaurant_tables_restaurant_number_unique UNIQUE (restaurant_id, table_number)
);

CREATE TABLE public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT categories_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT categories_id_restaurant_unique UNIQUE (id, restaurant_id)
);

CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text,
    price numeric NOT NULL,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT products_price_nonnegative CHECK (price >= 0),
    CONSTRAINT products_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT products_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES public.categories(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT products_category_same_restaurant
        FOREIGN KEY (category_id, restaurant_id)
        REFERENCES public.categories(id, restaurant_id)
);

-- Index was created by the team's earlier SQL; not a constraint.
CREATE UNIQUE INDEX products_id_restaurant_unique
    ON public.products (id, restaurant_id);

CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL,
    table_id uuid,
    customer_id uuid,
    status text NOT NULL DEFAULT 'pending',
    total_amount numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orders_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
        ON UPDATE CASCADE,
    CONSTRAINT orders_table_id_fkey
        FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT orders_customer_id_fkey
        FOREIGN KEY (customer_id) REFERENCES auth.users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_items_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES public.orders(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT order_items_product_id_fkey
        FOREIGN KEY (product_id) REFERENCES public.products(id)
        ON UPDATE CASCADE
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

COMMIT;
