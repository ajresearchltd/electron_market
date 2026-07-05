-- Electron Market - RLS Policies for Products, Homepage, and RFQ Extended Tables
-- Second-stage policies for product catalog, homepage content, and RFQ workflow
-- Created: 2026-07-04

-- ============================================
-- ENABLE RLS ON ALL NEW TABLES
-- ============================================

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

-- ============================================
-- GROUP A: PUBLIC/READABLE CONTENT TABLES
-- These tables are readable by everyone (anon + authenticated)
-- Write access restricted to authenticated users
-- ============================================

-- ============================================
-- TABLE: manufacturers
-- ============================================

DROP POLICY IF EXISTS "Anyone can select manufacturers" ON manufacturers;
CREATE POLICY "Anyone can select manufacturers"
    ON manufacturers
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert manufacturers" ON manufacturers;
CREATE POLICY "Authenticated users can insert manufacturers"
    ON manufacturers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update manufacturers" ON manufacturers;
CREATE POLICY "Authenticated users can update manufacturers"
    ON manufacturers
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete manufacturers" ON manufacturers;
CREATE POLICY "Authenticated users can delete manufacturers"
    ON manufacturers
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: products
-- ============================================

DROP POLICY IF EXISTS "Anyone can select products" ON products;
CREATE POLICY "Anyone can select products"
    ON products
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
CREATE POLICY "Authenticated users can insert products"
    ON products
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update products" ON products;
CREATE POLICY "Authenticated users can update products"
    ON products
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete products" ON products;
CREATE POLICY "Authenticated users can delete products"
    ON products
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: product_specifications
-- ============================================

DROP POLICY IF EXISTS "Anyone can select product_specifications" ON product_specifications;
CREATE POLICY "Anyone can select product_specifications"
    ON product_specifications
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert product_specifications" ON product_specifications;
CREATE POLICY "Authenticated users can insert product_specifications"
    ON product_specifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update product_specifications" ON product_specifications;
CREATE POLICY "Authenticated users can update product_specifications"
    ON product_specifications
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete product_specifications" ON product_specifications;
CREATE POLICY "Authenticated users can delete product_specifications"
    ON product_specifications
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: product_images
-- ============================================

DROP POLICY IF EXISTS "Anyone can select product_images" ON product_images;
CREATE POLICY "Anyone can select product_images"
    ON product_images
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert product_images" ON product_images;
CREATE POLICY "Authenticated users can insert product_images"
    ON product_images
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update product_images" ON product_images;
CREATE POLICY "Authenticated users can update product_images"
    ON product_images
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete product_images" ON product_images;
CREATE POLICY "Authenticated users can delete product_images"
    ON product_images
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: product_documents
-- ============================================

DROP POLICY IF EXISTS "Anyone can select product_documents" ON product_documents;
CREATE POLICY "Anyone can select product_documents"
    ON product_documents
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert product_documents" ON product_documents;
CREATE POLICY "Authenticated users can insert product_documents"
    ON product_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update product_documents" ON product_documents;
CREATE POLICY "Authenticated users can update product_documents"
    ON product_documents
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete product_documents" ON product_documents;
CREATE POLICY "Authenticated users can delete product_documents"
    ON product_documents
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: product_shipping_methods
-- ============================================

DROP POLICY IF EXISTS "Anyone can select product_shipping_methods" ON product_shipping_methods;
CREATE POLICY "Anyone can select product_shipping_methods"
    ON product_shipping_methods
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert product_shipping_methods" ON product_shipping_methods;
CREATE POLICY "Authenticated users can insert product_shipping_methods"
    ON product_shipping_methods
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update product_shipping_methods" ON product_shipping_methods;
CREATE POLICY "Authenticated users can update product_shipping_methods"
    ON product_shipping_methods
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete product_shipping_methods" ON product_shipping_methods;
CREATE POLICY "Authenticated users can delete product_shipping_methods"
    ON product_shipping_methods
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: product_delivery_countries
-- ============================================

DROP POLICY IF EXISTS "Anyone can select product_delivery_countries" ON product_delivery_countries;
CREATE POLICY "Anyone can select product_delivery_countries"
    ON product_delivery_countries
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert product_delivery_countries" ON product_delivery_countries;
CREATE POLICY "Authenticated users can insert product_delivery_countries"
    ON product_delivery_countries
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update product_delivery_countries" ON product_delivery_countries;
CREATE POLICY "Authenticated users can update product_delivery_countries"
    ON product_delivery_countries
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete product_delivery_countries" ON product_delivery_countries;
CREATE POLICY "Authenticated users can delete product_delivery_countries"
    ON product_delivery_countries
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: alternative_products
-- ============================================

DROP POLICY IF EXISTS "Anyone can select alternative_products" ON alternative_products;
CREATE POLICY "Anyone can select alternative_products"
    ON alternative_products
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert alternative_products" ON alternative_products;
CREATE POLICY "Authenticated users can insert alternative_products"
    ON alternative_products
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update alternative_products" ON alternative_products;
CREATE POLICY "Authenticated users can update alternative_products"
    ON alternative_products
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete alternative_products" ON alternative_products;
CREATE POLICY "Authenticated users can delete alternative_products"
    ON alternative_products
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: product_services
-- ============================================

DROP POLICY IF EXISTS "Anyone can select product_services" ON product_services;
CREATE POLICY "Anyone can select product_services"
    ON product_services
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert product_services" ON product_services;
CREATE POLICY "Authenticated users can insert product_services"
    ON product_services
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update product_services" ON product_services;
CREATE POLICY "Authenticated users can update product_services"
    ON product_services
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete product_services" ON product_services;
CREATE POLICY "Authenticated users can delete product_services"
    ON product_services
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: pages
-- ============================================

DROP POLICY IF EXISTS "Anyone can select pages" ON pages;
CREATE POLICY "Anyone can select pages"
    ON pages
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert pages" ON pages;
CREATE POLICY "Authenticated users can insert pages"
    ON pages
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update pages" ON pages;
CREATE POLICY "Authenticated users can update pages"
    ON pages
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete pages" ON pages;
CREATE POLICY "Authenticated users can delete pages"
    ON pages
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: homepage_content
-- ============================================

DROP POLICY IF EXISTS "Anyone can select homepage_content" ON homepage_content;
CREATE POLICY "Anyone can select homepage_content"
    ON homepage_content
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert homepage_content" ON homepage_content;
CREATE POLICY "Authenticated users can insert homepage_content"
    ON homepage_content
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update homepage_content" ON homepage_content;
CREATE POLICY "Authenticated users can update homepage_content"
    ON homepage_content
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete homepage_content" ON homepage_content;
CREATE POLICY "Authenticated users can delete homepage_content"
    ON homepage_content
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: category
-- ============================================

DROP POLICY IF EXISTS "Anyone can select category" ON category;
CREATE POLICY "Anyone can select category"
    ON category
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert category" ON category;
CREATE POLICY "Authenticated users can insert category"
    ON category
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update category" ON category;
CREATE POLICY "Authenticated users can update category"
    ON category
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete category" ON category;
CREATE POLICY "Authenticated users can delete category"
    ON category
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: verified_supplier
-- ============================================

DROP POLICY IF EXISTS "Anyone can select verified_supplier" ON verified_supplier;
CREATE POLICY "Anyone can select verified_supplier"
    ON verified_supplier
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert verified_supplier" ON verified_supplier;
CREATE POLICY "Authenticated users can insert verified_supplier"
    ON verified_supplier
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update verified_supplier" ON verified_supplier;
CREATE POLICY "Authenticated users can update verified_supplier"
    ON verified_supplier
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete verified_supplier" ON verified_supplier;
CREATE POLICY "Authenticated users can delete verified_supplier"
    ON verified_supplier
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: industry_solution
-- ============================================

DROP POLICY IF EXISTS "Anyone can select industry_solution" ON industry_solution;
CREATE POLICY "Anyone can select industry_solution"
    ON industry_solution
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert industry_solution" ON industry_solution;
CREATE POLICY "Authenticated users can insert industry_solution"
    ON industry_solution
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update industry_solution" ON industry_solution;
CREATE POLICY "Authenticated users can update industry_solution"
    ON industry_solution
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete industry_solution" ON industry_solution;
CREATE POLICY "Authenticated users can delete industry_solution"
    ON industry_solution
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: customer_say
-- ============================================

DROP POLICY IF EXISTS "Anyone can select customer_say" ON customer_say;
CREATE POLICY "Anyone can select customer_say"
    ON customer_say
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert customer_say" ON customer_say;
CREATE POLICY "Authenticated users can insert customer_say"
    ON customer_say
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update customer_say" ON customer_say;
CREATE POLICY "Authenticated users can update customer_say"
    ON customer_say
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete customer_say" ON customer_say;
CREATE POLICY "Authenticated users can delete customer_say"
    ON customer_say
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- TABLE: type_product
-- ============================================

DROP POLICY IF EXISTS "Anyone can select type_product" ON type_product;
CREATE POLICY "Anyone can select type_product"
    ON type_product
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert type_product" ON type_product;
CREATE POLICY "Authenticated users can insert type_product"
    ON type_product
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update type_product" ON type_product;
CREATE POLICY "Authenticated users can update type_product"
    ON type_product
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete type_product" ON type_product;
CREATE POLICY "Authenticated users can delete type_product"
    ON type_product
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- GROUP B: RFQ PRIVATE WORKFLOW TABLES
-- These tables are restricted to authenticated users only
-- With ownership checks based on parent RFQ
-- ============================================

-- ============================================
-- TABLE: rfq_bom_files
-- Users access BOMs for RFQs they created
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can select their rfq_bom_files" ON rfq_bom_files;
CREATE POLICY "Authenticated users can select their rfq_bom_files"
    ON rfq_bom_files
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_bom_files.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can insert rfq_bom_files" ON rfq_bom_files;
CREATE POLICY "Authenticated users can insert rfq_bom_files"
    ON rfq_bom_files
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_bom_files.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can update their rfq_bom_files" ON rfq_bom_files;
CREATE POLICY "Authenticated users can update their rfq_bom_files"
    ON rfq_bom_files
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_bom_files.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_bom_files.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can delete their rfq_bom_files" ON rfq_bom_files;
CREATE POLICY "Authenticated users can delete their rfq_bom_files"
    ON rfq_bom_files
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_bom_files.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

-- ============================================
-- TABLE: rfq_quotes
-- Users access quotes for RFQs they created
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can select their rfq_quotes" ON rfq_quotes;
CREATE POLICY "Authenticated users can select their rfq_quotes"
    ON rfq_quotes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_quotes.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can insert rfq_quotes" ON rfq_quotes;
CREATE POLICY "Authenticated users can insert rfq_quotes"
    ON rfq_quotes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_quotes.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can update their rfq_quotes" ON rfq_quotes;
CREATE POLICY "Authenticated users can update their rfq_quotes"
    ON rfq_quotes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_quotes.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_quotes.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can delete their rfq_quotes" ON rfq_quotes;
CREATE POLICY "Authenticated users can delete their rfq_quotes"
    ON rfq_quotes
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_quotes.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

-- ============================================
-- TABLE: rfq_quote_items
-- Users access quote items through parent rfq ownership
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can select their rfq_quote_items" ON rfq_quote_items;
CREATE POLICY "Authenticated users can select their rfq_quote_items"
    ON rfq_quote_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq_quotes
            JOIN rfq ON rfq_quotes.rfq_id = rfq.rfq_id
            WHERE rfq_quotes.quote_id = rfq_quote_items.quote_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can insert rfq_quote_items" ON rfq_quote_items;
CREATE POLICY "Authenticated users can insert rfq_quote_items"
    ON rfq_quote_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq_quotes
            JOIN rfq ON rfq_quotes.rfq_id = rfq.rfq_id
            WHERE rfq_quotes.quote_id = rfq_quote_items.quote_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can update their rfq_quote_items" ON rfq_quote_items;
CREATE POLICY "Authenticated users can update their rfq_quote_items"
    ON rfq_quote_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq_quotes
            JOIN rfq ON rfq_quotes.rfq_id = rfq.rfq_id
            WHERE rfq_quotes.quote_id = rfq_quote_items.quote_id
            AND rfq.created_by_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq_quotes
            JOIN rfq ON rfq_quotes.rfq_id = rfq.rfq_id
            WHERE rfq_quotes.quote_id = rfq_quote_items.quote_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can delete their rfq_quote_items" ON rfq_quote_items;
CREATE POLICY "Authenticated users can delete their rfq_quote_items"
    ON rfq_quote_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM rfq_quotes
            JOIN rfq ON rfq_quotes.rfq_id = rfq.rfq_id
            WHERE rfq_quotes.quote_id = rfq_quote_items.quote_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

-- ============================================
-- TABLE: rfq_messages
-- Users access messages where they are sender, receiver, or RFQ creator
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can select their rfq_messages" ON rfq_messages;
CREATE POLICY "Authenticated users can select their rfq_messages"
    ON rfq_messages
    FOR SELECT
    TO authenticated
    USING (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_messages.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can insert rfq_messages" ON rfq_messages;
CREATE POLICY "Authenticated users can insert rfq_messages"
    ON rfq_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_messages.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can update their rfq_messages" ON rfq_messages;
CREATE POLICY "Authenticated users can update their rfq_messages"
    ON rfq_messages
    FOR UPDATE
    TO authenticated
    USING (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_messages.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    )
    WITH CHECK (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_messages.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can delete their rfq_messages" ON rfq_messages;
CREATE POLICY "Authenticated users can delete their rfq_messages"
    ON rfq_messages
    FOR DELETE
    TO authenticated
    USING (
        sender_user_id = auth.uid()
        OR receiver_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM rfq
            WHERE rfq.rfq_id = rfq_messages.rfq_id
            AND rfq.created_by_user_id = auth.uid()
        )
    );

-- ============================================
-- RLS POLICIES SUMMARY
-- ============================================
-- Total Policies: 80
--
-- Group A - Public/Readable (16 tables × 4 policies = 64 policies):
--   All tables allow SELECT to public (anon + authenticated)
--   Only authenticated users can INSERT, UPDATE, DELETE
--
-- Group B - RFQ Private Workflow (4 tables × 4 policies = 16 policies):
--   All operations restricted to authenticated users
--   Access control via parent RFQ ownership
--
-- This is a development-stage policy set.
-- Production policies will refine supplier-side permissions after supplier accounts are fully designed.
