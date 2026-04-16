const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

const DIAS_VERIFICAR = ['01', '11', '14', '15', '17', '29', '30', '31'];

function executeSQL(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });

    const options = {
      hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/execute_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Length': data.length
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(data);
    req.end();
  });
}

async function verificarMarco() {
  console.log('🔍 VERIFICANDO DIFERENÇAS EM MARÇO/2026\n');

  for (const dia of DIAS_VERIFICAR) {
    const data = `2026-03-${dia}`;
    
    // Buscar soma do contahub_periodo
    const queryPeriodo = `
      SELECT 
        COALESCE(SUM(vr_pagamentos), 0) as total_periodo,
        COUNT(*) as num_registros
      FROM contahub_periodo 
      WHERE bar_id = 3 
      AND dt_gerencial = '${data}'
    `;
    
    // Buscar do eventos_base
    const queryEventos = `
      SELECT 
        real_r as total_eventos,
        cl_real as clientes
      FROM eventos_base 
      WHERE bar_id = 3 
      AND data_evento = '${data}'
    `;

    try {
      const [resultPeriodo, resultEventos] = await Promise.all([
        executeSQL(queryPeriodo),
        executeSQL(queryEventos)
      ]);

      const periodo = resultPeriodo[0];
      const eventos = resultEventos[0];

      const diff = Math.abs(parseFloat(periodo.total_periodo) - parseFloat(eventos.total_eventos));
      const diffPerc = (diff / parseFloat(periodo.total_periodo) * 100).toFixed(2);

      if (diff > 1) {
        console.log(`⚠️  ${data}:`);
        console.log(`   contahub_periodo: R$ ${parseFloat(periodo.total_periodo).toFixed(2)} (${periodo.num_registros} registros)`);
        console.log(`   eventos_base:     R$ ${parseFloat(eventos.total_eventos).toFixed(2)}`);
        console.log(`   DIFERENÇA:        R$ ${diff.toFixed(2)} (${diffPerc}%)`);
        console.log(`   Clientes:         ${eventos.clientes}\n`);
      } else {
        console.log(`✅ ${data}: OK (diff < R$ 1,00)`);
      }

      // Aguardar 200ms entre chamadas
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`❌ ${data}: Erro - ${error.message}`);
    }
  }
}

verificarMarco().catch(console.error);
