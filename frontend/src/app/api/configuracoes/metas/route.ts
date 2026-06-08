import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

// Metas vivem em operations.bares.metas (JSONB OBJETO): categoria -> { campo: valor }.
// O bar vem de user.bar_id, que authenticateUser já resolve a partir do header
// x-selected-bar-id (com validação de acesso). Antes esta rota apontava pra uma
// tabela `bars` inexistente e tratava metas como array -> não carregava e, se
// gravasse, zerava tudo. Agora lê/grava o objeto de forma simétrica e segura.

const SEP = '::';

const CATEGORIA_LABEL: Record<string, string> = {
  indicadores_estrategicos: 'Indicadores Estratégicos',
  indicadores_mensais: 'Indicadores Mensais',
  cockpit_vendas: 'Cockpit · Vendas',
  cockpit_produtos: 'Cockpit · Produtos',
  cockpit_financeiro: 'Cockpit · Financeiro',
  cockpit_marketing: 'Cockpit · Marketing',
  indicadores_qualidade: 'Indicadores de Qualidade',
};
const CATEGORIA_ORDER = Object.keys(CATEGORIA_LABEL);

const LABEL: Record<string, string> = {
  quisabdom: 'Qui + Sáb + Dom (R$)',
  venda_balcao: 'Venda Balcão',
  couvert_atracoes: 'Couvert / Atrações',
  percent_faturamento_ate_19h: '% Faturamento até 19h',
  cmv: 'CMV', cmv_rs: 'CMV (R$)', cmv_teorico: 'CMV Teórico (%)',
  cmv_limpo_percent: 'CMV Limpo (%)', cmv_global_real: 'CMV Global Real (%)',
  cmo: 'CMO', cmo_percent: 'CMO (%)', pro_labore: 'Pró-labore',
  tm_bar: 'TM Bar', tm_entrada: 'TM Entrada', ticket_medio_contahub: 'Ticket Médio (ContaHub)',
  faturamento_total: 'Faturamento Total', faturamento_bar: 'Faturamento Bar',
  faturamento_couvert: 'Faturamento Couvert', faturamento_cmovel: 'Faturamento Cmóvel',
  atracao_faturamento: '% Atração / Faturamento',
  nps_geral: 'NPS Geral', nps_ambiente: 'NPS Ambiente', nps_atendimento: 'NPS Atendimento',
  nps_limpeza: 'NPS Limpeza', nps_musica: 'NPS Música', nps_comida: 'NPS Comida',
  nps_drink: 'NPS Drink', nps_preco: 'NPS Preço', nps_reservas: 'NPS Reservas',
  nps_felicidade_equipe: 'NPS Felicidade Equipe',
  media_avaliacoes_google: 'Média Avaliações Google', avaliacoes_5_google_trip: 'Avaliações 5★ Google/Trip',
  clientes_ativos: 'Clientes Ativos', clientes_atendidos: 'Clientes Atendidos',
  reservas_totais: 'Reservas Totais', reservas_presentes: 'Reservas Presentes', retencao: 'Retenção',
  stockout_bar: 'StockOut Bar', stockout_drinks: 'StockOut Drinks', stockout_comidas: 'StockOut Comidas',
  tempo_saida_bar: 'Tempo Saída Bar', tempo_saida_cozinha: 'Tempo Saída Cozinha',
  percent_bebidas: '% Bebidas', percent_drinks: '% Drinks', percent_comida: '% Comida',
  percent_happyhour: '% Happy Hour', qtde_itens_bar: 'Qtde Itens Bar', qtde_itens_cozinha: 'Qtde Itens Cozinha',
};

function humanize(campo: string): string {
  if (LABEL[campo]) return LABEL[campo];
  return campo
    .replace(/_/g, ' ')
    .replace(/\bperc(ent)?\b/gi, '%')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function flatten(metas: any): any[] {
  const obj = metas && typeof metas === 'object' && !Array.isArray(metas) ? metas : {};
  const cats = Object.keys(obj);
  const ordered = [
    ...CATEGORIA_ORDER.filter((c) => cats.includes(c)),
    ...cats.filter((c) => !CATEGORIA_ORDER.includes(c)),
  ];
  const grupos: any[] = [];
  for (const categoria of ordered) {
    const campos = obj[categoria];
    if (!campos || typeof campos !== 'object' || Array.isArray(campos)) continue;
    const itens = Object.entries(campos).map(([campo, valor]) => ({
      id: `${categoria}${SEP}${campo}`,
      categoria,
      campo,
      nome: humanize(campo),
      tipo: typeof valor === 'number' ? 'number' : 'text',
      valor: valor as any,
    }));
    if (itens.length > 0) {
      grupos.push({ categoria, label: CATEGORIA_LABEL[categoria] || humanize(categoria), itens });
    }
  }
  return grupos;
}

// =====================================================
// GET — metas do bar selecionado (agrupadas por categoria)
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) return authErrorResponse('Usuário não autenticado');

    const supabase = await getAdminClient();
    const { data: bar, error } = await (supabase as any)
      .schema('operations')
      .from('bares')
      .select('nome, metas')
      .eq('id', user.bar_id)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar metas:', error);
      return NextResponse.json({ error: 'Erro ao buscar metas' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bar_id: user.bar_id,
      bar_nome: bar?.nome ?? null,
      grupos: flatten(bar?.metas || {}),
    });
  } catch (error) {
    console.error('❌ Erro na API de metas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// =====================================================
// PUT — atualiza valores das metas (merge no objeto, por bar selecionado)
//   body: { metas: [{ id: 'categoria::campo', valor, tipo? }] }
// =====================================================
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) return authErrorResponse('Usuário não autenticado');

    const { metas } = await request.json();
    if (!Array.isArray(metas)) {
      return NextResponse.json({ error: 'Formato inválido: esperado array de metas' }, { status: 400 });
    }

    const supabase = await getAdminClient();
    const { data: bar, error } = await (supabase as any)
      .schema('operations')
      .from('bares')
      .select('metas')
      .eq('id', user.bar_id)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar metas existentes:', error);
      return NextResponse.json({ error: 'Erro ao buscar metas existentes' }, { status: 500 });
    }

    const obj: Record<string, any> =
      bar?.metas && typeof bar.metas === 'object' && !Array.isArray(bar.metas)
        ? { ...bar.metas }
        : {};

    for (const m of metas) {
      if (!m?.id || typeof m.id !== 'string' || !m.id.includes(SEP)) continue;
      const [categoria, campo] = m.id.split(SEP);
      if (!categoria || !campo) continue;

      const grupoAtual = obj[categoria] && typeof obj[categoria] === 'object' ? obj[categoria] : {};
      const valorAtual = grupoAtual[campo];

      let v: any = m.valor;
      // Coerção: preserva número onde o valor armazenado já era número.
      if (typeof valorAtual === 'number' || m.tipo === 'number') {
        const n = Number(String(v ?? '').replace(',', '.'));
        v = Number.isFinite(n) ? n : 0;
      } else if (v == null) {
        v = '';
      }

      obj[categoria] = { ...grupoAtual, [campo]: v };
    }

    const { error: upErr } = await (supabase as any)
      .schema('operations')
      .from('bares')
      .update({ metas: obj, atualizado_em: new Date().toISOString() })
      .eq('id', user.bar_id);

    if (upErr) {
      console.error('❌ Erro ao atualizar metas:', upErr);
      return NextResponse.json({ error: 'Erro ao atualizar metas' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Metas atualizadas com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao atualizar metas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
