/**
 * Motor de avaliação do construtor de alertas no-code.
 *
 * Lê as condições ativas (system.alert_conditions), mede o SINAL de cada uma,
 * compara com o limite/operador e, se bater, dispara pelo dispatchNotification —
 * respeitando COOLDOWN (system.alert_condition_fires) pra não repetir o mesmo
 * alerta a cada rodada. Server-only. Best-effort: uma condição que falha não
 * derruba as outras.
 *
 * Um sinal pode retornar VÁRIAS medidas (ex: "estoque abaixo do mínimo" acha N
 * insumos) — cada uma com seu alvoKey (cooldown independente).
 *
 * Chamado pelo cron (/api/configuracoes/cron/avaliar-alertas) e pelo "testar agora".
 * Pra implementar um sinal novo: acrescente um case em `medirSinal`.
 */
import { getAdminClient } from '@/lib/supabase-admin';
import { getSignal, compara, OPERADORES, type Operador } from './signals';
import { dispatchNotification } from './dispatch';
import type { Severidade, Canal } from './catalog';

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
  canais: Canal[];
  target_roles: string[];
  target_user_ids: string[];
  cooldown_horas: number;
}

interface Medida {
  valor: number;
  /** chave da entidade medida (ex: data do dia, "insumo:i0123") — cooldown por alvo */
  alvoKey: string;
  /** valor formatado pra mensagem */
  descricaoValor: string;
}

function br(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Mede o(s) valor(es) atual(is) de um sinal. Retorna [] se sem dado / não implementado.
 * Sinais com `usaLimite=false` (ex: estoque<mínimo) já retornam SÓ os que bateram.
 */
async function medirSinal(
  supabase: any,
  barId: number,
  cond: ConditionRow
): Promise<Medida[]> {
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
      if (!row) return [];
      const v = Number(row.faturamento_liquido_r) || 0;
      return [{ valor: v, alvoKey: String(row.dt_gerencial), descricaoValor: `R$ ${br(v)}` }];
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
      if (!row) return [];
      const v = Number(row.nps_score) || 0;
      return [{ valor: v, alvoKey: String(row.data_referencia), descricaoValor: `NPS ${br(v)}` }];
    }

    case 'estoque_insumo_min': {
      // já vem filtrado (estoque < mínimo) — cada linha é um HIT
      const { data } = await supabase.schema('gold').rpc('fn_insumos_abaixo_minimo', {
        p_bar: barId,
      });
      return ((data ?? []) as Array<any>).map((r) => ({
        valor: Number(r.estoque_final) || 0,
        alvoKey: `insumo:${r.insumo_codigo}`,
        descricaoValor: `${r.insumo_nome} — ${br(Number(r.estoque_final) || 0)} (mín ${br(Number(r.estoque_min) || 0)})`,
      }));
    }

    case 'estoque_insumo': {
      const alvo = cond.alvo_id;
      if (!alvo) return [];
      const { data } = await supabase
        .schema('silver')
        .from('estoque_contagem')
        .select('insumo_codigo, insumo_nome, estoque_final, data_contagem')
        .eq('bar_id', barId)
        .eq('insumo_codigo', alvo)
        .order('data_contagem', { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (!row) return [];
      const v = Number(row.estoque_final) || 0;
      return [
        {
          valor: v,
          alvoKey: `insumo:${alvo}`,
          descricaoValor: `${row.insumo_nome || cond.alvo_label || alvo} — ${br(v)}`,
        },
      ];
    }

    case 'stockout_dia': {
      const { data } = await supabase
        .schema('silver')
        .from('stockout_execucao_log')
        .select('data_consulta, percentual_stockout, status, executado_em')
        .eq('bar_id', barId)
        .order('executado_em', { ascending: false })
        .limit(8);
      const row = ((data ?? []) as Array<any>).find(
        (r) => r.percentual_stockout != null && !String(r.status || '').toLowerCase().startsWith('erro')
      );
      if (!row) return [];
      // guarda de recência: só usa se o cálculo é dos últimos 3 dias (senão é stale → não alerta)
      const dias = (Date.now() - new Date(row.data_consulta).getTime()) / 86_400_000;
      if (dias > 3) return [];
      const v = Number(row.percentual_stockout) || 0;
      return [{ valor: v, alvoKey: String(row.data_consulta), descricaoValor: `${br(v)}% em ${row.data_consulta}` }];
    }

    case 'desvio_consumo': {
      const fim = new Date().toISOString().slice(0, 10);
      const ini = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase.schema('gold').rpc('fn_desvios', {
        p_bar: barId,
        p_ini: ini,
        p_fim: fim,
      });
      const total = ((data ?? []) as Array<any>).reduce(
        (s, r) => s + Math.abs(Number(r.desvio_rs) || 0),
        0
      );
      return [{ valor: total, alvoKey: `${ini}_${fim}`, descricaoValor: `R$ ${br(total)} (7 dias)` }];
    }

    case 'pipeline_parado': {
      // v_data_freshness (schema public) — status 'atrasado' | 'sem_dados' = problema
      const { data } = await supabase
        .from('v_data_freshness')
        .select('pipeline_name, horas_atras, sla_horas_max, status, bar_id')
        .in('status', ['atrasado', 'sem_dados']);
      return ((data ?? []) as Array<any>)
        .filter((r) => r.bar_id == null || Number(r.bar_id) === barId)
        .map((r) => ({
          valor: Number(r.horas_atras) || 0,
          alvoKey: `pipe:${r.pipeline_name}`,
          descricaoValor: `${r.pipeline_name} — ${br(Number(r.horas_atras) || 0)}h sem dado (SLA ${br(Number(r.sla_horas_max) || 0)}h)`,
        }));
    }

    default:
      return []; // sinal ainda não implementado no motor
  }
}

export interface AvaliacaoResultado {
  avaliadas: number;
  disparadas: number;
  detalhes: Array<{
    condId: string;
    signal: string;
    bateu: boolean;
    disparou: boolean;
    hits?: number;
    motivo?: string;
  }>;
}

/**
 * Avalia todas as condições ativas de um bar. Se `soCondId`, avalia só aquela
 * (usado pelo "testar agora"). `ignorarCooldown` dispara mesmo em cooldown (teste);
 * quando `teste` também é true, NÃO grava o cooldown.
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
      const medidas = await medirSinal(supabase, barId, cond);
      const limite = cond.limite != null ? Number(cond.limite) : 0;
      let hits = 0;

      for (const medida of medidas) {
        // usaLimite=false → o sinal já filtrou (todo retorno é hit). Senão, compara.
        const bateu = sig.usaLimite ? compara(medida.valor, cond.operador, limite) : true;
        if (!bateu) continue;

        const alvoKey = medida.alvoKey || cond.alvo_id || '';

        // cooldown por (condição, alvo)
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
            if (horas < (cond.cooldown_horas || 12)) continue; // ainda em cooldown
          }
        }

        const simbolo = OPERADORES[cond.operador]?.simbolo ?? cond.operador;
        const unidade = sig.unidade ? ` ${sig.unidade}` : '';
        const condTxt = sig.usaLimite ? ` (condição: ${simbolo} ${limite}${unidade})` : '';
        const titulo = cond.titulo?.trim() || sig.label;
        const mensagem = `${sig.label}: ${medida.descricaoValor}${condTxt}.`;

        await dispatchNotification({
          barId,
          eventKey: 'condicao_atingida',
          titulo,
          mensagem,
          severidade: cond.severidade,
          url: '/alertas',
          destinatarios: { roles: cond.target_roles, authIds: cond.target_user_ids },
          canais: cond.canais,
          dados: { condicao_id: cond.id, signal: cond.signal_key, valor: medida.valor, alvo: alvoKey },
        });

        if (!(opts.teste && opts.ignorarCooldown)) {
          await supabase
            .schema('system')
            .from('alert_condition_fires')
            .upsert(
              { condition_id: cond.id, alvo_key: alvoKey, last_fired_at: new Date().toISOString() },
              { onConflict: 'condition_id,alvo_key' }
            );
        }

        hits++;
        disparadas++;
      }

      detalhes.push({
        condId: cond.id,
        signal: cond.signal_key,
        bateu: hits > 0,
        disparou: hits > 0,
        hits,
      });
    } catch (e) {
      console.error('[condition-engine] falha ao avaliar condição', cond.id, e);
      detalhes.push({ condId: cond.id, signal: cond.signal_key, bateu: false, disparou: false, motivo: 'erro' });
    }
  }

  return { avaliadas: (conds ?? []).length, disparadas, detalhes };
}
