/**
 * Script DETALHADO para investigar API do Sympla
 */

const SYMPLA_TOKEN = '2835b1e7099e748057c71a9c0c34b3a4ca1246b379687ebf8affa92cdc65a7a4';
const EVENTO_ID = 's322f32';
const fs = require('fs');

async function testarAPI() {
  try {
    console.log('🔍 TESTE DETALHADO DA API SYMPLA\n');
    
    // Testar primeira página apenas para análise
    const url = `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=1`;
    
    console.log(`📡 URL: ${url}\n`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        's_token': SYMPLA_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Salvar resposta completa
    fs.writeFileSync(
      'exemplo_teste/sympla-response-page1.json', 
      JSON.stringify(data, null, 2)
    );
    console.log('✅ Resposta completa salva em: sympla-response-page1.json\n');
    
    // Analisar estrutura
    console.log('📊 ESTRUTURA DA RESPOSTA:');
    console.log('-'.repeat(60));
    console.log('Campos principais:', Object.keys(data));
    console.log('Total de participantes nesta página:', data.data?.length || 0);
    console.log('Paginação:', JSON.stringify(data.pagination, null, 2));
    
    // Analisar primeiro participante
    if (data.data && data.data.length > 0) {
      console.log('\n📝 ESTRUTURA DO PRIMEIRO PARTICIPANTE:');
      console.log('-'.repeat(60));
      console.log('Campos:', Object.keys(data.data[0]));
      
      // Salvar exemplo
      fs.writeFileSync(
        'exemplo_teste/sympla-participante-exemplo.json',
        JSON.stringify(data.data[0], null, 2)
      );
      console.log('✅ Exemplo salvo em: sympla-participante-exemplo.json');
      
      console.log('\nPrimeiro participante:');
      console.log(JSON.stringify(data.data[0], null, 2));
    }
    
    // Buscar um participante que sabemos que tem checkin (página 34+)
    console.log('\n\n🔍 BUSCANDO PÁGINA COM CHECKINS (página 34)...\n');
    
    const url34 = `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/participants?page=34`;
    const response34 = await fetch(url34, {
      method: 'GET',
      headers: {
        's_token': SYMPLA_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    const data34 = await response34.json();
    
    fs.writeFileSync(
      'exemplo_teste/sympla-response-page34.json',
      JSON.stringify(data34, null, 2)
    );
    console.log('✅ Página 34 salva em: sympla-response-page34.json\n');
    
    // Encontrar primeiro com checkin
    const comCheckin = data34.data?.find(p => p.checkin?.check_in === true);
    if (comCheckin) {
      console.log('📝 EXEMPLO DE PARTICIPANTE COM CHECKIN:');
      console.log('-'.repeat(60));
      console.log(JSON.stringify(comCheckin, null, 2));
      
      fs.writeFileSync(
        'exemplo_teste/sympla-participante-com-checkin.json',
        JSON.stringify(comCheckin, null, 2)
      );
    }
    
    // Verificar se há endpoint de checkins
    console.log('\n\n🧪 TESTANDO ENDPOINT ALTERNATIVO DE CHECKINS...\n');
    
    const urlCheckins = `https://api.sympla.com.br/public/v1.5.1/events/${EVENTO_ID}/checkins`;
    const responseCheckins = await fetch(urlCheckins, {
      method: 'GET',
      headers: {
        's_token': SYMPLA_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${responseCheckins.status}`);
    if (responseCheckins.ok) {
      const dataCheckins = await responseCheckins.json();
      console.log('✅ Endpoint de checkins EXISTE!');
      console.log(JSON.stringify(dataCheckins, null, 2));
      
      fs.writeFileSync(
        'exemplo_teste/sympla-checkins-endpoint.json',
        JSON.stringify(dataCheckins, null, 2)
      );
    } else {
      console.log('❌ Endpoint de checkins não existe ou não tem permissão');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Teste concluído! Verifique os arquivos JSON gerados.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
  }
}

testarAPI();
