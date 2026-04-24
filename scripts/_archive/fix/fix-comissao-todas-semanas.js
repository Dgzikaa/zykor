const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNzI1MzYyMSwiZXhwIjoyMDIyODI5NjIxfQ.aBUe7kkSr5Oj5OZhSWZlhZZGhbmZZZZZZZZZZZZZZZZ';
const SUPABASE_URL = 'uqtgsvujwcbymjmvkjhy.supabase.co';

function executeSql(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: '/rest/v1/rpc/execute_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fixComissao() {
  console.log('🔧 CORRIGINDO COMISSÃO DE TODAS AS SEMANAS\n');

  // Buscar todas as semanas com diferença
  const query = `
    SELECT 
      ds.bar_id,
      ds.numero_semana,
      ds.ano,
      ds.comissao as comissao_atual,
      COALESCE(SUM(cp.vr_repique), 0) as comissao_correta,
      COALESCE(SUM(cp.vr_couvert), 0) as couvert_correto
    FROM desempenho_semanal ds
    LEFT JOIN contahub_periodo cp 
      ON cp.bar_id = ds.bar_id 
      AND EXTRACT(WEEK FROM cp.dt_gerencial) = ds.numero_semana 
      AND EXTRACT(ISOYEAR FROM cp.dt_gerencial) = ds.ano
    WHERE ds.ano = 2026
    GROUP BY ds.bar_id, ds.numero_semana, ds.ano, ds.comissao
    HAVING ABS(ds.comissao - COALESCE(SUM(cp.vr_repique), 0)) > 1
    ORDER BY ds.bar_id, ds.numero_semana;
  `;

  const result = await executeSql(query);
  const semanas = result.result || [];

  console.log(`📊 Encontradas ${semanas.length} semanas com comissão incorreta\n`);

  for (const semana of semanas) {
    const { bar_id, numero_semana, ano, comissao_atual, comissao_correta, couvert_correto } = semana;
    
    console.log(`Semana ${numero_semana} (Bar ${bar_id}): R$ ${parseFloat(comissao_atual).toFixed(2)} → R$ ${parseFloat(comissao_correta).toFixed(2)}`);

    const updateQuery = `
      UPDATE desempenho_semanal 
      SET comissao = ${comissao_correta}, couvert_atracoes = ${couvert_correto}
      WHERE bar_id = ${bar_id} AND ano = ${ano} AND numero_semana = ${numero_semana};
    `;

    await executeSql(updateQuery);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n✅ Todas as comissões corrigidas!');
}

fixComissao().catch(console.error);
