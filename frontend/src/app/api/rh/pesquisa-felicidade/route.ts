import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Pesquisa da Felicidade — dados agregados por SETOR (a pesquisa é anônima,
 * nunca houve resposta individual).
 *
 * Três séries independentes, todas vindas da planilha "Indicadores - RH" do bar
 * via `google-sheets-sync` (action `pesquisa-felicidade`):
 *  - semanal: uma linha por (data, setor)
 *  - mensal: consolidado do mês, que NÃO é a média das semanas (a planilha pondera
 *    por quórum), por isso vem de tabela própria em vez de ser recalculado aqui
 *  - marca empregadora: NPS mensal, série solta
 *
 * Os percentuais são a escala da planilha (tipo eNPS: %favorável - %desfavorável),
 * então valor NEGATIVO é legítimo e a tela precisa saber disso.
 */

const DIMENSOES = [
  { key: 'eu_comigo_engajamento', label: 'Engajamento', pergunta: 'Eu comigo' },
  { key: 'eu_com_empresa_pertencimento', label: 'Pertencimento', pergunta: 'Eu com a empresa' },
  { key: 'eu_com_colega_relacionamento', label: 'Relacionamento', pergunta: 'Eu com meu colega' },
  { key: 'eu_com_gestor_lideranca', label: 'Liderança', pergunta: 'Eu com meu gestor' },
  { key: 'justica_reconhecimento', label: 'Reconhecimento', pergunta: 'Justiça e reconhecimento' },
] as const;

const num = (v: any): number | null => (v === null || v === undefined ? null : Number(v));

/** GET /api/rh/pesquisa-felicidade?setor=&meses=12 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const setorFiltro = (sp.get('setor') || '').trim();
  const meses = Math.min(Math.max(Number(sp.get('meses')) || 12, 1), 60);

  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);
  const desdeISO = desde.toISOString().slice(0, 10);

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  let qSemanal = hr('pesquisa_felicidade').select('*').eq('bar_id', user.bar_id).gte('data_pesquisa', desdeISO);
  if (setorFiltro) qSemanal = qSemanal.eq('setor', setorFiltro);

  const [semanalRes, mensalRes, marcaRes, setoresRes] = await Promise.all([
    qSemanal.order('data_pesquisa', { ascending: true }),
    hr('pesquisa_felicidade_mensal').select('*').eq('bar_id', user.bar_id)
      .order('ano', { ascending: true }).order('mes', { ascending: true }),
    hr('marca_empregadora').select('*').eq('bar_id', user.bar_id)
      .order('ano', { ascending: true }).order('mes', { ascending: true }),
    hr('pesquisa_felicidade').select('setor').eq('bar_id', user.bar_id),
  ]);

  if (semanalRes.error) {
    return NextResponse.json({ error: semanalRes.error.message }, { status: 500 });
  }

  const semanal = (semanalRes.data || []).map((r: any) => ({
    data_pesquisa: r.data_pesquisa,
    setor: r.setor,
    quorum: r.quorum,
    media_geral: num(r.media_geral),
    resultado_percentual: num(r.resultado_percentual),
    ...Object.fromEntries(DIMENSOES.map(d => [d.key, num(r[d.key])])),
  }));

  const mensalFiltrado = (mensalRes.data || []).filter((r: any) => !setorFiltro || r.setor === setorFiltro);
  const mensal = mensalFiltrado.map((r: any) => ({
    ano: r.ano,
    mes: r.mes,
    periodo: `${String(r.mes).padStart(2, '0')}/${r.ano}`,
    setor: r.setor,
    media_geral: num(r.media_geral),
    resultado_percentual: num(r.resultado_percentual),
    ...Object.fromEntries(DIMENSOES.map(d => [d.key, num(r[d.key])])),
  }));

  const marca_empregadora = (marcaRes.data || []).map((r: any) => ({
    ano: r.ano,
    mes: r.mes,
    periodo: `${String(r.mes).padStart(2, '0')}/${r.ano}`,
    quorum: r.quorum,
    resultado_percentual: num(r.resultado_percentual),
  }));

  // Setores disponíveis pro filtro. "TODOS" é o agregado da própria planilha —
  // não é um setor, e por isso encabeça a lista em vez de ficar na ordem alfabética.
  const setores = Array.from(new Set<string>((setoresRes.data || []).map((r: any) => String(r.setor))))
    .sort((a, b) => (a === 'TODOS' ? -1 : b === 'TODOS' ? 1 : a.localeCompare(b, 'pt-BR')));

  // Últimas pesquisas do recorte "TODOS" — é o número que a diretoria olha.
  const serieTodos = semanal.filter((r: any) => r.setor === 'TODOS');
  const ultima = serieTodos.length ? serieTodos[serieTodos.length - 1] : null;
  const penultima = serieTodos.length > 1 ? serieTodos[serieTodos.length - 2] : null;

  return NextResponse.json({
    dimensoes: DIMENSOES,
    setores,
    semanal,
    mensal,
    marca_empregadora,
    resumo: {
      ultima,
      variacao: ultima?.resultado_percentual != null && penultima?.resultado_percentual != null
        ? Number((ultima.resultado_percentual - penultima.resultado_percentual).toFixed(2))
        : null,
      total_pesquisas: serieTodos.length,
    },
  });
}
