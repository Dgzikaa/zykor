/**
 * Função: refresh_cliente_estatisticas_upsert
 * 
 * Atualiza estatísticas de clientes usando UPSERT ao invés de DELETE+INSERT.
 * Compatível com trigger de proteção contra DELETE.
 * 
 * Parâmetros:
 * - p_bar_id: ID do bar
 * - p_data_visita: Data das visitas a processar
 * 
 * @version 1.0.0
 * @date 2026-03-31
 */

CREATE OR REPLACE FUNCTION public.refresh_cliente_estatisticas_upsert(
  p_bar_id integer, 
  p_data_visita date
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO cliente_estatisticas (
    bar_id, telefone, nome, total_visitas, total_gasto, total_entrada, total_consumo,
    ticket_medio, ticket_medio_entrada, ticket_medio_consumo, ultima_visita,
    tempo_medio_minutos, total_visitas_com_tempo
  )
  SELECT 
    v.bar_id,
    CASE 
      WHEN LENGTH(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g')) = 10 
      THEN SUBSTRING(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g'), 1, 2) || '9' || SUBSTRING(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g'), 3)
      ELSE REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g')
    END as telefone,
    MAX(v.cliente_nome) as nome,
    COUNT(*) as total_visitas,
    SUM(COALESCE(v.valor_pagamentos, 0)) as total_gasto,
    SUM(COALESCE(v.valor_couvert, 0)) as total_entrada,
    SUM(COALESCE(v.valor_pagamentos, 0) - COALESCE(v.valor_couvert, 0)) as total_consumo,
    CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(v.valor_pagamentos, 0)) / COUNT(*) ELSE 0 END as ticket_medio,
    CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(v.valor_couvert, 0)) / COUNT(*) ELSE 0 END as ticket_medio_entrada,
    CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(v.valor_pagamentos, 0) - COALESCE(v.valor_couvert, 0)) / COUNT(*) ELSE 0 END as ticket_medio_consumo,
    MAX(v.data_visita) as ultima_visita,
    CASE 
      WHEN COUNT(CASE WHEN v.tempo_estadia_minutos > 0 AND v.tempo_estadia_minutos < 720 THEN 1 END) > 0 
      THEN AVG(CASE WHEN v.tempo_estadia_minutos > 0 AND v.tempo_estadia_minutos < 720 THEN v.tempo_estadia_minutos END)
      ELSE 0 
    END as tempo_medio_minutos,
    COUNT(CASE WHEN v.tempo_estadia_minutos > 0 AND v.tempo_estadia_minutos < 720 THEN 1 END) as total_visitas_com_tempo
  FROM visitas v
  WHERE v.bar_id = p_bar_id
    AND v.cliente_fone IS NOT NULL 
    AND v.cliente_fone != ''
    AND LENGTH(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g')) >= 10
    AND EXISTS (
      SELECT 1 FROM visitas v2
      WHERE v2.bar_id = p_bar_id
        AND v2.data_visita = p_data_visita
        AND CASE 
          WHEN LENGTH(REGEXP_REPLACE(v2.cliente_fone, '[^0-9]', '', 'g')) = 10 
          THEN SUBSTRING(REGEXP_REPLACE(v2.cliente_fone, '[^0-9]', '', 'g'), 1, 2) || '9' || SUBSTRING(REGEXP_REPLACE(v2.cliente_fone, '[^0-9]', '', 'g'), 3)
          ELSE REGEXP_REPLACE(v2.cliente_fone, '[^0-9]', '', 'g')
        END = CASE 
          WHEN LENGTH(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g')) = 10 
          THEN SUBSTRING(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g'), 1, 2) || '9' || SUBSTRING(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g'), 3)
          ELSE REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g')
        END
    )
  GROUP BY 
    v.bar_id,
    CASE 
      WHEN LENGTH(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g')) = 10 
      THEN SUBSTRING(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g'), 1, 2) || '9' || SUBSTRING(REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g'), 3)
      ELSE REGEXP_REPLACE(v.cliente_fone, '[^0-9]', '', 'g')
    END
  ON CONFLICT (bar_id, telefone) DO UPDATE SET
    nome = EXCLUDED.nome,
    total_visitas = EXCLUDED.total_visitas,
    total_gasto = EXCLUDED.total_gasto,
    total_entrada = EXCLUDED.total_entrada,
    total_consumo = EXCLUDED.total_consumo,
    ticket_medio = EXCLUDED.ticket_medio,
    ticket_medio_entrada = EXCLUDED.ticket_medio_entrada,
    ticket_medio_consumo = EXCLUDED.ticket_medio_consumo,
    ultima_visita = EXCLUDED.ultima_visita,
    tempo_medio_minutos = EXCLUDED.tempo_medio_minutos,
    total_visitas_com_tempo = EXCLUDED.total_visitas_com_tempo,
    updated_at = NOW();
END;
$function$;
