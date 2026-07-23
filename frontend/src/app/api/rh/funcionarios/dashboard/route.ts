import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { computarAlertas } from '@/lib/rh/alertas';

export const dynamic = 'force-dynamic';

const hojeISO = () => new Date().toISOString().slice(0, 10);
const mesesEntre = (a: string) => {
  const d = new Date(a); const n = new Date();
  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
};

/** GET /api/rh/funcionarios/dashboard -> indicadores globais de RH do bar. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const bar = user.bar_id;
  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: funcs } = await hr('funcionarios').select('*').eq('bar_id', bar);
  const { data: areas } = await hr('areas').select('id, nome').eq('bar_id', bar);
  const lista = funcs || [];
  const ids = lista.map((f: any) => f.id);
  const areaNome = new Map((areas || []).map((a: any) => [a.id, a.nome]));

  const [docsRes, ocorrRes, felizRes] = await Promise.all([
    ids.length ? hr('documentos_funcionario').select('funcionario_id, tipo, validade').in('funcionario_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? hr('funcionario_ocorrencias').select('funcionario_id, tipo, data_inicio, data_fim').in('funcionario_id', ids) : Promise.resolve({ data: [] }),
    hr('pesquisa_felicidade').select('data_pesquisa, setor, media_geral, resultado_percentual, eu_comigo_engajamento, eu_com_empresa_pertencimento, eu_com_colega_relacionamento, eu_com_gestor_lideranca, justica_reconhecimento').eq('bar_id', bar),
  ]);

  const docs = docsRes.data || [];
  const ocorr = ocorrRes.data || [];
  const ativos = lista.filter((f: any) => f.ativo);
  const hoje = hojeISO();

  // ── Sem bater ponto (ativos com escala parados há >=7 dias) ──
  const { data: ausentesRaw } = await hr('v_ponto_ausentes')
    .select('funcionario_id, nome, area_id, ultima_presenca, dias_sem_bater, faltas_30d, justificadas_30d')
    .eq('bar_id', bar);
  const ausentes = (ausentesRaw || [])
    .map((a: any) => ({ ...a, area: a.area_id ? (areaNome.get(a.area_id) as string) || null : null }))
    .sort((x: any, y: any) => (y.dias_sem_bater ?? 999) - (x.dias_sem_bater ?? 999));

  // ── Headcount ──
  const porTipo = { CLT: 0, PJ: 0, Freela: 0 } as Record<string, number>;
  const porArea = new Map<string, number>();
  let somaMeses = 0, comAdmissao = 0;
  for (const f of ativos) {
    porTipo[f.tipo_contratacao] = (porTipo[f.tipo_contratacao] || 0) + 1;
    const an = f.area_id ? (areaNome.get(f.area_id) as string) || 'Sem área' : 'Sem área';
    porArea.set(an, (porArea.get(an) || 0) + 1);
    if (f.data_admissao) { somaMeses += Math.max(0, mesesEntre(f.data_admissao)); comAdmissao++; }
  }
  const noventaAtras = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

  // ── Alertas (reusa o motor) ──
  const byFunc = (rows: any[]) => { const m = new Map<number, any[]>(); for (const r of rows) { const a = m.get(r.funcionario_id) || []; a.push(r); m.set(r.funcionario_id, a); } return m; };
  const docsBy = byFunc(docs); const feriasBy = byFunc(ocorr.filter((o: any) => o.tipo === 'ferias'));
  let comAlertas = 0; const tipoAlerta: Record<string, number> = {};
  for (const f of ativos) {
    const al = computarAlertas(f, docsBy.get(f.id) || [], feriasBy.get(f.id) || []);
    if (al.length) comAlertas++;
    for (const a of al) tipoAlerta[a.tipo] = (tipoAlerta[a.tipo] || 0) + 1;
  }

  // ── Ocorrências ──
  const inicioMes = hoje.slice(0, 8) + '01';
  const nomeFunc = new Map(lista.map((f: any) => [f.id, f.nome]));
  const emFerias = ocorr.filter((o: any) => o.tipo === 'ferias' && o.data_inicio <= hoje && (o.data_fim ?? o.data_inicio) >= hoje)
    .map((o: any) => ({ nome: nomeFunc.get(o.funcionario_id), ate: o.data_fim }));
  const noMes = (t: string) => ocorr.filter((o: any) => o.tipo === t && o.data_inicio >= inicioMes).length;

  // ── Felicidade (pesquisa real) ──
  const feliz = felizRes.data || [];
  const porPesquisa = new Map<string, { n: number; pct: number; media: number; dims: number[] }>();
  for (const r of feliz) {
    const k = String(r.data_pesquisa);
    const cur = porPesquisa.get(k) || { n: 0, pct: 0, media: 0, dims: [0, 0, 0, 0, 0] };
    cur.n++; cur.pct += Number(r.resultado_percentual || 0); cur.media += Number(r.media_geral || 0);
    cur.dims[0] += Number(r.eu_comigo_engajamento || 0); cur.dims[1] += Number(r.eu_com_empresa_pertencimento || 0);
    cur.dims[2] += Number(r.eu_com_colega_relacionamento || 0); cur.dims[3] += Number(r.eu_com_gestor_lideranca || 0);
    cur.dims[4] += Number(r.justica_reconhecimento || 0);
    porPesquisa.set(k, cur);
  }
  const trend = [...porPesquisa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, v]) => ({ data, pct: Math.round((v.pct / v.n) * 10) / 10, respostas: v.n }));
  const ultima = trend.length ? [...porPesquisa.entries()].sort((a, b) => b[0].localeCompare(a[0]))[0] : null;
  const dimsLabels = ['Engajamento', 'Pertencimento', 'Relacionamento', 'Liderança', 'Reconhecimento'];
  const felicidade = ultima ? {
    data: ultima[0],
    pct: Math.round((ultima[1].pct / ultima[1].n) * 10) / 10,
    media: Math.round((ultima[1].media / ultima[1].n) * 100) / 100,
    respostas: ultima[1].n,
    dimensoes: dimsLabels.map((label, i) => ({ label, valor: Math.round((ultima[1].dims[i] / ultima[1].n) * 100) / 100 })),
    trend: trend.slice(-12),
  } : null;

  return NextResponse.json({
    success: true,
    headcount: {
      ativos: ativos.length,
      inativos: lista.length - ativos.length,
      por_tipo: porTipo,
      por_area: [...porArea.entries()].map(([area, n]) => ({ area, n })).sort((a, b) => b.n - a.n),
      tempo_casa_medio_meses: comAdmissao ? Math.round(somaMeses / comAdmissao) : 0,
    },
    movimentacao: {
      admissoes_90d: ativos.filter((f: any) => f.data_admissao && f.data_admissao >= noventaAtras).length,
      demissoes_90d: lista.filter((f: any) => f.data_demissao && f.data_demissao >= noventaAtras).length,
    },
    ocorrencias: {
      em_ferias: emFerias,
      faltas_mes: noMes('falta'),
      atestados_mes: noMes('atestado'),
      advertencias_mes: noMes('advertencia'),
    },
    alertas: { com_alertas: comAlertas, por_tipo: tipoAlerta },
    sem_bater_ponto: ausentes,
    felicidade,
    avaliacoes: { total: 0, ultima: null }, // pré-construído — módulo Avaliação alimenta depois
  });
}
