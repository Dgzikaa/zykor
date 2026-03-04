require('dotenv').config({path:'../.env.local'});
const {createClient} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getFunctionDef() {
  const {data, error} = await supabase.rpc('execute_sql', {
    query_text: "SELECT pg_get_functiondef('calculate_evento_metrics'::regproc);"
  });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(data);
  }
}

getFunctionDef();
