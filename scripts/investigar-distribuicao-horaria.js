/**
 * Script para investigar o problema da distribuição horária
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  
  lines.forEach(line => {
    if (line.trim() && !line.trim().startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (value) process.env[key] = value;
      }
    }
  });
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function investigarDistribuicaoHoraria(barId, dataInicio, dataFim) {
  console.log(`\n🔍 Investigando distribuição horária para bar_id ${barId}...`);
  console.log(`   Período: ${dataInicio} a ${dataFim}\n`);
  
  try {
    // Buscar dados de faturamento_hora
    const respFatHora = await fetch(
      `${SUPABASE_URL}/rest/v1/faturamento_hora?bar_id=eq.${barId}&data_venda=gte.${dataInicio}&data_venda=lte.${dataFim}&select=data_venda,hora,valor&order=data_venda.asc,hora.asc`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const fatHora = await respFatHora.json();
    
    console.log(`📊 Total de registros em faturamento_hora: ${fatHora.length}`);
    
    if (fatHora.length > 0) {
      let fatAte19h = 0;
      let fatApos22h = 0;
      let fatTotal = 0;
      
      const porHora = {};
      
      fatHora.forEach(row => {
        const hora = parseInt(row.hora) || 0;
        const valor = parseFloat(row.valor) || 0;
        
        if (!porHora[hora]) porHora[hora] = 0;
        porHora[hora] += valor;
        
        fatTotal += valor;
        if (hora < 19) fatAte19h += valor;
        if (hora >= 22 || hora <= 5) fatApos22h += valor;
      });
      
      console.log(`\n💰 Faturamento por hora:`);
      Object.entries(porHora).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([hora, valor]) => {
        const perc = fatTotal > 0 ? (valor / fatTotal) * 100 : 0;
        console.log(`   ${hora.padStart(2, '0')}h: R$ ${valor.toFixed(2)} (${perc.toFixed(1)}%)`);
      });
      
      console.log(`\n📈 Resumo:`);
      console.log(`   Faturamento Total: R$ ${fatTotal.toFixed(2)}`);
      console.log(`   Até 19h: R$ ${fatAte19h.toFixed(2)} (${fatTotal > 0 ? ((fatAte19h / fatTotal) * 100).toFixed(2) : 0}%)`);
      console.log(`   Após 22h: R$ ${fatApos22h.toFixed(2)} (${fatTotal > 0 ? ((fatApos22h / fatTotal) * 100).toFixed(2) : 0}%)`);
      
      // Verificar se os valores estão em formato de percentual (> 100)
      const valoresGrandes = fatHora.filter(row => parseFloat(row.valor) > 100);
      if (valoresGrandes.length > 0) {
        console.log(`\n⚠️  Encontrados ${valoresGrandes.length} registros com valores > 100:`);
        valoresGrandes.slice(0, 5).forEach(row => {
          console.log(`   ${row.data_venda} ${row.hora}h: ${row.valor}`);
        });
      }
      
    } else {
      console.log(`   ⚠️  Nenhum registro encontrado!`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas!');
    process.exit(1);
  }
  
  console.log('🚀 Investigação de Distribuição Horária - Deboche (bar_id 4)');
  
  const barId = 4;
  const dataInicio = '2026-03-31';
  const dataFim = '2026-04-06';
  
  await investigarDistribuicaoHoraria(barId, dataInicio, dataFim);
  
  console.log('\n✅ Investigação concluída!');
}

main();
