#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Verificar contahub_raw_data
  const { data: rawData, error: rawError } = await supabase
    .from('contahub_raw_data')
    .select('id', { count: 'exact', head: true })
    .eq('data_type', 'periodo')
    .gte('data_date', '2026-01-01')
    .lte('data_date', '2026-12-31');

  console.log(`📊 contahub_raw_data (período 2026): ${rawError ? 'ERRO' : '0 registros'}`);

  // Verificar contahub_periodo
  const { data: periodoData, error: periodoError } = await supabase
    .from('contahub_periodo')
    .select('id', { count: 'exact', head: true })
    .eq('bar_id', 3)
    .gte('dt_gerencial', '2026-01-01')
    .lte('dt_gerencial', '2026-12-31');

  console.log(`📊 contahub_periodo (2026): ${periodoError ? 'ERRO' : '0 registros'}`);
  
  if (rawError) console.error('Erro raw:', rawError);
  if (periodoError) console.error('Erro periodo:', periodoError);
}

main();
