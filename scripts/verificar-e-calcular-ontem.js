/**
 * Script para verificar e calcular manualmente o evento de ontem (01/03/2026)
 * para o bar 4 (Deboche)
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ID = 4; // Deboche Bar
const DATA_EVENTO = '2026-03-01'; // Ontem

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificarECalcular() {
  console.log('🔍 Verificando evento de 01/03/2026 para o Deboche Bar...\n');

  // 1. Buscar o evento
  const { data: evento, error: fetchError } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', BAR_ID)
    .eq('data_evento', DATA_EVENTO)
    .eq('ativo', true)
    .single();

  if (fetchError) {
    console.error('❌ Erro ao buscar evento:', fetchError.message);
    process.exit(1);
  }

  if (!evento) {
    console.log('⚠️  Nenhum evento encontrado para 01/03/2026 no Deboche Bar');
    process.exit(0);
  }

  console.log('✅ Evento encontrado:');
  console.log(`   ID: ${evento.id}`);
  console.log(`   Nome: ${evento.nome}`);
  console.log(`   Data: ${evento.data_evento}`);
  console.log(`   Dia da semana: ${evento.dia_semana}`);
  console.log(`   Precisa recálculo: ${evento.precisa_recalculo}`);
  console.log(`   Versão cálculo: ${evento.versao_calculo}`);
  console.log(`   Calculado em: ${evento.calculado_em || 'Nunca'}`);
  console.log(`   Real R$: ${evento.real_r || 0}`);
  console.log(`   M-1 R$: ${evento.m1_r || 0}`);
  console.log();

  // 2. Verificar logs de cron
  console.log('📋 Verificando logs de execução do cron...\n');
  
  const { data: logs, error: logsError } = await supabase
    .from('cron_logs')
    .select('*')
    .eq('job_name', 'recalcular_eventos_diarios')
    .gte('executado_em', '2026-03-01T00:00:00')
    .order('executado_em', { ascending: false })
    .limit(10);

  if (logsError) {
    console.log('⚠️  Não foi possível buscar logs de cron:', logsError.message);
  } else if (!logs || logs.length === 0) {
    console.log('⚠️  Nenhum log de execução do cron encontrado para 01/03/2026');
  } else {
    console.log(`📊 Últimas ${logs.length} execuções do cron:`);
    logs.forEach(log => {
      console.log(`   ${log.executado_em} - Status: ${log.status} - ${log.mensagem || 'Sem mensagem'}`);
    });
  }
  console.log();

  // 3. Executar cálculo manual
  console.log('🚀 Executando cálculo manual...\n');

  const { data: resultado, error: calcError } = await supabase.rpc('calculate_evento_metrics', {
    evento_id: evento.id,
  });

  if (calcError) {
    console.error('❌ Erro ao calcular métricas:', calcError.message);
    process.exit(1);
  }

  console.log('✅ Cálculo executado com sucesso!');
  console.log();

  // 4. Buscar evento atualizado
  const { data: eventoAtualizado, error: fetchError2 } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('id', evento.id)
    .single();

  if (fetchError2) {
    console.error('❌ Erro ao buscar evento atualizado:', fetchError2.message);
    process.exit(1);
  }

  console.log('📊 Dados atualizados:');
  console.log(`   Real R$: ${eventoAtualizado.real_r || 0}`);
  console.log(`   M-1 R$: ${eventoAtualizado.m1_r || 0}`);
  console.log(`   Clientes Real: ${eventoAtualizado.cl_real || 0}`);
  console.log(`   Clientes Plan: ${eventoAtualizado.cl_plan || 0}`);
  console.log(`   TE Real: ${eventoAtualizado.te_real || 0}`);
  console.log(`   TB Real: ${eventoAtualizado.tb_real || 0}`);
  console.log(`   T Médio: ${eventoAtualizado.t_medio || 0}`);
  console.log(`   C. Artístico: ${eventoAtualizado.c_art || 0}`);
  console.log(`   % Art/Fat: ${eventoAtualizado.percent_art_fat || 0}%`);
  console.log(`   Precisa recálculo: ${eventoAtualizado.precisa_recalculo}`);
  console.log(`   Versão cálculo: ${eventoAtualizado.versao_calculo}`);
  console.log(`   Calculado em: ${eventoAtualizado.calculado_em}`);
  console.log();

  console.log('✅ Processo concluído!');
}

// Executar
verificarECalcular()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
