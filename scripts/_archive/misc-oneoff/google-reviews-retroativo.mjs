#!/usr/bin/env node
/**
 * Script para buscar histórico completo de avaliações do Google
 * Executa o Apify e aguarda localmente (sem timeout de Edge Function)
 * 
 * Uso: node scripts/google-reviews-retroativo.mjs [bar_id]
 *      Se bar_id não for fornecido, processa todos os bares
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM3OTMzNTYsImV4cCI6MjA0OTM2OTM1Nn0.BOi8aaBbqBCxnO7k7gPB0hMfhR_f4xIs9cZ4K_rPRQY';
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_TOKEN) {
  console.error('❌ APIFY_API_TOKEN não configurado. Defina no .env');
  process.exit(1);
}

const BAR_PLACE_IDS = {
  3: { placeId: 'ChIJz3z3lJA7WpMRaC_nQ3vL700', name: 'Ordinário Bar e Música' },
  4: { placeId: 'ChIJt50cXnQ7WpMRjlTp98nT91o', name: 'Deboche! Bar' }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runApifyScraper(barId, barConfig) {
  console.log(`\n🚀 Iniciando coleta retroativa para ${barConfig.name} (bar_id: ${barId})...`);
  console.log(`   Place ID: ${barConfig.placeId}`);
  
  const startTime = Date.now();
  
  // Iniciar o actor no Apify
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{
          url: `https://www.google.com/maps/place/?q=place_id:${barConfig.placeId}`
        }],
        maxReviews: 50000,
        language: 'pt-BR',
        reviewsSort: 'newest'
        // Sem reviewsStartDate = busca TODO o histórico
      })
    }
  );

  const runData = await runResponse.json();
  
  if (!runData.data?.id) {
    throw new Error('Falha ao iniciar scraping no Apify: ' + JSON.stringify(runData));
  }

  const runId = runData.data.id;
  console.log(`   Run ID: ${runId}`);
  console.log(`   Aguardando conclusão (pode demorar vários minutos)...`);

  // Aguardar conclusão
  let status = 'RUNNING';
  let attempts = 0;
  
  while (status === 'RUNNING' || status === 'READY') {
    await sleep(10000); // 10 segundos entre verificações
    attempts++;
    
    const statusResponse = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    const statusData = await statusResponse.json();
    status = statusData.data?.status || 'FAILED';
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r   ⏳ Status: ${status} | Tempo: ${elapsed}s | Tentativa: ${attempts}     `);
    
    if (attempts > 600) { // 100 minutos máximo
      throw new Error('Timeout aguardando Apify');
    }
  }
  
  console.log('');
  
  if (status !== 'SUCCEEDED') {
    throw new Error(`Scraping falhou com status: ${status}`);
  }

  // Obter dataset ID
  const runInfoResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
  );
  const runInfo = await runInfoResponse.json();
  const datasetId = runInfo.data.defaultDatasetId;
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`   ✅ Scraping concluído em ${elapsed}s`);
  console.log(`   Dataset ID: ${datasetId}`);
  
  return datasetId;
}

async function importDataset(barId, datasetId, barConfig) {
  console.log(`\n📥 Importando dataset ${datasetId} para ${barConfig.name}...`);
  
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/google-reviews-apify-sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        bar_id: barId,
        dataset_id: datasetId
      })
    }
  );

  const result = await response.json();
  
  if (result.success) {
    console.log(`   ✅ ${result.results[barId]?.message || 'Importação concluída'}`);
    return result.results[barId]?.count || 0;
  } else {
    throw new Error(`Erro na importação: ${result.error || JSON.stringify(result)}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const specificBarId = args[0] ? parseInt(args[0]) : null;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   IMPORTAÇÃO RETROATIVA - GOOGLE REVIEWS');
  console.log('   Busca TODO o histórico disponível no Google Maps');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const barsToProcess = specificBarId 
    ? { [specificBarId]: BAR_PLACE_IDS[specificBarId] }
    : BAR_PLACE_IDS;
  
  if (specificBarId && !BAR_PLACE_IDS[specificBarId]) {
    console.error(`❌ Bar ID ${specificBarId} não encontrado. IDs válidos: ${Object.keys(BAR_PLACE_IDS).join(', ')}`);
    process.exit(1);
  }

  let totalImportado = 0;
  
  for (const [barIdStr, barConfig] of Object.entries(barsToProcess)) {
    const barId = parseInt(barIdStr);
    
    try {
      // 1. Rodar o scraper no Apify
      const datasetId = await runApifyScraper(barId, barConfig);
      
      // 2. Importar o dataset via Edge Function
      const count = await importDataset(barId, datasetId, barConfig);
      totalImportado += count;
      
    } catch (error) {
      console.error(`\n❌ Erro processando ${barConfig.name}: ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`   ✅ CONCLUÍDO - Total importado: ${totalImportado} avaliações`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
