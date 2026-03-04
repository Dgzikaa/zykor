/**
 * Script para recalcular eventos do Deboche Bar em lotes
 * Usa a função calculate_evento_metrics do PostgreSQL
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ID = 4; // Deboche Bar
const BATCH_SIZE = 50; // Processar 50 eventos por vez

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function recalcularEventosEmLotes() {
  console.log('🚀 Iniciando recálculo de eventos do Deboche Bar...\n');

  let totalProcessados = 0;
  let totalSucesso = 0;
  let totalErros = 0;

  while (true) {
    // Buscar próximo lote de eventos pendentes
    const { data: eventos, error: fetchError } = await supabase
      .from('eventos_base')
      .select('id, nome, data_evento')
      .eq('bar_id', BAR_ID)
      .eq('precisa_recalculo', true)
      .eq('ativo', true)
      .order('data_evento', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('❌ Erro ao buscar eventos:', fetchError.message);
      break;
    }

    if (!eventos || eventos.length === 0) {
      console.log('\n✅ Todos os eventos foram processados!');
      break;
    }

    console.log(`\n📦 Processando lote de ${eventos.length} eventos...`);

    // Processar cada evento do lote
    for (const evento of eventos) {
      try {
        const { error: calcError } = await supabase.rpc('calculate_evento_metrics', {
          evento_id: evento.id,
        });

        if (calcError) {
          console.error(`  ❌ Evento ${evento.id} (${evento.nome}): ${calcError.message}`);
          totalErros++;
        } else {
          console.log(`  ✅ Evento ${evento.id} (${evento.nome}) - ${evento.data_evento}`);
          totalSucesso++;
        }

        totalProcessados++;
      } catch (error) {
        console.error(`  ❌ Erro ao processar evento ${evento.id}:`, error.message);
        totalErros++;
        totalProcessados++;
      }

      // Pequeno delay para não sobrecarregar o banco
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Progresso: ${totalProcessados} processados (${totalSucesso} sucesso, ${totalErros} erros)`);

    // Delay entre lotes
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`Total processados: ${totalProcessados}`);
  console.log(`✅ Sucesso: ${totalSucesso}`);
  console.log(`❌ Erros: ${totalErros}`);
  console.log('='.repeat(60));
}

// Executar
recalcularEventosEmLotes()
  .then(() => {
    console.log('\n✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
