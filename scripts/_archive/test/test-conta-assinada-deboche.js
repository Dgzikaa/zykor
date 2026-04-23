/**
 * Script para testar se a API retorna Conta Assinada do Deboche
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testContaAssinada() {
  console.log('🧪 Testando Conta Assinada do Deboche...\n');

  const barId = 4; // Deboche
  const dataInicio = '2026-04-06';
  const dataFim = '2026-04-12';

  try {
    // 1. Buscar dados brutos
    console.log('📊 Buscando dados de contahub_pagamentos...');
    const { data: pagamentos, error } = await supabase
      .from('contahub_pagamentos')
      .select('dt_gerencial, liquido, meio')
      .eq('bar_id', barId)
      .eq('meio', 'Conta Assinada')
      .gte('dt_gerencial', dataInicio)
      .lte('dt_gerencial', dataFim);

    if (error) {
      console.error('❌ Erro:', error);
      return;
    }

    console.log(`✅ Encontrados ${pagamentos?.length || 0} registros\n`);

    if (pagamentos && pagamentos.length > 0) {
      console.log('📋 Detalhes:');
      pagamentos.forEach(p => {
        console.log(`  ${p.dt_gerencial}: R$ ${parseFloat(p.liquido).toFixed(2)}`);
      });

      const total = pagamentos.reduce((sum, p) => sum + parseFloat(p.liquido || 0), 0);
      console.log(`\n💰 Total: R$ ${total.toFixed(2)}`);
    } else {
      console.log('⚠️  Nenhum registro encontrado');
    }

    // 2. Verificar se está na tabela desempenho_semanal
    console.log('\n🔍 Verificando desempenho_semanal...');
    const { data: semana, error: errorSemana } = await supabase
      .from('desempenho_semanal')
      .select('numero_semana, ano, conta_assinada_valor, conta_assinada_perc')
      .eq('bar_id', barId)
      .eq('numero_semana', 15)
      .eq('ano', 2026)
      .single();

    if (errorSemana) {
      console.error('❌ Erro:', errorSemana);
    } else if (semana) {
      console.log('✅ Dados na tabela desempenho_semanal:');
      console.log(`  Conta Assinada Valor: R$ ${semana.conta_assinada_valor || 0}`);
      console.log(`  Conta Assinada %: ${semana.conta_assinada_perc || 0}%`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testContaAssinada();
