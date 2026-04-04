/**
 * Debug da estrutura retornada pela API
 */

async function debug() {
  try {
    const s12Resp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const s12 = await s12Resp.json();

    console.log('📦 ESTRUTURA DO RETORNO DA API:\n');
    console.log(JSON.stringify(s12, null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

debug();
