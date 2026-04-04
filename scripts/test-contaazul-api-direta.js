/**
 * Teste direto da API do Conta Azul para debug
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testarAPI() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Buscar access_token
  const { data: cred } = await supabase
    .from('api_credentials')
    .select('access_token, client_id')
    .eq('sistema', 'conta_azul')
    .eq('bar_id', 3)
    .single();

  if (!cred?.access_token) {
    console.error('❌ Token não encontrado');
    return;
  }

  console.log('✅ Token encontrado');
  console.log('📡 Testando API do Conta Azul...\n');

  // Testar endpoint de contas a pagar
  const url = 'https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?pagina=1&tamanho_pagina=5&data_vencimento_de=2026-03-01&data_vencimento_ate=2026-04-04';

  console.log('🔗 URL:', url);
  console.log('🔑 Authorization: Bearer ' + cred.access_token.substring(0, 20) + '...\n');

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + cred.access_token,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Status:', response.status, response.statusText);

    const text = await response.text();
    
    if (!response.ok) {
      console.error('❌ Erro:', text);
      return;
    }

    const data = JSON.parse(text);
    
    console.log('\n✅ Resposta recebida!');
    console.log('📦 Estrutura:', Object.keys(data));
    console.log('📊 Total de itens:', data.itens_totais || data.total || 0);
    console.log('📄 Itens nesta página:', (data.itens || []).length);

    if (data.itens && data.itens.length > 0) {
      console.log('\n💰 Primeiro lançamento:');
      const primeiro = data.itens[0];
      console.log(JSON.stringify(primeiro, null, 2));
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarAPI();
