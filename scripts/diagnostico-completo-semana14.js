/**
 * Script para diagnóstico completo da semana 14 do Deboche
 */

const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
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

async function diagnosticoCompleto(barId, ano, numeroSemana) {
  console.log(`\n🔍 DIAGNÓSTICO COMPLETO - Bar ${barId}, Semana ${numeroSemana}/${ano}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Calcular datas da semana 14/2026
  const dataInicio = '2026-03-31';
  const dataFim = '2026-04-06';
  
  console.log(`📅 Período: ${dataInicio} a ${dataFim}\n`);
  
  try {
    // 1. Verificar dados de desempenho_semanal
    console.log('1️⃣ DADOS DE DESEMPENHO SEMANAL:');
    const respDesempenho = await fetch(
      `${SUPABASE_URL}/rest/v1/desempenho_semanal?bar_id=eq.${barId}&ano=eq.${ano}&numero_semana=eq.${numeroSemana}&select=*`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const desempenho = await respDesempenho.json();
    
    if (desempenho && desempenho.length > 0) {
      const d = desempenho[0];
      console.log(`   Faturamento Total: R$ ${(d.faturamento_total || 0).toFixed(2)}`);
      console.log(`   Faturamento Bar: R$ ${(d.faturamento_bar || 0).toFixed(2)}`);
      console.log(`   Clientes Atendidos: ${d.clientes_atendidos || 0}`);
      console.log(`   Conta Assinada: R$ ${(d.conta_assinada_valor || 0).toFixed(2)} (${(d.conta_assinada_perc || 0).toFixed(2)}%)`);
      console.log(`   Mix Bebidas: ${((d.perc_bebidas || 0) * 100).toFixed(2)}%`);
      console.log(`   Mix Drinks: ${((d.perc_drinks || 0) * 100).toFixed(2)}%`);
      console.log(`   Mix Comida: ${((d.perc_comida || 0) * 100).toFixed(2)}%`);
      console.log(`   Fat até 19h: ${((d.perc_faturamento_ate_19h || 0) * 100).toFixed(2)}%`);
      console.log(`   Fat após 22h: ${((d.perc_faturamento_apos_22h || 0) * 100).toFixed(2)}%`);
    }
    
    // 2. Verificar eventos_base (fonte do MIX)
    console.log('\n2️⃣ EVENTOS BASE (fonte do MIX):');
    const respEventos = await fetch(
      `${SUPABASE_URL}/rest/v1/eventos_base?bar_id=eq.${barId}&data_evento=gte.${dataInicio}&data_evento=lte.${dataFim}&ativo=eq.true&select=data_evento,faturamento_bar,percent_b,percent_d,percent_c,percent_happy_hour`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const eventos = await respEventos.json();
    
    console.log(`   Total de eventos: ${eventos.length}`);
    if (eventos.length > 0) {
      eventos.forEach(e => {
        console.log(`   ${e.data_evento}: Fat Bar R$ ${(e.faturamento_bar || 0).toFixed(2)} | B: ${((e.percent_b || 0) * 100).toFixed(1)}% | D: ${((e.percent_d || 0) * 100).toFixed(1)}% | C: ${((e.percent_c || 0) * 100).toFixed(1)}% | HH: ${((e.percent_happy_hour || 0) * 100).toFixed(1)}%`);
      });
      
      const fatTotal = eventos.reduce((sum, e) => sum + (parseFloat(e.faturamento_bar) || 0), 0);
      console.log(`   Faturamento Bar Total (eventos): R$ ${fatTotal.toFixed(2)}`);
    }
    
    // 3. Verificar contahub_pagamentos (fonte da Conta Assinada)
    console.log('\n3️⃣ CONTA ASSINADA (contahub_pagamentos):');
    const respPagamentos = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_pagamentos?bar_id=eq.${barId}&dt_gerencial=gte.${dataInicio}&dt_gerencial=lte.${dataFim}&meio=eq.Conta Assinada&select=dt_gerencial,liquido`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const pagamentos = await respPagamentos.json();
    
    console.log(`   Total de registros: ${pagamentos.length}`);
    if (pagamentos.length > 0) {
      const totalContaAssinada = pagamentos.reduce((sum, p) => sum + (parseFloat(p.liquido) || 0), 0);
      console.log(`   Total Conta Assinada: R$ ${totalContaAssinada.toFixed(2)}`);
      pagamentos.slice(0, 5).forEach(p => {
        console.log(`   ${p.dt_gerencial}: R$ ${(p.liquido || 0).toFixed(2)}`);
      });
    } else {
      console.log(`   ⚠️  Nenhum registro encontrado!`);
    }
    
    // 4. Verificar contahub_tempo (fonte dos tempos e atrasos)
    console.log('\n4️⃣ TEMPOS DE PRODUÇÃO (contahub_tempo):');
    const respTempo = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_tempo?bar_id=eq.${barId}&data=gte.${dataInicio}&data=lte.${dataFim}&select=data,categoria,tempo_final&limit=10`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const tempos = await respTempo.json();
    
    console.log(`   Total de registros (amostra): ${tempos.length}`);
    if (tempos.length > 0) {
      tempos.forEach(t => {
        console.log(`   ${t.data} | ${t.categoria} | ${(t.tempo_final || 0).toFixed(1)} min`);
      });
    } else {
      console.log(`   ⚠️  Nenhum registro encontrado!`);
    }
    
    // 5. Verificar contahub_periodo (fonte da distribuição horária)
    console.log('\n5️⃣ DISTRIBUIÇÃO HORÁRIA (contahub_periodo):');
    const respPeriodo = await fetch(
      `${SUPABASE_URL}/rest/v1/contahub_periodo?bar_id=eq.${barId}&vd_dtcontabil=gte.${dataInicio}&vd_dtcontabil=lte.${dataFim}&select=vd_dtcontabil,vd_horaabertura,vr_pagamentos&limit=10`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const periodo = await respPeriodo.json();
    
    console.log(`   Total de registros (amostra): ${periodo.length}`);
    if (periodo.length > 0) {
      periodo.forEach(p => {
        console.log(`   ${p.vd_dtcontabil} | Hora: ${p.vd_horaabertura} | R$ ${(p.vr_pagamentos || 0).toFixed(2)}`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Diagnóstico concluído!');
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error.message);
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Variáveis de ambiente não configuradas!');
    process.exit(1);
  }
  
  await diagnosticoCompleto(4, 2026, 14);
}

main();
