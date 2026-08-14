import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Panorama da calibração do trimestre — a visão que faltava: no dossiê só dá para ver uma pessoa
 * por vez, e o comitê precisa saber QUEM AINDA FALTA calibrar.
 *
 * Regra de elegibilidade da ata: "assim que ela entrou ela ainda n é avaliada... se ele entrou agr
 * ele n sera avaliado, ai sera avaliado no proximo período". Quem foi admitido DENTRO do trimestre
 * não entra na conta de pendentes — apareceria como buraco todo trimestre sem ser.
 */

const NIVEIS = ['insatisfatorio', 'abaixo', 'atende', 'acima', 'destaque'] as const;

/** GET ?ano=&trimestre= */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const hoje = new Date();
  const ano = Number(sp.get('ano')) || hoje.getFullYear();
  const trimestre = Number(sp.get('trimestre')) || Math.floor(hoje.getMonth() / 3) + 1;
  if (![1, 2, 3, 4].includes(trimestre)) {
    return NextResponse.json({ success: false, error: 'Trimestre deve ser 1, 2, 3 ou 4' }, { status: 400 });
  }

  // início do trimestre: quem entrou daqui pra frente ainda não é avaliado
  const inicio = new Date(Date.UTC(ano, (trimestre - 1) * 3, 1)).toISOString().slice(0, 10);

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const [funcRes, calibRes, cargosRes] = await Promise.all([
    hr('funcionarios').select('id, nome, cargo_id, area_id, data_admissao')
      .eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
    hr('calibracoes').select('funcionario_id, comportamento, performance, atualizado_em')
      .eq('bar_id', user.bar_id).eq('ano', ano).eq('trimestre', trimestre),
    hr('cargos').select('id, nome').eq('bar_id', user.bar_id),
  ]);
  if (funcRes.error) return NextResponse.json({ success: false, error: funcRes.error.message }, { status: 500 });

  const cargoNome = new Map<number, string>((cargosRes.data || []).map((c: any) => [c.id, c.nome]));
  const porFunc = new Map<number, any>((calibRes.data || []).map((c: any) => [c.funcionario_id, c]));

  const linhas = (funcRes.data || []).map((f: any) => {
    const c = porFunc.get(f.id);
    const entrouNoTrimestre = !!f.data_admissao && String(f.data_admissao).slice(0, 10) >= inicio;
    return {
      funcionario_id: f.id,
      nome: f.nome,
      cargo_nome: f.cargo_id ? cargoNome.get(f.cargo_id) || null : null,
      comportamento: c?.comportamento || null,
      performance: c?.performance || null,
      calibrado: !!c,
      // não é "pendente": pela regra da ata, entra no próximo período
      novo_no_periodo: entrouNoTrimestre,
    };
  });

  const elegiveis = linhas.filter((l) => !l.novo_no_periodo);
  const distribuicao = Object.fromEntries(NIVEIS.map((n) => [n, {
    comportamento: elegiveis.filter((l) => l.comportamento === n).length,
    performance: elegiveis.filter((l) => l.performance === n).length,
  }]));

  return NextResponse.json({
    success: true,
    ano, trimestre,
    linhas,
    resumo: {
      elegiveis: elegiveis.length,
      calibrados: elegiveis.filter((l) => l.calibrado).length,
      pendentes: elegiveis.filter((l) => !l.calibrado).length,
      novos_no_periodo: linhas.filter((l) => l.novo_no_periodo).length,
    },
    distribuicao,
  });
}
