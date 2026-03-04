/**
 * Verificar configuração do cron para sincronização ContaHub
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificarCron() {
  console.log('🔍 Verificando configuração do pg_cron\n');

  // Verificar jobs do cron
  const { data: jobs, error } = await supabase
    .rpc('execute_sql', {
      query: `
        SELECT 
          jobid,
          schedule,
          command,
          nodename,
          nodeport,
          database,
          username,
          active,
          jobname
        FROM cron.job
        WHERE command LIKE '%contahub%'
        ORDER BY jobid;
      `
    });

  if (error) {
    console.log('❌ Erro ao buscar jobs:', error.message);
    console.log('\n💡 Tentando método alternativo...\n');
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('⚠️  Nenhum job de ContaHub encontrado no pg_cron!\n');
    console.log('Isso explica por que o Deboche não sincroniza automaticamente.\n');
    return;
  }

  console.log(`✅ ${jobs.length} job(s) encontrado(s):\n`);
  
  jobs.forEach(job => {
    console.log('='.repeat(60));
    console.log(`Job ID: ${job.jobid}`);
    console.log(`Nome: ${job.jobname || 'Sem nome'}`);
    console.log(`Schedule: ${job.schedule}`);
    console.log(`Ativo: ${job.active ? 'SIM' : 'NÃO'}`);
    console.log(`Comando (primeiros 200 chars):`);
    console.log(`  ${job.command.substring(0, 200)}...`);
    console.log();
  });

  console.log('='.repeat(60));
  console.log('📋 ANÁLISE');
  console.log('='.repeat(60));
  console.log();
  console.log('Verificar se há jobs para:');
  console.log('  - bar_id=3 (Ordinário) ✅');
  console.log('  - bar_id=4 (Deboche) ?');
  console.log();
}

verificarCron()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
