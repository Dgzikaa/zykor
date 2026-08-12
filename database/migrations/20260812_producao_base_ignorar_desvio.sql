-- =============================================================================
-- Olhinho "fora do desvio" para PRODUÇÕES — 12/08/2026
-- =============================================================================
--
-- Pedido do Isaías: "consegue acrescentar esse olho nos outros desvios também? produção e
-- proteínas, e também no semanal e no mensal".
--
-- O olhinho grava `ignorar_desvio` em operations.insumos, e a API devolve 404 quando o código
-- não está lá (comportamento correto desde 29/07 — antes respondia sucesso sem gravar nada).
-- Só que PARTE das produções não existe em operations.insumos: no bar 4, 12 das 69 linhas de
-- produção da aba (Arroz Branco Cozido, Molho Rose, Suco de Laranja Drinks, os xaropes...)
-- vivem apenas em public.producao_base. Nelas o botão daria 404 e o time não conseguiria
-- tirar do desvio.
--
-- Insumos (265/265) e proteínas (9/9) já estavam 100% cobertos — o buraco era só produção.
--
-- Mesma semântica da coluna irmã em operations.insumos: flag de CADASTRO, não de período.
-- Marcar uma vez vale para diária, semanal e mensal.
-- =============================================================================

alter table public.producao_base
  add column if not exists ignorar_desvio boolean not null default false;

comment on column public.producao_base.ignorar_desvio is
  'Produção que o time não controla no desvio (olhinho da tela /operacional/desvios). '
  'Espelha operations.insumos.ignorar_desvio; existe porque nem toda produção tem cadastro '
  'em operations.insumos. Some da lista E do total de desvio, em qualquer granularidade.';
