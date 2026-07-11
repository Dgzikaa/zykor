/**
 * Briefing diário do dono — monta o "placar de ontem + 1 ponto de atenção" de cada bar
 * para disparo por WhatsApp (via dispatchNotification, canal whatsapp / template zykor_alerta).
 *
 * Cabe no template atual (2 variáveis, SEM quebra de linha): título + uma linha de detalhe.
 * Quando o template rico (multi-linha) for aprovado pela Meta, só o formatter muda.
 *
 * Fontes:
 *  - Placar do dia: operations.eventos_base (real_r = realizado, m1_r = meta do dia, cl_real).
 *    1 evento = 1 dia. Bar fechado (ex.: Deboche segunda) vem com real_r NULL → briefing pulado.
 *  - Ponto de atenção: gold.desempenho (mensal) reusando a MESMA régua da home
 *    ([[project_home_orgulho_atencao_indicadores]]) — nível-mês, não diário.
 *
 * Separado em (a) formatter PURO e testável e (b) montagem que lê o banco.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { calcularDestaques, type LinhaDesempenho } from '@/lib/home/indicadores';

export interface BriefingBar {
  barId: number;
  nome: string;
}

/** Bares cobertos pelo briefing. Primo (5) pode entrar depois de confirmar que tem dados. */
export const BARES_BRIEFING: BriefingBar[] = [
  { barId: 3, nome: 'Ordinário' },
  { barId: 4, nome: 'Deboche' },
];

export interface PlacarDia {
  real: number;
  meta: number | null;
  clientes: number;
  ticket: number | null;
}

export interface BriefingComposto {
  titulo: string;
  mensagem: string;
}

export type MotivoBriefing = 'ok' | 'sem_movimento' | 'dados_defasados';

export interface MontagemBriefing {
  briefing: BriefingComposto | null;
  /** por que (não) montou — para log/observabilidade do cron */
  motivo: MotivoBriefing;
}

/** R$ compacto pt-BR: 86010 → "R$ 86,0k"; 105 → "R$ 105". */
export function fmtBRLk(v: number): string {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`;
  return `R$ ${Math.round(v)}`;
}

/** yyyy-mm-dd → dd/mm */
function fmtDataCurta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/**
 * Monta título + detalhe (uma linha). Retorna null quando não houve movimento no dia
 * (bar fechado / dia futuro) — nesse caso não faz sentido mandar briefing.
 */
export function formatBriefing(
  nomeBar: string,
  hojeISO: string,
  placar: PlacarDia | null,
  atencao: { label: string; valorTexto: string } | null
): BriefingComposto | null {
  if (!placar || placar.real <= 0 || placar.clientes <= 0) return null;

  const titulo = `☕ Bom dia — ${nomeBar} · ${fmtDataCurta(hojeISO)}`;

  let placarTxt = `Ontem ${fmtBRLk(placar.real)}`;
  if (placar.meta && placar.meta > 0) {
    const pct = Math.round((placar.real / placar.meta) * 100);
    placarTxt += ` (${pct}% da meta${pct >= 100 ? ' ✅' : ''})`;
  }
  placarTxt += ` · ${placar.clientes} clientes`;
  if (placar.ticket && placar.ticket > 0) placarTxt += ` · ticket ${fmtBRLk(placar.ticket)}`;

  const partes = [placarTxt + '.'];
  if (atencao) partes.push(`⚠️ ${atencao.label}: ${atencao.valorTexto}.`);

  return { titulo, mensagem: partes.join(' ') };
}

/** Data (yyyy-mm-dd) em BRT (UTC-3 fixo) a partir de um timestamptz ISO. */
function dataBRT(tsISO: string): string {
  return new Date(new Date(tsISO).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Lê o banco e monta o briefing de um bar para um dia (ontem).
 *
 * Guarda de frescor: só monta o placar se o `real_r` de ontem foi RECALCULADO HOJE
 * (`calculado_em` = hoje BRT) e não está pendente (`precisa_recalculo = false`). O recálculo
 * roda ~08:45 BRT; sem essa guarda, disparar cedo mandaria número defasado/subestimado.
 * `motivo` distingue "bar fechado" de "dados ainda não consolidaram" para o log do cron.
 */
export async function montarBriefingBar(
  supabase: SupabaseClient,
  bar: BriefingBar,
  hojeISO: string,
  ontemISO: string
): Promise<MontagemBriefing> {
  // Placar de ontem
  const { data: evRows } = await supabase
    .schema('operations')
    .from('eventos_base')
    .select('real_r, m1_r, cl_real, precisa_recalculo, calculado_em')
    .eq('bar_id', bar.barId)
    .eq('data_evento', ontemISO)
    .limit(1);

  const ev = evRows?.[0] as
    | { real_r: number | null; m1_r: number | null; cl_real: number | null; precisa_recalculo: boolean | null; calculado_em: string | null }
    | undefined;

  const teveMovimento = !!(ev && ev.real_r != null && Number(ev.real_r) > 0);
  if (!teveMovimento) return { briefing: null, motivo: 'sem_movimento' };

  const fresco =
    ev!.precisa_recalculo === false && !!ev!.calculado_em && dataBRT(ev!.calculado_em) === hojeISO;
  if (!fresco) return { briefing: null, motivo: 'dados_defasados' };

  const real = Number(ev!.real_r);
  const clientes = Number(ev!.cl_real ?? 0);
  const placar: PlacarDia = {
    real,
    meta: ev!.m1_r != null ? Number(ev!.m1_r) : null,
    clientes,
    ticket: clientes > 0 ? real / clientes : null,
  };

  // Ponto de atenção do mês (mesma régua da home)
  const { data: mensalRows } = await supabase
    .schema('gold')
    .from('desempenho')
    .select(
      'nps_geral, nps_respostas, media_avaliacoes_google, google_reviews_total, ' +
        'reservas_quebra_pct, atrasos_cozinha_perc, atrasos_bar_perc, stockout_total_perc, ' +
        'nota_felicidade_equipe, retencao_1m'
    )
    .eq('bar_id', bar.barId)
    .eq('granularidade', 'mensal')
    .order('data_fim', { ascending: false })
    .limit(1);

  const destaques = calcularDestaques((mensalRows?.[0] ?? null) as unknown as LinhaDesempenho | null);
  const at = destaques.atencao[0]
    ? { label: destaques.atencao[0].label, valorTexto: destaques.atencao[0].valorTexto }
    : null;

  const briefing = formatBriefing(bar.nome, hojeISO, placar, at);
  return { briefing, motivo: briefing ? 'ok' : 'sem_movimento' };
}
