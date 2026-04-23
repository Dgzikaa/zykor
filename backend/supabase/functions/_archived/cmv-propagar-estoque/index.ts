/**
 * 🔄 CMV - Propagar Estoque Inicial
 * 
 * Edge Function para aplicar a regra contábil obrigatória:
 * Estoque Inicial da semana N = Estoque Final da semana N-1
 * 
 * Útil para corrigir histórico quando os estoques ficaram desalinhados.
 * 
 * @version 1.0.0
 * @date 2026-04-02
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';



interface PropagacaoRequest {
  bar_id?: number;
  ano?: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: PropagacaoRequest = await req.json().catch(() => ({}));
    const { bar_id, ano } = body;

    console.log('🔄 Propagação de Estoque Inicial - Iniciando', { bar_id, ano });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Buscar bares ativos
    let baresAtivos: number[] = [3, 4];
    if (!bar_id) {
      const { data: baresData } = await supabase
        .from('bares')
        .select('id')
        .eq('ativo', true)
        .order('id');
      
      if (baresData && baresData.length > 0) {
        baresAtivos = baresData.map((b: { id: number }) => b.id);
      }
    }

    const bares = bar_id ? [bar_id] : baresAtivos;
    let totalPropagacoes = 0;

    for (const barId of bares) {
      console.log(`\n🍺 Processando bar_id: ${barId}`);

      // Buscar todas as semanas do bar ordenadas
      let query = supabase
        .from('cmv_semanal')
        .select('id, ano, semana, estoque_final, estoque_final_cozinha, estoque_final_bebidas, estoque_final_drinks, estoque_final_funcionarios')
        .eq('bar_id', barId)
        .order('ano', { ascending: true })
        .order('semana', { ascending: true });

      if (ano) {
        query = query.eq('ano', ano);
      }

      const { data: semanas } = await query;

      if (!semanas || semanas.length < 2) {
        console.log(`  ⚠️ Menos de 2 semanas encontradas para bar ${barId}`);
        continue;
      }

      console.log(`  📅 ${semanas.length} semanas encontradas`);

      // Propagar estoque inicial para cada semana (exceto a primeira)
      for (let i = 1; i < semanas.length; i++) {
        const semanaAtual = semanas[i];
        const semanaAnterior = semanas[i - 1];

        // Verificar se é sequencial dentro do mesmo ano
        const isSequencial = 
          (semanaAtual.ano === semanaAnterior.ano && semanaAtual.semana === semanaAnterior.semana + 1) ||
          (semanaAtual.ano === semanaAnterior.ano + 1 && semanaAtual.semana === 1 && semanaAnterior.semana >= 52);

        if (!isSequencial) {
          console.log(`  ⚠️ Semanas não sequenciais: S${semanaAnterior.semana}/${semanaAnterior.ano} → S${semanaAtual.semana}/${semanaAtual.ano}`);
          continue;
        }

        // Propagar
        const { error: propError } = await supabase
          .from('cmv_semanal')
          .update({
            estoque_inicial: semanaAnterior.estoque_final || 0,
            estoque_inicial_cozinha: semanaAnterior.estoque_final_cozinha || 0,
            estoque_inicial_bebidas: semanaAnterior.estoque_final_bebidas || 0,
            estoque_inicial_drinks: semanaAnterior.estoque_final_drinks || 0,
            estoque_inicial_funcionarios: semanaAnterior.estoque_final_funcionarios || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', semanaAtual.id);

        if (propError) {
          console.error(`  ❌ Erro S${semanaAtual.semana}/${semanaAtual.ano}:`, propError.message);
        } else {
          totalPropagacoes++;
          console.log(`  ✅ S${semanaAtual.semana}/${semanaAtual.ano}: inicial = R$ ${(semanaAnterior.estoque_final || 0).toFixed(2)}`);
        }
      }
    }

    console.log(`\n✅ Total: ${totalPropagacoes} propagações realizadas`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Propagação concluída: ${totalPropagacoes} semanas atualizadas`,
        total_propagacoes: totalPropagacoes,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro ao propagar estoque:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
