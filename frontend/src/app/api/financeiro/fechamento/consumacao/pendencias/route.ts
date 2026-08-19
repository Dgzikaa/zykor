import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { getFatorCmv } from '@/lib/config/getFatorCmv';
import { criarLancamentoCA, resolveCategoriaId, resolveContaPadrao, getCAToken, brDate } from '@/lib/financeiro/contaazul-lancador';

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
 * GET  ?bar_id=&ini=&fim=&minimo=   → lista o que está desencontrado
 * POST { bar_id, linhas:[{dia,chave}] } → CORRIGE no Conta Azul
 *
 * COMO A CORREÇÃO FUNCIONA (opção A, decidida pelo Rodrigo em 19/08/2026).
 *
 * O Conta Azul não apaga lançamento, então "estornar" é lançar uma RECEITA de mesmo valor na
 * MESMA categoria: no DRE, despesa 50 − receita 50 = 0. E como cada categoria do CA é de um tipo
 * só, isso exige a categoria espelho de RECEITA existir — é o que o Rodrigo/Gonza criam lá
 * (a API do CA é read-only para categorias).
 *
 * `resolveCategoriaId` filtra por TIPO antes do nome, então o tipo já desambigua: a espelho pode
 * ter o mesmo nome da despesa. Mesmo assim tentamos MAIÚSCULA primeiro, que é a convenção que já
 * existe para o Ajuste CMV, e caímos no nome original — assim funciona com qualquer uma das duas.
 *
 * Idempotência: a chave do ajuste carrega um contador (`chave#aj1`, `#aj2`…), e o delta é sempre
 * recalculado do log. Depois que o ajuste entra, o delta vira zero e nenhum outro nasce — o mesmo
 * princípio auto-idempotente do complemento de soma-zero.
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

  /**
   * O corte vale só para "aumentou/diminuiu" — esses PODEM ser só a ficha técnica tendo mudado, o
   * que desloca o custo histórico de todos os dias e encheria a lista de centavos.
   *
   * "sumiu" e "novo" NÃO têm corte: a categoria deixou de existir (ou passou a existir) naquele
   * dia, o que é sempre reclassificação ou "ignorar" de verdade — o caso que originou o painel.
   * Filtrar esses por valor esconderia justamente o erro que a gente quer pegar. São poucos: nos
   * últimos 60 dias, 20 dos 56 "sumiu" estão abaixo de R$ 20 e somam R$ 222.
   *
   * Nada é descartado no banco: o seletor da tela desce e mostra o resto.
   */
  const inequivoco = (l: { situacao: string }) => l.situacao === 'sumiu' || l.situacao === 'novo';
  const linhas = todas.filter((l) => inequivoco(l) || Math.abs(l.delta) >= minimo);

  const resumo = {
    linhas: linhas.length,
    dias: new Set(linhas.map((l) => l.dia)).size,
    a_estornar: Number(linhas.filter((l) => l.delta < 0).reduce((s, l) => s + Math.abs(l.delta), 0).toFixed(2)),
    a_lancar: Number(linhas.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0).toFixed(2)),
    ignoradas_abaixo_do_corte: todas.length - linhas.length,
    // quantas entraram por serem inequívocas, mesmo abaixo do corte
    inequivocas: linhas.filter(inequivoco).length,
  };

  return NextResponse.json({ success: true, minimo, fator, resumo, linhas });
}

/** Nome da categoria espelho de RECEITA, na convenção que já existe para o Ajuste CMV. */
const espelhoReceita = (categoriaDespesa: string) => categoriaDespesa.toUpperCase();

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request);
  if (nega) return nega;

  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  const alvos: Array<{ dia: string; chave: string }> = Array.isArray(body.linhas) ? body.linhas : [];
  if (!barId || !alvos.length) {
    return NextResponse.json({ success: false, error: 'bar_id e linhas são obrigatórios' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const fator = await getFatorCmv(supabase, barId);
  const dias = Array.from(new Set(alvos.map((a) => a.dia))).sort();

  // Recalcula do zero em vez de confiar no que a tela mandou: entre ver e clicar, a classificação
  // pode ter mudado de novo, e lançar um delta velho criaria um erro novo.
  const { data: pend, error } = await (supabase as any).schema('financial')
    .rpc('fn_consumacao_pendencias', { p_bar_id: barId, p_ini: dias[0], p_fim: dias[dias.length - 1], p_fator: fator });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const querido = new Set(alvos.map((a) => `${a.dia}|${a.chave}`));
  const linhas = ((pend || []) as any[]).filter((r) => querido.has(`${String(r.dia).slice(0, 10)}|${r.chave}`));
  if (!linhas.length) {
    return NextResponse.json({ success: true, resultados: [], aviso: 'Nada a corrigir — as diferenças já foram resolvidas.' });
  }

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return NextResponse.json({ success: false, error: tokenResult.error }, { status: tokenResult.status });
  const conta = await resolveContaPadrao(barId);
  if (!conta) return NextResponse.json({ success: false, error: 'Nenhuma conta financeira ativa no Conta Azul' }, { status: 400 });

  const log = () => (supabase as any).schema('financial').from('lancamento_manual_ca_log');
  const resultados: any[] = [];

  for (const l of linhas) {
    const dia = String(l.dia).slice(0, 10);
    const chave = String(l.chave);
    const delta = Number(l.delta);
    if (Math.abs(delta) < 0.01) continue;

    const catDespesa = CATEGORIA_CA[chave] || chave;
    const estorno = delta < 0;
    const sinal: 'RECEITA' | 'DESPESA' = estorno ? 'RECEITA' : 'DESPESA';
    // no estorno a categoria precisa existir como RECEITA; tenta MAIÚSCULA e depois o nome original
    const candidatos = estorno ? [espelhoReceita(catDespesa), catDespesa] : [catDespesa];

    const cat = await resolveCategoriaId(barId, candidatos, sinal);
    if (!cat) {
      resultados.push({
        dia, chave, ok: false,
        erro: `Falta a categoria de ${sinal} "${candidatos[0]}" no Conta Azul deste bar. Crie-a como ${sinal} e re-sincronize as categorias.`,
      });
      continue;
    }

    // contador de ajustes já feitos nessa chave/dia, só para a chave do log não colidir
    const { data: jaAj } = await log().select('chave')
      .eq('bar_id', barId).eq('tipo', 'consumacao').eq('competencia', dia).like('chave', `${chave}#aj%`);
    const n = ((jaAj as any[]) || []).length + 1;

    const label = LABEL[chave] || chave;
    const descricao = `${estorno ? 'Estorno' : 'Ajuste'} consumação ${label} ${brDate(dia)}`;
    const r = await criarLancamentoCA({
      token: tokenResult.token, sinal, competencia: dia, vencimento: dia, valor: Math.abs(delta),
      descricao,
      observacao: `${descricao} — reclassificação depois do lançamento (Zykor)`,
      categoriaId: cat.id, contaId: conta.id,
    });

    if (r.ok) {
      await log().insert({
        bar_id: barId, tipo: 'consumacao', competencia: dia, chave: `${chave}#aj${n}`,
        sinal, valor: Math.abs(delta), descricao,
        categoria_id: cat.id, categoria_nome: cat.nome, conta_id: conta.id, data_vencimento: dia,
        ca_protocol_id: r.protocolId, ca_status: r.status, baixado: false,
        criado_por: user.email || 'zykor',
      });
    }
    resultados.push({ dia, chave, sinal, valor: Math.abs(delta), categoria: cat.nome, ok: r.ok, erro: r.erro });
  }

  const erros = resultados.filter((r) => !r.ok).length;
  return NextResponse.json({
    success: erros === 0,
    corrigidos: resultados.filter((r) => r.ok).length,
    erros,
    resultados,
  }, { status: erros ? 207 : 200 });
}
