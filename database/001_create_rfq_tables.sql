CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Electron Market RFQ Module - Database Schema
-- First-stage tables for RFQ flow
-- Created: 2026-07-04

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    company_id UUID,
    phone TEXT,
    user_status TEXT,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE: suppliers
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_name TEXT NOT NULL,
    company_name TEXT,
    supplier_type TEXT,
    business_type TEXT,
    country TEXT,
    city TEXT,
    website TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    verified_supplier BOOLEAN DEFAULT false,
    official_authorized_distributor BOOLEAN DEFAULT false,
    supplier_status TEXT DEFAULT 'active',
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE: rfq (Request for Quotation)
-- ============================================
CREATE TABLE IF NOT EXISTS rfq (
    rfq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_name TEXT NOT NULL,
    rfq_type TEXT DEFAULT 'RFQ',
    rfq_visibility TEXT NOT NULL,
    project_description TEXT NOT NULL,
    required_delivery_date TIMESTAMPTZ,
    incoterms_preference TEXT,
    destination_country TEXT NOT NULL,
    target_budget NUMERIC,
    official_suppliers_only BOOLEAN DEFAULT false,
    manufacturers_only BOOLEAN DEFAULT false,
    include_substitute_alternate_parts BOOLEAN DEFAULT true,
    need_technical_support BOOLEAN DEFAULT false,
    rfq_status TEXT DEFAULT 'draft',
    created_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_date TIMESTAMPTZ DEFAULT now(),
    updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABLE: rfq_items
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_items (
    rfq_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq(rfq_id) ON DELETE CASCADE,
    rec_num INTEGER NOT NULL,
    part_num TEXT,
    name_of_detail TEXT NOT NULL,
    specification TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    additional_info TEXT
);

-- ============================================
-- TABLE: rfq_target_suppliers
-- ============================================
CREATE TABLE IF NOT EXISTS rfq_target_suppliers (
    rfq_target_supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq(rfq_id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    send_status TEXT DEFAULT 'draft',
    sent_date TIMESTAMPTZ,
    viewed_date TIMESTAMPTZ,
    quote_status TEXT DEFAULT 'waiting'
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_rfq_created_by_user_id ON rfq(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq_id ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_target_suppliers_rfq_id ON rfq_target_suppliers(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_target_suppliers_supplier_id ON rfq_target_suppliers(supplier_id);

-- ============================================
-- FIRST-STAGE RFQ MODULE SCHEMA
-- ============================================
-- Tables created: 5
-- 1. users - User accounts (email, full_name, role, company_id, phone, user_status)
-- 2. suppliers - Supplier profiles (supplier_name, company_name, supplier_type, business_type, country, city, website, contact_email, contact_phone, verified_supplier, official_authorized_distributor, supplier_status)
-- 3. rfq - Request for Quotation records (rfq_name, rfq_type, rfq_visibility, project_description, required_delivery_date, incoterms_preference, destination_country, target_budget, official_suppliers_only, manufacturers_only, include_substitute_alternate_parts, need_technical_support, rfq_status, created_by_user_id)
-- 4. rfq_items - Individual line items within an RFQ (rec_num, part_num, name_of_detail, specification, amount, additional_info)
-- 5. rfq_target_suppliers - Mapping of RFQs to target suppliers (send_status, sent_date, viewed_date, quote_status)
--
-- Foreign Key Relationships:
-- - rfq.created_by_user_id → users(user_id) ON DELETE CASCADE
-- - rfq_items.rfq_id → rfq(rfq_id) ON DELETE CASCADE
-- - rfq_target_suppliers.rfq_id → rfq(rfq_id) ON DELETE CASCADE
-- - rfq_target_suppliers.supplier_id → suppliers(supplier_id) ON DELETE CASCADE
--
-- Indexes: 4 for optimal query performance on foreign keys
