const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function debugCalculos() {
  try {
    await client.connect();
    
    console.log('DEBUG: Executando cálculos manualmente...\n');
    
    // Simular a query da função
    const result = await client.query(`
      SELECT 
        SUM(valorfinal) as total_valorfinal,
        SUM(CASE WHEN loc_desc = ANY(ARRAY['Salao']) THEN valorfinal ELSE 0 END) as valor_bebidas,
        SUM(CASE WHEN loc_desc = ANY(ARRAY['Cozinha', 'Cozinha 2']) THEN valorfinal ELSE 0 END) as valor_comidas,
        SUM(CASE WHEN loc_desc = ANY(ARRAY['Bar']) THEN valorfinal ELSE 0 END) as valor_drinks
      FROM contahub_analitico
      WHERE trn_dtgerencial = '2026-02-01'
      AND bar_id = 4
    `);
    
    const dados = result.rows[0];
    
    console.log('Valores agregados:');
    console.log('  total_valorfinal:', parseFloat(dados.total_valorfinal).toFixed(2));
    console.log('  valor_bebidas (Salao):', parseFloat(dados.valor_bebidas).toFixed(2));
    console.log('  valor_comidas (Cozinha + Cozinha 2):', parseFloat(dados.valor_comidas).toFixed(2));
    console.log('  valor_drinks (Bar):', parseFloat(dados.valor_drinks).toFixed(2));
    
    console.log('\nPercentuais calculados:');
    const percent_b = (parseFloat(dados.valor_bebidas) / parseFloat(dados.total_valorfinal)) * 100;
    const percent_c = (parseFloat(dados.valor_comidas) / parseFloat(dados.total_valorfinal)) * 100;
    const percent_d = (parseFloat(dados.valor_drinks) / parseFloat(dados.total_valorfinal)) * 100;
    
    console.log('  %Bebidas:', percent_b.toFixed(2) + '%');
    console.log('  %Comidas:', percent_c.toFixed(2) + '%');
    console.log('  %Drinks:', percent_d.toFixed(2) + '%');
    console.log('  Total:', (percent_b + percent_c + percent_d).toFixed(2) + '%');
    
    // Verificar o que está gravado
    console.log('\n\nVerificando valores gravados no banco:');
    const eventoResult = await client.query(`
      SELECT percent_b, percent_c, percent_d, real_r
      FROM eventos_base
      WHERE data_evento = '2026-02-01' AND bar_id = 4
    `);
    
    const evento = eventoResult.rows[0];
    console.log('  %Bebidas gravado:', parseFloat(evento.percent_b).toFixed(2) + '%');
    console.log('  %Comidas gravado:', parseFloat(evento.percent_c).toFixed(2) + '%');
    console.log('  %Drinks gravado:', parseFloat(evento.percent_d).toFixed(2) + '%');
    console.log('  Real R gravado:', parseFloat(evento.real_r).toFixed(2));
    
    await client.end();
    
  } catch (err) {
    console.error('ERRO:', err.message);
    await client.end();
    process.exit(1);
  }
}

debugCalculos();