-- ==============================================================================
-- Schema: Tabela Central de Empresas Monitoradas (Companies) - Radar & Crawler
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  ats TEXT NOT NULL DEFAULT 'OUTRO',
  career_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MONITORED',
  active_jobs_count INTEGER DEFAULT 0,
  has_tech_jobs BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies (slug);
CREATE INDEX IF NOT EXISTS idx_companies_ats ON public.companies (ats);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies (status);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica de companies" ON public.companies;
CREATE POLICY "Permitir leitura publica de companies"
  ON public.companies
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir gestao pelo service_role" ON public.companies;
CREATE POLICY "Permitir gestao pelo service_role"
  ON public.companies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- Schema: Tabela Central de Vagas (Jobs) - QueroVagas & JobsFinder
-- ==============================================================================

-- 1. Criação da tabela de vagas
CREATE TABLE IF NOT EXISTS public.jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  work_model TEXT DEFAULT 'NAO_INFORMADO',
  salary TEXT,
  contract_type TEXT DEFAULT 'CLT',
  seniority_level TEXT DEFAULT 'NAO_INFORMADO',
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  stack TEXT[] DEFAULT '{}',
  description TEXT,
  is_tech BOOLEAN DEFAULT true,
  scraped_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Índices de alta performance para filtros e ordenação no portal
CREATE INDEX IF NOT EXISTS idx_jobs_is_tech ON public.jobs (is_tech);
CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON public.jobs (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_seniority ON public.jobs (seniority_level);
CREATE INDEX IF NOT EXISTS idx_jobs_work_model ON public.jobs (work_model);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON public.jobs (source);

-- 3. Habilitação de Segurança em Nível de Linha (Row Level Security - RLS)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Política 1: Leitura pública (anon e autenticados) para vagas ativas de TI
DROP POLICY IF EXISTS "Permitir leitura publica de vagas tech" ON public.jobs;
CREATE POLICY "Permitir leitura publica de vagas tech"
  ON public.jobs
  FOR SELECT
  TO anon, authenticated
  USING (is_tech = true);

-- Política 2: Acesso irrestrito de escrita para o serviço de crawler (service_role)
DROP POLICY IF EXISTS "Permitir escrita pelo crawler" ON public.jobs;
CREATE POLICY "Permitir escrita pelo crawler"
  ON public.jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- Schema: Tabela de Sugestões Comunitárias de Empresas (Radar & DevPedia)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.company_suggestions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  ats TEXT NOT NULL DEFAULT 'OUTRO',
  career_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUGGESTED',
  votes_count INTEGER DEFAULT 1,
  suggested_by TEXT DEFAULT 'Comunidade',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_company_suggestions_slug ON public.company_suggestions (slug);
CREATE INDEX IF NOT EXISTS idx_company_suggestions_votes ON public.company_suggestions (votes_count DESC);

ALTER TABLE public.company_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica de sugestoes" ON public.company_suggestions;
CREATE POLICY "Permitir leitura publica de sugestoes"
  ON public.company_suggestions
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir insercao publica de sugestoes" ON public.company_suggestions;
CREATE POLICY "Permitir insercao publica de sugestoes"
  ON public.company_suggestions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ==============================================================================
-- Function: Agregação Estatística de Vagas em Tempo Real (get_job_stats)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_job_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'totalJobs', COUNT(*)::int,
    'byModel', COALESCE(
      (SELECT json_object_agg(work_model, count)
       FROM (SELECT COALESCE(work_model, 'NAO_INFORMADO') as work_model, COUNT(*)::int as count 
             FROM public.jobs WHERE is_tech = true GROUP BY work_model) m), '{}'::json),
    'bySeniority', COALESCE(
      (SELECT json_object_agg(seniority_level, count)
       FROM (SELECT COALESCE(seniority_level, 'NAO_INFORMADO') as seniority_level, COUNT(*)::int as count 
             FROM public.jobs WHERE is_tech = true GROUP BY seniority_level) s), '{}'::json),
    'bySource', COALESCE(
      (SELECT json_object_agg(source, count)
       FROM (SELECT COALESCE(source, 'OUTRO') as source, COUNT(*)::int as count 
             FROM public.jobs WHERE is_tech = true GROUP BY source) src), '{}'::json)
  )
  FROM public.jobs
  WHERE is_tech = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_stats() TO anon, authenticated, service_role;


