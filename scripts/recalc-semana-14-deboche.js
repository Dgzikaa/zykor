/**
 * Script para recalcular desempenho da semana 14 do Deboche
 */

const fetch = require('node-fetch');

async function recalcularSemana14() {
  console.log('🔄 Recalculando desempenho da semana 14 do Deboche...\n');

  const url = 'https://vgpqvzlgfpqgwmqxhxkr.supabase.co/functions/v1/recalcular-desempenho-v2';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncHF2emxnZnBxZ3dtcXhoeGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5MjY5NDYsImV4cCI6MjA1MTUwMjk0Nn0.AXL5cDPRNtMTMPcMTKPUqxUJWJm4CZBc2Qkf-NUVlcI'
  };

  const body = JSON.stringify({
    bar_id: 4,
    ano: 2026,
    numero_semana: 14
  });

  try {
    console.log('📡 Chamando edge function...');
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Sucesso!');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Erro:', data);
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

recalcularSemana14();
