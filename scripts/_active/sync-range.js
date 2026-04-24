// Script Node.js para sincronizar range de datas do ContaHub
const https = require('https');

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Uso: node sync-range.js <barId> <dataInicio> <dataFim>');
  console.log('Exemplo: node sync-range.js 3 2025-03-01 2025-03-31');
  process.exit(1);
}

const barId = parseInt(args[0]);
const dataInicio = args[1];
const dataFim = args[2];

const url = 'pzojhaqqgjlquzouhelm.supabase.co';
const path = '/functions/v1/contahub-sync-automatico';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2poYXFxZ2pscXV6b3VoZWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwMzU2NTcsImV4cCI6MjA0OTYxMTY1N30.gVLqLkuEKkRPqIE5SLjdJQxe-cNLSJQTBKAg1qqfxMg';

function syncDay(date) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      bar_id: barId,
      data_date: date
    });

    const options = {
      hostname: url,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ date, status: 'success', code: res.statusCode });
        } else {
          resolve({ date, status: 'error', code: res.statusCode, message: data });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ date, status: 'error', message: error.message });
    });

    req.write(body);
    req.end();
  });
}

async function syncRange() {
  const start = new Date(dataInicio);
  const end = new Date(dataFim);
  const totalDias = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  
  console.log(`🚀 Iniciando sincronização de ${totalDias} dias...`);
  console.log(`📊 Bar ID: ${barId}`);
  console.log(`📅 Período: ${dataInicio} a ${dataFim}\n`);

  let contador = 0;
  let sucessos = 0;
  let erros = 0;
  const current = new Date(start);

  while (current <= end) {
    contador++;
    const dateStr = current.toISOString().split('T')[0];
    const percentual = ((contador / totalDias) * 100).toFixed(1);
    
    process.stdout.write(`[${contador}/${totalDias} - ${percentual}%] Sincronizando ${dateStr}...`);
    
    const result = await syncDay(dateStr);
    
    if (result.status === 'success') {
      console.log(' ✅');
      sucessos++;
    } else {
      console.log(` ❌ Erro: ${result.message || result.code}`);
      erros++;
    }
    
    current.setDate(current.getDate() + 1);
    
    // Delay de 1 segundo entre chamadas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n🎯 Sincronização concluída!`);
  console.log(`✅ Sucessos: ${sucessos}`);
  console.log(`❌ Erros: ${erros}`);
}

syncRange().catch(console.error);
