-- Reconciliação CMV: capturar o PREÇO por item da planilha de contagem (aba INSUMOS) pra comparar
-- item-a-item contra o preço do Zykor (VMarket). A planilha valoriza estoque pelo seu próprio preço;
-- o Zykor usa o último preço VMarket. Sincronizar os dois permite achar exatamente o que diverge.
-- A edge function sync-contagem-sheets passou a ler a coluna PREÇO (detectada pelo cabeçalho).
-- Validado: qtd × preco_planilha reproduz a linha TOTAL da própria planilha na vírgula.
-- Aplicada em prod via MCP em 2026-06-29.
alter table public.bronze_contagem_sheet add column if not exists preco_planilha numeric;
