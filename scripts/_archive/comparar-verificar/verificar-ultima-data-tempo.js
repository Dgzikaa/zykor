/**
 * Script para verificar a última data com dados de tempo para o Deboche
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

async function verificarUltimaData(barId) {
  console.log(`\n🔍 Verificando última data com dados de tempo para bar_id ${barId}...`);
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_tempo?bar_id=eq.${barId}&select=data,categoria,tempo_final&order=data.desc&limit=50`,
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
      console.log(`\n📊 Total de registros recentes: ${data.length}`);
      
      if (data.length > 0) {
        const ultimaData = data[0].data;
        console.log(`\n📅 Última data com dados: ${ultimaData}`);
        
        // Calcular semana ISO da última data
        const d = new Date(ultimaData + 'T00:00:00');
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        const year = d.getUTCFullYear();
        
        console.log(`   Semana ISO: ${weekNum}/${year}`);
        
        const porCategoria = data.reduce((acc, item) => {
          const cat = item.categoria || 'sem_categoria';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
        }, {});
        
        console.log('\n📈 Distribuição por Categoria (últimos 50 registros):');
        Object.entries(porCategoria).forEach(([cat, itens]) => {
          const tempos = itens.map(i => parseFloat(i.tempo_final) || 0).filter(t => t > 0);
          const media = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
          console.log(`   ${cat}: ${itens.length} itens (média: ${media.toFixed(1)} min)`);
        });
        
        console.log('\n📅 Últimos 10 registros:');
        data.slice(0, 10).forEach(item => {
          console.log(`   ${item.data} | ${item.categoria} | ${item.tempo_final} min`);
        });
        
        // Verificar se há dados na semana 15
        const semana15Inicio = '2026-04-07';
        const semana15Fim = '2026-04-13';
        const dadosSemana15 = data.filter(item => item.data >= semana15Inicio && item.data <= semana15Fim);
        
        if (dadosSemana15.length > 0) {
          console.log(`\n✅ Há ${dadosSemana15.length} registros na semana 15/2026!`);
        } else {
          console.log(`\n⚠️  Não há dados na semana 15/2026 (${semana15Inicio} a ${semana15Fim})`);
          console.log(`   A última data disponível é ${ultimaData}`);
        }
      } else {
        console.log('   ⚠️  Nenhum registro encontrado para este bar.');
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
  console.log('🚀 Verificação de Última Data com Dados de Tempo - Deboche (bar_id 4)');
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\n❌ Variáveis de ambiente não configuradas!');
    process.exit(1);
  }
  
  const barId = 4;
  
  const result = await verificarUltimaData(barId);
  
  if (result !== null) {
    console.log('\n✅ Verificação concluída!');
    
    if (result.length === 0) {
      console.log('\n💡 Possíveis causas:');
      console.log('   1. Os dados ainda não foram sincronizados do ContaHub');
      console.log('   2. O bar_id 4 pode não ter dados nesta tabela');
      console.log('   3. Os dados podem estar em outra tabela (ex: tempos_producao)');
    }
  } else {
    console.log('\n❌ Verificação falhou.');
    process.exit(1);
  }
}

main();
