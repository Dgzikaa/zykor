-- Vínculo usuário do Zykor <-> funcionário: exposição na view e a carga inicial
--
-- auth_custom.usuarios é a VIEW por onde as rotas de usuário leem e escrevem
-- (PUT /api/usuarios/[id]). Sem expor `funcionario_id` nela, a coluna existiria na tabela e seria
-- invisível para a aplicação — o RH não teria como corrigir o vínculo.
create or replace view auth_custom.usuarios as
 SELECT id, auth_id, nome, email, telefone, cpf, ativo, created_at, updated_at, role, setor,
    modulos_permitidos, data_nascimento, endereco, cep, cidade, estado, bio, foto_perfil,
    preferencias, senha_redefinida, conta_verificada, ultima_atividade, reset_token,
    reset_token_expiry, perfil_id,
    funcionario_id
   FROM public.usuarios;

-- Carga inicial por NOME (o casamento por e-mail já rodou antes e pegou só 3: o login costuma ser
-- e-mail pessoal, não o do cadastro). Só os seguros — ver abaixo o que foi recusado de propósito.
update public.usuarios u set funcionario_id = v.fid
from (values
  ('alanlisboa306@gmail.com', 65),        -- Alan Lisboa      -> ALAN PEREIRA LISBOA (Assistente de Produção)
  ('andreiaordi@gmail.com', 660),         -- Andreia          -> Andréia Pereira (Gerente Operacional)
  ('mafe@grupobizu.com.br', 661),         -- Mafê             -> Mafê (Chefe de Bar)
  ('nataliaordinario2@gmail.com', 103)    -- Natalia          -> NATÁLIA DIAS MEDEIROS (Auxiliar de Produção)
) as v(email, fid)
where lower(u.email) = v.email and u.funcionario_id is null;

-- RECUSADOS pelo casamento automático, embora o algoritmo os tenha sugerido:
--   · "Tia Lu" -> DANILO CRISTIAN MATOS ROSSI. Casou porque "tia" é pedaço de "criSTIAn".
--   · "Thais RH" -> THAIS HIGINO DOS SANTOS. A Thaís do RH não é a garçonete do Deboche; nomes
--     iguais, pessoas diferentes. Vincular daria a ela a equipe errada no check-in.
-- Ambos ficam para o RH resolver na mão.
