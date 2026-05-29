/**
 * 🎯 Executar Campanhas Clube (H2)
 *
 * Roda diário. Pra cada campanha ativa:
 *   1. Busca membros do Clube que casam com a regra (segmento + nivel + dias_inativo)
 *   2. Aplica cooldown (não duplicar disparo pro mesmo cliente em N dias)
 *   3. Renderiza mensagem
 *   4. Insere em crm.campanhas_execucoes com status 'sugerida'
 *
 * NÃO envia WhatsApp/IG. Só registra sugestão pra equipe trabalhar.
 *
 * Body: { campanha_id? } - se omitido roda todas ativas.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

function renderTemplate(tpl: string, vars: Record<string, any>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const campanhaId: number | undefined = body?.campanha_id;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let q = supabase.schema('crm').from('campanhas').select('*').eq('ativo', true);
    if (campanhaId) q = q.eq('id', campanhaId);
    const { data: campanhas } = await q;

    const resultados: any[] = [];

    for (const c of (campanhas ?? [])) {
      // Membros candidatos
      let qm = supabase.schema('crm').from('clube_ordi_membros')
        .select('cliente_fone_norm, cliente_nome, nivel, dias_inativo, valor_total_consumo, ultima_visita, segmento')
        .eq('bar_id', c.bar_id)
        .eq('segmento', c.segmento_alvo);
      if (c.niveis_alvo?.length) qm = qm.in('nivel', c.niveis_alvo);
      if (c.dias_inativo_min) qm = qm.gte('dias_inativo', c.dias_inativo_min);
      if (c.dias_inativo_max) qm = qm.lte('dias_inativo', c.dias_inativo_max);

      const { data: candidatos } = await qm
        .order('valor_total_consumo', { ascending: false })
        .limit(c.max_por_execucao || 50);

      let inseridos = 0;
      let cooldown_skip = 0;

      for (const m of (candidatos ?? [])) {
        // Checar cooldown
        const cooldownDate = new Date(Date.now() - (c.cooldown_dias || 30) * 86400000).toISOString();
        const { count } = await supabase.schema('crm').from('campanhas_execucoes')
          .select('id', { count: 'exact', head: true })
          .eq('campanha_id', c.id)
          .eq('cliente_fone_norm', m.cliente_fone_norm)
          .gte('criado_em', cooldownDate);

        if ((count ?? 0) > 0) { cooldown_skip++; continue; }

        const mensagem = renderTemplate(c.mensagem_template || '', {
          nome: (m.cliente_nome || '').split(' ')[0] || 'amigo',
          nivel: m.nivel,
          dias_inativo: m.dias_inativo,
          ultima_visita: m.ultima_visita,
          voucher_pct: c.voucher_pct,
        });

        await supabase.schema('crm').from('campanhas_execucoes').insert({
          campanha_id: c.id, bar_id: c.bar_id,
          cliente_fone_norm: m.cliente_fone_norm,
          cliente_nome: m.cliente_nome,
          cliente_nivel: m.nivel,
          dias_inativo: m.dias_inativo,
          valor_total_consumo: m.valor_total_consumo,
          mensagem_renderizada: mensagem,
          status: 'sugerida',
        });
        inseridos++;
      }

      resultados.push({
        campanha_id: c.id, nome: c.nome, bar_id: c.bar_id,
        candidatos: candidatos?.length ?? 0,
        inseridos, cooldown_skip,
      });
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
