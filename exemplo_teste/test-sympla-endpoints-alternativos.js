/**
 * Testar endpoints alternativos da Sympla
 */

const SYMPLA_TOKEN = '2835b1e7099e748057c71a9c0c34b3a4ca1246b379687ebf8affa92cdc65a7a4';
const EVENTO_ID = 's322f32';

async function testarEndpoints() {
  console.log('🔍 TESTANDO ENDPOINTS ALTERNATIVOS DA SYMPLA\n');
  
  const endpoints = [
    // Endpoint padrão
    `/public/v1.5.1/events/${EVENTO_ID}/participants?page=1`,
    
    // Endpoint de checkins (se existir)
    `/public/v1.5.1/events/${EVENTO_ID}/checkins`,
    `/public/v1.5.1/events/${EVENTO_ID}/checkins?page=1`,
    
    // Endpoint de relatórios (se existir)
    `/public/v1.5.1/events/${EVENTO_ID}/reports`,
    `/public/v1.5.1/events/${EVENTO_ID}/reports/checkins`,
    
    // Versões antigas da API
    `/public/v1/events/${EVENTO_ID}/participants?page=1`,
    `/public/v2/events/${EVENTO_ID}/participants?page=1`,
    
    // Endpoint privado (se existir)
    `/private/v1/events/${EVENTO_ID}/participants?page=1`,
    
    // Com parâmetro de campos completos
    `/public/v1.5.1/events/${EVENTO_ID}/participants?page=1&fields=*`,
    `/public/v1.5.1/events/${EVENTO_ID}/participants?page=1&include_checkin=true`,
  ];
  
  for (const endpoint of endpoints) {
    console.log('='.repeat(60));
    console.log(`🔗 Testando: ${endpoint}`);
    console.log('-'.repeat(60));
    
    try {
      const response = await fetch(`https://api.sympla.com.br${endpoint}`, {
        method: 'GET',
        headers: {
          's_token': SYMPLA_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📡 Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
          const primeiro = data.data[0];
          const comCheckin = data.data.filter(p => p.checkin !== undefined).length;
          
          console.log(`✅ Sucesso!`);
          console.log(`   Total na página: ${data.data.length}`);
          console.log(`   Com campo checkin: ${comCheckin}`);
          console.log(`   Primeiro participante tem checkin? ${primeiro?.checkin !== undefined ? 'SIM' : 'NÃO'}`);
          
          if (primeiro?.checkin) {
            console.log(`   Exemplo checkin:`, JSON.stringify(primeiro.checkin, null, 2));
          }
        } else {
          console.log(`✅ Resposta OK mas estrutura diferente:`, JSON.stringify(data).substring(0, 200));
        }
      } else {
        console.log(`❌ Erro: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ Erro: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('✅ Testes concluídos!');
  console.log('='.repeat(60));
}

testarEndpoints();
