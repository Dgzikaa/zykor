require('dotenv').config({ path: './frontend/.env.local' });

async function test() {
  try {
    console.log('🧪 Testando endpoint de stakeholders...\n');
    
    const response = await fetch('http://localhost:3001/api/financeiro/contaazul/stakeholders?bar_id=3&sync=true');
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Resposta:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

test();
