/**
 * Script para processar dados brutos usando as funções SQL nativas
 * process_analitico_data, process_vendas_data, etc.
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ID = 4;
const DATA_EVENTO = '2026-03-01';
const EVENTO_ID = 858;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function processarViaSQLFunctions() {
  console.log('='.repeat(70));
  console.log('🚀 PROCESSANDO DADOS BRUTOS VIA SQL FUNCTIONS');
  console.log('='.repeat(70));
  console.log();

  // 1. Buscar dados brutos pendentes
  console.log('📦 Buscando dados brutos de 01/03/2026...');
  
  const { data: rawData, error: rawError } = await supabase
    .from('contahub_raw_data')
    .select('id, data_type, data_date, processed, raw_json')
    .eq('bar_id', BAR_ID)
    .eq('data_date', DATA_EVENTO)
    .order('data_type', { ascending: true });

  if (rawError) {
    console.error('❌ Erro:', rawError.message);
    process.exit(1);
  }

  if (!rawData || rawData.length === 0) {
    console.log('❌ Nenhum dado bruto encontrado!');
    process.exit(1);
  }

  console.log(`✅ ${rawData.length} tipos de dados encontrados\n`);

  // 2. Processar cada tipo
  const resultados = [];
  
  for (const dado of rawData) {
    console.log('='.repeat(70));
    console.log(`📊 Processando ${dado.data_type.toUpperCase()}`);
    console.log('='.repeat(70));
    
    const json = dado.raw_json;
    const dataArray = json?.list || json || [];
    const totalItens = Array.isArray(dataArray) ? dataArray.length : 0;
    
    console.log(`   ID: ${dado.id}`);
    console.log(`   Itens no JSON: ${totalItens}`);
    console.log(`   Processado: ${dado.processed ? 'SIM' : 'NÃO'}`);
    console.log();

    if (totalItens === 0) {
      console.log('   ⚠️  Array vazio - pulando');
      console.log();
      resultados.push({ tipo: dado.data_type, sucesso: false, erro: 'Array vazio', registros: 0 });
      continue;
    }

    // Mapear tipo de dado para nome da função SQL
    const funcaoMap = {
      'analitico': 'process_analitico_data',
      'fatporhora': 'process_fatporhora_data',
      'pagamentos': 'process_pagamentos_data',
      'periodo': 'process_periodo_data',
      'tempo': 'process_tempo_data'
    };

    const nomeFuncao = funcaoMap[dado.data_type];
    
    if (!nomeFuncao) {
      console.log(`   ⚠️  Função SQL não encontrada para tipo: ${dado.data_type}`);
      console.log();
      resultados.push({ tipo: dado.data_type, sucesso: false, erro: 'Função não encontrada', registros: 0 });
      continue;
    }

    console.log(`   🔧 Chamando função SQL: ${nomeFuncao}()`);
    console.log(`   📊 Processando ${totalItens} registros...`);
    console.log();

    try {
      const inicio = Date.now();
      
      const { data: resultado, error: procError } = await supabase.rpc(nomeFuncao, {
        p_bar_id: BAR_ID,
        p_data_array: dataArray,
        p_data_date: DATA_EVENTO
      });

      const tempoDecorrido = ((Date.now() - inicio) / 1000).toFixed(2);

      if (procError) {
        console.log(`   ❌ Erro: ${procError.message}`);
        console.log();
        resultados.push({ tipo: dado.data_type, sucesso: false, erro: procError.message, registros: 0 });
        continue;
      }

      const registrosInseridos = resultado || 0;
      console.log(`   ✅ Sucesso: ${registrosInseridos} registros inseridos`);
      console.log(`   ⏱️  Tempo: ${tempoDecorrido}s`);
      console.log();

      // Marcar como processado
      const { error: updateError } = await supabase
        .from('contahub_raw_data')
        .update({ processed: true })
        .eq('id', dado.id);

      if (updateError) {
        console.log(`   ⚠️  Erro ao marcar como processado: ${updateError.message}`);
      } else {
        console.log(`   ✅ Marcado como processado`);
      }
      console.log();

      resultados.push({ tipo: dado.data_type, sucesso: true, registros: registrosInseridos, tempo: tempoDecorrido });

    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
      console.log();
      resultados.push({ tipo: dado.data_type, sucesso: false, erro: err.message, registros: 0 });
    }
  }

  // 3. Resumo
  console.log('='.repeat(70));
  console.log('📊 RESUMO DO PROCESSAMENTO');
  console.log('='.repeat(70));
  console.log();

  const sucessos = resultados.filter(r => r.sucesso).length;
  const erros = resultados.filter(r => !r.sucesso).length;
  const totalRegistros = resultados.reduce((sum, r) => sum + (r.registros || 0), 0);

  console.log(`   ✅ Sucessos: ${sucessos}/${rawData.length}`);
  console.log(`   ❌ Erros: ${erros}/${rawData.length}`);
  console.log(`   📊 Total registros inseridos: ${totalRegistros}`);
  console.log();

  resultados.forEach(r => {
    const status = r.sucesso ? '✅' : '❌';
    console.log(`   ${status} ${r.tipo}: ${r.registros || 0} registros ${r.tempo ? `(${r.tempo}s)` : ''}`);
  });
  console.log();

  if (sucessos === 0) {
    console.log('❌ Nenhum dado foi processado com sucesso.');
    console.log('   Verifique os erros acima.');
    console.log();
    return;
  }

  // 4. Recalcular evento
  console.log('='.repeat(70));
  console.log('🔧 RECALCULANDO EVENTO 858');
  console.log('='.repeat(70));
  console.log();

  const { error: calcError } = await supabase.rpc('calculate_evento_metrics', {
    evento_id: EVENTO_ID
  });

  if (calcError) {
    console.log(`❌ Erro no recálculo: ${calcError.message}`);
    return;
  }

  console.log('✅ Recálculo executado com sucesso!');
  console.log();

  // 5. Resultado final
  const { data: evento } = await supabase
    .from('eventos_base')
    .select('id, nome, data_evento, real_r, m1_r, cl_real, te_real, tb_real, t_medio, c_art, percent_art_fat, calculado_em')
    .eq('id', EVENTO_ID)
    .single();

  if (!evento) {
    console.log('❌ Erro ao buscar evento atualizado');
    return;
  }

  console.log('='.repeat(70));
  console.log('🎉 PLANEJAMENTO COMERCIAL ATUALIZADO!');
  console.log('='.repeat(70));
  console.log();
  console.log(`   📅 ${evento.nome} - ${evento.data_evento}`);
  console.log();
  console.log('   💰 FATURAMENTO:');
  console.log(`      Real: R$ ${(evento.real_r || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`      M-1:  R$ ${(evento.m1_r || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  
  if (evento.real_r > 0 && evento.m1_r > 0) {
    const variacao = ((evento.real_r / evento.m1_r - 1) * 100);
    const status = variacao >= 0 ? '✅' : '❌';
    console.log(`      Variação: ${status} ${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)}%`);
  }
  console.log();
  
  console.log('   👥 PÚBLICO:');
  console.log(`      Clientes: ${evento.cl_real || 0}`);
  console.log();
  
  console.log('   💵 TICKETS:');
  console.log(`      TE: R$ ${(evento.te_real || 0).toFixed(2)}`);
  console.log(`      TB: R$ ${(evento.tb_real || 0).toFixed(2)}`);
  console.log(`      T Médio: R$ ${(evento.t_medio || 0).toFixed(2)}`);
  console.log();
  
  console.log('   🎭 CUSTOS:');
  console.log(`      C. Artístico: R$ ${(evento.c_art || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`      % Art/Fat: ${(evento.percent_art_fat || 0).toFixed(1)}%`);
  console.log();
  
  console.log(`   🕐 Calculado em: ${evento.calculado_em}`);
  console.log();
  console.log('='.repeat(70));
  
  if (evento.real_r > 0) {
    console.log('✅✅✅ SUCESSO TOTAL!');
    console.log();
    console.log('🌐 O planejamento comercial está atualizado!');
    console.log('   Acesse: https://zykor.com.br/estrategico/planejamento-comercial');
  } else {
    console.log('⚠️  ATENÇÃO: Real R$ ainda está zerado.');
    console.log();
    console.log('   Verifique se os dados foram inseridos nas tabelas:');
    console.log('   - contahub_vendas');
    console.log('   - contahub_periodo');
    console.log('   - contahub_pagamentos');
  }
  console.log();
  console.log('='.repeat(70));
}

processarViaSQLFunctions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
