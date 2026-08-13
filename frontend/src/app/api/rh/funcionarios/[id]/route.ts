import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { computarAlertas } from '@/lib/rh/alertas';
import { fimDaExperiencia } from '@/lib/rh/experiencia';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

// Lista IRMÃ da de ../route.ts (criar). `genero` entrou nas duas em 13/08/2026 — sem ele aqui,
// dava pra escolher o gênero ao criar e a edição descartava calada.
const CAMPOS_EDITAVEIS = [
  'nome', 'cpf', 'telefone', 'email', 'data_admissao', 'data_demissao', 'data_nascimento',
  'cargo_id', 'area_id', 'tipo_contratacao', 'genero', 'salario_base', 'valor_diaria',
  'vale_transporte_diaria', 'dias_trabalho_semana', 'chave_pix', 'tipo_chave_pix',
  'observacoes', 'foto_url', 'ativo', 'rg', 'ctps', 'data_fim_experiencia',
] as const;

function limparPayload(body: any) {
  const out: Record<string, any> = {};
  for (const k of CAMPOS_EDITAVEIS) if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k];
  return out;
}

/** GET /api/rh/funcionarios/[id] -> dossiê (dados + documentos). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();

  const { data: f, error } = await (supabase as any).schema('hr').from('funcionarios')
    .select('*').eq('id', Number(id)).eq('bar_id', user.bar_id).maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!f) return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });

  const [cargoRes, areaRes, docsRes, ocorrRes, fotoRes, salRes, onbRes, treinoRes] = await Promise.all([
    f.cargo_id ? (supabase as any).schema('hr').from('cargos').select('nome').eq('id', f.cargo_id).maybeSingle() : Promise.resolve({ data: null }),
    f.area_id ? (supabase as any).schema('hr').from('areas').select('nome').eq('id', f.area_id).maybeSingle() : Promise.resolve({ data: null }),
    (supabase as any).schema('hr').from('documentos_funcionario').select('id, tipo, descricao, nome_arquivo, mime, tamanho_bytes, validade, criado_em').eq('funcionario_id', Number(id)).order('criado_em', { ascending: false }),
    (supabase as any).schema('hr').from('funcionario_ocorrencias').select('*').eq('funcionario_id', Number(id)).order('data_inicio', { ascending: false }),
    // última selfie do ponto (Tangerino) -> avatar quando não há foto cadastrada
    (supabase as any).schema('hr').from('ponto_registro').select('foto_in_url').eq('funcionario_id', Number(id)).not('foto_in_url', 'is', null).order('data', { ascending: false }).limit(1),
    // salário real pago via Conta Azul (match por nome) — últimos meses
    (supabase as any).schema('hr').from('v_funcionario_salario').select('valor_pago, data_pagamento, data_competencia, descricao, tipo').eq('funcionario_id', Number(id)).eq('tipo', 'salario').order('data_pagamento', { ascending: false }).limit(8),
    // onboarding e treinamentos entram no cálculo dos alertas (prazo estourado / validade vencida)
    (supabase as any).schema('hr').from('onboarding_itens').select('item, concluido, prazo').eq('funcionario_id', Number(id)),
    (supabase as any).schema('hr').from('treinamentos').select('nome, validade').eq('funcionario_id', Number(id)),
  ]);

  const documentos = docsRes.data || [];
  const ocorrencias = ocorrRes.data || [];
  const alertas = computarAlertas(f, documentos, ocorrencias, treinoRes.data || [], onbRes.data || []);

  // A Pesquisa da Felicidade NÃO entra aqui: ela é anônima e agregada por setor.
  // O que existia era um match por nome contra uma coluna que sempre valia a
  // constante 'Equipe' — ou seja, nunca retornava nada. Agora vive em
  // /rh/pesquisa-felicidade, que é a granularidade real do dado.

  const salHist = salRes.data || [];
  const funcionario = {
    ...f,
    cargo_nome: cargoRes.data?.nome || null, area_nome: areaRes.data?.nome || null,
    foto_ponto_url: fotoRes.data?.[0]?.foto_in_url || null,
    salario_ca: salHist[0]?.valor_pago != null ? Number(salHist[0].valor_pago) : null,
    salario_ca_data: salHist[0]?.data_pagamento || null,
    salario_ca_historico: salHist,
  };
  return NextResponse.json({ success: true, funcionario, data: funcionario, documentos, ocorrencias, alertas });
}

/** PUT /api/rh/funcionarios/[id] -> atualiza (+ histórico de contrato se mudou salário/cargo). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const payload = limparPayload(body);
  // Corrigir a admissão tem que arrastar o fim da experiência junto — senão o aviso dos 15 dias
  // continua contando a partir de uma data que já não existe. Só quando não veio explícito.
  if (payload.data_admissao && payload.data_fim_experiencia === undefined) {
    payload.data_fim_experiencia = fimDaExperiencia(payload.data_admissao);
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ success: false, error: 'Nada para atualizar' }, { status: 400 });
  }
  if (payload.data_demissao) payload.ativo = false; // demitido -> inativo

  const supabase = await getAdminClient();
  const { data: atual } = await (supabase as any).schema('hr').from('funcionarios')
    .select('*').eq('id', Number(id)).eq('bar_id', user.bar_id).maybeSingle();
  if (!atual) return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });

  const { data, error } = await (supabase as any).schema('hr').from('funcionarios')
    .update(payload).eq('id', Number(id)).eq('bar_id', user.bar_id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Histórico: se mudou salário/cargo/área/tipo, fecha o contrato vigente e abre um novo.
  const mudouContrato =
    (payload.salario_base !== undefined && payload.salario_base !== atual.salario_base) ||
    (payload.cargo_id !== undefined && payload.cargo_id !== atual.cargo_id) ||
    (payload.area_id !== undefined && payload.area_id !== atual.area_id) ||
    (payload.tipo_contratacao !== undefined && payload.tipo_contratacao !== atual.tipo_contratacao);
  if (mudouContrato) {
    const hoje = new Date().toISOString().slice(0, 10);
    await (supabase as any).schema('hr').from('contratos_funcionario')
      .update({ vigencia_fim: hoje }).eq('funcionario_id', Number(id)).is('vigencia_fim', null);
    await (supabase as any).schema('hr').from('contratos_funcionario').insert({
      funcionario_id: Number(id),
      salario_base: payload.salario_base ?? atual.salario_base,
      vale_transporte_diaria: payload.vale_transporte_diaria ?? atual.vale_transporte_diaria,
      tipo_contratacao: payload.tipo_contratacao ?? atual.tipo_contratacao,
      cargo_id: payload.cargo_id ?? atual.cargo_id, area_id: payload.area_id ?? atual.area_id,
      vigencia_inicio: hoje, motivo_alteracao: body.motivo_alteracao || 'Alteração contratual',
    });
  }

  return NextResponse.json({ success: true, funcionario: data, data });
}
