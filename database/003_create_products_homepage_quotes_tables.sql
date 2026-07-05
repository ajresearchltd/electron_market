CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- EXISTING TABLE UPDATES
-- Existing tables: users, suppliers, rfq, rfq_items, rfq_target_suppliers
-- =========================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_rating NUMERIC;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS products_count INTEGER DEFAULT 0;

ALTER TABLE rfq_items ADD COLUMN IF NOT EXISTS unit TEXT;


-- =========================================================
-- TABLE: manufacturers
-- =========================================================

CREATE TABLE IF NOT EXISTS manufacturers (
    manufacturer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_name TEXT NOT NULL,
    country TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    company_description TEXT,
    logo_url TEXT,
    manufacturer_status TEXT DEFAULT 'active',
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers(manufacturer_name);
CREATE INDEX IF NOT EXISTS idx_manufacturers_country ON manufacturers(country);


-- =========================================================
-- TABLE: products
-- =========================================================

CREATE TABLE IF NOT EXISTS products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type TEXT,
    product_name TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    brand_manufacturer TEXT,
    model_series TEXT,
    part_number_mpn TEXT,
    sku_internal TEXT,
    gtin_ean TEXT,
    country_of_origin TEXT,
    short_description TEXT,
    full_description TEXT,
    supplier_type TEXT,
    business_type TEXT,
    number_of_suppliers INTEGER DEFAULT 0,
    number_of_manufacturers INTEGER DEFAULT 0,
    verified_suppliers BOOLEAN DEFAULT false,
    official_authorized_distributor BOOLEAN DEFAULT false,
    availability TEXT,
    stock_location TEXT,
    moq_quantity NUMERIC,
    moq_unit TEXT,
    price_type TEXT,
    base_price NUMERIC,
    base_currency TEXT,
    min_price NUMERIC,
    max_price NUMERIC,
    price_range_currency TEXT,
    price_on_request BOOLEAN DEFAULT false,
    lead_time TEXT,
    delivery_time_estimated TEXT,
    shipping_methods TEXT,
    delivery_countries TEXT,
    packaging_details TEXT,
    hs_code TEXT,
    installation_available BOOLEAN DEFAULT false,
    training_available BOOLEAN DEFAULT false,
    maintenance_available BOOLEAN DEFAULT false,
    technical_support BOOLEAN DEFAULT false,
    spare_parts_available BOOLEAN DEFAULT false,
    customization_available BOOLEAN DEFAULT false,
    service_description TEXT,
    meta_title TEXT,
    meta_description TEXT,
    visibility TEXT DEFAULT 'public',
    warranty TEXT,
    return_policy TEXT,
    condition TEXT,
    notes TEXT,
    product_status TEXT DEFAULT 'active',
    main_image_url TEXT,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now(),
    supplier_id UUID REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    manufacturer_id UUID REFERENCES manufacturers(manufacturer_id) ON DELETE SET NULL,
    created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_id ON products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_products_created_by_user_id ON products(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_part_number_mpn ON products(part_number_mpn);
CREATE INDEX IF NOT EXISTS idx_products_product_status ON products(product_status);


-- =========================================================
-- PRODUCT CHILD TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS product_specifications (
    specification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    specification_name TEXT NOT NULL,
    specification_value TEXT,
    unit TEXT
);

CREATE TABLE IF NOT EXISTS product_images (
    image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_title TEXT,
    is_main_image BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    document_type TEXT,
    document_name TEXT,
    file_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_shipping_methods (
    shipping_method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    shipping_method TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_delivery_countries (
    country_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    country_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alternative_products (
    alternative_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    alternative_part_number TEXT,
    alternative_product_name TEXT,
    alternative_manufacturer_brand TEXT
);

CREATE TABLE IF NOT EXISTS product_services (
    service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    installation_available BOOLEAN DEFAULT false,
    training_available BOOLEAN DEFAULT false,
    maintenance_available BOOLEAN DEFAULT false,
    technical_support BOOLEAN DEFAULT false,
    spare_parts_available BOOLEAN DEFAULT false,
    customization_available BOOLEAN DEFAULT false,
    service_description TEXT
);

CREATE INDEX IF NOT EXISTS idx_product_specifications_product_id ON product_specifications(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_documents_product_id ON product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_product_shipping_methods_product_id ON product_shipping_methods(product_id);
CREATE INDEX IF NOT EXISTS idx_product_delivery_countries_product_id ON product_delivery_countries(product_id);
CREATE INDEX IF NOT EXISTS idx_alternative_products_product_id ON alternative_products(product_id);
CREATE INDEX IF NOT EXISTS idx_product_services_product_id ON product_services(product_id);


-- =========================================================
-- RFQ ADDITIONAL TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS rfq_bom_files (
    bom_file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq(rfq_id) ON DELETE CASCADE,
    bom_file_url TEXT NOT NULL,
    bom_file_name TEXT,
    bom_file_type TEXT,
    bom_file_size NUMERIC,
    uploaded_date TIMESTAMPTZ DEFAULT now(),
    ai_analysis_status TEXT DEFAULT 'pending',
    ai_matched_suppliers_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rfq_quotes (
    quote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq(rfq_id) ON DELETE CASCADE,
    rfq_target_supplier_id UUID REFERENCES rfq_target_suppliers(rfq_target_supplier_id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    quote_status TEXT DEFAULT 'draft',
    total_amount NUMERIC,
    currency TEXT,
    delivery_time TEXT,
    incoterms TEXT,
    supplier_comment TEXT,
    created_date TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfq_quote_items (
    quote_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES rfq_quotes(quote_id) ON DELETE CASCADE,
    rfq_item_id UUID REFERENCES rfq_items(rfq_item_id) ON DELETE SET NULL,
    offered_part_num TEXT,
    offered_name_of_detail TEXT,
    offered_specification TEXT,
    offered_amount NUMERIC,
    unit_price NUMERIC,
    total_price NUMERIC,
    currency TEXT,
    is_substitute_alternate BOOLEAN DEFAULT false,
    delivery_time TEXT,
    comment TEXT
);

CREATE TABLE IF NOT EXISTS rfq_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq(rfq_id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    sender_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    receiver_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    message_subject TEXT,
    message_text TEXT,
    message_status TEXT DEFAULT 'sent',
    sent_date TIMESTAMPTZ DEFAULT now(),
    read_date TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rfq_bom_files_rfq_id ON rfq_bom_files(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_rfq_id ON rfq_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_supplier_id ON rfq_quotes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_target_supplier_id ON rfq_quotes(rfq_target_supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quote_items_quote_id ON rfq_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quote_items_rfq_item_id ON rfq_quote_items(rfq_item_id);
CREATE INDEX IF NOT EXISTS idx_rfq_messages_rfq_id ON rfq_messages(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_messages_supplier_id ON rfq_messages(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_messages_sender_user_id ON rfq_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_rfq_messages_receiver_user_id ON rfq_messages(receiver_user_id);


-- =========================================================
-- TABLE: pages
-- =========================================================

CREATE TABLE IF NOT EXISTS pages (
    page_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_name TEXT NOT NULL,
    page_title TEXT,
    page_url TEXT,
    page_type TEXT,
    meta_title TEXT,
    meta_description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pages_page_name ON pages(page_name);
CREATE INDEX IF NOT EXISTS idx_pages_page_url ON pages(page_url);
CREATE INDEX IF NOT EXISTS idx_pages_is_active ON pages(is_active);


-- =========================================================
-- TABLE: homepage_content
-- Converted from fields like 1_title, 2_pic1 into safe PostgreSQL names:
-- section_1_title, section_2_pic_1, etc.
-- =========================================================

CREATE TABLE IF NOT EXISTS homepage_content (
    homepage_content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES pages(page_id) ON DELETE CASCADE,

    section_1_country TEXT,
    section_1_language TEXT,
    section_1_name TEXT,
    section_1_description TEXT,
    section_1_title_of_site TEXT,
    section_1_subtitle_of_site TEXT,
    section_1_link_to_get_bom TEXT,
    section_1_link_to_supplier TEXT,
    section_1_under_title_1 TEXT,
    section_1_under_title_2 TEXT,
    section_1_under_title_3 TEXT,
    section_1_under_title_4 TEXT,
    section_1_menu_1 TEXT,
    section_1_menu_1_link TEXT,
    section_1_menu_2 TEXT,
    section_1_menu_2_link TEXT,
    section_1_menu_3 TEXT,
    section_1_menu_3_link TEXT,
    section_1_menu_4 TEXT,
    section_1_menu_4_link TEXT,

    section_2_title_1 TEXT,
    section_2_title_2 TEXT,
    section_2_pic_1 TEXT,
    section_2_name_1 TEXT,
    section_2_text_1 TEXT,
    section_2_pic_2 TEXT,
    section_2_name_2 TEXT,
    section_2_text_2 TEXT,
    section_2_pic_3 TEXT,
    section_2_name_3 TEXT,
    section_2_text_3 TEXT,
    section_2_pic_4 TEXT,
    section_2_name_4 TEXT,
    section_2_text_4 TEXT,
    section_2_link_button TEXT,

    section_3_title TEXT,
    section_3_description TEXT,
    section_4_title TEXT,
    section_4_description TEXT,

    section_5_title TEXT,
    section_5_description TEXT,
    section_5_name_1 TEXT,
    section_5_text_1 TEXT,
    section_5_pic_1 TEXT,
    section_5_name_2 TEXT,
    section_5_text_2 TEXT,
    section_5_pic_2 TEXT,
    section_5_name_3 TEXT,
    section_5_text_3 TEXT,
    section_5_pic_3 TEXT,
    section_5_name_4 TEXT,
    section_5_text_4 TEXT,
    section_5_pic_4 TEXT,
    section_5_name_5 TEXT,
    section_5_text_5 TEXT,
    section_5_pic_5 TEXT,
    section_5_name_6 TEXT,
    section_5_text_6 TEXT,
    section_5_pic_6 TEXT,

    section_6_title TEXT,
    section_6_description TEXT,
    section_6_title_1 TEXT,
    section_6_text_1 TEXT,
    section_6_pic_1 TEXT,
    section_6_title_2 TEXT,
    section_6_text_2 TEXT,
    section_6_pic_2 TEXT,
    section_6_title_3 TEXT,
    section_6_text_3 TEXT,
    section_6_pic_3 TEXT,
    section_6_title_4 TEXT,
    section_6_text_4 TEXT,
    section_6_pic_4 TEXT,
    section_6_simple_1 TEXT,
    section_6_simple_2 TEXT,
    section_6_simple_3 TEXT,
    section_6_simple_4 TEXT,

    section_7_title TEXT,
    section_7_description TEXT,
    section_7_title_1 TEXT,
    section_7_text_1 TEXT,
    section_7_pic_1 TEXT,
    section_7_title_2 TEXT,
    section_7_text_2 TEXT,
    section_7_pic_2 TEXT,
    section_7_title_3 TEXT,
    section_7_text_3 TEXT,
    section_7_pic_3 TEXT,
    section_7_title_4 TEXT,
    section_7_text_4 TEXT,
    section_7_pic_4 TEXT,
    section_7_title_5 TEXT,
    section_7_text_5 TEXT,
    section_7_pic_5 TEXT,

    section_8_title TEXT,
    section_8_description TEXT,
    section_8_title_1 TEXT,
    section_8_text_1 TEXT,
    section_8_pic_1 TEXT,
    section_8_title_2 TEXT,
    section_8_text_2 TEXT,
    section_8_pic_2 TEXT,
    section_8_title_3 TEXT,
    section_8_text_3 TEXT,
    section_8_pic_3 TEXT,
    section_8_title_4 TEXT,
    section_8_text_4 TEXT,
    section_8_pic_4 TEXT,
    section_8_title_5 TEXT,
    section_8_text_5 TEXT,
    section_8_pic_5 TEXT,
    section_8_title_6 TEXT,
    section_8_text_6 TEXT,
    section_8_pic_6 TEXT,

    section_9_title TEXT,
    section_9_description TEXT,
    section_10_title TEXT,
    section_10_description TEXT,

    section_11_title TEXT,
    section_11_description TEXT,
    section_11_pic_1 TEXT,
    section_11_digit_1 TEXT,
    section_11_text_1 TEXT,
    section_11_pic_2 TEXT,
    section_11_digit_2 TEXT,
    section_11_text_2 TEXT,
    section_11_pic_3 TEXT,
    section_11_digit_3 TEXT,
    section_11_text_3 TEXT,
    section_11_pic_4 TEXT,
    section_11_digit_4 TEXT,
    section_11_text_4 TEXT,
    section_11_pic_5 TEXT,
    section_11_digit_5 TEXT,
    section_11_text_5 TEXT,
    section_11_pic_6 TEXT,
    section_11_digit_6 TEXT,
    section_11_text_6 TEXT,

    section_12_title TEXT,
    section_12_deviz TEXT,
    section_12_logo TEXT,
    section_12_pic_card_1 TEXT,
    section_12_pic_card_1_link TEXT,
    section_12_pic_card_2 TEXT,
    section_12_pic_card_2_link TEXT,
    section_12_pic_card_3 TEXT,
    section_12_pic_card_3_link TEXT,
    section_12_pic_card_4 TEXT,
    section_12_pic_card_4_link TEXT,
    section_12_pic_card_5 TEXT,
    section_12_pic_card_5_link TEXT,
    section_12_pic_card_6 TEXT,
    section_12_pic_card_6_link TEXT,

    section_12_how_it_work TEXT,
    section_12_how_it_work_link TEXT,
    section_12_submit_rfq TEXT,
    section_12_submit_rfq_link TEXT,
    section_12_find_supplier TEXT,
    section_12_find_supplier_link TEXT,
    section_12_help_center TEXT,
    section_12_help_center_link TEXT,
    section_12_join_as_supplier TEXT,
    section_12_join_as_supplier_link TEXT,
    section_12_supplier_guide TEXT,
    section_12_supplier_guide_link TEXT,
    section_12_benefit TEXT,
    section_12_benefit_link TEXT,
    section_12_resources TEXT,
    section_12_resources_link TEXT,
    section_12_about_us TEXT,
    section_12_about_us_link TEXT,
    section_12_news TEXT,
    section_12_news_link TEXT,
    section_12_careers TEXT,
    section_12_careers_link TEXT,
    section_12_partners TEXT,
    section_12_partners_link TEXT,
    section_12_contact_us TEXT,
    section_12_contact_us_link TEXT,

    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homepage_content_page_id ON homepage_content(page_id);


-- =========================================================
-- HOMEPAGE LIST TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS category (
    cat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pic TEXT,
    name TEXT NOT NULL,
    text TEXT,
    description TEXT,
    type_of_product TEXT
);

CREATE TABLE IF NOT EXISTS verified_supplier (
    supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pic TEXT,
    delivery_product TEXT
);

CREATE TABLE IF NOT EXISTS industry_solution (
    ind_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    text TEXT,
    pic TEXT
);

CREATE TABLE IF NOT EXISTS customer_say (
    ref_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    text TEXT,
    pic TEXT
);

CREATE TABLE IF NOT EXISTS type_product (
    type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    text TEXT,
    pic TEXT,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_category_name ON category(name);
CREATE INDEX IF NOT EXISTS idx_category_type_of_product ON category(type_of_product);
CREATE INDEX IF NOT EXISTS idx_verified_supplier_name ON verified_supplier(name);
CREATE INDEX IF NOT EXISTS idx_industry_solution_title ON industry_solution(title);
CREATE INDEX IF NOT EXISTS idx_customer_say_title ON customer_say(title);
CREATE INDEX IF NOT EXISTS idx_type_product_title ON type_product(title);


-- =========================================================
-- RLS ENABLEMENT FOR NEW TABLES
-- Policies will be added in a separate migration.
-- =========================================================

ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_delivery_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE alternative_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_bom_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE category ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_supplier ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_solution ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_say ENABLE ROW LEVEL SECURITY;
ALTER TABLE type_product ENABLE ROW LEVEL SECURITY;