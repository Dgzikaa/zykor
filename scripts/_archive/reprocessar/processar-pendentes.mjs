// Processar raw data pendente em lotes (evitar timeout)
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';
const BASE = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';

async function query(sql) {
  const res = await fetch(`${BASE}/rest/v1/rpc/processar_raw_lote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify({ p_limit: 100 })
  });
  return res.ok ? await res.json() : null;
}

// Alternativa: chamar via supabase client
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(BASE, SERVICE_KEY);

async function processarLote(limite) {
  const { data, error } = await supabase.rpc('processar_raw_data_lote', { p_limite: limite });
  if (error) return { error: error.message };
  return data;
}

async function run() {
  // Primeiro criar a funcao de lote no banco
  const { error: createErr } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' }).catch(() => ({}));

  // Usar approach diferente: processar dia a dia via a funcao existente
  // Buscar datas pendentes
  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore) {
    // Buscar proximo lote de 50 registros pendentes
    const { data: pendentes, error } = await supabase
      .from('contahub_raw_data')
      .select('id, bar_id, data_date, data_type, raw_json')
      .eq('processed', false)
      .order('data_date')
      .limit(20);

    if (error || !pendentes || pendentes.length === 0) {
      hasMore = false;
      break;
    }

    for (const rec of pendentes) {
      try {
        let rawData;
        if (typeof rec.raw_json === 'object' && rec.raw_json.list) {
          rawData = rec.raw_json.list;
        } else if (Array.isArray(rec.raw_json)) {
          rawData = rec.raw_json;
        } else {
          rawData = [];
        }

        // Chamar a funcao de processamento correspondente
        const funcName = `process_${rec.data_type}_data`;
        if (['analitico', 'periodo', 'pagamentos', 'tempo', 'fatporhora'].includes(rec.data_type)) {
          const { error: procErr } = await supabase.rpc(funcName, {
            p_bar_id: rec.bar_id,
            p_data_array: rawData,
            p_data_date: rec.data_date
          });

          if (procErr) {
            console.error(`  ERRO ${rec.data_type} bar${rec.bar_id} ${rec.data_date}:`, procErr.message.substring(0, 100));
          } else {
            // Marcar como processado
            await supabase.from('contahub_raw_data').update({ processed: true }).eq('id', rec.id);
            totalProcessed++;
          }
        } else {
          // tipo desconhecido, marcar como processado
          await supabase.from('contahub_raw_data').update({ processed: true }).eq('id', rec.id);
          totalProcessed++;
        }
      } catch (e) {
        console.error(`  ERRO ${rec.id}:`, e.message);
      }
    }

    if (totalProcessed % 100 === 0 || pendentes.length < 20) {
      const { count } = await supabase.from('contahub_raw_data').select('*', { count: 'exact', head: true }).eq('processed', false);
      console.log(`Processados: ${totalProcessed} | Pendentes: ${count}`);
    }
  }

  // Verificar resultado final
  const { count: periodo } = await supabase.from('contahub_periodo').select('*', { count: 'exact', head: true });
  const { count: visitas } = await supabase.from('visitas').select('*', { count: 'exact', head: true });
  const { count: pendentes } = await supabase.from('contahub_raw_data').select('*', { count: 'exact', head: true }).eq('processed', false);

  console.log(`\nFinalizado! Total processados: ${totalProcessed}`);
  console.log(`contahub_periodo: ${periodo}`);
  console.log(`visitas: ${visitas}`);
  console.log(`Raw pendente: ${pendentes}`);
}

run().catch(console.error);
