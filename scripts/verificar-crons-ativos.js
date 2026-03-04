/**
 * Verificar crons ativos no pg_cron
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificarCrons() {
  console.log('🔍 Verificando crons ativos no pg_cron\n');
  console.log('='.repeat(70));

  // Query SQL para buscar jobs do cron
  const query = `
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
    ORDER BY jobid;
  `;

  try {
    // Tentar via REST API direta
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const jobs = await response.json();
    
    if (!jobs || jobs.length === 0) {
      console.log('⚠️  Nenhum job encontrado no pg_cron\n');
      return;
    }

    console.log(`\n✅ ${jobs.length} job(s) encontrado(s):\n`);
    
    jobs.forEach(job => {
      console.log('─'.repeat(70));
      console.log(`📋 Job #${job.jobid}: ${job.jobname || 'Sem nome'}`);
      console.log(`   Schedule: ${job.schedule}`);
      console.log(`   Ativo: ${job.active ? '✅ SIM' : '❌ NÃO'}`);
      console.log(`   Database: ${job.database}`);
      console.log(`   Comando:`);
      
      // Mostrar comando formatado
      const cmd = job.command.substring(0, 300);
      console.log(`   ${cmd}${job.command.length > 300 ? '...' : ''}`);
      console.log();
    });

    // Filtrar jobs relacionados ao ContaHub
    const jobsContahub = jobs.filter(j => 
      j.command?.toLowerCase().includes('contahub') || 
      j.jobname?.toLowerCase().includes('contahub')
    );

    console.log('='.repeat(70));
    console.log('📊 ANÁLISE - CONTAHUB');
    console.log('='.repeat(70));
    console.log();

    if (jobsContahub.length === 0) {
      console.log('❌ Nenhum job de ContaHub encontrado!');
      console.log('   Isso explica por que não está rodando automaticamente.\n');
    } else {
      console.log(`✅ ${jobsContahub.length} job(s) de ContaHub encontrado(s):\n`);
      jobsContahub.forEach(job => {
        console.log(`   #${job.jobid}: ${job.jobname}`);
        console.log(`   Schedule: ${job.schedule}`);
        console.log(`   Ativo: ${job.active ? 'SIM' : 'NÃO'}`);
        console.log();
      });
    }

  } catch (error) {
    console.log('❌ Erro ao buscar jobs:', error.message);
    console.log('\n💡 Tentando método alternativo via query direta...\n');

    // Método alternativo: query via from
    try {
      const { data, error: err } = await supabase
        .from('cron.job')
        .select('*');

      if (err) {
        console.log('❌ Também falhou:', err.message);
        console.log('\n📋 Execute manualmente no Supabase SQL Editor:');
        console.log(query);
      } else {
        console.log('✅ Conseguiu via método alternativo!');
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (err2) {
      console.log('❌ Todos os métodos falharam');
      console.log('\n📋 Execute manualmente no Supabase SQL Editor:');
      console.log(query);
    }
  }
}

verificarCrons()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
