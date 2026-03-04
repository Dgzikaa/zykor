/**
 * Script para processar os dados brutos coletados de 01/03/2026
 * Chama a API /api/contahub/processar-raw
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

async function processarDadosBrutos() {
  console.log('='.repeat(70));
  console.log('🚀 PROCESSANDO DADOS BRUTOS - 01/03/2026 (Deboche)');
  console.log('='.repeat(70));
  console.log();

  // 1. Buscar dados brutos pendentes
  console.log('📦 Buscando dados brutos pendentes...');
  
  const { data: rawData, error: rawError } = await supabase
    .from('contahub_raw_data')
    .select('id, data_type, data_date, processed')
    .eq('bar_id', BAR_ID)
    .eq('data_date', DATA_EVENTO)
    .eq('processed', false)
    .order('data_type', { ascending: true });

  if (rawError) {
    console.error('❌ Erro:', rawError.message);
    process.exit(1);
  }

  if (!rawData || rawData.length === 0) {
    console.log('✅ Nenhum dado pendente - todos já foram processados!');
    console.log();
    
    // Verificar se há dados processados
    const { data: processed } = await supabase
      .from('contahub_raw_data')
      .select('id, data_type, processed')
      .eq('bar_id', BAR_ID)
      .eq('data_date', DATA_EVENTO);
    
    if (processed && processed.length > 0) {
      console.log('📊 Dados já processados:');
      processed.forEach(d => {
        console.log(`   ${d.processed ? '✅' : '⚠️ '} ${d.data_type}`);
      });
      console.log();
      
      // Pular para recálculo
      console.log('💡 Pulando para recálculo do evento...');
      await recalcularEvento();
      return;
    } else {
      console.log('❌ Nenhum dado bruto encontrado para 01/03/2026');
      console.log('   Execute primeiro: node forcar-sync-ontem.js');
      process.exit(1);
    }
  }

  console.log(`✅ ${rawData.length} tipos de dados pendentes:\n`);
  rawData.forEach(d => {
    console.log(`   - ${d.data_type} (ID: ${d.id})`);
  });
  console.log();

  // 2. Processar cada tipo via Edge Function contahub_processor
  console.log('='.repeat(70));
  console.log('🔧 PROCESSANDO DADOS BRUTOS');
  console.log('='.repeat(70));
  console.log();

  const resultados = [];

  for (const dado of rawData) {
    console.log(`📊 Processando ${dado.data_type} (ID: ${dado.id})...`);
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/contahub_processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          raw_data_id: dado.id
        })
      });

      const resultado = await response.json();

      if (!response.ok) {
        console.log(`   ❌ Erro: ${resultado.error || response.statusText}`);
        resultados.push({ tipo: dado.data_type, sucesso: false, erro: resultado.error });
      } else {
        console.log(`   ✅ Sucesso: ${resultado.inserted_records || 0} registros inseridos`);
        resultados.push({ tipo: dado.data_type, sucesso: true, registros: resultado.inserted_records });
      }
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
      resultados.push({ tipo: dado.data_type, sucesso: false, erro: err.message });
    }
    
    // Pequeno delay entre processamentos
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log();
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

  if (sucessos > 0) {
    console.log('✅ Dados processados com sucesso!');
    console.log();
    await recalcularEvento();
  } else {
    console.log('❌ Nenhum dado foi processado com sucesso.');
    console.log('   Verifique os erros acima.');
  }
}

async function recalcularEvento() {
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

  // Buscar resultado
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
  console.log('📊 PLANEJAMENTO COMERCIAL ATUALIZADO');
  console.log('='.repeat(70));
  console.log();
  console.log(`   📅 Evento: ${evento.nome} - ${evento.data_evento}`);
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
    console.log('✅✅✅ SUCESSO! O planejamento comercial está atualizado!');
    console.log();
    console.log('🌐 Acesse: https://zykor.com.br/estrategico/planejamento-comercial');
  } else {
    console.log('⚠️  ATENÇÃO: Real R$ ainda está zerado.');
    console.log();
    console.log('   Isso significa que não há vendas processadas para 01/03/2026.');
    console.log('   Verifique manualmente no ContaHub se há vendas para esse dia.');
  }
  console.log();
  console.log('='.repeat(70));
}

processarDadosBrutos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
