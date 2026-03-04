require('dotenv').config({path:'../frontend/.env.local'});
const {createClient} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: {
      schema: 'public'
    }
  }
);

async function getFunctionDef() {
  const {data, error} = await supabase
    .from('pg_proc')
    .select('*')
    .eq('proname', 'calculate_evento_metrics')
    .single();
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Encontrado:', data);
  }
}

getFunctionDef();
