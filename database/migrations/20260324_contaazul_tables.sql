-- ====================================================
-- MIGRAÇÃO: Tabelas Conta Azul (Substituindo NIBO)
-- Data: 2026-03-24
-- Ref: database/CONTA_AZUL_MIGRATION.md
-- ====================================================
-- 
-- Tabelas criadas:
--   1. contaazul_lancamentos   (equivale a nibo_agendamentos)
--   2. contaazul_categorias    (equivale a nibo_categorias)
--   3. contaazul_centros_custo (equivale a nibo_centros_custo)
--   4. contaazul_pessoas       (equivale a nibo_stakeholders)
--   5. contaazul_contas_financeiras (nova)
--   6. contaazul_logs_sincronizacao (equivale a nibo_logs_sincronizacao)
-- 
-- Todas com RLS habilitado + policies padrão do projeto.
-- ====================================================

-- ====================================================
-- 1. CONTAAZUL_LANCAMENTOS (Contas a Pagar/Receber)
-- ====================================================

CREATE TABLE IF NOT EXISTS public.contaazul_lancamentos (
    id SERIAL PRIMARY KEY,
    contaazul_id UUID UNIQUE NOT NULL,
    contaazul_evento_id UUID,
    bar_id INTEGER NOT NULL REFERENCES public.bares(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('DESPESA', 'RECEITA')),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
    descricao TEXT,
    observacao TEXT,
    valor_bruto NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_liquido NUMERIC(15,2) DEFAULT 0,
    valor_pago NUMERIC(15,2) DEFAULT 0,
    data_vencimento DATE,
    data_competencia DATE,
    data_pagamento DATE,
    data_pagamento_previsto DATE,
    categoria_id UUID,
    categoria_nome VARCHAR(255),
    centro_custo_id UUID,
    centro_custo_nome VARCHAR(255),
    pessoa_id UUID,
    pessoa_nome VARCHAR(255),
    conta_financeira_id UUID,
    conta_financeira_nome VARCHAR(255),
    metodo_pagamento VARCHAR(100),
    numero_documento VARCHAR(100),
    numero_parcela INTEGER,
    total_parcelas INTEGER,
    conciliado BOOLEAN DEFAULT false,
    data_alteracao_ca TIMESTAMPTZ,
    raw_data JSONB DEFAULT '{}',
    origem VARCHAR(50) DEFAULT 'contaazul',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contaazul_lancamentos_bar_id 
    ON public.contaazul_lancamentos(bar_id);
CREATE INDEX IF NOT EXISTS idx_contaazul_lancamentos_bar_competencia 
    ON public.contaazul_lancamentos(bar_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_contaazul_lancamentos_bar_vencimento 
    ON public.contaazul_lancamentos(bar_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contaazul_lancamentos_bar_tipo 
    ON public.contaazul_lancamentos(bar_id, tipo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_lancamentos_contaazul_id 
    ON public.contaazul_lancamentos(contaazul_id);

COMMENT ON TABLE public.contaazul_lancamentos IS 'Lançamentos financeiros do Conta Azul (contas a pagar/receber). Equivalente a nibo_agendamentos.';
COMMENT ON COLUMN public.contaazul_lancamentos.contaazul_id IS 'ID único da parcela no Conta Azul';
COMMENT ON COLUMN public.contaazul_lancamentos.contaazul_evento_id IS 'ID do evento financeiro pai no Conta Azul';
COMMENT ON COLUMN public.contaazul_lancamentos.data_alteracao_ca IS 'Data de alteração no Conta Azul (para sync incremental)';

-- ====================================================
-- 2. CONTAAZUL_CATEGORIAS
-- ====================================================

CREATE TABLE IF NOT EXISTS public.contaazul_categorias (
    id SERIAL PRIMARY KEY,
    contaazul_id UUID UNIQUE NOT NULL,
    bar_id INTEGER NOT NULL REFERENCES public.bares(id),
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) CHECK (tipo IN ('RECEITA', 'DESPESA')),
    categoria_pai_id UUID,
    apenas_filhos BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    categoria_macro VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contaazul_categorias_bar_id 
    ON public.contaazul_categorias(bar_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_categorias_contaazul_id 
    ON public.contaazul_categorias(contaazul_id);

COMMENT ON TABLE public.contaazul_categorias IS 'Categorias financeiras do Conta Azul. Equivalente a nibo_categorias.';
COMMENT ON COLUMN public.contaazul_categorias.categoria_macro IS 'Mapeamento manual para DRE (ex: CMV, Despesas Operacionais)';

-- ====================================================
-- 3. CONTAAZUL_CENTROS_CUSTO
-- ====================================================

CREATE TABLE IF NOT EXISTS public.contaazul_centros_custo (
    id SERIAL PRIMARY KEY,
    contaazul_id UUID UNIQUE NOT NULL,
    bar_id INTEGER NOT NULL REFERENCES public.bares(id),
    codigo VARCHAR(50),
    nome VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contaazul_centros_custo_bar_id 
    ON public.contaazul_centros_custo(bar_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_centros_custo_contaazul_id 
    ON public.contaazul_centros_custo(contaazul_id);

COMMENT ON TABLE public.contaazul_centros_custo IS 'Centros de custo do Conta Azul. Equivalente a nibo_centros_custo.';

-- ====================================================
-- 4. CONTAAZUL_PESSOAS (Fornecedores/Clientes)
-- ====================================================

CREATE TABLE IF NOT EXISTS public.contaazul_pessoas (
    id SERIAL PRIMARY KEY,
    contaazul_id UUID UNIQUE NOT NULL,
    bar_id INTEGER NOT NULL REFERENCES public.bares(id),
    nome VARCHAR(255) NOT NULL,
    tipo_pessoa VARCHAR(20) CHECK (tipo_pessoa IN ('Física', 'Jurídica', 'Estrangeira')),
    documento VARCHAR(50),
    email VARCHAR(255),
    telefone VARCHAR(50),
    perfil VARCHAR(50) DEFAULT 'Fornecedor',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contaazul_pessoas_bar_id 
    ON public.contaazul_pessoas(bar_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_pessoas_contaazul_id 
    ON public.contaazul_pessoas(contaazul_id);

COMMENT ON TABLE public.contaazul_pessoas IS 'Fornecedores e clientes do Conta Azul. Equivalente a nibo_stakeholders.';

-- ====================================================
-- 5. CONTAAZUL_CONTAS_FINANCEIRAS (Contas Bancárias)
-- ====================================================

CREATE TABLE IF NOT EXISTS public.contaazul_contas_financeiras (
    id SERIAL PRIMARY KEY,
    contaazul_id UUID UNIQUE NOT NULL,
    bar_id INTEGER NOT NULL REFERENCES public.bares(id),
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(100),
    banco VARCHAR(100),
    agencia VARCHAR(20),
    numero VARCHAR(30),
    ativo BOOLEAN DEFAULT true,
    conta_padrao BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contaazul_contas_financeiras_bar_id 
    ON public.contaazul_contas_financeiras(bar_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_contas_financeiras_contaazul_id 
    ON public.contaazul_contas_financeiras(contaazul_id);

COMMENT ON TABLE public.contaazul_contas_financeiras IS 'Contas bancárias/financeiras do Conta Azul.';

-- ====================================================
-- 6. CONTAAZUL_LOGS_SINCRONIZACAO
-- ====================================================

CREATE TABLE IF NOT EXISTS public.contaazul_logs_sincronizacao (
    id SERIAL PRIMARY KEY,
    bar_id INTEGER NOT NULL REFERENCES public.bares(id),
    tipo_sincronizacao VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'iniciado',
    total_registros INTEGER DEFAULT 0,
    registros_processados INTEGER DEFAULT 0,
    registros_erro INTEGER DEFAULT 0,
    mensagem_erro TEXT,
    data_inicio TIMESTAMPTZ DEFAULT now(),
    data_fim TIMESTAMPTZ,
    duracao_segundos INTEGER
);

CREATE INDEX IF NOT EXISTS idx_contaazul_logs_sincronizacao_bar_id 
    ON public.contaazul_logs_sincronizacao(bar_id);
CREATE INDEX IF NOT EXISTS idx_contaazul_logs_sincronizacao_data_inicio 
    ON public.contaazul_logs_sincronizacao(data_inicio DESC);

COMMENT ON TABLE public.contaazul_logs_sincronizacao IS 'Logs de sincronização com Conta Azul. Equivalente a nibo_logs_sincronizacao.';

-- ====================================================
-- TRIGGERS: update_updated_at
-- (Reutiliza função existente: public.update_updated_at_column)
-- ====================================================

CREATE TRIGGER update_contaazul_lancamentos_updated_at 
    BEFORE UPDATE ON public.contaazul_lancamentos 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contaazul_categorias_updated_at 
    BEFORE UPDATE ON public.contaazul_categorias 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contaazul_centros_custo_updated_at 
    BEFORE UPDATE ON public.contaazul_centros_custo 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contaazul_pessoas_updated_at 
    BEFORE UPDATE ON public.contaazul_pessoas 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contaazul_contas_financeiras_updated_at 
    BEFORE UPDATE ON public.contaazul_contas_financeiras 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================
-- ROW LEVEL SECURITY
-- ====================================================

-- 1. CONTAAZUL_LANCAMENTOS
ALTER TABLE public.contaazul_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.contaazul_lancamentos;
CREATE POLICY "service_role_full_access" ON public.contaazul_lancamentos 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_bar_access" ON public.contaazul_lancamentos;
CREATE POLICY "authenticated_select_bar_access" ON public.contaazul_lancamentos 
    FOR SELECT TO authenticated 
    USING (auth.role() = 'authenticated' AND public.user_has_bar_access(bar_id));

-- 2. CONTAAZUL_CATEGORIAS
ALTER TABLE public.contaazul_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.contaazul_categorias;
CREATE POLICY "service_role_full_access" ON public.contaazul_categorias 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_bar_access" ON public.contaazul_categorias;
CREATE POLICY "authenticated_select_bar_access" ON public.contaazul_categorias 
    FOR SELECT TO authenticated 
    USING (auth.role() = 'authenticated' AND public.user_has_bar_access(bar_id));

-- 3. CONTAAZUL_CENTROS_CUSTO
ALTER TABLE public.contaazul_centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.contaazul_centros_custo;
CREATE POLICY "service_role_full_access" ON public.contaazul_centros_custo 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_bar_access" ON public.contaazul_centros_custo;
CREATE POLICY "authenticated_select_bar_access" ON public.contaazul_centros_custo 
    FOR SELECT TO authenticated 
    USING (auth.role() = 'authenticated' AND public.user_has_bar_access(bar_id));

-- 4. CONTAAZUL_PESSOAS
ALTER TABLE public.contaazul_pessoas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.contaazul_pessoas;
CREATE POLICY "service_role_full_access" ON public.contaazul_pessoas 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_bar_access" ON public.contaazul_pessoas;
CREATE POLICY "authenticated_select_bar_access" ON public.contaazul_pessoas 
    FOR SELECT TO authenticated 
    USING (auth.role() = 'authenticated' AND public.user_has_bar_access(bar_id));

-- 5. CONTAAZUL_CONTAS_FINANCEIRAS
ALTER TABLE public.contaazul_contas_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.contaazul_contas_financeiras;
CREATE POLICY "service_role_full_access" ON public.contaazul_contas_financeiras 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_bar_access" ON public.contaazul_contas_financeiras;
CREATE POLICY "authenticated_select_bar_access" ON public.contaazul_contas_financeiras 
    FOR SELECT TO authenticated 
    USING (auth.role() = 'authenticated' AND public.user_has_bar_access(bar_id));

-- 6. CONTAAZUL_LOGS_SINCRONIZACAO
ALTER TABLE public.contaazul_logs_sincronizacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.contaazul_logs_sincronizacao;
CREATE POLICY "service_role_full_access" ON public.contaazul_logs_sincronizacao 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_bar_access" ON public.contaazul_logs_sincronizacao;
CREATE POLICY "authenticated_select_bar_access" ON public.contaazul_logs_sincronizacao 
    FOR SELECT TO authenticated 
    USING (auth.role() = 'authenticated' AND public.user_has_bar_access(bar_id));

-- ====================================================
-- FIM DA MIGRAÇÃO
-- ====================================================
