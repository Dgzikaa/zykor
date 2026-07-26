-- 25/07/2026 — REAPLICA o teórico ao vivo do fn_desvios + cria guarda contra o mesmo acidente
--
-- INCIDENTE: a migration 20260709_fn_desvios_teorico_ao_vivo.sql fez o CTE `teorico_ins` do
-- gold.fn_desvios ler `silver.insumo_por_produto` AO VIVO em vez da matview
-- `silver.consumo_teorico_insumo_dia` (refrescada só de hora em hora). Ela foi aplicada como
-- patch CIRÚRGICO (regexp_replace sobre pg_get_functiondef), sem deixar o corpo completo num
-- arquivo-fonte.
--
-- Em 24/07 a migration 20260724_fn_desvios_embalagem_manual_chave_correta.sql fez
-- `CREATE OR REPLACE FUNCTION gold.fn_desvios` com o CORPO INTEIRO — escrito a partir de uma
-- cópia anterior a 09/07. Resultado: a correção do teórico ao vivo foi DESFEITA silenciosamente.
-- Ficou assim de 24/07 a 25/07: o Desvio voltou a divergir da tela de Saída sempre que alguém
-- mexia numa ficha (até 1h de atraso, que é o intervalo do refresh da matview).
--
-- Ninguém percebeu porque não existe nada que verifique "esta função continua lendo a fonte
-- certa?". É o mesmo padrão do 504 do Conta Azul e do detector de fraude: o erro não gritava.
--
-- Este arquivo faz duas coisas:
--   1) reaplica o patch do teórico ao vivo (com guarda que aborta se o padrão não existir)
--   2) cria integridade.verificar_invariantes_sql(), que checa se funções críticas continuam
--      lendo a fonte esperada — pra que a próxima reversão apareça em vez de passar batido.

-- ── 1) reaplica ───────────────────────────────────────────────────────────────────────────
do $$
declare def text; novo text;
begin
  def := pg_get_functiondef('gold.fn_desvios'::regproc);
  if def ILIKE '%silver.insumo_por_produto%' and def NOT ILIKE '%consumo_teorico_insumo_dia%' then
    raise notice 'fn_desvios ja le o teorico ao vivo — nada a fazer';
    return;
  end if;
  novo := regexp_replace(def,
    'teorico_ins\s+as\s*\(\s*select\s+upper\(insumo_codigo\)\s+cod,\s*sum\(qtd_teorica\)\s+as\s+base\s+from\s+silver\.consumo_teorico_insumo_dia\s+where\s+bar_id=p_bar\s+and\s+data\s*>=\s*p_ini\s+and\s+data\s*<\s*p_fim\s+group\s+by\s+upper\(insumo_codigo\)\s*\)',
    'teorico_ins as (select upper(ipp.insumo_codigo) cod, sum(v.qtd_consumo * ipp.qtd_por_produto) as base from silver.vendas_consolidada_dia v join silver.insumo_por_produto ipp on ipp.bar_id=v.bar_id and ipp.produto_cod=v.cod_interno where v.bar_id=p_bar and v.data >= p_ini and v.data < p_fim group by upper(ipp.insumo_codigo))',
    'g');
  if novo = def then
    raise exception 'fn_desvios: padrao teorico_ins nao encontrado — abortando';
  end if;
  execute novo;
end $$;

-- ── 2) guarda contra reversão silenciosa ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integridade.invariantes_sql (
  id             serial PRIMARY KEY,
  objeto         text NOT NULL,          -- 'gold.fn_desvios'
  descricao      text NOT NULL,
  deve_conter    text,                   -- trecho que TEM que aparecer na definição
  nao_pode_conter text,                  -- trecho que NÃO pode aparecer
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE integridade.invariantes_sql ENABLE ROW LEVEL SECURITY;

INSERT INTO integridade.invariantes_sql (objeto, descricao, deve_conter, nao_pode_conter)
SELECT * FROM (VALUES
  ('gold.fn_desvios',
   'Teórico do desvio tem que ser AO VIVO (ficha muda -> desvio reflete na hora). Matview atrasa até 1h e faz o Desvio divergir da tela de Saída.',
   'silver.insumo_por_produto', 'consumo_teorico_insumo_dia'),
  ('gold.fn_desvios',
   'Embalagem tem que vir da chave MANUAL (-insumos.id), não da chave VMarket — senão diverge da tela de Insumos.',
   'iu.id_prod = -i.id', NULL),
  ('gold.fn_desvios_composicao',
   'Mesma regra de embalagem do fn_desvios: a composição do modal precisa bater com a tela.',
   'iu.id_prod = -i.id', 'id_produto_sisfood_cotacao')
) v(objeto, descricao, deve_conter, nao_pode_conter)
WHERE NOT EXISTS (SELECT 1 FROM integridade.invariantes_sql x WHERE x.objeto = v.objeto AND x.descricao = v.descricao);

CREATE OR REPLACE FUNCTION integridade.verificar_invariantes_sql()
RETURNS TABLE(objeto text, descricao text, problema text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = integridade, public, pg_catalog
AS $$
DECLARE r record; def text;
BEGIN
  FOR r IN SELECT * FROM integridade.invariantes_sql WHERE ativo LOOP
    BEGIN
      def := pg_get_functiondef(r.objeto::regproc);
    EXCEPTION WHEN OTHERS THEN
      objeto := r.objeto; descricao := r.descricao; problema := 'objeto não encontrado';
      RETURN NEXT; CONTINUE;
    END;
    IF r.deve_conter IS NOT NULL AND position(r.deve_conter in def) = 0 THEN
      objeto := r.objeto; descricao := r.descricao;
      problema := 'deixou de conter: ' || r.deve_conter;
      RETURN NEXT;
    END IF;
    IF r.nao_pode_conter IS NOT NULL AND position(r.nao_pode_conter in def) > 0 THEN
      objeto := r.objeto; descricao := r.descricao;
      problema := 'voltou a conter: ' || r.nao_pode_conter;
      RETURN NEXT;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION integridade.verificar_invariantes_sql() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION integridade.verificar_invariantes_sql() TO service_role;
