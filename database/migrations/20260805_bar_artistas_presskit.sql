-- Presskit do artista no cadastro (operations.bar_artistas)
--
-- Pedido da Ana Paula (05/08/2026): ela mantém um Drive com o presskit dos residentes pra Dani
-- achar as fotos na hora de fazer os cards, e hoje reenvia o link no grupo do WhatsApp toda vez.
-- O Zykor vira o índice: o cadastro do artista já tem nome, tipo, contato e foto — falta o link.
--
-- É só o LINK, de propósito: os arquivos pesados continuam onde já estão (Drive), e o campo aceita
-- tanto uma pasta do Drive quanto uma pasta da tela de Arquivos do Zykor.

ALTER TABLE operations.bar_artistas
  ADD COLUMN IF NOT EXISTS presskit_url text;

COMMENT ON COLUMN operations.bar_artistas.presskit_url IS
  'Link do presskit do artista (pasta no Drive, na tela de Arquivos do Zykor, ou site do artista). Só o link — arquivo não fica aqui.';

-- A tela lista os artistas por esta função; sem devolver o campo, o presskit não chegaria no front.
-- RETURNS TABLE mudou => DROP antes (a assinatura de ENTRADA continua igual, quem chama não muda).
DROP FUNCTION IF EXISTS operations.fn_artista_lista(integer, date, date, integer);

CREATE OR REPLACE FUNCTION operations.fn_artista_lista(p_bar integer, p_ini date DEFAULT NULL::date, p_fim date DEFAULT NULL::date, p_dow integer DEFAULT NULL::integer)
 RETURNS TABLE(artista_id integer, nome text, tipo text, foto_url text, presskit_url text, shows bigint, primeiro date, ultimo date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'operations', 'public', 'pg_catalog'
AS $function$
  select ea.artista_id,
         coalesce(max(ba.nome), max(ea.artista_nome)) as nome,
         coalesce(max(ba.tipo),'banda') as tipo,
         max(ba.foto_url) as foto_url,
         max(ba.presskit_url) as presskit_url,
         count(*) as shows, min(eb.data_evento::date) as primeiro, max(eb.data_evento::date) as ultimo
  from operations.evento_artistas ea
  join public.eventos_base eb on eb.id = ea.evento_id
  left join operations.bar_artistas ba on ba.id = ea.artista_id
  where ea.bar_id = p_bar and ea.artista_id is not null and eb.data_evento::date <= current_date
    and (p_ini is null or eb.data_evento::date >= p_ini)
    and (p_fim is null or eb.data_evento::date <= p_fim)
    and (p_dow is null or extract(dow from eb.data_evento)::int = p_dow)
  group by ea.artista_id
  order by count(*) desc;
$function$;
