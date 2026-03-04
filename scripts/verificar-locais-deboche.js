const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function verificarDados() {
  try {
    await client.connect();
    
    console.log('Verificando dados do ContaHub Analítico para Deboche em 01/02/2026...\n');
    
    const result = await client.query(`
      SELECT 
        loc_desc,
        SUM(valorfinal) as total
      FROM contahub_analitico
      WHERE trn_dtgerencial = '2026-02-01'
      AND bar_id = 4
      GROUP BY loc_desc
      ORDER BY total DESC
    `);
    
    console.log('Locais encontrados:');
    console.log('==================');
    
    let totalGeral = 0;
    result.rows.forEach(row => {
      console.log(`${row.loc_desc}: R$ ${parseFloat(row.total).toFixed(2)}`);
      totalGeral += parseFloat(row.total);
    });
    
    console.log('==================');
    console.log(`TOTAL: R$ ${totalGeral.toFixed(2)}`);
    
    console.log('\n\nVerificando arrays configurados na função:');
    console.log('Bar ID 4 (Deboche):');
    console.log('  locais_bebidas: [Salao]');
    console.log('  locais_comidas: [Cozinha, Cozinha 2]');
    console.log('  locais_drinks: [Bar]');
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

verificarDados();