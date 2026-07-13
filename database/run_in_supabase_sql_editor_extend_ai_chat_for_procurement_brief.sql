-- Run manually in Supabase SQL Editor after the existing AI chat and procurement-chain migrations.
-- Electron Market - bind existing AI chat history to one procurement chain.

ALTER TABLE public.ai_chat_sessions ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE;
ALTER TABLE public.ai_chat_sessions ADD COLUMN IF NOT EXISTS bom_upload_id uuid NULL REFERENCES public.customer_bom_uploads(id) ON DELETE SET NULL;
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS procurement_chain_id uuid NULL REFERENCES public.procurement_chains(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS ai_chat_sessions_procurement_chain_unique ON public.ai_chat_sessions(procurement_chain_id) WHERE procurement_chain_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_chat_messages_procurement_chain_idx ON public.ai_chat_messages(procurement_chain_id);

DROP POLICY IF EXISTS "Users can select own ai chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can select own ai chat sessions" ON public.ai_chat_sessions FOR SELECT TO authenticated USING (auth.uid()=user_id AND (procurement_chain_id IS NULL OR EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=ai_chat_sessions.procurement_chain_id AND c.customer_user_id=auth.uid())));
DROP POLICY IF EXISTS "Users can insert own ai chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can insert own ai chat sessions" ON public.ai_chat_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id AND (procurement_chain_id IS NULL OR EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=ai_chat_sessions.procurement_chain_id AND c.customer_user_id=auth.uid())) AND (bom_upload_id IS NULL OR EXISTS (SELECT 1 FROM public.customer_bom_uploads b WHERE b.id=ai_chat_sessions.bom_upload_id AND b.user_id=auth.uid() AND b.procurement_chain_id=ai_chat_sessions.procurement_chain_id)));
DROP POLICY IF EXISTS "Users can update own ai chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can update own ai chat sessions" ON public.ai_chat_sessions FOR UPDATE TO authenticated USING (auth.uid()=user_id AND (procurement_chain_id IS NULL OR EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=ai_chat_sessions.procurement_chain_id AND c.customer_user_id=auth.uid()))) WITH CHECK (auth.uid()=user_id AND (procurement_chain_id IS NULL OR EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=ai_chat_sessions.procurement_chain_id AND c.customer_user_id=auth.uid())));
DROP POLICY IF EXISTS "Users can select own ai chat messages" ON public.ai_chat_messages;
CREATE POLICY "Users can select own ai chat messages" ON public.ai_chat_messages FOR SELECT TO authenticated USING (auth.uid()=user_id AND (procurement_chain_id IS NULL OR EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=ai_chat_messages.procurement_chain_id AND c.customer_user_id=auth.uid())));
DROP POLICY IF EXISTS "Users can insert own ai chat messages" ON public.ai_chat_messages;
CREATE POLICY "Users can insert own ai chat messages" ON public.ai_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id AND (procurement_chain_id IS NULL OR EXISTS (SELECT 1 FROM public.procurement_chains c WHERE c.id=ai_chat_messages.procurement_chain_id AND c.customer_user_id=auth.uid())));
NOTIFY pgrst, 'reload schema';
