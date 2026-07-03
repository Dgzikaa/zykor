import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Dados da HOME (welcome hub, para todos os papéis): mural de recados, orgulho da casa
 * (NPS/Google/clientes) e a atração do dia. Leve — uma chamada só, tudo de camadas prontas.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = user.bar_id;
  const supabase = await getAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const anoAtual = new Date().getUTCFullYear();

  // --- Mural: recados ativos do bar selecionado (ou globais, bar_id null) ---
  const muralP = supabase
    .schema('operations')
    .from('mural_avisos')
    .select('id, bar_id, autor_nome, mensagem, fixado, criado_em')
    .eq('ativo', true)
    .or(`bar_id.eq.${barId},bar_id.is.null`)
    .order('fixado', { ascending: false })
    .order('criado_em', { ascending: false })
    .limit(8);

  // --- Orgulho: NPS do último mês fechado (desempenho mensal), nota Google, clientes no ano ---
  const npsP = supabase
    .schema('gold')
    .from('desempenho')
    .select('nps_geral, nps_respostas, data_fim')
    .eq('bar_id', barId)
    .eq('granularidade', 'mensal')
    .not('nps_geral', 'is', null)
    .order('data_fim', { ascending: false })
    .limit(1);

  const goldP = supabase
    .schema('gold')
    .from('desempenho')
    .select('media_avaliacoes_google, google_reviews_total, clientes_atendidos, ano, granularidade, data_fim')
    .eq('bar_id', barId)
    .eq('granularidade', 'semanal')
    .eq('ano', anoAtual);

  // --- Atração do dia: evento de hoje; se não houver, o próximo ---
  const atracaoP = supabase
    .schema('operations')
    .from('eventos_base')
    .select('data_evento, dia_semana, nome, nome_evento, artista')
    .eq('bar_id', barId)
    .gte('data_evento', hoje)
    .order('data_evento', { ascending: true })
    .limit(1);

  const [mural, nps, gold, atracao] = await Promise.all([muralP, npsP, goldP, atracaoP]);

  // NPS do último mês fechado (desempenho mensal)
  let npsScore: number | null = null;
  let npsRespostas = 0;
  let npsMes: string | null = null;
  if (nps.data?.length) {
    const m = nps.data[0];
    npsScore = Math.round(Number(m.nps_geral));
    npsRespostas = Number(m.nps_respostas || 0);
    npsMes = m.data_fim || null;
  }

  // Google: pega a última linha com nota
  let google: { nota: number; total: number } | null = null;
  let clientesAno = 0;
  if (gold.data?.length) {
    const ordered = [...gold.data].sort((a, b) => (a.data_fim < b.data_fim ? 1 : -1));
    const comNota = ordered.find((r) => Number(r.media_avaliacoes_google) > 0);
    if (comNota) google = { nota: Number(comNota.media_avaliacoes_google), total: Number(comNota.google_reviews_total || 0) };
    clientesAno = gold.data.reduce((s, r) => s + Number(r.clientes_atendidos || 0), 0);
  }

  const ev = atracao.data?.[0];
  const atracaoDia = ev
    ? {
        titulo: ev.nome || ev.nome_evento || 'Evento',
        artista: ev.artista || null,
        data: ev.data_evento,
        dia_semana: ev.dia_semana || null,
        eh_hoje: ev.data_evento === hoje,
      }
    : null;

  return NextResponse.json({
    success: true,
    mural: mural.data || [],
    orgulho: {
      nps: npsScore,
      nps_respostas: npsRespostas,
      nps_mes: npsMes,
      google,
      clientes_ano: clientesAno,
      ano: anoAtual,
    },
    atracao: atracaoDia,
  });
}
