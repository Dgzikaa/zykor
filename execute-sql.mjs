import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://zykor.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não definida');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = fs.readFileSync('temp_query.sql', 'utf8');

async function executeSql() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('Erro ao executar SQL:', error);
      process.exit(1);
    }
    
    console.log('SQL executado com sucesso!');
    console.log('Resultado:', data);
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
}

executeSql();
