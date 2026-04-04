import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { bar_id, ano, semana } = body;

    console.log('Teste minimal - Parâmetros:', { bar_id, ano, semana });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Teste 1: Buscar desempenho_semanal
    console.log('Teste 1: Buscando desempenho_semanal...');
    const { data: desempenho } = await supabase
      .from('desempenho_semanal')
      .select('numero_semana, ano')
      .eq('bar_id', bar_id)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .limit(1);
    console.log('Teste 1: OK -', desempenho?.length || 0, 'registros');

    // Teste 2: Buscar cmv_semanal
    console.log('Teste 2: Buscando cmv_semanal...');
    const { data: cmv } = await supabase
      .from('cmv_semanal')
      .select('semana')
      .eq('bar_id', bar_id)
      .eq('ano', ano)
      .eq('semana', semana)
      .limit(1);
    console.log('Teste 2: OK -', cmv?.length || 0, 'registros');

    // Teste 3: Buscar nibo_agendamentos
    console.log('Teste 3: Buscando nibo_agendamentos...');
    const { data: nibo } = await supabase
      .from('nibo_agendamentos')
      .select('id')
      .eq('bar_id', bar_id)
      .limit(1);
    console.log('Teste 3: OK -', nibo?.length || 0, 'registros');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Teste minimal concluído',
        bar_id,
        semana,
        ano
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
