import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { calcularDestaques, type LinhaDesempenho } from '@/lib/home/indicadores';

export const dynamic = 'force-dynamic';

/**
 * Dados da HOME (welcome hub, para todos os papéis): mural de recados, destaques do mês
 * (Orgulho da Casa + Pontos de Atenção, calculados por régua inteligente sobre o último
 * mês do gold.desempenho) e a atração do dia. Leve — tudo de camadas prontas.
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

  // --- Último mês (fechado ou em curso): base dos destaques Orgulho/Atenção ---
  const mensalP = supabase
    .schema('gold')
    .from('desempenho')
    .select(
      'nps_geral, nps_respostas, media_avaliacoes_google, google_reviews_total, ' +
      'reservas_quebra_pct, atrasos_cozinha_perc, atrasos_bar_perc, stockout_total_perc, ' +
      'nota_felicidade_equipe, retencao_1m, data_fim'
    )
    .eq('bar_id', barId)
    .eq('granularidade', 'mensal')
    .order('data_fim', { ascending: false })
    .limit(1);

  // --- Clientes atendidos no ano (soma das semanas) ---
  const anoP = supabase
    .schema('gold')
    .from('desempenho')
    .select('clientes_atendidos')
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

  const [mural, mensal, ano, atracao] = await Promise.all([muralP, mensalP, anoP, atracaoP]);

  const destaques = calcularDestaques((mensal.data?.[0] ?? null) as unknown as LinhaDesempenho | null);
  const clientesAno = (ano.data || []).reduce((s, r) => s + Number(r.clientes_atendidos || 0), 0);

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
    destaques,
    clientes_ano: clientesAno,
    ano: anoAtual,
    atracao: atracaoDia,
  });
}
