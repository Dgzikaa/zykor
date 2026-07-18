-- RBAC (Fase 1): perfis de acesso editáveis + FK em usuarios.
--
-- Requisitado pelo Gonza (2026-07-17): substituir a atribuição granular por usuário
-- (modulos_permitidos jsonb) por PERFIS reutilizáveis. Cada perfil = conjunto de
-- módulos. Usuário vinculado a 1 perfil. Mudança no perfil propaga automaticamente
-- pra todos os usuários que o usam.
--
-- Modelo:
--   usuarios_perfil (id, nome, descricao, modulos jsonb, sistema)
--   usuarios.perfil_id → FK nullable pra usuarios_perfil
--
-- Regra do resolver (implementada em Fase 1 no lib/permissions/resolver.ts):
--   - Se usuarios.perfil_id NÃO é null → usa perfil.modulos (SÓ isso, sem merge)
--   - Se perfil_id é null → fallback pro modulos_permitidos antigo (compat)
--
-- Perfil "Admin" sistema=true (não editável, não deletável, módulos=["todos"])
-- absorve o antigo role='admin'. Todos os admins ativos ficam vinculados a ele.
-- Os demais perfis (Sócio, Financeiro, Liderança, Operação, Adm) começam vazios
-- e serão preenchidos pela UI de gestão de perfis (Fase 2).

BEGIN;

CREATE TABLE IF NOT EXISTS public.usuarios_perfil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  modulos jsonb NOT NULL DEFAULT '[]'::jsonb,
  sistema boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT NOW(),
  atualizado_em timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT modulos_is_array CHECK (jsonb_typeof(modulos) = 'array')
);

COMMENT ON TABLE public.usuarios_perfil IS
  'Perfis de acesso (RBAC). Cada perfil = conjunto de módulos. Usuários vinculados via usuarios.perfil_id. Alterações no perfil propagam automaticamente pra todos os usuários que o usam.';

COMMENT ON COLUMN public.usuarios_perfil.sistema IS
  'true = perfil de sistema, não editável nem deletável (ex.: Admin).';

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS perfil_id uuid
    REFERENCES public.usuarios_perfil(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_id
  ON public.usuarios(perfil_id) WHERE perfil_id IS NOT NULL;

-- Perfis iniciais
INSERT INTO public.usuarios_perfil (nome, descricao, modulos, sistema)
VALUES
  ('Admin', 'Acesso total ao sistema. Perfil de sistema — não pode ser editado ou removido.',
   '["todos"]'::jsonb, true),
  ('Sócio', 'Sócios: acesso a estratégico, relatórios financeiros e visão de resultados.',
   '[]'::jsonb, false),
  ('Financeiro', 'Time financeiro: DRE, DFC, Balanço, Ferramentas Financeiro completas.',
   '[]'::jsonb, false),
  ('Liderança', 'Gerentes/coordenadores: operação + estratégico do dia a dia.',
   '[]'::jsonb, false),
  ('Operação', 'Time operacional (bar/cozinha/salão): CMV, estoque, produção.',
   '[]'::jsonb, false),
  ('Adm', 'Administrativo: agendamentos, conciliação, ferramentas de rotina.',
   '[]'::jsonb, false)
ON CONFLICT (nome) DO NOTHING;

-- Vincula os admins ao perfil Admin
UPDATE public.usuarios u
SET perfil_id = (SELECT id FROM public.usuarios_perfil WHERE nome = 'Admin')
WHERE u.role = 'admin' AND u.ativo = true AND u.perfil_id IS NULL;

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.tg_usuarios_perfil_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_perfil_updated ON public.usuarios_perfil;
CREATE TRIGGER trg_usuarios_perfil_updated
  BEFORE UPDATE ON public.usuarios_perfil
  FOR EACH ROW EXECUTE FUNCTION public.tg_usuarios_perfil_updated();

-- Recria a view auth_custom.usuarios expondo `perfil_id`. Sem isso, os INSERT/UPDATE
-- via schema('auth_custom') com perfil_id no payload quebravam silenciosamente
-- (a coluna existia na tabela real mas não na view — bug reportado pelo Gonza
-- 2026-07-18 ao criar usuário).
CREATE OR REPLACE VIEW auth_custom.usuarios AS
SELECT id, auth_id, nome, email, telefone, cpf, ativo,
       created_at, updated_at, role, setor, modulos_permitidos,
       data_nascimento, endereco, cep, cidade, estado, bio, foto_perfil,
       preferencias, senha_redefinida, conta_verificada, ultima_atividade,
       reset_token, reset_token_expiry,
       perfil_id
FROM public.usuarios;

COMMIT;
