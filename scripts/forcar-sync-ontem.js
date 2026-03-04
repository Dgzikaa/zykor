/**
 * Script para forçar sincronização do ContaHub para 01/03/2026
 * Verifica dados brutos e força processamento se necessário
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ID = 4; // Deboche
const DATA_EVENTO = '2026-03-01';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function forcarSincronizacao() {
  console.log('='.repeat(70));
  console.log('🔧 FORÇANDO SINCRONIZAÇÃO CONTAHUB - 01/03/2026 (Deboche)');
  console.log('='.repeat(70));
  console.log();

  // 1. Verificar se há dados brutos coletados
  console.log('📦 1. VERIFICANDO DADOS BRUTOS COLETADOS');
  console.log('-'.repeat(70));
  
  const { data: rawData, error: rawError } = await supabase
    .from('contahub_raw_data')
    .select('id, data_type, data_date, processed, created_at, record_count')
    .eq('bar_id', BAR_ID)
    .eq('data_date', DATA_EVENTO)
    .order('data_type', { ascending: true });

  if (rawError) {
    console.log(`   ❌ Erro ao buscar dados brutos: ${rawError.message}`);
  } else if (!rawData || rawData.length === 0) {
    console.log('   ⚠️  NENHUM dado bruto coletado para 01/03/2026');
    console.log();
    console.log('   Isso significa que a COLETA não rodou!');
    console.log();
  } else {
    console.log(`   ✅ ${rawData.length} tipos de dados coletados:`);
    rawData.forEach(d => {
      console.log(`      - ${d.data_type}: ${d.processed ? '✅ Processado' : '⚠️  NÃO processado'} (${d.record_count || 0} registros)`);
    });
    console.log();
  }

  // 2. Verificar dados processados
  console.log('📊 2. VERIFICANDO DADOS PROCESSADOS');
  console.log('-'.repeat(70));
  
  const tiposTabelas = [
    { tipo: 'analitico', tabela: 'contahub_analitico' },
    { tipo: 'vendas', tabela: 'contahub_vendas' },
    { tipo: 'pagamentos', tabela: 'contahub_pagamentos' },
    { tipo: 'periodo', tabela: 'contahub_periodo' },
    { tipo: 'tempo', tabela: 'contahub_tempo' },
    { tipo: 'fatporhora', tabela: 'contahub_fatporhora' }
  ];

  const dadosProcessados = {};
  
  for (const { tipo, tabela } of tiposTabelas) {
    try {
      // Tentar buscar com diferentes campos de data
      let query = supabase
        .from(tabela)
        .select('id', { count: 'exact', head: true })
        .eq('bar_id', BAR_ID);
      
      // Adicionar filtro de data dependendo da tabela
      if (tabela === 'contahub_vendas') {
        query = query.eq('vd_dtcontabil', DATA_EVENTO);
      } else if (tabela === 'contahub_analitico') {
        query = query.gte('trn_dtgerencial', DATA_EVENTO)
                     .lt('trn_dtgerencial', '2026-03-02');
      } else if (tabela === 'contahub_periodo') {
        query = query.eq('prd_dtgerencial', DATA_EVENTO);
      } else if (tabela === 'contahub_tempo') {
        query = query.gte('trn_dtgerencial', DATA_EVENTO)
                     .lt('trn_dtgerencial', '2026-03-02');
      } else if (tabela === 'contahub_pagamentos') {
        query = query.eq('vd_dtcontabil', DATA_EVENTO);
      } else if (tabela === 'contahub_fatporhora') {
        query = query.gte('trn_dtgerencial', DATA_EVENTO)
                     .lt('trn_dtgerencial', '2026-03-02');
      }
      
      const { count, error } = await query;
      
      if (error) {
        console.log(`   ❌ ${tipo}: Erro - ${error.message}`);
        dadosProcessados[tipo] = 0;
      } else {
        console.log(`   ${count > 0 ? '✅' : '⚠️ '} ${tipo}: ${count || 0} registros`);
        dadosProcessados[tipo] = count || 0;
      }
    } catch (err) {
      console.log(`   ❌ ${tipo}: Erro ao verificar`);
      dadosProcessados[tipo] = 0;
    }
  }
  console.log();

  // 3. Verificar logs de sincronização
  console.log('📋 3. VERIFICANDO LOGS DE SINCRONIZAÇÃO');
  console.log('-'.repeat(70));
  
  const { data: logs, error: logsError } = await supabase
    .from('sync_logs_contahub')
    .select('id, data_sync, status, inicio_execucao, fim_execucao, total_registros, triggered_by')
    .eq('bar_id', BAR_ID)
    .eq('data_sync', DATA_EVENTO)
    .order('inicio_execucao', { ascending: false });

  if (logsError) {
    console.log(`   ❌ Erro ao buscar logs: ${logsError.message}`);
  } else if (!logs || logs.length === 0) {
    console.log('   ⚠️  Nenhum log de sincronização encontrado para 01/03/2026');
  } else {
    console.log(`   ✅ ${logs.length} execução(ões) encontrada(s):`);
    logs.forEach(log => {
      console.log(`      - ${log.inicio_execucao}: ${log.status} (${log.total_registros || 0} registros) - ${log.triggered_by || 'manual'}`);
    });
  }
  console.log();

  // 4. Diagnóstico
  console.log('='.repeat(70));
  console.log('🔍 DIAGNÓSTICO');
  console.log('='.repeat(70));
  console.log();

  const temDadosBrutos = rawData && rawData.length > 0;
  const temDadosProcessados = Object.values(dadosProcessados).some(count => count > 0);

  if (!temDadosBrutos && !temDadosProcessados) {
    console.log('❌ PROBLEMA: COLETA NÃO RODOU');
    console.log();
    console.log('   Não há dados brutos nem processados para 01/03/2026');
    console.log();
    console.log('💡 AÇÃO: Forçar coleta manual agora...');
    console.log();
  } else if (temDadosBrutos && !temDadosProcessados) {
    console.log('⚠️  PROBLEMA: COLETA OK, mas PROCESSAMENTO NÃO RODOU');
    console.log();
    console.log('   Dados brutos foram coletados mas não foram processados');
    console.log();
    console.log('💡 AÇÃO: Forçar processamento manual agora...');
    console.log();
  } else if (temDadosProcessados) {
    console.log('✅ DADOS PROCESSADOS ENCONTRADOS!');
    console.log();
    console.log('   Os dados do ContaHub estão no banco.');
    console.log('   O problema pode ser no cálculo do evento.');
    console.log();
    console.log('💡 AÇÃO: Recalcular evento agora...');
    console.log();
  }

  // 5. FORÇAR SINCRONIZAÇÃO
  console.log('='.repeat(70));
  console.log('🚀 EXECUTANDO SINCRONIZAÇÃO FORÇADA');
  console.log('='.repeat(70));
  console.log();

  console.log('📡 Chamando Edge Function contahub-sync-automatico...');
  console.log();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/contahub-sync-automatico`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({
      bar_id: BAR_ID,
      data_date: DATA_EVENTO
    })
  });

  const resultado = await response.json();

  if (!response.ok) {
    console.log('❌ ERRO na sincronização:');
    console.log(JSON.stringify(resultado, null, 2));
    console.log();
  } else {
    console.log('✅ SINCRONIZAÇÃO EXECUTADA COM SUCESSO!');
    console.log();
    console.log('📊 Resumo:');
    console.log(`   - Tipos coletados: ${resultado.summary?.collected_count || 0}`);
    console.log(`   - Total registros: ${resultado.summary?.total_records_collected || 0}`);
    console.log(`   - Erros: ${resultado.summary?.error_count || 0}`);
    console.log();
  }

  // 6. Aguardar processamento (pg_cron roda a cada minuto)
  console.log('⏳ Aguardando processamento automático (30 segundos)...');
  console.log();
  await new Promise(resolve => setTimeout(resolve, 30000));

  // 7. Verificar dados processados novamente
  console.log('📊 VERIFICANDO DADOS PROCESSADOS (após sync)');
  console.log('-'.repeat(70));
  
  for (const { tipo, tabela } of tiposTabelas) {
    try {
      let query = supabase
        .from(tabela)
        .select('id', { count: 'exact', head: true })
        .eq('bar_id', BAR_ID);
      
      if (tabela === 'contahub_vendas') {
        query = query.eq('vd_dtcontabil', DATA_EVENTO);
      } else if (tabela === 'contahub_analitico') {
        query = query.gte('trn_dtgerencial', DATA_EVENTO).lt('trn_dtgerencial', '2026-03-02');
      } else if (tabela === 'contahub_periodo') {
        query = query.eq('prd_dtgerencial', DATA_EVENTO);
      } else if (tabela === 'contahub_tempo') {
        query = query.gte('trn_dtgerencial', DATA_EVENTO).lt('trn_dtgerencial', '2026-03-02');
      } else if (tabela === 'contahub_pagamentos') {
        query = query.eq('vd_dtcontabil', DATA_EVENTO);
      } else if (tabela === 'contahub_fatporhora') {
        query = query.gte('trn_dtgerencial', DATA_EVENTO).lt('trn_dtgerencial', '2026-03-02');
      }
      
      const { count } = await query;
      console.log(`   ${count > 0 ? '✅' : '⚠️ '} ${tipo}: ${count || 0} registros`);
    } catch (err) {
      console.log(`   ❌ ${tipo}: Erro ao verificar`);
    }
  }
  console.log();

  // 8. Recalcular evento
  console.log('🔧 RECALCULANDO EVENTO 858...');
  console.log();

  const { error: calcError } = await supabase.rpc('calculate_evento_metrics', {
    evento_id: 858
  });

  if (calcError) {
    console.log(`   ❌ Erro no recálculo: ${calcError.message}`);
  } else {
    console.log('   ✅ Recálculo executado com sucesso!');
  }
  console.log();

  // 9. Verificar resultado final
  console.log('📊 RESULTADO FINAL');
  console.log('-'.repeat(70));
  
  const { data: eventoFinal } = await supabase
    .from('eventos_base')
    .select('id, nome, data_evento, real_r, m1_r, cl_real, te_real, tb_real, t_medio, c_art, calculado_em')
    .eq('id', 858)
    .single();

  if (eventoFinal) {
    console.log(`   Evento: ${eventoFinal.nome}`);
    console.log(`   Data: ${eventoFinal.data_evento}`);
    console.log(`   Real R$: R$ ${(eventoFinal.real_r || 0).toFixed(2)}`);
    console.log(`   M-1 R$: R$ ${(eventoFinal.m1_r || 0).toFixed(2)}`);
    console.log(`   Clientes: ${eventoFinal.cl_real || 0}`);
    console.log(`   TE: R$ ${(eventoFinal.te_real || 0).toFixed(2)}`);
    console.log(`   TB: R$ ${(eventoFinal.tb_real || 0).toFixed(2)}`);
    console.log(`   T Médio: R$ ${(eventoFinal.t_medio || 0).toFixed(2)}`);
    console.log(`   C. Artístico: R$ ${(eventoFinal.c_art || 0).toFixed(2)}`);
    console.log(`   Calculado em: ${eventoFinal.calculado_em}`);
    console.log();
    
    if (eventoFinal.real_r > 0) {
      console.log('✅ SUCESSO! O planejamento comercial agora tem dados!');
    } else {
      console.log('⚠️  ATENÇÃO: Real R$ ainda está zerado');
      console.log();
      console.log('   Possíveis causas:');
      console.log('   1. Dados ainda estão sendo processados (aguardar mais tempo)');
      console.log('   2. Não há vendas no ContaHub para 01/03/2026');
      console.log('   3. Erro no processamento dos dados brutos');
    }
  }
  console.log();
  console.log('='.repeat(70));
}

forcarSincronizacao()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
