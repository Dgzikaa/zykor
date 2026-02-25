/**
 * Verificar dados importados no banco
 */

async function verificar() {
  const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDk2MzQ1NCwiZXhwIjoyMDUwNTM5NDU0fQ.lF-Kp-Ey4vxcBMBSJMJzxPdx8S7eWCLQqvYvLKjYbTE';
  
  console.log('🔍 VERIFICANDO DADOS IMPORTADOS\n');
  console.log('='.repeat(60));
  
  const eventos = ['s322f32', 's322f39', 's322f46', 's322f4f', 's322f58'];
  
  for (const eventoId of eventos) {
    const url = `${SUPABASE_URL}/rest/v1/sympla_participantes?evento_sympla_id=eq.${eventoId}&bar_id=eq.3&select=tipo_ingresso,fez_checkin`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      const total = data.length;
      const checkins = data.filter(p => p.fez_checkin === true).length;
      
      console.log(`\n📊 Evento: ${eventoId}`);
      console.log(`   Total: ${total}`);
      console.log(`   Checkins: ${checkins}`);
      
      // Agrupar por tipo
      const porTipo = {};
      data.forEach(p => {
        const tipo = p.tipo_ingresso || 'Sem tipo';
        if (!porTipo[tipo]) {
          porTipo[tipo] = { total: 0, checkins: 0 };
        }
        porTipo[tipo].total++;
        if (p.fez_checkin) porTipo[tipo].checkins++;
      });
      
      console.log('   Por tipo:');
      Object.entries(porTipo)
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([tipo, stats]) => {
          console.log(`      ${tipo}: ${stats.total} (${stats.checkins} checkins)`);
        });
    } else {
      console.log(`\n❌ Evento ${eventoId}: Erro ou sem dados`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Verificação concluída!');
}

verificar();
