/**
 * Motor de avaliação do construtor de alertas no-code.
 *
 * Lê as condições ativas (system.alert_conditions), mede o SINAL de cada uma,
 * compara com o limite/operador e, se bater, dispara pelo dispatchNotification —
 * respeitando COOLDOWN (system.alert_condition_fires) pra não repetir o mesmo
 * alerta a cada rodada. Server-only. Best-effort: uma condição que falha não
 * derruba as outras.
 *
 * Chamado pelo cron (/api/crons/avaliar-alertas) e pelo "testar agora" do construtor.
 *
 * Pra implementar um sinal novo: acrescente um case em `medirSinal`.
 */
import { getAdminClient } from '@/lib/supabase-admin';
import { getSignal, compara, OPERADORES, type Operador } from './signals';
import { dispatchNotification } from './dispatch';
import type { Severidade } from './catalog';

interface ConditionRow {
  id: string;
  bar_id: number;
  signal_key: string;
  operador: Operador;
  limite: number | null;
  alvo_id: string | null;
  alvo_label: string | null;
  titulo: string | null;
  severidade: Severidade;
  canais: string[];
  target_roles: string[];
  target_user_ids: string[];
  cooldown_horas: number;
}

interface Medida {
  valor: number;
  /** chave da entidade medida (ex: data do dia) — usada no cooldown p/ não repetir o mesmo */
  alvoKey: string;
  /** valor formatado pra mensagem */
  descricaoValor: string;
}

/** Mede o valor atual de um sinal. Retorna null se sem dado ou sinal não implementado. */
async function medirSinal(
  supabase: any,
  barId: number,
  cond: ConditionRow
): Promise<Medida | null> {
  switch (cond.signal_key) {
    case 'faturamento_dia': {
      const { data } = await supabase
        .schema('silver')
        .from('vendas_diarias')
        .select('dt_gerencial, faturamento_liquido_r')
        .eq('bar_id', barId)
        .order('dt_gerencial', { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (!row) return null;
      const v = Number(row.faturamento_liquido_r) || 0;
      return {
        valor: v,
        alvoKey: String(row.dt_gerencial),
        descricaoValor: `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      };
    }
    case 'nps_semana': {
      const { data } = await supabase
        .schema('silver')
        .from('nps_diario')
        .select('data_referencia, nps_score')
        .eq('bar_id', barId)
        .order('data_referencia', { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (!row) return null;
      const v = Number(row.nps_score) || 0;
      return { valor: v, alvoKey: String(row.data_referencia), descricaoValor: `NPS ${v}` };
    }
    default:
      return null; // sinal ainda não implementado no motor
  }
}

export interface AvaliacaoResultado {
  avaliadas: number;
  disparadas: number;
  detalhes: Array<{
    condId: string;
    signal: string;
    valor?: number;
    bateu: boolean;
    disparou: boolean;
    motivo?: string;
  }>;
}

/**
 * Avalia todas as condições ativas de um bar. Se `soCondId` for passado, avalia só
 * aquela (usado pelo "testar agora"). Se `ignorarCooldown`, dispara mesmo em cooldown
 * (teste manual) — mas NÃO grava o cooldown quando é teste.
 */
export async function avaliarCondicoesDoBar(
  barId: number,
  opts: { soCondId?: string; ignorarCooldown?: boolean; teste?: boolean } = {}
): Promise<AvaliacaoResultado> {
  const supabase = await getAdminClient();
  let q = supabase
    .schema('system')
    .from('alert_conditions')
    .select('*')
    .eq('bar_id', barId)
    .eq('ativo', true);
  if (opts.soCondId) q = q.eq('id', opts.soCondId);
  const { data: conds } = await q;

  const detalhes: AvaliacaoResultado['detalhes'] = [];
  let disparadas = 0;

  for (const cond of (conds ?? []) as ConditionRow[]) {
    const sig = getSignal(cond.signal_key);
    if (!sig) {
      detalhes.push({ condId: cond.id, signal: cond.signal_key, bateu: false, disparou: false, motivo: 'sinal_desconhecido' });
      continue;
    }
    try {
      const medida = await medirSinal(supabase, barId, cond);
      if (!medida) {
        detalhes.push({ condId: cond.id, signal: cond.signal_key, bateu: false, disparou: false, motivo: 'sem_dado' });
        continue;
      }
      const limite = cond.limite != null ? Number(cond.limite) : 0;
      const bateu = compara(medida.valor, cond.operador, limite);
      if (!bateu) {
        detalhes.push({ condId: cond.id, signal: cond.signal_key, valor: medida.valor, bateu: false, disparou: false });
        continue;
      }

      // cooldown: não re-dispara o mesmo (condição, alvo) dentro da janela
      const alvoKey = medida.alvoKey || cond.alvo_id || '';
      if (!opts.ignorarCooldown) {
        const { data: fire } = await supabase
          .schema('system')
          .from('alert_condition_fires')
          .select('last_fired_at')
          .eq('condition_id', cond.id)
          .eq('alvo_key', alvoKey)
          .maybeSingle();
        if (fire?.last_fired_at) {
          const horas = (Date.now() - new Date(fire.last_fired_at).getTime()) / 3_600_000;
          if (horas < (cond.cooldown_horas || 12)) {
            detalhes.push({ condId: cond.id, signal: cond.signal_key, valor: medida.valor, bateu: true, disparou: false, motivo: 'cooldown' });
            continue;
          }
        }
      }

      const simbolo = OPERADORES[cond.operador]?.simbolo ?? cond.operador;
      const unidade = sig.unidade ? ` ${sig.unidade}` : '';
      const titulo = cond.titulo?.trim() || sig.label;
      const mensagem = `${sig.label}: ${medida.descricaoValor} (condição: ${simbolo} ${limite}${unidade}).`;

      await dispatchNotification({
        barId,
        eventKey: 'condicao_atingida',
        titulo,
        mensagem,
        severidade: cond.severidade,
        url: '/alertas',
        destinatarios: { roles: cond.target_roles, authIds: cond.target_user_ids },
        canais: cond.canais as any,
        dados: { condicao_id: cond.id, signal: cond.signal_key, valor: medida.valor, limite },
      });

      // grava cooldown (exceto em teste puro que ignora cooldown)
      if (!(opts.teste && opts.ignorarCooldown)) {
        await supabase
          .schema('system')
          .from('alert_condition_fires')
          .upsert(
            { condition_id: cond.id, alvo_key: alvoKey, last_fired_at: new Date().toISOString() },
            { onConflict: 'condition_id,alvo_key' }
          );
      }

      disparadas++;
      detalhes.push({ condId: cond.id, signal: cond.signal_key, valor: medida.valor, bateu: true, disparou: true });
    } catch (e) {
      console.error('[condition-engine] falha ao avaliar condição', cond.id, e);
      detalhes.push({ condId: cond.id, signal: cond.signal_key, bateu: false, disparou: false, motivo: 'erro' });
    }
  }

  return { avaliadas: (conds ?? []).length, disparadas, detalhes };
}
