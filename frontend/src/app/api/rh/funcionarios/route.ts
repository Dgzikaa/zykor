import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { computarAlertas } from '@/lib/rh/alertas';

export const dynamic = 'force-dynamic';

// hr.funcionarios é schema de domínio (operacional), NÃO medallion. Sempre .schema('hr').
const CAMPOS_EDITAVEIS = [
  'nome', 'cpf', 'telefone', 'email', 'data_admissao', 'data_demissao', 'data_nascimento',
  'cargo_id', 'area_id', 'tipo_contratacao', 'salario_base', 'valor_diaria',
  'vale_transporte_diaria', 'dias_trabalho_semana', 'chave_pix', 'tipo_chave_pix',
  'observacoes', 'foto_url', 'ativo',
] as const;

function limparPayload(body: any) {
  const out: Record<string, any> = {};
  for (const k of CAMPOS_EDITAVEIS) if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k];
  return out;
}

/** GET /api/rh/funcionarios?q=&busca=&area_id=&cargo_id=&ativo=&tipo= */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const supabase = await getAdminClient();

  let query = (supabase as any).schema('hr').from('funcionarios').select('*').eq('bar_id', user.bar_id);
  const ativo = sp.get('ativo');
  if (ativo === '1' || ativo === 'true') query = query.eq('ativo', true);
  if (ativo === '0' || ativo === 'false') query = query.eq('ativo', false);
  if (sp.get('area_id')) query = query.eq('area_id', Number(sp.get('area_id')));
  if (sp.get('cargo_id')) query = query.eq('cargo_id', Number(sp.get('cargo_id')));
  const tipo = sp.get('tipo') || sp.get('tipo_contratacao');
  if (tipo) query = query.eq('tipo_contratacao', tipo);
  const q = (sp.get('q') || sp.get('busca') || '').trim();
  if (q) query = query.or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,email.ilike.%${q}%`);

  const [{ data: funcs, error }, cargosRes, areasRes] = await Promise.all([
    query.order('nome'),
    (supabase as any).schema('hr').from('cargos').select('id, nome').eq('bar_id', user.bar_id),
    (supabase as any).schema('hr').from('areas').select('id, nome').eq('bar_id', user.bar_id),
  ]);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const cargoMap = new Map((cargosRes.data || []).map((c: any) => [c.id, c.nome]));
  const areaMap = new Map((areasRes.data || []).map((a: any) => [a.id, a.nome]));
  const funcionarios = (funcs || []).map((f: any) => ({
    ...f,
    cargo_nome: f.cargo_id ? cargoMap.get(f.cargo_id) || null : null,
    area_nome: f.area_id ? areaMap.get(f.area_id) || null : null,
  }));

  // Alertas por funcionário (documento faltando/vencido, férias vencendo).
  const ids = funcionarios.map((f: any) => f.id);
  if (ids.length) {
    const [docsRes, feriasRes, treinosRes] = await Promise.all([
      (supabase as any).schema('hr').from('documentos_funcionario').select('funcionario_id, tipo, validade').in('funcionario_id', ids),
      (supabase as any).schema('hr').from('funcionario_ocorrencias').select('funcionario_id, tipo, data_inicio').in('funcionario_id', ids).eq('tipo', 'ferias'),
      (supabase as any).schema('hr').from('treinamentos').select('funcionario_id, nome, validade').in('funcionario_id', ids).not('validade', 'is', null),
    ]);
    const porFunc = (rows: any[]) => {
      const m = new Map<number, any[]>();
      for (const r of rows || []) { const a = m.get(r.funcionario_id) || []; a.push(r); m.set(r.funcionario_id, a); }
      return m;
    };
    const docsByFunc = porFunc(docsRes.data);
    const feriasByFunc = porFunc(feriasRes.data);
    const treinosByFunc = porFunc(treinosRes.data);
    for (const f of funcionarios) f.alertas = computarAlertas(f, docsByFunc.get(f.id) || [], feriasByFunc.get(f.id) || [], treinosByFunc.get(f.id) || []);
  }

  return NextResponse.json({
    success: true,
    funcionarios,
    data: funcionarios, // alias de compat (simulacao-cmo lê .data)
    resumo: {
      total: funcionarios.length,
      ativos: funcionarios.filter((f: any) => f.ativo).length,
      freelas: funcionarios.filter((f: any) => f.tipo_contratacao === 'Freela').length,
      com_alertas: funcionarios.filter((f: any) => (f.alertas?.length || 0) > 0).length,
    },
  });
}

/** POST /api/rh/funcionarios -> cria funcionário (+ contrato inicial). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  if (!body.nome || !String(body.nome).trim()) {
    return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 });
  }
  const payload: Record<string, any> = { ...limparPayload(body), bar_id: user.bar_id };
  if (payload.ativo === undefined) payload.ativo = true;

  const supabase = await getAdminClient();
  const { data: f, error } = await (supabase as any).schema('hr').from('funcionarios').insert(payload).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Histórico: registra o contrato de admissão.
  if (f && (payload.salario_base || payload.vale_transporte_diaria || payload.valor_diaria)) {
    await (supabase as any).schema('hr').from('contratos_funcionario').insert({
      funcionario_id: f.id, salario_base: payload.salario_base || 0,
      vale_transporte_diaria: payload.vale_transporte_diaria || 0,
      tipo_contratacao: payload.tipo_contratacao || 'CLT',
      cargo_id: payload.cargo_id || null, area_id: payload.area_id || null,
      vigencia_inicio: payload.data_admissao || new Date().toISOString().slice(0, 10),
      motivo_alteracao: 'Admissão',
    });
  }

  return NextResponse.json({ success: true, funcionario: f, data: f }, { status: 201 });
}
