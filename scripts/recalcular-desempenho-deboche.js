/**
 * Script para recalcular dados de desempenho do Deboche (bar_id 4)
 * Chama a Edge Function recalcular-desempenho-v2 diretamente
 */

const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Arquivo .env.local não encontrado em:', envPath);
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  
  lines.forEach(line => {
    if (line.trim() && !line.trim().startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (value) {
          process.env[key] = value;
        }
      }
    }
  });
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function recalcularSemana(barId, ano, numeroSemana) {
  console.log(`\n🔄 Recalculando semana ${numeroSemana}/${ano} para bar_id ${barId}...`);
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/recalcular-desempenho-v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bar_id: barId,
          ano: ano,
          numero_semana: numeroSemana,
          mode: 'write'
        }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Sucesso!');
      console.log(`   Mode: ${result.mode}`);
      console.log(`   Write Enabled: ${result.write_enabled}`);
      console.log(`   Writes Executed: ${result.writes_executed}`);
      
      if (result.results && result.results.length > 0) {
        const r = result.results[0];
        console.log(`\n📊 Resultado:`);
        console.log(`   Campos calculados: ${r.total_fields_calculated}`);
        console.log(`   Campos divergentes: ${r.total_fields_divergent}`);
        console.log(`   Write executado: ${r.write_executed ? 'SIM' : 'NÃO'}`);
        console.log(`   Duração: ${r.duration_ms}ms`);
        
        if (r.calculators_with_error && r.calculators_with_error.length > 0) {
          console.log(`\n⚠️  Calculators com erro: ${r.calculators_with_error.join(', ')}`);
        }
        
        if (r.diff_summary && r.diff_summary.significant_diffs && r.diff_summary.significant_diffs.length > 0) {
          console.log(`\n📈 Diferenças significativas encontradas:`);
          r.diff_summary.significant_diffs.slice(0, 10).forEach(diff => {
            console.log(`   - ${diff.field}: ${diff.banco} → ${diff.calculado} (${diff.percentual}%)`);
          });
        }
      }
      
      return result;
    } else {
      console.error('❌ Erro na requisição:', result);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao recalcular:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Iniciando recálculo de desempenho para Deboche (bar_id 4)');
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Service Role Key: ${SERVICE_ROLE_KEY ? '✓ Configurada' : '✗ Não configurada'}`);
  
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\n❌ Variáveis de ambiente não configuradas!');
    console.error('   Certifique-se de ter NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
    process.exit(1);
  }
  
  const barId = 4;
  const ano = 2026;
  const numeroSemana = 14;
  
  const result = await recalcularSemana(barId, ano, numeroSemana);
  
  if (result) {
    console.log('\n✅ Recálculo concluído com sucesso!');
  } else {
    console.log('\n❌ Recálculo falhou.');
    process.exit(1);
  }
}

main();
