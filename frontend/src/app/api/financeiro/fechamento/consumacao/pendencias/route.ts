import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getFatorCmv } from '@/lib/config/getFatorCmv';

export const dynamic = 'force-dynamic';

/**
 * Ajustes que ficaram pendentes NO CONTA AZUL depois que o dia já tinha sido lançado.
 *
 * O PROBLEMA (levantado pelo Rodrigo em 19/08/2026): o lançamento é idempotente por CHAVE e ignora
 * o valor. Se alguém reclassifica um consumo — "isso não foi benefício cliente, foi funcionário" —
 * ou marca "ignorar" depois do dia já lançado, então:
 *   · a categoria antiga some da lista de itens e NINGUÉM a estorna: fica no CA;
 *   · a nova aparece como pendente e, se lançada, SOMA por cima;
 *   · e o complemento de soma-zero cria uma receita de ajuste que faz o TOTAL fechar.
 * Resultado: o total bate e o erro fica escondido dentro da categoria — pior do que dar erro,
 * porque não aparece em lugar nenhum.
 *
 * Este endpoint só ENXERGA o problema; não corrige nada. Corrigir sozinho exigiria estornar uma
 * despesa, e no Conta Azul cada `[Consumação] X` existe apenas como DESPESA (só o Ajuste CMV tem o
 * par de receita), enquanto a API do CA é read-only para categorias. Enquanto essa decisão não é
 * tomada, o painel tira do Rodrigo a obrigação de LEMBRAR o que precisa ajustar lá dentro.
 *
 * GET ?bar_id=&ini=&fim=&minimo=
 */

const LABEL: Record<string, string> = {
  socios: 'Sócios', relacionamento: 'Relacionamento', funcionarios_escritorio: 'Funcionários Escritório',
  funcionarios_operacao: 'Funcionários Operação', artistas: 'Artistas', influencer: 'Influencers',
  beneficio_cliente: 'Benefício Clientes', aniversario: 'Aniversários', programa_pontos: 'Programa de Pontos',
  ajuste_cmv: 'Ajuste CMV',
};
const CATEGORIA_CA: Record<string, string> = {
  socios: '[Consumação] Sócios', relacionamento: '[Consumação] Relacionamento',
  funcionarios_escritorio: '[Consumação] Funcionários Escritório',
  funcionarios_operacao: '[Consumação] Funcionários Operação',
  artistas: '[Consumação] Artistas', influencer: '[Consumação] Influencers',
  beneficio_cliente: '[Consumação] Benefício Clientes', aniversario: '[Consumação] Aniversários',
  programa_pontos: '[Consumação] Programa de Pontos', ajuste_cmv: '[Consumação] Ajuste CMV',
};

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const ini = sp.get('ini');
  const fim = sp.get('fim');
  // Corte para não afogar o painel em centavos: mudança de ficha técnica desloca o custo histórico
  // de TODOS os dias, e ajustar o CA por R$ 0,40 custa mais do que o erro.
  const minimo = Number(sp.get('minimo') ?? 20);
  if (!barId || !ini || !fim) {
    return NextResponse.json({ success: false, error: 'bar_id, ini e fim são obrigatórios' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const fator = await getFatorCmv(supabase, barId);

  const { data, error } = await (supabase as any).schema('financial')
    .rpc('fn_consumacao_pendencias', { p_bar_id: barId, p_ini: ini, p_fim: fim, p_fator: fator });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const todas = ((data || []) as any[]).map((r) => ({
    dia: r.dia,
    chave: r.chave,
    label: LABEL[r.chave] || r.chave,
    categoria_ca: CATEGORIA_CA[r.chave] || r.chave,
    no_ca: Number(r.no_ca),
    agora: Number(r.agora),
    delta: Number(r.delta),
    situacao: r.situacao as 'novo' | 'sumiu' | 'aumentou' | 'diminuiu',
  }));

  // "sumiu" entra sempre que passa do corte: é o caso inequívoco (a categoria deixou de existir
  // naquele dia), enquanto "aumentou/diminuiu" pode ser só a ficha técnica tendo mudado.
  const linhas = todas.filter((l) => Math.abs(l.delta) >= minimo);

  const resumo = {
    linhas: linhas.length,
    dias: new Set(linhas.map((l) => l.dia)).size,
    a_estornar: Number(linhas.filter((l) => l.delta < 0).reduce((s, l) => s + Math.abs(l.delta), 0).toFixed(2)),
    a_lancar: Number(linhas.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0).toFixed(2)),
    ignoradas_abaixo_do_corte: todas.length - linhas.length,
  };

  return NextResponse.json({ success: true, minimo, fator, resumo, linhas });
}
