import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface AuditoriaResult {
  secao: string;
  dados: any[];
  erro?: string;
}

async function executarQuery(nome: string, query: string): Promise<AuditoriaResult> {
  console.log(`\n🔍 Executando: ${nome}...`);
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query_text: query });
    
    if (error) {
      console.error(`❌ Erro em ${nome}:`, error.message);
      return { secao: nome, dados: [], erro: error.message };
    }
    
    console.log(`✅ ${nome}: ${data?.length || 0} registros`);
    return { secao: nome, dados: data || [] };
  } catch (err: any) {
    console.error(`❌ Exceção em ${nome}:`, err.message);
    return { secao: nome, dados: [], erro: err.message };
  }
}

async function auditoriaCompleta() {
  console.log('🚀 INICIANDO AUDITORIA COMPLETA DO BANCO ZYKOR\n');
  console.log('Data:', new Date().toLocaleString('pt-BR'));
  console.log('=' .repeat(80));

  const resultados: AuditoriaResult[] = [];

  // 1. MAPEAMENTO DE TABELAS
  resultados.push(await executarQuery(
    '1. Mapeamento de Tabelas',
    `
      SELECT 
          tablename,
          pg_size_pretty(pg_total_relation_size('public.'||tablename)) as tamanho,
          (SELECT COUNT(*) FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = t.tablename) as num_colunas
      FROM pg_tables t
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||tablename) DESC
      LIMIT 30;
    `
  ));

  // 2. VOLUME DE REGISTROS
  resultados.push(await executarQuery(
    '2. Volume de Registros por Tabela',
    `
      SELECT 
          'contahub_analitico' as tabela,
          COUNT(*) as total_registros,
          MIN(trn_dtgerencial)::text as primeira_data,
          MAX(trn_dtgerencial)::text as ultima_data,
          COUNT(DISTINCT bar_id) as bares_com_dados,
          COUNT(DISTINCT trn_dtgerencial) as dias_unicos
      FROM contahub_analitico

      UNION ALL

      SELECT 
          'eventos_base' as tabela,
          COUNT(*) as total_registros,
          MIN(data_evento)::text as primeira_data,
          MAX(data_evento)::text as ultima_data,
          COUNT(DISTINCT bar_id) as bares_com_dados,
          COUNT(DISTINCT data_evento) as dias_unicos
      FROM eventos_base

      UNION ALL

      SELECT 
          'cmv_semanal' as tabela,
          COUNT(*) as total_registros,
          MIN(data_inicio)::text as primeira_data,
          MAX(data_inicio)::text as ultima_data,
          COUNT(DISTINCT bar_id) as bares_com_dados,
          COUNT(DISTINCT data_inicio) as dias_unicos
      FROM cmv_semanal

      UNION ALL

      SELECT 
          'desempenho_semanal' as tabela,
          COUNT(*) as total_registros,
          MIN(data_inicio)::text as primeira_data,
          MAX(data_inicio)::text as ultima_data,
          COUNT(DISTINCT bar_id) as bares_com_dados,
          COUNT(DISTINCT data_inicio) as dias_unicos
      FROM desempenho_semanal

      ORDER BY total_registros DESC;
    `
  ));

  // 3. COBERTURA POR BAR
  resultados.push(await executarQuery(
    '3. Cobertura de Dados por Bar',
    `
      WITH periodo_total AS (
          SELECT 
              bar_id,
              MIN(data_evento) as primeira_data,
              MAX(data_evento) as ultima_data,
              MAX(data_evento) - MIN(data_evento) as dias_total_periodo
          FROM eventos_base
          WHERE bar_id IS NOT NULL
          GROUP BY bar_id
      ),
      dias_com_dados AS (
          SELECT 
              bar_id,
              COUNT(DISTINCT data_evento) as dias_com_registros
          FROM eventos_base
          WHERE bar_id IS NOT NULL
          GROUP BY bar_id
      )
      SELECT 
          pt.bar_id,
          b.name as nome_bar,
          pt.primeira_data::text,
          pt.ultima_data::text,
          pt.dias_total_periodo + 1 as dias_esperados,
          COALESCE(dcd.dias_com_registros, 0) as dias_com_dados,
          ROUND(
              (COALESCE(dcd.dias_com_registros, 0)::numeric / 
               NULLIF(pt.dias_total_periodo + 1, 0)) * 100, 
              2
          ) as taxa_cobertura_pct
      FROM periodo_total pt
      LEFT JOIN dias_com_dados dcd ON pt.bar_id = dcd.bar_id
      LEFT JOIN bars b ON pt.bar_id = b.id
      ORDER BY taxa_cobertura_pct ASC;
    `
  ));

  // 4. CMV IMPOSSÍVEIS
  resultados.push(await executarQuery(
    '4. CMV Impossíveis (>100% ou <0%)',
    `
      SELECT 
          'cmv_semanal' as origem,
          id::text,
          bar_id,
          ano,
          semana,
          data_inicio::text,
          cmv_percentual,
          CASE 
              WHEN cmv_percentual > 100 THEN 'CMV > 100%'
              WHEN cmv_percentual < 0 THEN 'CMV < 0%'
          END as problema
      FROM cmv_semanal
      WHERE cmv_percentual > 100 OR cmv_percentual < 0
      ORDER BY data_inicio DESC
      LIMIT 50;
    `
  ));

  // 5. ESTOQUE NEGATIVO
  resultados.push(await executarQuery(
    '5. Estoque Negativo',
    `
      SELECT 
          'contagem_estoque_produtos' as tabela,
          id::text,
          categoria,
          descricao,
          estoque_total,
          estoque_flutuante,
          estoque_fechado,
          CASE 
              WHEN estoque_total < 0 THEN 'Estoque total negativo'
              WHEN estoque_flutuante < 0 THEN 'Estoque flutuante negativo'
              WHEN estoque_fechado < 0 THEN 'Estoque fechado negativo'
          END as problema,
          data_contagem::text
      FROM contagem_estoque_produtos
      WHERE estoque_total < 0 
         OR estoque_flutuante < 0 
         OR estoque_fechado < 0
      ORDER BY data_contagem DESC
      LIMIT 50;
    `
  ));

  // 6. VALORES NULOS CRÍTICOS
  resultados.push(await executarQuery(
    '6. Valores Nulos em Campos Críticos',
    `
      SELECT 
          'eventos_base' as tabela,
          id::text,
          bar_id,
          data_evento::text,
          nome,
          'Faturamento NULL mas tem público' as problema,
          real_r as faturamento,
          cl_real as publico
      FROM eventos_base
      WHERE real_r IS NULL 
        AND cl_real IS NOT NULL 
        AND cl_real > 0
      ORDER BY data_evento DESC
      LIMIT 50;
    `
  ));

  // 7. DUPLICAÇÕES
  resultados.push(await executarQuery(
    '7. Eventos Duplicados',
    `
      SELECT 
          bar_id,
          data_evento::text,
          COUNT(*) as quantidade_duplicados,
          STRING_AGG(id::text, ', ') as ids_duplicados,
          STRING_AGG(nome, ' | ') as nomes_eventos
      FROM eventos_base
      GROUP BY bar_id, data_evento
      HAVING COUNT(*) > 1
      ORDER BY quantidade_duplicados DESC
      LIMIT 30;
    `
  ));

  // 8. GAPS TEMPORAIS (últimos 90 dias)
  resultados.push(await executarQuery(
    '8. Gaps Temporais (Finais de Semana)',
    `
      WITH datas_esperadas AS (
          SELECT generate_series(
              CURRENT_DATE - INTERVAL '90 days',
              CURRENT_DATE,
              '1 day'::interval
          )::date as data,
          EXTRACT(DOW FROM generate_series(
              CURRENT_DATE - INTERVAL '90 days',
              CURRENT_DATE,
              '1 day'::interval
          )::date) as dia_semana
      ),
      datas_com_dados AS (
          SELECT DISTINCT data_evento
          FROM eventos_base
          WHERE data_evento >= CURRENT_DATE - INTERVAL '90 days'
            AND bar_id = 3
      )
      SELECT 
          de.data::text,
          CASE de.dia_semana
              WHEN 0 THEN 'Domingo'
              WHEN 1 THEN 'Segunda'
              WHEN 2 THEN 'Terça'
              WHEN 3 THEN 'Quarta'
              WHEN 4 THEN 'Quinta'
              WHEN 5 THEN 'Sexta'
              WHEN 6 THEN 'Sábado'
          END as dia_semana,
          CASE 
              WHEN de.dia_semana IN (5, 6) AND dcd.data_evento IS NULL THEN 'CRÍTICO - Fim de semana'
              WHEN dcd.data_evento IS NULL THEN 'GAP'
              ELSE 'OK'
          END as status
      FROM datas_esperadas de
      LEFT JOIN datas_com_dados dcd ON de.data = dcd.data_evento
      WHERE dcd.data_evento IS NULL
        AND de.dia_semana IN (5, 6)
      ORDER BY de.data DESC
      LIMIT 30;
    `
  ));

  // 9. INCONSISTÊNCIAS EVENTOS vs CONTAHUB
  resultados.push(await executarQuery(
    '9. Inconsistências Faturamento (Eventos vs ContaHub)',
    `
      SELECT 
          eb.id::text,
          eb.bar_id,
          eb.data_evento::text,
          eb.nome as evento,
          eb.real_r as fat_evento,
          COALESCE(SUM(ca.valorfinal), 0) as fat_contahub,
          ABS(eb.real_r - COALESCE(SUM(ca.valorfinal), 0)) as diferenca,
          ROUND(
              (ABS(eb.real_r - COALESCE(SUM(ca.valorfinal), 0)) / NULLIF(eb.real_r, 0)) * 100,
              2
          ) as diferenca_pct
      FROM eventos_base eb
      LEFT JOIN contahub_analitico ca 
          ON eb.bar_id = ca.bar_id 
          AND eb.data_evento = ca.trn_dtgerencial
      WHERE eb.real_r > 0
        AND eb.bar_id = 3
      GROUP BY eb.id, eb.bar_id, eb.data_evento, eb.nome, eb.real_r
      HAVING ABS(eb.real_r - COALESCE(SUM(ca.valorfinal), 0)) > eb.real_r * 0.1
      ORDER BY diferenca DESC
      LIMIT 30;
    `
  ));

  // 10. SCORE DE SAÚDE
  const scoreResult = await executarQuery(
    '10. Score de Saúde dos Dados',
    `
      WITH problemas_count AS (
          SELECT 
              (SELECT COUNT(*) FROM cmv_semanal WHERE cmv_percentual > 100 OR cmv_percentual < 0) as cmv_impossiveis,
              (SELECT COUNT(*) FROM contagem_estoque_produtos 
               WHERE estoque_total < 0 OR estoque_flutuante < 0 OR estoque_fechado < 0) as estoque_negativo,
              (SELECT COUNT(*) FROM eventos_base 
               WHERE (real_r IS NULL AND cl_real > 0) 
                  OR (real_r > 0 AND (cl_real IS NULL OR cl_real = 0))) as valores_nulos,
              (SELECT COUNT(*) FROM (
                  SELECT bar_id, data_evento FROM eventos_base 
                  GROUP BY bar_id, data_evento HAVING COUNT(*) > 1
              ) dup) as duplicacoes
      )
      SELECT 
          cmv_impossiveis,
          estoque_negativo,
          valores_nulos,
          duplicacoes,
          (cmv_impossiveis * 10 + estoque_negativo * 5 + valores_nulos * 3 + duplicacoes * 2) as pontos_desconto,
          100 - LEAST((cmv_impossiveis * 10 + estoque_negativo * 5 + valores_nulos * 3 + duplicacoes * 2), 100) as score_saude
      FROM problemas_count;
    `
  );
  resultados.push(scoreResult);

  // GERAR RELATÓRIO
  console.log('\n' + '='.repeat(80));
  console.log('📊 RELATÓRIO DE AUDITORIA COMPLETA');
  console.log('='.repeat(80));

  const relatorio = {
    data_auditoria: new Date().toISOString(),
    resultados: resultados,
    score_saude: scoreResult.dados[0] || null,
    resumo: {
      total_secoes: resultados.length,
      secoes_com_erro: resultados.filter(r => r.erro).length,
      secoes_ok: resultados.filter(r => !r.erro).length,
    }
  };

  // Salvar em arquivo
  const nomeArquivo = `docs/auditoria-completa-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(nomeArquivo, JSON.stringify(relatorio, null, 2), 'utf-8');
  console.log(`\n💾 Relatório salvo em: ${nomeArquivo}`);

  // Exibir resumo
  console.log('\n📈 RESUMO:');
  console.log(`   Total de seções: ${relatorio.resumo.total_secoes}`);
  console.log(`   Seções OK: ${relatorio.resumo.secoes_ok}`);
  console.log(`   Seções com erro: ${relatorio.resumo.secoes_com_erro}`);
  
  if (relatorio.score_saude) {
    console.log(`\n🏥 SCORE DE SAÚDE: ${relatorio.score_saude.score_saude}%`);
    console.log(`   CMV Impossíveis: ${relatorio.score_saude.cmv_impossiveis}`);
    console.log(`   Estoque Negativo: ${relatorio.score_saude.estoque_negativo}`);
    console.log(`   Valores Nulos: ${relatorio.score_saude.valores_nulos}`);
    console.log(`   Duplicações: ${relatorio.score_saude.duplicacoes}`);
  }

  console.log('\n✅ Auditoria completa finalizada!');
  
  return relatorio;
}

// Executar
auditoriaCompleta()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
