/**
 * Script para verificar e corrigir os percentuais de MIX nos eventos_base
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

async function verificarECorrigirMix(barId, dataInicio, dataFim) {
  console.log(`\n🔍 Verificando MIX dos eventos entre ${dataInicio} e ${dataFim}...`);
  
  try {
    // Buscar eventos com problema
    const respEventos = await fetch(
      `${SUPABASE_URL}/rest/v1/eventos_base?bar_id=eq.${barId}&data_evento=gte.${dataInicio}&data_evento=lte.${dataFim}&select=id,data_evento,percent_b,percent_d,percent_c,percent_happy_hour`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const eventos = await respEventos.json();
    
    console.log(`\n📊 Encontrados ${eventos.length} eventos`);
    
    let eventosCorrigidos = 0;
    
    for (const evento of eventos) {
      // Verificar se os valores estão acima de 100 (formato errado: 4662.3 ao invés de 46.623)
      const percentB = parseFloat(evento.percent_b) || 0;
      const percentD = parseFloat(evento.percent_d) || 0;
      const percentC = parseFloat(evento.percent_c) || 0;
      const percentHH = parseFloat(evento.percent_happy_hour) || 0;
      
      if (percentB > 1 || percentD > 1 || percentC > 1 || percentHH > 1) {
        console.log(`\n⚠️  Evento ${evento.data_evento} (ID: ${evento.id}) com valores incorretos:`);
        console.log(`   Bebidas: ${percentB} → ${(percentB / 100).toFixed(6)}`);
        console.log(`   Drinks: ${percentD} → ${(percentD / 100).toFixed(6)}`);
        console.log(`   Comida: ${percentC} → ${(percentC / 100).toFixed(6)}`);
        console.log(`   Happy Hour: ${percentHH} → ${(percentHH / 100).toFixed(6)}`);
        
        // Corrigir dividindo por 100
        const respUpdate = await fetch(
          `${SUPABASE_URL}/rest/v1/eventos_base?id=eq.${evento.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              percent_b: percentB / 100,
              percent_d: percentD / 100,
              percent_c: percentC / 100,
              percent_happy_hour: percentHH / 100
            })
          }
        );
        
        if (respUpdate.ok) {
          console.log(`   ✅ Corrigido!`);
          eventosCorrigidos++;
        } else {
          const error = await respUpdate.text();
          console.log(`   ❌ Erro ao corrigir: ${error}`);
        }
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`   Total de eventos: ${eventos.length}`);
    console.log(`   Eventos corrigidos: ${eventosCorrigidos}`);
    
    return eventosCorrigidos;
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return 0;
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas!');
    process.exit(1);
  }
  
  console.log('🚀 Correção de MIX - Eventos Base');
  
  const barId = 4;
  const dataInicio = '2026-03-31';
  const dataFim = '2026-04-06';
  
  const corrigidos = await verificarECorrigirMix(barId, dataInicio, dataFim);
  
  if (corrigidos > 0) {
    console.log(`\n✅ ${corrigidos} eventos corrigidos!`);
    console.log(`\n💡 Agora execute o recálculo novamente para atualizar os dados de desempenho.`);
  } else {
    console.log(`\n✅ Nenhuma correção necessária.`);
  }
}

main();
