/**
 * Script para verificar dados brutos e forçar processamento
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ID = 4;
const DATA_EVENTO = '2026-03-01';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificarEProcessar() {
  console.log('='.repeat(70));
  console.log('🔍 VERIFICANDO DADOS BRUTOS E FORÇANDO PROCESSAMENTO');
  console.log('='.repeat(70));
  console.log();

  // 1. Verificar dados brutos
  console.log('📦 DADOS BRUTOS COLETADOS:');
  console.log('-'.repeat(70));
  
  const { data: rawData, error: rawError } = await supabase
    .from('contahub_raw_data')
    .select('id, data_type, data_date, processed, record_count, created_at')
    .eq('bar_id', BAR_ID)
    .eq('data_date', DATA_EVENTO)
    .order('data_type', { ascending: true });

  if (rawError) {
    console.log(`❌ Erro: ${rawError.message}`);
    process.exit(1);
  }

  if (!rawData || rawData.length === 0) {
    console.log('❌ Nenhum dado bruto encontrado!');
    console.log('   Execute primeiro: node forcar-sync-ontem.js');
    process.exit(1);
  }

  console.log(`✅ ${rawData.length} tipos de dados encontrados:\n`);
  rawData.forEach(d => {
    const status = d.processed ? '✅ Processado' : '⚠️  PENDENTE';
    console.log(`   ${status} - ${d.data_type}: ${d.record_count || 0} registros (ID: ${d.id})`);
  });
  console.log();

  // 2. Verificar se há dados pendentes
  const dadosPendentes = rawData.filter(d => !d.processed);
  
  if (dadosPendentes.length === 0) {
    console.log('✅ Todos os dados já foram processados!');
    console.log();
  } else {
    console.log(`⚠️  ${dadosPendentes.length} tipos de dados PENDENTES de processamento:`);
    dadosPendentes.forEach(d => {
      console.log(`   - ${d.data_type} (ID: ${d.id})`);
    });
    console.log();
  }

  // 3. Forçar processamento via Edge Function
  console.log('='.repeat(70));
  console.log('🚀 FORÇANDO PROCESSAMENTO VIA EDGE FUNCTION');
  console.log('='.repeat(70));
  console.log();

  // Verificar se existe a função contahub-processor
  console.log('📡 Chamando contahub-sync com action=process...');
  console.log();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/contahub-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({
      action: 'process',
      bar_id: BAR_ID,
      data_date: DATA_EVENTO
    })
  });

  const resultado = await response.json();

  if (!response.ok) {
    console.log('❌ ERRO no processamento:');
    console.log(JSON.stringify(resultado, null, 2));
    console.log();
  } else {
    console.log('✅ PROCESSAMENTO EXECUTADO!');
    console.log();
    if (resultado.result) {
      console.log('📊 Resultado:');
      console.log(JSON.stringify(resultado.result, null, 2));
    }
    console.log();
  }

  // 4. Verificar dados processados
  console.log('📊 VERIFICANDO DADOS PROCESSADOS:');
  console.log('-'.repeat(70));
  
  const { data: vendas, error: vendasError } = await supabase
    .from('contahub_vendas')
    .select('id, vr_produtos, vr_couvert, vr_pagamentos')
    .eq('bar_id', BAR_ID)
    .eq('vd_dtcontabil', DATA_EVENTO)
    .limit(5);

  if (vendasError) {
    console.log(`   ❌ Erro ao buscar vendas: ${vendasError.message}`);
  } else if (!vendas || vendas.length === 0) {
    console.log('   ⚠️  Nenhuma venda processada ainda');
  } else {
    const total = vendas.reduce((s, v) => s + (v.vr_pagamentos || 0), 0);
    console.log(`   ✅ ${vendas.length} vendas processadas`);
    console.log(`   💰 Total (primeiras 5): R$ ${total.toFixed(2)}`);
  }
  console.log();

  // 5. Recalcular evento novamente
  console.log('🔧 RECALCULANDO EVENTO 858 (após processamento)...');
  console.log();

  const { error: calcError2 } = await supabase.rpc('calculate_evento_metrics', {
    evento_id: 858
  });

  if (calcError2) {
    console.log(`   ❌ Erro: ${calcError2.message}`);
  } else {
    console.log('   ✅ Recálculo executado!');
  }
  console.log();

  // 6. Resultado final
  const { data: eventoFinal } = await supabase
    .from('eventos_base')
    .select('id, nome, real_r, m1_r, cl_real, calculado_em')
    .eq('id', 858)
    .single();

  console.log('='.repeat(70));
  console.log('📊 RESULTADO FINAL');
  console.log('='.repeat(70));
  console.log();
  console.log(`   Evento: ${eventoFinal.nome}`);
  console.log(`   Real R$: R$ ${(eventoFinal.real_r || 0).toFixed(2)}`);
  console.log(`   M-1 R$: R$ ${(eventoFinal.m1_r || 0).toFixed(2)}`);
  console.log(`   Clientes: ${eventoFinal.cl_real || 0}`);
  console.log(`   Calculado em: ${eventoFinal.calculado_em}`);
  console.log();
  
  if (eventoFinal.real_r > 0) {
    console.log('✅✅✅ SUCESSO! Planejamento comercial atualizado!');
    console.log('   Acesse: https://zykor.com.br/estrategico/planejamento-comercial');
  } else {
    console.log('⚠️  Real R$ ainda está zerado.');
    console.log('   Verifique se há vendas no ContaHub para 01/03/2026.');
  }
  console.log();
  console.log('='.repeat(70));
}

verificarEProcessar()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
