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
    hr('pesquisa_felicidade').select('data_pesquisa, setor, quorum, media_geral, resultado_percentual, eu_comigo_engajamento, eu_com_empresa_pertencimento, eu_com_colega_relacionamento, eu_com_gestor_lideranca, justica_reconhecimento').eq('bar_id', bar),
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
  //
  // As dimensões são PERCENTUAL (escala tipo eNPS, pode ser negativo), não a
  // antiga nota de 0 a 5.
  const dimsCols = ['eu_comigo_engajamento', 'eu_com_empresa_pertencimento', 'eu_com_colega_relacionamento', 'eu_com_gestor_lideranca', 'justica_reconhecimento'];
  const dimsLabels = ['Engajamento', 'Pertencimento', 'Relacionamento', 'Liderança', 'Reconhecimento'];

  // A tabela guarda uma linha por setor. O Ordinário ainda traz uma linha
  // 'TODOS', que é o consolidado feito na própria planilha — quando ela existe é
  // a resposta certa. O Deboche NÃO tem (só Operacional e Administrativo), então
  // ali o consolidado é calculado aqui, ponderado por quórum: média simples daria
  // o mesmo peso a um setor de 2 pessoas e a outro de 30.
  const felizTodas = felizRes.data || [];
  const temTodos = felizTodas.some((r: any) => r.setor === 'TODOS');

  const porData = new Map<string, any[]>();
  for (const r of felizTodas) {
    if (temTodos && r.setor !== 'TODOS') continue;
    const k = String(r.data_pesquisa);
    porData.set(k, [...(porData.get(k) || []), r]);
  }

  const ponderar = (linhas: any[], campo: string): number | null => {
    const validas = linhas.filter((r) => r[campo] != null);
    if (!validas.length) return null;
    const pesoTotal = validas.reduce((s, r) => s + (Number(r.quorum) || 0), 0);
    // Sem quórum registrado não dá pra ponderar; cai na média simples.
    if (!pesoTotal) return validas.reduce((s, r) => s + Number(r[campo]), 0) / validas.length;
    return validas.reduce((s, r) => s + Number(r[campo]) * (Number(r.quorum) || 0), 0) / pesoTotal;
  };
  const arred = (v: number | null, casas = 1) => (v == null ? null : Math.round(v * 10 ** casas) / 10 ** casas);

  const datas = [...porData.keys()].sort();
  const trend = datas
    .map((d) => {
      const linhas = porData.get(d)!;
      return {
        data: d,
        pct: arred(ponderar(linhas, 'resultado_percentual')),
        respostas: linhas.reduce((s, r) => s + (Number(r.quorum) || 0), 0),
      };
    })
    .filter((p) => p.pct != null) as { data: string; pct: number; respostas: number }[];

  const ultimaData = datas.length ? datas[datas.length - 1] : null;
  const ultLinhas = ultimaData ? porData.get(ultimaData)! : [];

  const felicidade = ultimaData ? {
    data: ultimaData,
    pct: arred(ponderar(ultLinhas, 'resultado_percentual')),
    media: arred(ponderar(ultLinhas, 'media_geral'), 2),
    respostas: ultLinhas.reduce((s, r) => s + (Number(r.quorum) || 0), 0),
    dimensoes: dimsLabels.map((label, i) => ({ label, valor: arred(ponderar(ultLinhas, dimsCols[i])) })),
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
