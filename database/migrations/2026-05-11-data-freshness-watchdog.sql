-- Watchdog universal de Data Freshness
-- Verifica saúde de TODAS as pipelines via uma única função baseada em config.
-- Substitui necessidade de criar 1 alerta hardcoded por pipeline (que quebra
-- quando crons são recriados, vide bug do alerta-umbler com jobid=314).

-- ── Tabela de configuração ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system.data_freshness_config (
  id                 SERIAL PRIMARY KEY,
  pipeline_name      TEXT NOT NULL UNIQUE,
  categoria          TEXT NOT NULL,
  schema_origem      TEXT NOT NULL,
  tabela_origem      TEXT NOT NULL,
  coluna_tempo       TEXT NOT NULL,
  coluna_bar         TEXT,
  bars_esperados     INT[] DEFAULT ARRAY[3,4]::INT[],
  sla_horas_max      INT NOT NULL DEFAULT 36,
  volume_diario_min  INT DEFAULT 0,
  ativo              BOOLEAN DEFAULT TRUE,
  criticidade        TEXT DEFAULT 'media',
  canal_discord      TEXT DEFAULT 'pipeline_saude',
  descricao          TEXT,
  criado_em          TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system.data_freshness_config IS
  'Configuração do watchdog universal de freshness. Cada linha = 1 pipeline. Função verificar_data_freshness() lê daqui e gera alertas.';

INSERT INTO system.data_freshness_config
  (pipeline_name, categoria, schema_origem, tabela_origem, coluna_tempo, coluna_bar, bars_esperados, sla_horas_max, volume_diario_min, criticidade, descricao)
VALUES
  ('contahub_raw',        'pdv',         'bronze', 'bronze_contahub_raw_data',     'created_at',    'bar_id', ARRAY[3,4], 48, 1,    'critica', 'Vendas/produtos ContaHub'),
  ('contaazul',           'financeiro',  'bronze', 'bronze_contaazul_lancamentos', 'synced_at',     'bar_id', ARRAY[3,4], 30, 1,    'critica', 'Lançamentos financeiros Conta Azul'),
  ('getin',               'reservas',    'bronze', 'bronze_getin_reservations',    'synced_at',     'bar_id', ARRAY[3],   30, 0,    'alta',    'Reservas GetIn (só Ordinário)'),
  ('sympla',              'eventos',     'bronze', 'bronze_sympla_participantes',  'synced_at',     'bar_id', ARRAY[3],   168, 0,   'media',   'Participantes Sympla (só Ordinário; eventos esporádicos)'),
  ('yuzer',               'eventos',     'bronze', 'bronze_yuzer_eventos',         'synced_at',     'bar_id', ARRAY[3],   168, 0,   'media',   'Eventos Yuzer (só Ordinário; eventos esporádicos)'),
  ('google_reviews',      'marketing',   'bronze', 'bronze_google_reviews',        'scraped_at',     NULL,    ARRAY[3,4], 36, 0,    'alta',    'Reviews Google via Apify'),
  ('falae',               'comunicacao', 'bronze', 'bronze_falae_respostas',       'created_at',     NULL,    ARRAY[3,4], 168, 0,   'baixa',   'NPS Falaê (respostas esporádicas)'),
  ('umbler',              'comunicacao', 'integrations', 'umbler_mensagens',       'created_at',     NULL,    ARRAY[3],   36, 1,    'alta',    'Atendimento WhatsApp via Umbler'),
  ('inter_webhooks',      'financeiro',  'financial', 'inter_webhook_logs',        'recebido_em',    NULL,    ARRAY[3],   168, 0,   'baixa',   'PIX Inter (webhook push, esporádico)'),
  ('instagram_account',   'marketing',   'integrations', 'instagram_conta_metricas','data_snapshot', 'bar_id', ARRAY[3,4], 36, 0,    'media',   'Métricas conta IG diárias (novo)')
ON CONFLICT (pipeline_name) DO UPDATE SET
  categoria         = EXCLUDED.categoria,
  schema_origem     = EXCLUDED.schema_origem,
  tabela_origem     = EXCLUDED.tabela_origem,
  coluna_tempo      = EXCLUDED.coluna_tempo,
  coluna_bar        = EXCLUDED.coluna_bar,
  bars_esperados    = EXCLUDED.bars_esperados,
  sla_horas_max     = EXCLUDED.sla_horas_max,
  volume_diario_min = EXCLUDED.volume_diario_min,
  criticidade       = EXCLUDED.criticidade,
  descricao         = EXCLUDED.descricao,
  atualizado_em     = NOW();

-- ── Função principal: retorna status de TODAS as pipelines ──────────────
CREATE OR REPLACE FUNCTION public.verificar_data_freshness()
RETURNS TABLE (
  pipeline_name TEXT,
  categoria TEXT,
  bar_id INT,
  ultimo_em TIMESTAMPTZ,
  horas_atras NUMERIC,
  volume_24h BIGINT,
  sla_horas_max INT,
  volume_diario_min INT,
  status TEXT,
  problema TEXT,
  criticidade TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, system, bronze, silver, integrations, financial, pg_catalog
AS $$
DECLARE
  cfg RECORD;
  v_bar INT;
  v_ultimo TIMESTAMPTZ;
  v_horas NUMERIC;
  v_vol24h BIGINT;
  v_sql TEXT;
  v_status TEXT;
  v_problema TEXT;
BEGIN
  FOR cfg IN SELECT * FROM system.data_freshness_config WHERE ativo = true LOOP
    IF cfg.coluna_bar IS NULL THEN
      v_sql := format(
        'SELECT max(%I), count(*) FILTER (WHERE %I > NOW() - INTERVAL ''24 hours'') FROM %I.%I',
        cfg.coluna_tempo, cfg.coluna_tempo, cfg.schema_origem, cfg.tabela_origem
      );
      EXECUTE v_sql INTO v_ultimo, v_vol24h;
      v_horas := CASE WHEN v_ultimo IS NULL THEN NULL
                      ELSE EXTRACT(EPOCH FROM (NOW() - v_ultimo))/3600 END;
      v_status := CASE
        WHEN v_ultimo IS NULL THEN 'sem_dados'
        WHEN v_horas > cfg.sla_horas_max THEN 'atrasado'
        WHEN cfg.volume_diario_min > 0 AND v_vol24h < cfg.volume_diario_min THEN 'volume_baixo'
        ELSE 'ok'
      END;
      v_problema := CASE v_status
        WHEN 'sem_dados' THEN 'Tabela vazia'
        WHEN 'atrasado' THEN format('Última %sh atrás (SLA: %sh)', round(v_horas, 1), cfg.sla_horas_max)
        WHEN 'volume_baixo' THEN format('Volume 24h = %s (mínimo esperado: %s)', v_vol24h, cfg.volume_diario_min)
        ELSE NULL
      END;
      RETURN QUERY SELECT
        cfg.pipeline_name, cfg.categoria, NULL::INT, v_ultimo, v_horas, v_vol24h,
        cfg.sla_horas_max, cfg.volume_diario_min, v_status, v_problema, cfg.criticidade;
    ELSE
      FOREACH v_bar IN ARRAY cfg.bars_esperados LOOP
        v_sql := format(
          'SELECT max(%I), count(*) FILTER (WHERE %I > NOW() - INTERVAL ''24 hours'') FROM %I.%I WHERE %I = %s',
          cfg.coluna_tempo, cfg.coluna_tempo, cfg.schema_origem, cfg.tabela_origem, cfg.coluna_bar, v_bar
        );
        EXECUTE v_sql INTO v_ultimo, v_vol24h;
        v_horas := CASE WHEN v_ultimo IS NULL THEN NULL
                        ELSE EXTRACT(EPOCH FROM (NOW() - v_ultimo))/3600 END;
        v_status := CASE
          WHEN v_ultimo IS NULL THEN 'sem_dados'
          WHEN v_horas > cfg.sla_horas_max THEN 'atrasado'
          WHEN cfg.volume_diario_min > 0 AND v_vol24h < cfg.volume_diario_min THEN 'volume_baixo'
          ELSE 'ok'
        END;
        v_problema := CASE v_status
          WHEN 'sem_dados' THEN 'Tabela vazia pra esse bar'
          WHEN 'atrasado' THEN format('Última %sh atrás (SLA: %sh)', round(v_horas, 1), cfg.sla_horas_max)
          WHEN 'volume_baixo' THEN format('Volume 24h = %s (mínimo esperado: %s)', v_vol24h, cfg.volume_diario_min)
          ELSE NULL
        END;
        RETURN QUERY SELECT
          cfg.pipeline_name, cfg.categoria, v_bar, v_ultimo, v_horas, v_vol24h,
          cfg.sla_horas_max, cfg.volume_diario_min, v_status, v_problema, cfg.criticidade;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ── Função de alerta: dispara Discord se houver problemas ───────────────
CREATE OR REPLACE FUNCTION public.alertar_data_freshness_discord()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, system, pg_temp
AS $$
DECLARE
  v_msg TEXT := '';
  r RECORD;
  v_total_problemas INT := 0;
  v_dedup_key TEXT;
BEGIN
  FOR r IN
    SELECT * FROM public.verificar_data_freshness()
    WHERE status <> 'ok'
    ORDER BY
      CASE criticidade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
      pipeline_name
  LOOP
    v_total_problemas := v_total_problemas + 1;
    v_msg := v_msg || format(
      '• **%s** [%s%s] — %s%s' || E'\n',
      r.pipeline_name,
      r.criticidade,
      CASE WHEN r.bar_id IS NOT NULL THEN '/bar ' || r.bar_id ELSE '/global' END,
      r.problema,
      CASE WHEN r.ultimo_em IS NULL THEN ''
           ELSE ' (último: ' || to_char(r.ultimo_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || ')' END
    );
  END LOOP;

  IF v_total_problemas = 0 THEN
    RETURN 'OK_SEM_ALERTA';
  END IF;

  v_dedup_key := 'data_freshness_' || to_char(CURRENT_DATE, 'YYYY_MM_DD');

  RETURN public.enviar_alerta_discord_sistema_dedup(
    3,
    'erro',
    'pipeline_saude',
    format('🚨 Data Freshness — %s pipeline(s) com problema', v_total_problemas),
    'Pipelines com data atrasada ou volume baixo:' || E'\n\n' || v_msg ||
    E'\n\nVer detalhes: https://zykor.com.br/operacional/saude-pipeline',
    15158332,
    v_dedup_key
  );
END;
$$;

-- ── Cron 3x/dia: 8h, 12h, 18h BRT ────────────────────────────────────────
SELECT cron.schedule(
  'data-freshness-watchdog',
  '0 11,15,21 * * *',
  $cron$ SELECT public.alertar_data_freshness_discord(); $cron$
);

-- ── View pública pra consumir do frontend ───────────────────────────────
CREATE OR REPLACE VIEW public.v_data_freshness AS
  SELECT * FROM public.verificar_data_freshness();
