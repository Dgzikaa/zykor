import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeRH } from '@/lib/auth/rh-guard';

export const dynamic = 'force-dynamic';

/**
 * O que a FOLHA já pagou por cargo — a âncora para o RH preencher a faixa salarial.
 *
 * A faixa (hr.cargos.salario_min/max) nasceu vazia em 15/08/2026 e alguém precisa digitar ~16 cargos
 * por empresa. Chutar de cabeça é como se erra; aqui vem o que a folha registrou de verdade.
 *
 * DELIBERADAMENTE NÃO preenche nada sozinho. A folha mais recente do banco é de fevereiro/2026 e já
 * passaram meses — semear a faixa com isso faria um número velho parecer decisão de hoje. O período
 * volta junto na resposta justamente para a tela poder escrever "pela folha de fev/2026", e quem
 * decide se aquilo ainda vale é o RH.
 *
 * Endpoint separado (e não dentro do GET do organograma) porque só interessa na hora de editar a
 * faixa: o quadro carrega dezenas de vezes por dia, e esta conta não deve pesar nele.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  // é folha de pagamento: só quem tem RH vê, mesmo agregado por cargo
  if (!podeRH(user)) return permissionErrorResponse('Sem permissão no módulo de RH');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: ultimo } = await hr('folha_pagamento')
    .select('ano, mes').eq('bar_id', user.bar_id)
    .order('ano', { ascending: false }).order('mes', { ascending: false })
    .limit(1).maybeSingle();

  // Bar sem folha lançada (é o caso do Deboche e do Escritório Central hoje) devolve vazio em vez
  // de erro — a tela simplesmente não mostra a dica.
  if (!ultimo) return NextResponse.json({ periodo: null, por_cargo: {} });

  const { data: linhas } = await hr('folha_pagamento')
    .select('funcionario_id, salario_bruto')
    .eq('bar_id', user.bar_id).eq('ano', ultimo.ano).eq('mes', ultimo.mes);

  const ids = Array.from(new Set((linhas || []).map((l: any) => l.funcionario_id).filter(Boolean)));
  if (!ids.length) return NextResponse.json({ periodo: ultimo, por_cargo: {} });

  // inclui inativo de propósito: quem saiu depois de fevereiro ainda diz quanto aquele cargo pagava
  const { data: pessoas } = await hr('funcionarios')
    .select('id, cargo_id').eq('bar_id', user.bar_id).in('id', ids);
  const cargoDe = new Map<number, number>(
    (pessoas || []).filter((p: any) => p.cargo_id).map((p: any) => [p.id, p.cargo_id]),
  );

  const porCargo: Record<number, { min: number; max: number; n: number }> = {};
  for (const l of linhas || []) {
    const cargoId = cargoDe.get(l.funcionario_id);
    const valor = Number(l.salario_bruto);
    if (!cargoId || !(valor > 0)) continue;
    const atual = porCargo[cargoId];
    if (!atual) porCargo[cargoId] = { min: valor, max: valor, n: 1 };
    else {
      atual.min = Math.min(atual.min, valor);
      atual.max = Math.max(atual.max, valor);
      atual.n++;
    }
  }

  return NextResponse.json({ periodo: ultimo, por_cargo: porCargo });
}
