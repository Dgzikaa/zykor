import type { SupabaseClient } from '@supabase/supabase-js';
import { recalcularDia } from './calculo';
import { parametrosVigentes } from './parametros';

const ops = (c: SupabaseClient) => (c as any).schema('operations');

/**
 * Recalcula e grava vários dias de uma vez.
 *
 * Existe porque o recálculo passou a ter DOIS gatilhos: a tela (PATCH de um dia) e a
 * sincronização do M1, que muda o faturamento de um mês inteiro de uma vez. Fazer o
 * segundo chamando o primeiro dia a dia seriam ~35 idas ao banco por sincronização.
 *
 * O que grava: `publico_calculado`/`pico_calculado` no dia e `total_calculado` por função.
 * O que NUNCA toca: os campos `_manual` — eles continuam ganhando na leitura, que é o que
 * mantém a célula amarela ("tem automático por trás disso") em vez de virar branca.
 */
export async function recalcularDias(
  client: SupabaseClient,
  barId: number,
  dias: Array<{ id: string; data: string; turno: string; faturamento_previsto: number | string | null;
    ticket_medio_manual?: number | string | null; giro_manual?: number | string | null;
    publico_manual?: number | string | null; pico_manual?: number | string | null }>,
): Promise<{ dias: number; sem_parametro: string[] }> {
  if (!dias.length) return { dias: 0, sem_parametro: [] };
  const c = ops(client);

  const [{ data: funcoes }, { data: existentes }] = await Promise.all([
    c.from('operacao_funcao').select('id').eq('bar_id', barId).eq('ativo', true),
    c.from('operacao_dia_funcao').select('*').in('operacao_dia_id', dias.map(d => d.id)),
  ]);

  const porDiaFuncao = new Map<string, any>();
  (existentes || []).forEach((l: any) => porDiaFuncao.set(`${l.operacao_dia_id}|${l.funcao_id}`, l));

  // a vigência quase nunca muda dentro do período — busca uma vez por data distinta
  const cacheParam = new Map<string, Awaited<ReturnType<typeof parametrosVigentes>>>();
  const semParametro: string[] = [];
  const updDias: any[] = [];
  const updLinhas: any[] = [];
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  for (const d of dias) {
    if (!cacheParam.has(d.data)) cacheParam.set(d.data, await parametrosVigentes(client, barId, d.data));
    const parametros = cacheParam.get(d.data)!;
    if (!parametros) { semParametro.push(d.data); continue; }

    const calc = recalcularDia({
      dataISO: d.data,
      faturamento: num(d.faturamento_previsto),
      ticketManual: num(d.ticket_medio_manual),
      giroManual: num(d.giro_manual),
      publicoManual: num(d.publico_manual),
      picoManual: num(d.pico_manual),
      funcoes: (funcoes || []).map((f: any) => {
        const l = porDiaFuncao.get(`${d.id}|${f.id}`);
        return {
          funcao_id: f.id,
          total_manual: l?.total_manual ?? null,
          fixos_escala: l?.fixos_escala ?? 0,
          fixos_manual: l?.fixos_manual ?? null,
        };
      }),
      parametros,
    });

    updDias.push({
      bar_id: barId, data: d.data, turno: d.turno,
      publico_calculado: calc.publico_calculado,
      pico_calculado: calc.pico_calculado,
    });
    for (const l of calc.funcoes) {
      const ant = porDiaFuncao.get(`${d.id}|${l.funcao_id}`);
      updLinhas.push({
        operacao_dia_id: d.id,
        funcao_id: l.funcao_id,
        total_calculado: l.total_calculado,
        total_manual: ant?.total_manual ?? null,
        fixos_escala: ant?.fixos_escala ?? 0,
        fixos_manual: ant?.fixos_manual ?? null,
        atualizado_em: new Date().toISOString(),
      });
    }
  }

  if (updDias.length) {
    await c.from('operacao_dia').upsert(updDias, { onConflict: 'bar_id,data,turno' });
  }
  if (updLinhas.length) {
    await c.from('operacao_dia_funcao').upsert(updLinhas, { onConflict: 'operacao_dia_id,funcao_id' });
  }

  return { dias: updDias.length, sem_parametro: semParametro };
}
