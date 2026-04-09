/**
 * Script para verificar dados de atrasos e tempos do Deboche (bar_id 4)
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

async function verificarDados(barId, ano, numeroSemana) {
  console.log(`\n🔍 Verificando dados de atrasos e tempos para bar_id ${barId}, semana ${numeroSemana}/${ano}...`);
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/desempenho_semanal?bar_id=eq.${barId}&ano=eq.${ano}&numero_semana=eq.${numeroSemana}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.ok && data && data.length > 0) {
      const semana = data[0];
      
      console.log('\n📊 Dados de Atrasos e Tempos:');
      console.log('═══════════════════════════════════════');
      
      console.log('\n🍹 BAR:');
      console.log(`   Atrasinhos: ${semana.atrasinhos_bar || 0} (${(semana.atrasinhos_bar_perc || 0).toFixed(2)}%)`);
      console.log(`   Atrasos: ${semana.atrasos_bar || 0} (${(semana.atrasos_bar_perc || 0).toFixed(2)}%)`);
      console.log(`   Tempo Saída: ${(semana.tempo_saida_bar || 0).toFixed(1)} min`);
      console.log(`   Qtde Itens: ${semana.qtde_itens_bar || 0}`);
      
      console.log('\n🍽️  COZINHA:');
      console.log(`   Atrasinhos: ${semana.atrasinhos_cozinha || 0} (${(semana.atrasinhos_cozinha_perc || 0).toFixed(2)}%)`);
      console.log(`   Atrasos: ${semana.atrasos_cozinha || 0} (${(semana.atrasos_cozinha_perc || 0).toFixed(2)}%)`);
      console.log(`   Tempo Saída: ${(semana.tempo_saida_cozinha || 0).toFixed(1)} min`);
      console.log(`   Qtde Itens: ${semana.qtde_itens_cozinha || 0}`);
      
      console.log('\n📦 STOCKOUT:');
      console.log(`   Bar: ${semana.stockout_bar || 0} produtos (${(semana.stockout_bar_perc || 0).toFixed(2)}%)`);
      console.log(`   Drinks: ${semana.stockout_drinks || 0} produtos (${(semana.stockout_drinks_perc || 0).toFixed(2)}%)`);
      console.log(`   Comidas: ${semana.stockout_comidas || 0} produtos (${(semana.stockout_comidas_perc || 0).toFixed(2)}%)`);
      
      console.log('\n🎯 MIX:');
      console.log(`   Bebidas: ${(semana.perc_bebidas * 100 || 0).toFixed(2)}%`);
      console.log(`   Drinks: ${(semana.perc_drinks * 100 || 0).toFixed(2)}%`);
      console.log(`   Comida: ${(semana.perc_comida * 100 || 0).toFixed(2)}%`);
      console.log(`   Happy Hour: ${(semana.perc_happy_hour * 100 || 0).toFixed(2)}%`);
      
      console.log('\n⏰ Última Atualização:');
      console.log(`   ${semana.atualizado_em || semana.updated_at || 'N/A'}`);
      
      return semana;
    } else {
      console.error('❌ Nenhum dado encontrado para esta semana.');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Verificação de Dados - Deboche (bar_id 4)');
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\n❌ Variáveis de ambiente não configuradas!');
    process.exit(1);
  }
  
  const barId = 4;
  const ano = 2026;
  const numeroSemana = 14;
  
  const result = await verificarDados(barId, ano, numeroSemana);
  
  if (result) {
    console.log('\n✅ Verificação concluída!');
  } else {
    console.log('\n❌ Verificação falhou.');
    process.exit(1);
  }
}

main();
