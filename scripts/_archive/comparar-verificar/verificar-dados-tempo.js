/**
 * Script para verificar se existem dados de tempo para o Deboche
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

async function verificarDadosTempo(barId, dataInicio, dataFim) {
  console.log(`\n🔍 Verificando dados de tempo para bar_id ${barId} entre ${dataInicio} e ${dataFim}...`);
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_tempo?bar_id=eq.${barId}&data=gte.${dataInicio}&data=lte.${dataFim}&select=data,categoria,tempo_final&order=data.desc&limit=100`,
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

    if (response.ok) {
      console.log(`\n📊 Encontrados ${data.length} registros de tempo:`);
      
      if (data.length > 0) {
        const porCategoria = data.reduce((acc, item) => {
          const cat = item.categoria || 'sem_categoria';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
        }, {});
        
        console.log('\n📈 Por Categoria:');
        Object.entries(porCategoria).forEach(([cat, itens]) => {
          const tempos = itens.map(i => parseFloat(i.tempo_final) || 0).filter(t => t > 0);
          const media = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
          console.log(`   ${cat}: ${itens.length} itens (média: ${media.toFixed(1)} min)`);
        });
        
        console.log('\n📅 Últimos 10 registros:');
        data.slice(0, 10).forEach(item => {
          console.log(`   ${item.data} | ${item.categoria} | ${item.tempo_final} min`);
        });
      } else {
        console.log('   ⚠️  Nenhum registro encontrado para este período.');
      }
      
      return data;
    } else {
      console.error('❌ Erro ao buscar dados:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao verificar dados:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Verificação de Dados de Tempo - Deboche (bar_id 4)');
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\n❌ Variáveis de ambiente não configuradas!');
    process.exit(1);
  }
  
  const barId = 4;
  
  // Semana 15/2026: 07/04 a 13/04
  const dataInicio = '2026-04-07';
  const dataFim = '2026-04-13';
  
  console.log(`\n📅 Período da Semana 15/2026: ${dataInicio} a ${dataFim}`);
  
  const result = await verificarDadosTempo(barId, dataInicio, dataFim);
  
  if (result !== null) {
    console.log('\n✅ Verificação concluída!');
    
    if (result.length === 0) {
      console.log('\n💡 Dica: Os dados de tempo podem estar em outra tabela ou não foram sincronizados ainda.');
      console.log('   Verifique as tabelas: tempos_producao, contahub_periodo, ou outras fontes de dados.');
    }
  } else {
    console.log('\n❌ Verificação falhou.');
    process.exit(1);
  }
}

main();
