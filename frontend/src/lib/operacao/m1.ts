import type { SupabaseClient } from '@supabase/supabase-js';
import { recalcularDias } from './recalcular';

const ops = (c: SupabaseClient) => (c as any).schema('operations');

/**
 * Faturamento do plano operacional vindo do M1 do planejamento comercial.
 *
 * Era 100% digitado, e digitado DE NOVO: o M1 já existe por dia em `eventos_base.m1_r`.
 * Além do retrabalho, as duas fontes divergiam — a semana de 03/08 tinha R$ 255.000
 * digitados contra R$ 293.547 de M1, 15% a mais, o que muda público, headcount e freela.
 *
 * O M1 entra como o lado CALCULADO do par calculado × manual que a tela toda já usa:
 * grava em `faturamento_m1`, e `faturamento_previsto` (coluna gerada) é
 * `coalesce(faturamento_manual, faturamento_m1)`. Digitar sobrepõe; apagar volta pro M1.
 *
 * SÁBADO é o único caso chato: o plano parte o dia em turno dia/noite (duas equipes, dois
 * custos) e o M1 é um número só por data. A proporção não é fixa — 08/08 foi 40k/30k e
 * 15/08 foi 8k/45k — então não dá pra cravar uma constante; ver `proporcaoSabado`.
 */

const MEIO_A_MEIO = 0.5;

/**
 * Quanto do sábado é do turno DIA.
 *
 * 1. Se o próprio sábado já foi planejado nos dois turnos, respeita a proporção dele —
 *    quem digitou 8k/45k sabia que aquele sábado tinha um evento à noite.
 * 2. Senão, usa a MEDIANA dos sábados anteriores que têm os dois turnos preenchidos.
 *    Mediana e não média: um sábado atípico (40k de dia, festival) não pode puxar a régua.
 * 3. Sem histórico nenhum, meio a meio — e aí a tela mostra amarelo pra alguém corrigir.
 */
function proporcaoSabado(
  manualDia: number | null, manualNoite: number | null, historico: number[],
): number {
  const soma = (manualDia ?? 0) + (manualNoite ?? 0);
  if (manualDia != null && manualNoite != null && soma > 0) return (manualDia ?? 0) / soma;
  if (historico.length) {
    const ord = [...historico].sort((a, b) => a - b);
    const meio = Math.floor(ord.length / 2);
    return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
  }
  return MEIO_A_MEIO;
}

/**
 * Puxa o M1 do período para `operacao_dia.faturamento_m1` e recalcula o que mudou.
 *
 * Só recalcula os dias em que o faturamento EFETIVO mudou: dia com valor digitado não
 * muda nada (o manual continua ganhando), então gravar M1 nele é registro, não recálculo.
 */
export async function sincronizarM1(
  client: SupabaseClient, barId: number, de: string, ate: string,
): Promise<{ dias_com_m1: number; recalculados: number; sem_m1: string[] }> {
  const c = ops(client);

  const [{ data: dias }, { data: eventos }] = await Promise.all([
    c.from('operacao_dia')
      .select('id, data, turno, faturamento_manual, faturamento_m1, faturamento_previsto, ticket_medio_manual, giro_manual, publico_manual, pico_manual')
      .eq('bar_id', barId).gte('data', de).lte('data', ate).order('data'),
    (client as any).from('eventos_base').select('data_evento, m1_r')
      .eq('bar_id', barId).gte('data_evento', de).lte('data_evento', ate),
  ]);
  if (!dias?.length) return { dias_com_m1: 0, recalculados: 0, sem_m1: [] };

  const m1PorData = new Map<string, number>();
  (eventos || []).forEach((e: any) => {
    if (e.m1_r == null) return;
    // mais de um evento no mesmo dia soma — é a receita planejada da data
    m1PorData.set(e.data_evento, (m1PorData.get(e.data_evento) || 0) + Number(e.m1_r));
  });

  // histórico de proporção do sábado, dos dias que já têm os dois turnos digitados
  const { data: sabados } = await c.from('operacao_dia')
    .select('data, turno, faturamento_manual')
    .eq('bar_id', barId).lte('data', ate).gte('data', '2026-01-01')
    .in('turno', ['dia', 'noite']).not('faturamento_manual', 'is', null);
  const porSabado = new Map<string, { dia?: number; noite?: number }>();
  (sabados || []).forEach((s: any) => {
    const at = porSabado.get(s.data) || {};
    (at as any)[s.turno] = Number(s.faturamento_manual);
    porSabado.set(s.data, at);
  });
  const historico: number[] = [];
  porSabado.forEach(v => {
    const soma = (v.dia ?? 0) + (v.noite ?? 0);
    if (v.dia != null && v.noite != null && soma > 0) historico.push(v.dia / soma);
  });

  // agrupa por data pra saber quem está partido em dois turnos
  const porData = new Map<string, any[]>();
  dias.forEach((d: any) => {
    if (!porData.has(d.data)) porData.set(d.data, []);
    porData.get(d.data)!.push(d);
  });

  const updates: any[] = [];
  const mudaramEfetivo: any[] = [];
  const semM1: string[] = [];

  porData.forEach((linhas, data) => {
    const m1 = m1PorData.get(data);
    if (m1 == null) { semM1.push(data); return; }

    const alvo = new Map<string, number>();
    if (linhas.length === 1) {
      alvo.set(linhas[0].turno, m1);
    } else {
      const dDia = linhas.find(l => l.turno === 'dia');
      const dNoite = linhas.find(l => l.turno === 'noite');
      const pctDia = proporcaoSabado(
        dDia?.faturamento_manual == null ? null : Number(dDia.faturamento_manual),
        dNoite?.faturamento_manual == null ? null : Number(dNoite.faturamento_manual),
        historico,
      );
      if (dDia) alvo.set('dia', Math.round(m1 * pctDia * 100) / 100);
      if (dNoite) alvo.set('noite', Math.round(m1 * (1 - pctDia) * 100) / 100);
    }

    for (const l of linhas) {
      const novo = alvo.get(l.turno);
      if (novo == null) continue;
      const antigo = l.faturamento_m1 == null ? null : Number(l.faturamento_m1);
      if (antigo != null && Math.abs(antigo - novo) < 0.01) continue;

      updates.push({ bar_id: barId, data: l.data, turno: l.turno, faturamento_m1: novo });
      // o efetivo só muda se não houver valor digitado por cima
      if (l.faturamento_manual == null) {
        mudaramEfetivo.push({ ...l, faturamento_previsto: novo });
      }
    }
  });

  if (updates.length) {
    const { error } = await c.from('operacao_dia').upsert(updates, { onConflict: 'bar_id,data,turno' });
    if (error) throw new Error(`Não gravou o M1: ${error.message}`);
  }
  const rec = await recalcularDias(client, barId, mudaramEfetivo);

  return { dias_com_m1: updates.length, recalculados: rec.dias, sem_m1: semM1 };
}
