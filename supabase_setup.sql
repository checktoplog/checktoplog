
-- =============================================================================
-- SCRIPT UNIFICADO SUPABASE - CHECKTOPLOG
-- Este script cria todas as tabelas, índices e políticas de segurança.
-- =============================================================================

-- 0. LIMPEZA (OPCIONAL - CUIDADO: APAGA DADOS EXISTENTES)
-- DROP TABLE IF EXISTS public.products CASCADE;
-- DROP TABLE IF EXISTS public.responses CASCADE;
-- DROP TABLE IF EXISTS public.templates CASCADE;
-- DROP TABLE IF EXISTS public.users CASCADE;

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'USER',
  allowed_screens JSONB DEFAULT '["dashboard", "checklists", "templates"]'::jsonB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE MODELOS (TEMPLATES)
CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  stages JSONB NOT NULL,
  signature_title TEXT DEFAULT 'Assinatura',
  custom_id_placeholder TEXT,
  image_url TEXT, 
  external_data JSONB DEFAULT '[]'::jsonb,
  external_data_imported_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE RESPOSTAS (HISTÓRICO DE CHECKLISTS)
CREATE TABLE IF NOT EXISTS public.responses (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES public.templates(id) ON DELETE CASCADE,
  custom_id TEXT, 
  status TEXT DEFAULT 'DRAFT',
  current_stage_id TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonB,
  stage_time_spent JSONB DEFAULT '{}'::jsonB,
  locked_stages JSONB DEFAULT '[]'::jsonb,
  divergences JSONB DEFAULT '{}'::jsonb,
  external_data_row JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  pdf_url TEXT DEFAULT ''
);

-- 4. TABELA DE ARQUIVOS (ORGANIZAÇÃO DE STORAGE)
CREATE TABLE IF NOT EXISTS public.storage_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  related_entity_id TEXT, -- ID da sessão, checklist ou produto
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- OTIMIZAÇÕES: ÍNDICES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_responses_updated_at ON public.responses (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_template_id ON public.responses (template_id);
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON public.templates (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_files_related_id ON public.storage_files (related_entity_id);

-- =============================================================================
-- SEGURANÇA: RLS (ROW LEVEL SECURITY)
-- =============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_files ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso total para usuários autenticados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso Total Autenticado Users') THEN
        CREATE POLICY "Acesso Total Autenticado Users" ON public.users FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso Total Autenticado Templates') THEN
        CREATE POLICY "Acesso Total Autenticado Templates" ON public.templates FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso Total Autenticado Responses') THEN
        CREATE POLICY "Acesso Total Autenticado Responses" ON public.responses FOR ALL USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acesso Total Autenticado StorageFiles') THEN
        CREATE POLICY "Acesso Total Autenticado StorageFiles" ON public.storage_files FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- =============================================================================
-- AUTENTICAÇÃO: TRIGGER PARA PERFIL DE USUÁRIO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, allowed_screens)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    NEW.email, 
    'USER', 
    '["dashboard", "checklists", "templates"]'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- NOTA SOBRE STORAGE:
-- Certifique-se de criar os buckets manualmente no painel do Supabase:
-- 1. 'checklists' (Público)
-- =============================================================================
