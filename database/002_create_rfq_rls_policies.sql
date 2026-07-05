-- Electron Market RFQ Module - Row Level Security Policies
-- First-stage development policies for authenticated users
-- Created: 2026-07-04

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_target_suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TABLE: users POLICIES
-- ============================================

-- Allow authenticated users to select all users
CREATE POLICY "Authenticated users can select users" 
    ON users 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert users
CREATE POLICY "Authenticated users can insert users" 
    ON users 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update their own profile" 
    ON users 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TABLE: suppliers POLICIES
-- ============================================

-- Allow authenticated users to select suppliers
CREATE POLICY "Authenticated users can select suppliers" 
    ON suppliers 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert suppliers
CREATE POLICY "Authenticated users can insert suppliers" 
    ON suppliers 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow authenticated users to update suppliers
CREATE POLICY "Authenticated users can update suppliers" 
    ON suppliers 
    FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- ============================================
-- TABLE: rfq POLICIES
-- ============================================

-- Allow authenticated users to select rfq
CREATE POLICY "Authenticated users can select rfq" 
    ON rfq 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert rfq
CREATE POLICY "Authenticated users can insert rfq" 
    ON rfq 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow authenticated users to update their own rfq
CREATE POLICY "Users can update their own rfq" 
    ON rfq 
    FOR UPDATE 
    TO authenticated 
    USING (created_by_user_id = auth.uid()) 
    WITH CHECK (created_by_user_id = auth.uid());

-- ============================================
-- TABLE: rfq_items POLICIES
-- ============================================

-- Allow authenticated users to select rfq_items
CREATE POLICY "Authenticated users can select rfq_items" 
    ON rfq_items 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert rfq_items
CREATE POLICY "Authenticated users can insert rfq_items" 
    ON rfq_items 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow authenticated users to update rfq_items if the parent rfq was created by them
CREATE POLICY "Users can update rfq_items if they own the parent rfq" 
    ON rfq_items 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM rfq 
            WHERE rfq.rfq_id = rfq_items.rfq_id 
            AND rfq.created_by_user_id = auth.uid()
        )
    ) 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq 
            WHERE rfq.rfq_id = rfq_items.rfq_id 
            AND rfq.created_by_user_id = auth.uid()
        )
    );

-- ============================================
-- TABLE: rfq_target_suppliers POLICIES
-- ============================================

-- Allow authenticated users to select rfq_target_suppliers
CREATE POLICY "Authenticated users can select rfq_target_suppliers" 
    ON rfq_target_suppliers 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert rfq_target_suppliers
CREATE POLICY "Authenticated users can insert rfq_target_suppliers" 
    ON rfq_target_suppliers 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow authenticated users to update rfq_target_suppliers if the parent rfq was created by them
CREATE POLICY "Users can update rfq_target_suppliers if they own the parent rfq" 
    ON rfq_target_suppliers 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM rfq 
            WHERE rfq.rfq_id = rfq_target_suppliers.rfq_id 
            AND rfq.created_by_user_id = auth.uid()
        )
    ) 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM rfq 
            WHERE rfq.rfq_id = rfq_target_suppliers.rfq_id 
            AND rfq.created_by_user_id = auth.uid()
        )
    );

-- ============================================
-- RLS POLICIES SUMMARY
-- ============================================
-- Total Policies: 15
-- 1. users (3): SELECT all, INSERT all, UPDATE own
-- 2. suppliers (3): SELECT all, INSERT all, UPDATE all
-- 3. rfq (3): SELECT all, INSERT all, UPDATE own
-- 4. rfq_items (3): SELECT all, INSERT all, UPDATE (parent owned by user)
-- 5. rfq_target_suppliers (3): SELECT all, INSERT all, UPDATE (parent owned by user)
--
-- Security Model:
-- - All authenticated users can view all records
-- - All authenticated users can create records
-- - Users can only update records they own or records under their ownership
-- - Parent-child relationships are enforced via EXISTS subqueries
--
-- Note: This is a first-stage development policy. Production policies should
-- include more granular role-based access control (RBAC) for buyer, supplier, and admin roles.
