import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verProdutosLocal(local: string, barId: number = 3) {
  const { data } = await supabase
    .from('contahub_stockout')
    .select('prd_desc, raw_data')
    .eq('bar_id', barId)
    .eq('loc_desc', local)
    .eq('data_consulta', '2026-03-01');

  const grupos: Record<string, string[]> = {};
  
  data?.forEach(p => {
    const grupo = p.raw_data?.grp_desc || 'Sem grupo';
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(p.prd_desc);
  });

  console.log(`\n📍 LOCAL: ${local.toUpperCase()}\n`);
  console.log(`Total de produtos: ${data?.length || 0}\n`);

  Object.keys(grupos).sort().forEach(grupo => {
    console.log(`\n📦 ${grupo} (${grupos[grupo].length} produtos):`);
    grupos[grupo].slice(0, 8).forEach(p => console.log(`   - ${p}`));
    if (grupos[grupo].length > 8) {
      console.log(`   ... e mais ${grupos[grupo].length - 8} produtos`);
    }
  });
}

const local = process.argv[2] || 'Bar';
verProdutosLocal(local).then(() => process.exit(0));
