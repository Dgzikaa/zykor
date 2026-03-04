const fs = require('fs');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Geladeira%40001@db.uqtgsvujwcbymjmvkjhy.supabase.co:5432/postgres';

const client = new Client({ connectionString });

async function aplicarFuncao() {
  try {
    await client.connect();
    console.log('✓ Conectado ao banco de dados');
    
    const sql = fs.readFileSync('c:/Projects/zykor/temp_function_dynamic_arrays.sql', 'utf8');
    
    console.log('\nAplicando função calculate_evento_metrics com arrays dinâmicos...');
    console.log('Tamanho do SQL:', sql.length, 'caracteres');
    
    await client.query(sql);
    
    console.log('✓ Função aplicada com sucesso!');
    
    // Buscar evento 01/02/2026 do Deboche (bar_id=4)
    console.log('\nBuscando evento 01/02/2026 do Deboche...');
    const eventoResult = await client.query(
      'SELECT id, nome, data_evento, bar_id FROM eventos_base WHERE data_evento = $1 AND bar_id = $2',
      ['2026-02-01', 4]
    );
    
    if (eventoResult.rows.length === 0) {
      console.error('ERRO: Evento não encontrado');
      await client.end();
      process.exit(1);
    }
    
    const evento = eventoResult.rows[0];
    console.log('Evento encontrado:', evento);
    console.log('\nRecalculando métricas...');
    
    await client.query('SELECT calculate_evento_metrics($1)', [evento.id]);
    
    console.log('✓ Recálculo executado!');
    
    // Buscar percentuais atualizados
    console.log('\nBuscando percentuais atualizados...');
    const updatedResult = await client.query(
      'SELECT percent_b, percent_c, percent_d, real_r, cl_real FROM eventos_base WHERE id = $1',
      [evento.id]
    );
    
    const updated = updatedResult.rows[0];
    
    console.log('\n=== RESULTADO ===');
    console.log('Evento:', evento.nome);
    console.log('Data:', evento.data_evento);
    console.log('Bar ID:', evento.bar_id, '(Deboche)');
    console.log('\nPercentuais:');
    console.log('  %Bebidas:', parseFloat(updated.percent_b || 0).toFixed(2) + '%');
    console.log('  %Drinks:', parseFloat(updated.percent_d || 0).toFixed(2) + '%');
    console.log('  %Comida:', parseFloat(updated.percent_c || 0).toFixed(2) + '%');
    const total = parseFloat(updated.percent_b || 0) + parseFloat(updated.percent_c || 0) + parseFloat(updated.percent_d || 0);
    console.log('  Total:', total.toFixed(2) + '%');
    console.log('\nReceita Real: R$', parseFloat(updated.real_r || 0).toFixed(2));
    console.log('Clientes Real:', updated.cl_real);
    
    await client.end();
    
  } catch (err) {
    console.error('\nERRO:', err.message);
    console.error('Stack:', err.stack);
    await client.end();
    process.exit(1);
  }
}

aplicarFuncao();