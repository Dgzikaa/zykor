/**
 * Script para resumir a situação do evento de 01/03/2026
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

async function resumirSituacao() {
  console.log('='.repeat(70));
  console.log('📋 RESUMO DA SITUAÇÃO - Planejamento Comercial Deboche');
  console.log('='.repeat(70));
  console.log();
  
  const hoje = new Date();
  const dataEvento = new Date('2026-03-01T00:00:00');
  
  console.log(`📅 Hoje: ${hoje.toISOString().split('T')[0]} (${hoje.toLocaleDateString('pt-BR', { weekday: 'long' })})`);
  console.log(`📅 Data do evento: ${DATA_EVENTO} (${dataEvento.toLocaleDateString('pt-BR', { weekday: 'long' })})`);
  console.log();
  
  const eventoJaAconteceu = dataEvento < hoje;
  
  if (eventoJaAconteceu) {
    console.log('✅ O evento JÁ ACONTECEU');
  } else {
    console.log('⚠️  O evento AINDA NÃO ACONTECEU');
  }
  console.log();
  
  // Buscar evento
  const { data: evento } = await supabase
    .from('eventos_base')
    .select('id, nome, data_evento, dia_semana, real_r, m1_r, precisa_recalculo, calculado_em')
    .eq('id', EVENTO_ID)
    .single();
  
  if (!evento) {
    console.log('❌ Evento não encontrado no banco');
    process.exit(1);
  }
  
  console.log('📊 DADOS DO EVENTO:');
  console.log(`   ID: ${evento.id}`);
  console.log(`   Nome: ${evento.nome}`);
  console.log(`   Data: ${evento.data_evento}`);
  console.log(`   Dia da semana cadastrado: ${evento.dia_semana}`);
  console.log(`   Real R$: R$ ${(evento.real_r || 0).toFixed(2)}`);
  console.log(`   M-1 R$: R$ ${(evento.m1_r || 0).toFixed(2)}`);
  console.log(`   Precisa recálculo: ${evento.precisa_recalculo ? 'SIM' : 'NÃO'}`);
  console.log(`   Última atualização: ${evento.calculado_em || 'Nunca'}`);
  console.log();
  
  console.log('='.repeat(70));
  console.log('🔍 DIAGNÓSTICO FINAL');
  console.log('='.repeat(70));
  console.log();
  
  if (!eventoJaAconteceu) {
    console.log('❌ PROBLEMA: O evento ainda NÃO aconteceu!');
    console.log();
    console.log('   O planejamento comercial está ZERADO porque:');
    console.log('   - Hoje é ' + hoje.toISOString().split('T')[0]);
    console.log('   - O evento é em ' + DATA_EVENTO);
    console.log('   - Não há dados de faturamento para processar');
    console.log();
    console.log('💡 AÇÃO: Aguardar o evento acontecer e a sincronização automática rodar.');
    console.log();
  } else {
    console.log('✅ O evento JÁ aconteceu!');
    console.log();
    console.log('   Mas o planejamento está zerado porque:');
    console.log('   - Os dados do ContaHub não foram sincronizados');
    console.log('   - OU não houve vendas nesse dia');
    console.log();
    console.log('💡 AÇÃO: Sincronizar dados do ContaHub manualmente.');
    console.log();
  }
  
  console.log('='.repeat(70));
  console.log('🚀 PRÓXIMOS PASSOS');
  console.log('='.repeat(70));
  console.log();
  
  if (eventoJaAconteceu) {
    console.log('1. Verificar se há dados no ContaHub para 01/03/2026');
    console.log('2. Sincronizar dados do ContaHub (se necessário)');
    console.log('3. Executar recálculo manual do evento');
    console.log('4. Verificar planejamento comercial novamente');
  } else {
    console.log('1. Aguardar o evento acontecer (01/03/2026)');
    console.log('2. Aguardar sincronização automática do ContaHub');
    console.log('3. Verificar planejamento comercial após o evento');
  }
  console.log();
  
  // Forçar recálculo de qualquer forma
  console.log('🔧 Executando recálculo manual agora (mesmo sem dados)...');
  console.log();
  
  const { error: calcError } = await supabase.rpc('calculate_evento_metrics', {
    evento_id: EVENTO_ID,
  });
  
  if (calcError) {
    console.log(`   ❌ Erro: ${calcError.message}`);
  } else {
    console.log('   ✅ Recálculo executado (pode estar zerado se não há dados)');
  }
  console.log();
  
  // Buscar dados atualizados
  const { data: eventoAtualizado } = await supabase
    .from('eventos_base')
    .select('real_r, precisa_recalculo, calculado_em')
    .eq('id', EVENTO_ID)
    .single();
  
  if (eventoAtualizado) {
    console.log('📊 Após recálculo:');
    console.log(`   Real R$: R$ ${(eventoAtualizado.real_r || 0).toFixed(2)}`);
    console.log(`   Precisa recálculo: ${eventoAtualizado.precisa_recalculo ? 'SIM' : 'NÃO'}`);
    console.log(`   Calculado em: ${eventoAtualizado.calculado_em}`);
  }
  console.log();
  console.log('='.repeat(70));
}

resumirSituacao()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
