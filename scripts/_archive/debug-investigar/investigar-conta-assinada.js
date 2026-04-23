/**
 * Script para investigar o problema da Conta Assinada zerada
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

async function investigarContaAssinada(barId) {
  console.log(`\n🔍 Investigando Conta Assinada para bar_id ${barId}...`);
  
  try {
    // 1. Verificar se há dados em contahub_pagamentos (tabela raw)
    console.log('\n1️⃣ Verificando contahub_pagamentos (tabela raw):');
    const respRaw = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_pagamentos?bar_id=eq.${barId}&select=dt_gerencial,meio,liquido&order=dt_gerencial.desc&limit=20`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const raw = await respRaw.json();
    
    console.log(`   Total de registros recentes: ${raw.length}`);
    if (raw.length > 0) {
      console.log(`   Última data: ${raw[0].dt_gerencial}`);
      
      const meios = {};
      raw.forEach(r => {
        const meio = r.meio || 'null';
        if (!meios[meio]) meios[meio] = { count: 0, total: 0 };
        meios[meio].count++;
        meios[meio].total += parseFloat(r.liquido) || 0;
      });
      
      console.log(`\n   Distribuição por meio de pagamento:`);
      Object.entries(meios).forEach(([meio, data]) => {
        console.log(`   - ${meio}: ${data.count} registros, R$ ${data.total.toFixed(2)}`);
      });
    }
    
    // 2. Verificar contahub_pagamentos
    console.log('\n2️⃣ Verificando contahub_pagamentos (tabela processada):');
    const respLimpo = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_pagamentos?bar_id=eq.${barId}&select=dt_gerencial,meio,liquido&order=dt_gerencial.desc&limit=20`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const limpo = await respLimpo.json();
    
    console.log(`   Total de registros recentes: ${limpo.length}`);
    if (limpo.length > 0) {
      console.log(`   Última data: ${limpo[0].dt_gerencial}`);
      
      const meios = {};
      limpo.forEach(r => {
        const meio = r.meio || 'null';
        if (!meios[meio]) meios[meio] = { count: 0, total: 0 };
        meios[meio].count++;
        meios[meio].total += parseFloat(r.liquido) || 0;
      });
      
      console.log(`\n   Distribuição por meio de pagamento:`);
      Object.entries(meios).forEach(([meio, data]) => {
        console.log(`   - ${meio}: ${data.count} registros, R$ ${data.total.toFixed(2)}`);
      });
    }
    
    // 3. Verificar especificamente semana 14
    console.log('\n3️⃣ Verificando Conta Assinada na semana 14 (31/03 a 06/04):');
    const respSemana14 = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_pagamentos?bar_id=eq.${barId}&dt_gerencial=gte.2026-03-31&dt_gerencial=lte.2026-04-06&meio=eq.Conta Assinada&select=dt_gerencial,liquido`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const semana14 = await respSemana14.json();
    
    console.log(`   Total de registros: ${semana14.length}`);
    if (semana14.length > 0) {
      const total = semana14.reduce((sum, r) => sum + (parseFloat(r.liquido) || 0), 0);
      console.log(`   Total Conta Assinada: R$ ${total.toFixed(2)}`);
    } else {
      console.log(`   ⚠️  Nenhum registro de Conta Assinada neste período!`);
    }
    
    // 4. Verificar todos os meios de pagamento na semana 14
    console.log('\n4️⃣ Todos os meios de pagamento na semana 14:');
    const respTodosMeios = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_pagamentos?bar_id=eq.${barId}&dt_gerencial=gte.2026-03-31&dt_gerencial=lte.2026-04-06&select=dt_gerencial,meio,liquido`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const todosMeios = await respTodosMeios.json();
    
    const meiosSemana14 = {};
    todosMeios.forEach(r => {
      const meio = r.meio || 'null';
      if (!meiosSemana14[meio]) meiosSemana14[meio] = { count: 0, total: 0 };
      meiosSemana14[meio].count++;
      meiosSemana14[meio].total += parseFloat(r.liquido) || 0;
    });
    
    console.log(`   Total de registros: ${todosMeios.length}`);
    Object.entries(meiosSemana14).forEach(([meio, data]) => {
      console.log(`   - ${meio}: ${data.count} registros, R$ ${data.total.toFixed(2)}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas!');
    process.exit(1);
  }
  
  console.log('🚀 Investigação de Conta Assinada - Deboche (bar_id 4)');
  
  await investigarContaAssinada(4);
  
  console.log('\n✅ Investigação concluída!');
}

main();
