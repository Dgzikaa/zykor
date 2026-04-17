#!/usr/bin/env node
/**
 * 🧪 TESTE: Coleta de Periodo do ContaHub (qryId 51)
 * 
 * Testa coleta de periodo para 1 semana de março/2025
 * Para validar se qryId 51 está funcionando e trazendo campo VD
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Credenciais ContaHub
const CONTAHUB_EMAIL = process.env.CONTAHUB_EMAIL || 'rodrigo@ordinariobar.com.br';
const CONTAHUB_PASSWORD = process.env.CONTAHUB_PASSWORD;
const BAR_ORDINARIO_ID = 3;
const BAR_DEBOCHE_ID = 4;

if (!CONTAHUB_PASSWORD) {
  console.error('❌ CONTAHUB_PASSWORD não encontrada');
  process.exit(1);
}

function generateDynamicTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
}

function toContaHubDateFormat(isoDate) {
  return `${isoDate}T00:00:00-0300`;
}

async function loginContaHub(email, password) {
  console.log('🔐 Fazendo login no ContaHub...');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordSha1 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const loginData = new URLSearchParams({
    "usr_email": email,
    "usr_password_sha1": passwordSha1
  });
  
  const loginTimestamp = generateDynamicTimestamp();
  const loginResponse = await fetch(`https://sp.contahub.com/rest/contahub.cmds.UsuarioCmd/login/${loginTimestamp}?emp=0`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    },
    body: loginData,
  });
  
  if (!loginResponse.ok) {
    throw new Error(`Erro no login: ${loginResponse.statusText}`);
  }
  
  const loginResult = await loginResponse.json();
  
  if (!loginResult.token) {
    throw new Error('Token não retornado pelo ContaHub');
  }
  
  console.log('✅ Login realizado com sucesso');
  return {
    token: loginResult.token,
    empId: loginResult.emp
  };
}

async function fetchPeriodo(baseUrl, dataDate, empId, sessionToken) {
  const timestamp = generateDynamicTimestamp();
  const url = `${baseUrl}/qry/${timestamp}?emp=${empId}&qryId=51&data_inicio=${dataDate}&data_fim=${dataDate}`;
  
  console.log(`📡 Buscando periodo: ${dataDate}`);
  console.log(`🔗 URL: ${url.replace(sessionToken, 'TOKEN')}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': `JSESSIONID=${sessionToken}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

async function saveRawData(dataType, rawData, dataDate, barId) {
  const recordCount = Array.isArray(rawData?.list) ? rawData.list.length : 0;
  
  if (recordCount === 0) {
    console.warn(`⚠️ ${dataType} ${dataDate}: ContaHub retornou 0 registros`);
    return { saved: false, count: 0 };
  }
  
  // Calcular hash
  const dataHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(rawData))
  );
  const hashArray = Array.from(new Uint8Array(dataHash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const { error } = await supabase
    .from('contahub_raw_data')
    .insert({
      bar_id: barId,
      data_type: dataType,
      data_date: dataDate,
      raw_json: rawData,
      record_count: recordCount,
      data_hash: hashHex,
      processed: false,
      needs_reprocess: false
    });
  
  if (error) {
    console.error(`❌ Erro ao salvar: ${error.message}`);
    return { saved: false, count: 0, error };
  }
  
  console.log(`✅ Salvos ${recordCount} registros de ${dataType} para ${dataDate}`);
  return { saved: true, count: recordCount };
}

async function verificarCampoVD(rawData, dataDate) {
  if (!rawData?.list || rawData.list.length === 0) {
    return { temVD: false, amostra: null };
  }
  
  const primeiroRegistro = rawData.list[0];
  const temVD = 'vd' in primeiroRegistro;
  
  console.log(`\n📋 Análise do primeiro registro de ${dataDate}:`);
  console.log(`   ✅ Campo VD existe? ${temVD ? 'SIM ✅' : 'NÃO ❌'}`);
  
  if (temVD) {
    console.log(`   📌 VD = ${primeiroRegistro.vd}`);
    console.log(`   📌 Mesa = ${primeiroRegistro.vd_mesadesc || 'N/A'}`);
    console.log(`   📌 Cliente = ${primeiroRegistro.cli_nome || 'N/A'}`);
    console.log(`   📌 Valor = ${primeiroRegistro.$vr_pagamentos || primeiroRegistro.vr_pagamentos || 0}`);
  }
  
  console.log(`\n   📦 Campos disponíveis:`);
  Object.keys(primeiroRegistro).slice(0, 10).forEach(key => {
    console.log(`      - ${key}`);
  });
  
  return { 
    temVD, 
    amostra: primeiroRegistro,
    totalCampos: Object.keys(primeiroRegistro).length
  };
}

async function testarSemanaMArco() {
  console.log('🧪 ========================================');
  console.log('🧪 TESTE: Coleta Periodo Março/2025');
  console.log('🧪 qryId: 51 (com campo VD)');
  console.log('🧪 Período: 01-07/03/2025 (1 semana)');
  console.log('🧪 Bar: Ordinário (ID 3)');
  console.log('🧪 ========================================\n');
  
  try {
    // Login
    const { token, empId } = await loginContaHub(CONTAHUB_EMAIL, CONTAHUB_PASSWORD);
    const baseUrl = 'https://sp.contahub.com/rest/contahub.cmds.QryCmd';
    
    // Datas de teste: 01 a 07 de março de 2025
    const datasParaTestar = [
      '2025-03-01',
      '2025-03-02',
      '2025-03-03',
      '2025-03-04',
      '2025-03-05',
      '2025-03-06',
      '2025-03-07'
    ];
    
    let totalRegistros = 0;
    let datasComVD = 0;
    let datasSemVD = 0;
    
    for (const dataDate of datasParaTestar) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📅 Processando: ${dataDate}`);
      console.log('='.repeat(60));
      
      try {
        // Buscar dados
        const dataContaHub = toContaHubDateFormat(dataDate);
        const rawData = await fetchPeriodo(baseUrl, dataContaHub, empId, token);
        
        // Verificar se tem VD
        const { temVD, amostra, totalCampos } = await verificarCampoVD(rawData, dataDate);
        
        if (temVD) {
          datasComVD++;
        } else {
          datasSemVD++;
        }
        
        // Salvar no banco
        const result = await saveRawData('periodo', rawData, dataDate, BAR_ORDINARIO_ID);
        
        if (result.saved) {
          totalRegistros += result.count;
          console.log(`✅ ${dataDate}: ${result.count} registros salvos (${totalCampos} campos)`);
        }
        
        // Delay entre requisições
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${dataDate}:`, error.message);
      }
    }
    
    // Resumo
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESUMO DO TESTE');
    console.log('='.repeat(60));
    console.log(`✅ Total de registros coletados: ${totalRegistros}`);
    console.log(`✅ Datas com campo VD: ${datasComVD}/${datasParaTestar.length}`);
    console.log(`❌ Datas sem campo VD: ${datasSemVD}/${datasParaTestar.length}`);
    
    if (datasComVD === datasParaTestar.length) {
      console.log('\n🎉 SUCESSO! Todas as datas têm campo VD!');
      console.log('✅ qryId 51 está funcionando corretamente!');
      console.log('\n💡 Próximo passo: Rodar coleta completa de março/2025 até abril/2026');
    } else if (datasComVD > 0) {
      console.log('\n⚠️ ATENÇÃO! Algumas datas têm VD, outras não.');
      console.log('🔍 Verificar por que algumas datas não retornam VD.');
    } else {
      console.log('\n❌ PROBLEMA! Nenhuma data retornou campo VD!');
      console.log('🔍 Verificar se qryId 51 está correto ou se ContaHub mudou estrutura.');
    }
    
    // Verificar no banco
    const { data: registrosSalvos } = await supabase
      .from('contahub_raw_data')
      .select('data_date, record_count')
      .eq('data_type', 'periodo')
      .gte('data_date', '2025-03-01')
      .lte('data_date', '2025-03-07')
      .order('data_date');
    
    console.log('\n📦 Registros salvos no banco:');
    registrosSalvos?.forEach(r => {
      console.log(`   ${r.data_date}: ${r.record_count} registros`);
    });
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error);
    throw error;
  }
}

// Executar
testarSemanaMArco()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Teste falhou:', error);
    process.exit(1);
  });
