-- 00027_kb_proper_rls.sql

ALTER TABLE public.knowledge_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_guardrails ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies that might conflict
DO $$
BEGIN
  -- knowledge_services
  DROP POLICY IF EXISTS "kb_services_select" ON public.knowledge_services;
  DROP POLICY IF EXISTS "kb_services_insert" ON public.knowledge_services;
  DROP POLICY IF EXISTS "kb_services_update" ON public.knowledge_services;
  DROP POLICY IF EXISTS "kb_services_delete" ON public.knowledge_services;
  DROP POLICY IF EXISTS "Users can view own knowledge services" ON public.knowledge_services;
  DROP POLICY IF EXISTS "Users can insert own knowledge services" ON public.knowledge_services;
  DROP POLICY IF EXISTS "Users can update own knowledge services" ON public.knowledge_services;
  DROP POLICY IF EXISTS "Users can delete own knowledge services" ON public.knowledge_services;

  -- knowledge_faqs
  DROP POLICY IF EXISTS "kb_faqs_select" ON public.knowledge_faqs;
  DROP POLICY IF EXISTS "kb_faqs_insert" ON public.knowledge_faqs;
  DROP POLICY IF EXISTS "kb_faqs_update" ON public.knowledge_faqs;
  DROP POLICY IF EXISTS "kb_faqs_delete" ON public.knowledge_faqs;
  DROP POLICY IF EXISTS "Users can view own knowledge faqs" ON public.knowledge_faqs;
  DROP POLICY IF EXISTS "Users can insert own knowledge faqs" ON public.knowledge_faqs;
  DROP POLICY IF EXISTS "Users can update own knowledge faqs" ON public.knowledge_faqs;
  DROP POLICY IF EXISTS "Users can delete own knowledge faqs" ON public.knowledge_faqs;

  -- knowledge_guardrails
  DROP POLICY IF EXISTS "kb_guardrails_select" ON public.knowledge_guardrails;
  DROP POLICY IF EXISTS "kb_guardrails_insert" ON public.knowledge_guardrails;
  DROP POLICY IF EXISTS "kb_guardrails_update" ON public.knowledge_guardrails;
  DROP POLICY IF EXISTS "kb_guardrails_delete" ON public.knowledge_guardrails;
  DROP POLICY IF EXISTS "Users can view own guardrails" ON public.knowledge_guardrails;
  DROP POLICY IF EXISTS "Users can insert own guardrails" ON public.knowledge_guardrails;
  DROP POLICY IF EXISTS "Users can update own guardrails" ON public.knowledge_guardrails;
  DROP POLICY IF EXISTS "Users can delete own guardrails" ON public.knowledge_guardrails;
END $$;

-- Ensure user_id column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'knowledge_services' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.knowledge_services ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'knowledge_faqs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.knowledge_faqs ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'knowledge_guardrails' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.knowledge_guardrails ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Apply user_id based RLS to knowledge_services
CREATE POLICY "Users can view own knowledge services" ON public.knowledge_services FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge services" ON public.knowledge_services FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge services" ON public.knowledge_services FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge services" ON public.knowledge_services FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Apply user_id based RLS to knowledge_faqs
CREATE POLICY "Users can view own knowledge faqs" ON public.knowledge_faqs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge faqs" ON public.knowledge_faqs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge faqs" ON public.knowledge_faqs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge faqs" ON public.knowledge_faqs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Apply user_id based RLS to knowledge_guardrails
CREATE POLICY "Users can view own knowledge guardrails" ON public.knowledge_guardrails FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge guardrails" ON public.knowledge_guardrails FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge guardrails" ON public.knowledge_guardrails FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge guardrails" ON public.knowledge_guardrails FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Replace the category CHECK constraint to allow exactly the categories listed in the prompt
ALTER TABLE public.knowledge_services DROP CONSTRAINT IF EXISTS knowledge_services_category_check;
ALTER TABLE public.knowledge_services ADD CONSTRAINT knowledge_services_category_check CHECK (
  category IN (
    'Injectables',
    'Laser Treatments',
    'Facials',
    'Skin Rejuvenation',
    'Body Treatments',
    'Wellness',
    'Other'
  )
);
