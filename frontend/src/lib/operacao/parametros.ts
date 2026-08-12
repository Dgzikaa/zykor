import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParametrosOperacao } from './calculo';

/**
 * Parâmetros do plano operacional que valem NA DATA pedida — não os de hoje.
 *
 * A tabela é versionada por vigência de propósito: mudar a diária ou o nível de serviço
 * hoje não pode reescrever o custo projetado de junho. É a mesma lição do preço as-of do
 * CMV teórico — parâmetro que muda retroativamente faz mês fechado mudar sozinho.
 */
export async function parametrosVigentes(
  client: SupabaseClient,
  barId: number,
  data: string,
): Promise<(ParametrosOperacao & { id: string }) | null> {
  const ops = (client as any).schema('operations');

  const { data: p } = await ops.from('operacao_parametro').select('id, giro')
    .eq('bar_id', barId)
    .lte('vigencia_inicio', data)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${data}`)
    .order('vigencia_inicio', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!p) return null;

  const [{ data: tickets }, { data: porFuncao }] = await Promise.all([
    ops.from('operacao_parametro_ticket').select('dia_semana, ticket_medio').eq('parametro_id', p.id),
    ops.from('operacao_parametro_funcao').select('funcao_id, nivel_servico, diaria').eq('parametro_id', p.id),
  ]);

  return {
    id: p.id,
    giro: Number(p.giro),
    ticket_por_dia_semana: Object.fromEntries(
      (tickets || []).map((t: any) => [Number(t.dia_semana), Number(t.ticket_medio)]),
    ),
    por_funcao: Object.fromEntries(
      (porFuncao || []).map((f: any) => [f.funcao_id, {
        nivel_servico: f.nivel_servico === null ? null : Number(f.nivel_servico),
        diaria: f.diaria === null ? null : Number(f.diaria),
      }]),
    ),
  };
}
