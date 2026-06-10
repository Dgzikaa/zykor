-- 2026-06-10 | Conserta o PRIMEIRO ACESSO (criação de nova senha) que travava todo usuário novo.
--
-- Sintoma: usuário novo logava mas não era levado pra criar a senha e não entrava — ficava preso.
--
-- Causa: a rota de login (api/auth/login) grava reset_token/reset_token_expiry em
--   auth_custom.usuarios e a de redefinir-senha valida esses campos, mas as colunas NÃO
--   existiam em public.usuarios (nem na view auth_custom.usuarios). O token nunca era salvo
--   -> a validação falhava -> primeiro acesso impossível.
--
-- Correção: criar as colunas em public.usuarios e expô-las na view auth_custom.usuarios.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS reset_token text,
  ADD COLUMN IF NOT EXISTS reset_token_expiry timestamptz;

CREATE OR REPLACE VIEW auth_custom.usuarios AS
 SELECT id, auth_id, nome, email, telefone, cpf, ativo, created_at, updated_at,
   role, setor, modulos_permitidos, data_nascimento, endereco, cep, cidade, estado,
   bio, foto_perfil, preferencias, senha_redefinida, conta_verificada, ultima_atividade,
   reset_token, reset_token_expiry
 FROM public.usuarios;

-- PostgREST precisa recarregar o schema p/ enxergar as colunas novas na view
NOTIFY pgrst, 'reload schema';
