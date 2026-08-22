import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { dimensaoDe } from '@/lib/analytics/nps-dimensoes';
import {
  AREAS, NPS_DA_AREA, SETOR_FELICIDADE, TEMPO_DA_AREA, TEM_ATRASO_PEDIDO,
  type AreaOperacional,
} from '@/lib/operacao/painel-lider';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Painel do Líder — os indicadores da ÁREA de quem está logado.
 *
 * A área sai da cadeira do organograma, não de um cadastro próprio: quem é Chefe de Bar abre e vê
 * o Bar. Quem ocupa cadeira SEM área (Gerente Operacional, sócio) ou é admin escolhe no seletor.
 *
 * Todo número aqui é recorte de uma fonte que já alimenta uma tela existente. Se divergir da tela
 * detalhada é bug, não "outra metodologia" — por isso cada bloco carrega o link pra tela dele.
 */

const num = (v: any) => Number(v || 0);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

const hojeBRT = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const addDias = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Stockout: qual `categoria_local` pertence a cada área. */
const STOCKOUT_LOCAIS: Partial<Record<AreaOperacional, string[]>> = {
  Bar: ['Drinks', 'Bar'],
  Cozinha: ['Comidas'],
};

/** A cadeira do usuário no organograma → área. null quando a cadeira não tem área (gerência). */
async function areaDoUsuario(supabase: any, barId: number, email: string | null | undefined) {
  if (!email) return null;
  const hr = (t: string) => supabase.schema('hr').from(t);
  // O email do organograma às vezes vem com espaço/tab colado (import de planilha) — normaliza
  // dos dois lados em vez de confiar no dado.
  const alvo = String(email).trim().toLowerCase();
  const { data: pessoas } = await hr('funcionarios')
    .select('id, nome, email, area_id').eq('bar_id', barId).eq('ativo', true);
  const eu = ((pessoas || []) as any[]).find((p) => String(p.email || '').trim().toLowerCase() === alvo);
  if (!eu) return null;

  const { data: ocup } = await hr('cadeira_ocupacao')
    .select('cadeira_id').eq('funcionario_id', eu.id).is('fim', null).maybeSingle();
  let areaId: number | null = eu.area_id ?? null;
  if (ocup?.cadeira_id) {
    const { data: cad } = await hr('cadeiras').select('area_id').eq('id', ocup.cadeira_id).maybeSingle();
    // A cadeira MANDA no cargo/área (ver project_organograma_manda_cargo_area_e_lideranca).
    if (cad && cad.area_id != null) areaId = cad.area_id;
  }
  if (areaId == null) return { nome: eu.nome, area: null as string | null };

  const { data: area } = await hr('areas').select('nome').eq('id', areaId).maybeSingle();
  return { nome: eu.nome, area: (area?.nome as string) ?? null };
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const dias = Math.min(180, Math.max(7, Number(sp.get('dias')) || 30));
  const supabase = await getAdminClient();

  const eu = await areaDoUsuario(supabase, user.bar_id, user.email);
  // Sem área na cadeira = gerência/sócio: escolhe. Com área = trava na dela, que é o ponto do
  // painel (o líder abre e já está no lugar certo, sem filtro pra errar).
  const podeTrocar = !eu?.area;
  const pedida = sp.get('area');
  const area = ((podeTrocar ? pedida : eu?.area) || eu?.area || pedida || 'Bar') as AreaOperacional;
  if (!AREAS.includes(area)) {
    return NextResponse.json({ success: false, error: 'área inválida' }, { status: 400 });
  }

  const ate = hojeBRT();
  const de = addDias(ate, -dias);
  const deAnt = addDias(ate, -dias * 2);

  const [nps, tempo, stockout, felicidade, equipe] = await Promise.all([
    blocoNps(supabase, user.bar_id, area, de, ate, deAnt),
    blocoTempo(supabase, user.bar_id, area, de, ate, deAnt),
    blocoStockout(supabase, user.bar_id, area, de),
    blocoFelicidade(supabase, user.bar_id, area),
    blocoEquipe(supabase, user.bar_id, area),
  ]);

  return NextResponse.json({
    success: true,
    area, areas: AREAS, pode_trocar: podeTrocar, sou: eu?.nome ?? null,
    periodo: { de, ate, dias },
    nps, tempo, stockout, felicidade, equipe,
  });
}

/** NPS da dimensão que pertence à área, com a variação contra o período anterior. */
async function blocoNps(supabase: any, barId: number, area: AreaOperacional, de: string, ate: string, deAnt: string) {
  const alvo = NPS_DA_AREA[area];
  const { data } = await supabase.schema('silver').from('v_nps_area')
    .select('area_raw, nota, data_visita')
    .eq('bar_id', barId).gte('data_visita', deAnt).lte('data_visita', ate);

  const linhas = ((data || []) as any[]).filter((r) => dimensaoDe(r.area_raw) === alvo);
  const acc = (rows: any[]) => {
    const notas = rows.map((r) => num(r.nota)).filter((n) => n > 0);
    if (!notas.length) return { nota: null as number | null, n: 0, reclamacoes: 0 };
    return {
      nota: r2(notas.reduce((s, n) => s + n, 0) / notas.length),
      n: notas.length,
      reclamacoes: notas.filter((n) => n <= 3).length,
    };
  };
  const atual = acc(linhas.filter((r) => r.data_visita >= de));
  const ant = acc(linhas.filter((r) => r.data_visita < de));
  return {
    dimensao: alvo,
    ...atual,
    nota_anterior: ant.nota,
    delta: atual.nota != null && ant.nota != null ? r2(atual.nota - ant.nota) : null,
    link: '/analitico/nps',
  };
}

/** Tempo de produção do ContaHub (segundos) — só Bar e Cozinha têm o seu. */
async function blocoTempo(supabase: any, barId: number, area: AreaOperacional, de: string, ate: string, deAnt: string) {
  const cfg = TEMPO_DA_AREA[area];
  if (!cfg) return null;
  const campos = `data_evento, ${cfg.campo}, atrasinho_bar, atrasao_bar`;
  const { data } = await supabase.schema('operations').from('eventos_base')
    .select(campos).eq('bar_id', barId)
    .gte('data_evento', deAnt).lte('data_evento', ate).gt('real_r', 0);

  const linhas = (data || []) as any[];
  const media = (rows: any[]) => {
    const vs = rows.map((r) => num(r[cfg.campo])).filter((v) => v > 0);
    return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) : null;
  };
  const atuais = linhas.filter((r) => r.data_evento >= de);
  const seg = media(atuais);
  const segAnt = media(linhas.filter((r) => r.data_evento < de));

  return {
    rotulo: cfg.rotulo,
    seg, seg_anterior: segAnt,
    // Delta NEGATIVO é bom aqui (saiu mais rápido) — a tela inverte a cor por isso.
    delta: seg != null && segAnt != null ? seg - segAnt : null,
    atrasos: TEM_ATRASO_PEDIDO.includes(area) ? {
      atrasinho: atuais.reduce((s, r) => s + num(r.atrasinho_bar), 0),
      atrasao: atuais.reduce((s, r) => s + num(r.atrasao_bar), 0),
    } : null,
    dias_com_dado: atuais.length,
    link: '/analitico/eventos',
  };
}

/** % de itens sem estoque nas categorias que a área repõe. */
async function blocoStockout(supabase: any, barId: number, area: AreaOperacional, de: string) {
  const locais = STOCKOUT_LOCAIS[area];
  if (!locais) return null;
  const { data } = await supabase.schema('silver').from('silver_contahub_operacional_stockout_processado')
    .select('categoria_local, prd_estoque, prd_desc, data_consulta')
    .eq('bar_id', barId).gte('data_consulta', de).in('categoria_local', locais);

  const linhas = (data || []) as any[];
  if (!linhas.length) return { pct: null, zerados: 0, total: 0, locais, top: [], link: '/ferramentas/stockout' };

  const zerados = linhas.filter((r) => num(r.prd_estoque) <= 0);
  // Quais produtos mais faltaram — é o acionável, não o percentual.
  const porProduto = new Map<string, number>();
  for (const r of zerados) {
    const nome = String(r.prd_desc || '').trim();
    if (nome) porProduto.set(nome, (porProduto.get(nome) || 0) + 1);
  }
  const top = [...porProduto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, vezes]) => ({ nome, vezes }));

  return {
    pct: r1((zerados.length / linhas.length) * 100),
    zerados: zerados.length, total: linhas.length, locais, top,
    link: '/ferramentas/stockout',
  };
}

/** Pesquisa da Felicidade do setor equivalente à área (o de-para mora no lib). */
async function blocoFelicidade(supabase: any, barId: number, area: AreaOperacional) {
  const setores = SETOR_FELICIDADE[area] || [];
  if (!setores.length) return null;
  const { data } = await supabase.schema('hr').from('pesquisa_felicidade')
    .select('setor, resultado_percentual, data_pesquisa')
    .eq('bar_id', barId).order('data_pesquisa', { ascending: false }).limit(400);

  const alvo = new Set(setores.map((s) => s.toUpperCase()));
  const linhas = ((data || []) as any[])
    .filter((r) => alvo.has(String(r.setor || '').trim().toUpperCase()))
    .filter((r) => r.resultado_percentual != null);
  if (!linhas.length) return { pct: null, data: null, setor: setores[0], link: '/rh/pesquisas' };

  const ultima = linhas[0];
  const doDia = linhas.filter((r) => r.data_pesquisa === ultima.data_pesquisa);
  return {
    pct: r1(doDia.reduce((s, r) => s + num(r.resultado_percentual), 0) / doDia.length),
    data: ultima.data_pesquisa,
    setor: String(ultima.setor),
    link: '/rh/pesquisas',
  };
}

/** Quem é o time da área — o painel é de liderança, então isso é contexto, não indicador. */
async function blocoEquipe(supabase: any, barId: number, area: AreaOperacional) {
  const hr = (t: string) => supabase.schema('hr').from(t);
  const { data: areas } = await hr('areas').select('id, nome').eq('bar_id', barId).eq('ativo', true);
  const a = ((areas || []) as any[]).find((x) => String(x.nome).trim() === area);
  if (!a) return { pessoas: 0, link: '/rh/funcionarios' };
  const { count } = await hr('funcionarios')
    .select('id', { count: 'exact', head: true })
    .eq('bar_id', barId).eq('area_id', a.id).eq('ativo', true);
  return { pessoas: count ?? 0, link: '/rh/funcionarios' };
}
