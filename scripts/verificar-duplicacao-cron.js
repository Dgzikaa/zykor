/**
 * Verificar se criamos crons duplicados
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificar() {
  console.log('🔍 Verificando possível duplicação de crons\n');
  console.log('='.repeat(70));

  // Verificar se o cron que criamos realmente existe
  console.log('\n📋 Verificando job "contahub-daily-sync"...\n');
  
  // Tentar via SQL direto
  const query = `
    SELECT jobid, jobname, schedule, active, command
    FROM cron.job
    WHERE jobname LIKE '%contahub%'
    ORDER BY jobid;
  `;

  console.log('SQL a executar no Supabase SQL Editor:');
  console.log(query);
  console.log();
  console.log('='.repeat(70));
  console.log('📋 ANÁLISE DO PIPELINE EXISTENTE');
  console.log('='.repeat(70));
  console.log();
  console.log('Segundo o contexto, o pipeline é:');
  console.log();
  console.log('1. 07:00 UTC (04:00 BRT) - contahub-sync');
  console.log('   → Coleta dados brutos do ContaHub');
  console.log('   → Salva em contahub_raw_data');
  console.log();
  console.log('2. 07:15 UTC (04:15 BRT) - contahub-processor');
  console.log('   → Processa dados brutos');
  console.log('   → Insere em contahub_analitico, contahub_vendas, etc');
  console.log();
  console.log('3. 07:30 UTC (04:30 BRT) - update_eventos_base_from_contahub_batch');
  console.log('   → Atualiza eventos_base com dados do ContaHub');
  console.log('   → Calcula métricas dos eventos');
  console.log();
  console.log('='.repeat(70));
  console.log('🔍 O QUE FIZEMOS');
  console.log('='.repeat(70));
  console.log();
  console.log('Criamos/atualizamos:');
  console.log('1. ✅ sync_contahub_daily() - Função que chama /api/contahub/sync-diario');
  console.log('2. ✅ cron.schedule("contahub-daily-sync") - Job às 07:00 UTC');
  console.log();
  console.log('Isso pode ter SUBSTITUÍDO o cron existente.');
  console.log();
  console.log('='.repeat(70));
  console.log('⚠️  POSSÍVEL PROBLEMA');
  console.log('='.repeat(70));
  console.log();
  console.log('Se o pipeline original era:');
  console.log('   contahub-sync → contahub-processor → update_eventos');
  console.log();
  console.log('E agora temos:');
  console.log('   sync_contahub_daily() → /api/contahub/sync-diario');
  console.log();
  console.log('Precisamos verificar se:');
  console.log('1. A API /api/contahub/sync-diario faz TUDO (coleta + processamento)');
  console.log('2. OU se ainda precisamos dos outros jobs (processor, update_eventos)');
  console.log();
  console.log('='.repeat(70));
  console.log('💡 PRÓXIMO PASSO');
  console.log('='.repeat(70));
  console.log();
  console.log('Verificar no Supabase SQL Editor:');
  console.log();
  console.log('SELECT jobid, jobname, schedule, active');
  console.log('FROM cron.job');
  console.log('WHERE command LIKE \'%contahub%\'');
  console.log('   OR jobname LIKE \'%contahub%\';');
  console.log();
  console.log('E verificar se temos:');
  console.log('- 1 job (novo) → OK, substituiu o antigo');
  console.log('- 3 jobs (sync, processor, update) → OK, pipeline completo');
  console.log('- 0 jobs → PROBLEMA, cron não está configurado');
  console.log();
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
