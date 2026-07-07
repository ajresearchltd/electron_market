CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Electron Market - RFQ, supplier quote, and active order schema
-- RFQ-related names use a 0 suffix because the repository already contains older rfq/rfq_quotes tables.
-- RLS policies will be added later after frontend workflows are defined.

-- =========================================================
-- TABLE: rfq_orders0
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rfq_orders0 (
  rfq_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_company_name text,
  customer_contact_name text,
  customer_email text,
  customer_country_iso2 text,
  customer_country_name text,
  delivery_country_iso2 text,
  delivery_country_name text,
  rfq_status text NOT NULL DEFAULT 'open' CHECK (rfq_status IN ('open', 'quote_sent', 'supplier_selected', 'expired', 'cancelled')),
  priority_status text NOT NULL DEFAULT 'open',
  deadline_at timestamptz,
  total_items_count integer NOT NULL DEFAULT 0,
  total_requested_quantity integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  buyer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rfq_orders0 IS 'RLS policies will be added later after frontend workflows are defined.';

ALTER TABLE public.rfq_orders0 ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rfq_orders0_customer_id ON public.rfq_orders0(customer_id);
CREATE INDEX IF NOT EXISTS idx_rfq_orders0_rfq_status ON public.rfq_orders0(rfq_status);

-- =========================================================
-- TABLE: rfq_order_items0
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rfq_order_items0 (
  rfq_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE CASCADE,
  order_number text NOT NULL,
  line_number integer NOT NULL,
  category_id bigint,
  category_name text,
  part_number text,
  manufacturer text,
  description text,
  requested_quantity integer NOT NULL DEFAULT 0,
  quantity_unit text NOT NULL DEFAULT 'pcs',
  target_unit_price numeric,
  target_total_price numeric,
  currency text NOT NULL DEFAULT 'USD',
  required_date date,
  customer_line_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rfq_order_items0 IS 'RLS policies will be added later after frontend workflows are defined.';

ALTER TABLE public.rfq_order_items0 ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rfq_order_items0_order_number ON public.rfq_order_items0(order_number);
CREATE INDEX IF NOT EXISTS idx_rfq_order_items0_rfq_id ON public.rfq_order_items0(rfq_id);

-- =========================================================
-- TABLE: supplier_quotes0
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_quotes0 (
  quote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE CASCADE,
  order_number text NOT NULL,
  supplier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_company_name text,
  supplier_contact_name text,
  supplier_email text,
  supplier_country_iso2 text,
  supplier_country_name text,
  delivery_country_iso2 text,
  delivery_country_name text,
  quote_status text NOT NULL DEFAULT 'draft' CHECK (quote_status IN ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired', 'cancelled')),
  quote_revision integer NOT NULL DEFAULT 1,
  total_items_count integer NOT NULL DEFAULT 0,
  quote_subtotal numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  quote_total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  delivery_terms text,
  payment_terms text,
  valid_until timestamptz,
  supplier_notes text,
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_quotes0 IS 'RLS policies will be added later after frontend workflows are defined.';

ALTER TABLE public.supplier_quotes0 ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_supplier_quotes0_order_number ON public.supplier_quotes0(order_number);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes0_rfq_id ON public.supplier_quotes0(rfq_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes0_supplier_id ON public.supplier_quotes0(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes0_quote_status ON public.supplier_quotes0(quote_status);

-- =========================================================
-- TABLE: supplier_quote_items0
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_quote_items0 (
  quote_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.supplier_quotes0(quote_id) ON DELETE CASCADE,
  rfq_id uuid NOT NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE CASCADE,
  rfq_item_id uuid REFERENCES public.rfq_order_items0(rfq_item_id) ON DELETE SET NULL,
  order_number text NOT NULL,
  line_number integer NOT NULL,
  category_id bigint,
  category_name text,
  part_number text,
  manufacturer text,
  description text,
  requested_quantity integer NOT NULL DEFAULT 0,
  quoted_quantity integer NOT NULL DEFAULT 0,
  quantity_unit text NOT NULL DEFAULT 'pcs',
  target_unit_price numeric,
  unit_price numeric NOT NULL DEFAULT 0,
  line_subtotal numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  lead_time_days integer,
  availability_status text,
  replacement_allowed boolean NOT NULL DEFAULT false,
  replacement_part_number text,
  supplier_line_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_quote_items0 IS 'RLS policies will be added later after frontend workflows are defined.';

ALTER TABLE public.supplier_quote_items0 ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_supplier_quote_items0_order_number ON public.supplier_quote_items0(order_number);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_items0_quote_id ON public.supplier_quote_items0(quote_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_items0_rfq_id ON public.supplier_quote_items0(rfq_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quote_items0_rfqi_id ON public.supplier_quote_items0(rfq_item_id);

-- =========================================================
-- TABLE: active_orders
-- =========================================================
CREATE TABLE IF NOT EXISTS public.active_orders (
  active_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES public.supplier_quotes0(quote_id) ON DELETE RESTRICT,
  order_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_company_name text,
  customer_contact_name text,
  customer_email text,
  supplier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_company_name text,
  supplier_contact_name text,
  supplier_email text,
  supplier_country_iso2 text,
  supplier_country_name text,
  delivery_country_iso2 text,
  delivery_country_name text,
  current_stage text NOT NULL DEFAULT 'rfq_received' CHECK (current_stage IN ('rfq_received', 'quote_sent', 'approved_rejected', 'buyer_paid', 'goods_shipped', 'goods_received_by_buyer', 'funds_sent_to_supplier')),
  order_status text NOT NULL DEFAULT 'active' CHECK (order_status IN ('active', 'completed', 'cancelled', 'dispute')),
  payment_status text NOT NULL DEFAULT 'not_paid' CHECK (payment_status IN ('not_paid', 'buyer_paid', 'refunded')),
  shipping_status text NOT NULL DEFAULT 'not_shipped' CHECK (shipping_status IN ('not_shipped', 'shipped', 'received')),
  payout_status text NOT NULL DEFAULT 'not_ready' CHECK (payout_status IN ('not_ready', 'pending_release', 'sent_to_supplier')),
  total_items_count integer NOT NULL DEFAULT 0,
  order_subtotal numeric NOT NULL DEFAULT 0,
  shipping_cost numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  order_total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  tracking_number text,
  shipping_carrier text,
  expected_delivery_at timestamptz,
  rfq_received_at timestamptz,
  quote_sent_at timestamptz,
  buyer_decision_at timestamptz,
  buyer_paid_at timestamptz,
  goods_shipped_at timestamptz,
  goods_received_at timestamptz,
  funds_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.active_orders IS 'RLS policies will be added later after frontend workflows are defined.';

ALTER TABLE public.active_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_active_orders_order_number ON public.active_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_active_orders_rfq_id ON public.active_orders(rfq_id);
CREATE INDEX IF NOT EXISTS idx_active_orders_quote_id ON public.active_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_active_orders_supplier_id ON public.active_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_active_orders_customer_id ON public.active_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_active_orders_current_stage ON public.active_orders(current_stage);
CREATE INDEX IF NOT EXISTS idx_active_orders_order_status ON public.active_orders(order_status);

-- =========================================================
-- TABLE: active_order_items
-- =========================================================
CREATE TABLE IF NOT EXISTS public.active_order_items (
  active_order_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_order_id uuid NOT NULL REFERENCES public.active_orders(active_order_id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.supplier_quotes0(quote_id) ON DELETE RESTRICT,
  quote_item_id uuid REFERENCES public.supplier_quote_items0(quote_item_id) ON DELETE SET NULL,
  rfq_id uuid NOT NULL REFERENCES public.rfq_orders0(rfq_id) ON DELETE RESTRICT,
  rfq_item_id uuid REFERENCES public.rfq_order_items0(rfq_item_id) ON DELETE SET NULL,
  order_number text NOT NULL,
  line_number integer NOT NULL,
  category_id bigint,
  category_name text,
  part_number text,
  manufacturer text,
  description text,
  requested_quantity integer NOT NULL DEFAULT 0,
  quoted_quantity integer NOT NULL DEFAULT 0,
  confirmed_quantity integer NOT NULL DEFAULT 0,
  quantity_unit text NOT NULL DEFAULT 'pcs',
  unit_price numeric NOT NULL DEFAULT 0,
  line_subtotal numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  lead_time_days integer,
  availability_status text,
  item_fulfillment_status text NOT NULL DEFAULT 'pending_payment' CHECK (item_fulfillment_status IN ('pending_payment', 'paid', 'preparing', 'shipped', 'received', 'completed', 'cancelled')),
  supplier_line_notes text,
  customer_line_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.active_order_items IS 'RLS policies will be added later after frontend workflows are defined.';

ALTER TABLE public.active_order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_active_order_items_order_number ON public.active_order_items(order_number);
CREATE INDEX IF NOT EXISTS idx_active_order_items_active_order_id ON public.active_order_items(active_order_id);
CREATE INDEX IF NOT EXISTS idx_active_order_items_quote_id ON public.active_order_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_active_order_items_quote_item_id ON public.active_order_items(quote_item_id);
CREATE INDEX IF NOT EXISTS idx_active_order_items_rfq_id ON public.active_order_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_active_order_items_rfq_item_id ON public.active_order_items(rfq_item_id);

-- End of RFQ / quote / active order schema.
NOTIFY pgrst, 'reload schema';

