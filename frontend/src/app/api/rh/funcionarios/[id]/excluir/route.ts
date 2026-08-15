import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Apagar um cadastro de funcionário criado por engano (duplicata).
 *
 * NÃO é "desligar": desligar é um fato da vida da pessoa e vive em hr.desligamentos. Isto aqui
 * é para a linha que nunca deveria ter existido — o "Renato Augusto" cadastrado à mão ao lado do
 * "RENATO AUGUSTO BATISTA" que já vinha do Tangerino.
 *
 * A trava é o que protege o cadastro de verdade: só apaga quem NÃO tem história. Qualquer registro
 * abaixo bloqueia e a rota devolve 409 dizendo o que impede — porque apagar alguém com ponto,
 * documento ou ocorrência não é limpar duplicata, é destruir histórico trabalhista.
 */
const BLOQUEIOS: Array<{ tabela: string; schema: 'hr' | 'operations'; label: string }> = [
  { tabela: 'ponto_registro', schema: 'hr', label: 'marcações de ponto' },
  { tabela: 'documentos_funcionario', schema: 'hr', label: 'documentos anexados' },
  { tabela: 'funcionario_ocorrencias', schema: 'hr', label: 'ocorrências' },
  { tabela: 'treinamentos', schema: 'hr', label: 'treinamentos' },
  { tabela: 'contratos_funcionario', schema: 'hr', label: 'histórico de contrato' },
  { tabela: 'checkin', schema: 'hr', label: 'check-ins' },
  { tabela: 'calibracoes', schema: 'hr', label: 'calibrações' },
  { tabela: 'avaliacoes', schema: 'hr', label: 'avaliações' },
  { tabela: 'desligamentos', schema: 'hr', label: 'registro de desligamento' },
  { tabela: 'reconhecimentos', schema: 'hr', label: 'reconhecimentos' },
  { tabela: 'escala_dia', schema: 'operations', label: 'vínculo com a escala da operação' },
];

/** Some junto: nasceram com o cadastro e não são história de ninguém. */
const CASCATA: Array<{ tabela: string; schema: 'hr'; label: string }> = [
  { tabela: 'onboarding_itens', schema: 'hr', label: 'itens de onboarding' },
  { tabela: 'cadeira_ocupacao', schema: 'hr', label: 'ocupações de cadeira já encerradas' },
];

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const funcId = Number(id);
  if (!Number.isFinite(funcId)) return NextResponse.json({ success: false, error: 'id inválido' }, { status: 400 });

  const supabase = await getAdminClient();

  // o bar do usuário no filtro: ninguém apaga cadastro de outra empresa do grupo
  const { data: f } = await (supabase as any).schema('hr').from('funcionarios')
    .select('id, nome, bar_id').eq('id', funcId).eq('bar_id', user.bar_id).maybeSingle();
  if (!f) return NextResponse.json({ success: false, error: 'Funcionário não encontrado neste bar' }, { status: 404 });

  // ---- o que impede ----------------------------------------------------------------------
  const impedimentos: Array<{ label: string; n: number }> = [];
  for (const b of BLOQUEIOS) {
    const { count } = await (supabase as any).schema(b.schema).from(b.tabela)
      .select('*', { count: 'exact', head: true }).eq('funcionario_id', funcId);
    if ((count || 0) > 0) impedimentos.push({ label: b.label, n: count || 0 });
  }
  // cadeira ocupada AGORA também segura: liberar a cadeira é decisão de quem cuida do quadro,
  // não efeito colateral de apagar uma linha.
  const { count: ocupando } = await (supabase as any).schema('hr').from('cadeira_ocupacao')
    .select('*', { count: 'exact', head: true }).eq('funcionario_id', funcId).is('fim', null);
  if ((ocupando || 0) > 0) impedimentos.push({ label: 'cadeira ocupada no organograma (tire da cadeira antes)', n: ocupando || 0 });

  if (impedimentos.length) {
    return NextResponse.json({
      success: false,
      error: `${f.nome} tem histórico e não pode ser apagado. Se a pessoa saiu, use "Registrar demissão".`,
      impedimentos,
    }, { status: 409 });
  }

  // ---- apaga o que nasceu junto e depois a pessoa ------------------------------------------
  const removidos: Record<string, number> = {};
  for (const c of CASCATA) {
    const { data } = await (supabase as any).schema(c.schema).from(c.tabela)
      .delete().eq('funcionario_id', funcId).select('id');
    removidos[c.tabela] = (data || []).length;
  }

  const { error } = await (supabase as any).schema('hr').from('funcionarios')
    .delete().eq('id', funcId).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, nome: f.nome, removidos });
}
