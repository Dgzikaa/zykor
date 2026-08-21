import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';
import { criarContaPagarCA } from '@/lib/contaazul/criarContaPagar';
import { keywordDe } from '@/lib/financeiro/cartaoCategoria';
import { parseParcela, chaveCompraParcelada, planejarParcelas, type ModoCompetencia } from '@/lib/financeiro/cartaoParcelas';

export const dynamic = 'force-dynamic';

// =====================================================
// POST — lança UMA linha da fatura no Conta Azul (no bar da linha).
//   Idempotente: se já está 'lancado', não repete. Grava contaazul_lancamento_id.
//
//   body: { bar_id, categoria_id, categoria_nome, pessoa_id, conta_financeira_id,
//           data_vencimento, centro_custo_id?,
//           gerar_restantes?, modo_competencia?: 'compra'|'mensal', competencia_inicial? }
//   competência = data da transação; vencimento = vencimento da fatura.
//
// COMPRA PARCELADA (David, 13/08/2026)
//   A fatura traz uma linha por parcela e toda parcela carrega a data da compra original. Lançando
//   uma por uma com competência = data da compra, o mês da compra cresce pra trás a cada fatura
//   (junho ganhava mais R$ 38 por mês por causa de um 1/6 do Mercado Livre). Agora:
//     · a parcela que já foi coberta por um lançamento anterior é VINCULADA, não lançada de novo;
//     · `gerar_restantes` (opt-in) manda as parcelas que faltam junto, e o mês fecha de uma vez;
//     · `modo_competencia: 'mensal'` joga a competência mês a mês — o inverso, pro contrato 12x
//       tipo SKY que hoje cai inteiro em janeiro.
// =====================================================
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'inserir')) return permissionErrorResponse('Sem permissão para lançar');
  const { id } = await params;

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const supabase = await getAdminClient();
  const { data: linha } = await fin(supabase).from('cartao_fatura_linhas').select('*').eq('id', id).maybeSingle();
  if (!linha) return NextResponse.json({ success: false, error: 'Linha não encontrada' }, { status: 404 });
  if (linha.status === 'lancado' || linha.contaazul_lancamento_id) {
    return NextResponse.json({ success: false, error: 'Linha já lançada no Conta Azul' }, { status: 409 });
  }
  if (linha.tipo !== 'compra') {
    return NextResponse.json({ success: false, error: 'Só compras vão pro Conta Azul (pagamento/estorno são ignorados)' }, { status: 400 });
  }

  const barId = Number(body.bar_id ?? linha.bar_id);
  const categoria_id = body.categoria_id ?? linha.categoria_id;
  const categoria_nome = body.categoria_nome ?? linha.categoria_nome;
  let pessoa_id = body.pessoa_id;
  let conta_financeira_id = body.conta_financeira_id;
  let data_vencimento = body.data_vencimento;

  // --- compra parcelada: esta parcela já foi coberta por um lançamento anterior? ---
  // Acontece todo mês: a fatura de agosto traz "Parcela 3 de 6" de uma compra de junho cujas
  // parcelas 3..6 já foram lançadas junto com a 2. Aqui a linha só é VINCULADA ao lançamento que
  // já existe — nada novo vai pro Conta Azul (que, além do mais, não deleta lançamento por API).
  const parcela = parseParcela(linha.parcela);
  const chaveParcelada = parcela
    ? chaveCompraParcelada({
        banco: linha.banco, cartao_final: linha.cartao_final,
        data_transacao: linha.data_transacao, total_parcelas: parcela.total, valor: Number(linha.valor),
      })
    : null;

  const { data: compraParcelada } = chaveParcelada
    ? await fin(supabase).from('cartao_compra_parcelada').select('*').eq('chave', chaveParcelada).maybeSingle()
    : { data: null as any };

  if (parcela && compraParcelada && (compraParcelada.parcelas_lancadas || []).includes(parcela.n)) {
    const { data: vinculada } = await fin(supabase)
      .from('cartao_fatura_linhas')
      .update({
        status: 'lancado',
        contaazul_lancamento_id: (compraParcelada.contaazul_ids || [])[0] || null,
        bar_id: compraParcelada.bar_id,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id).select().single();
    return NextResponse.json({
      success: true, vinculado: true, linha: vinculada,
      mensagem: `Parcela ${parcela.n} de ${parcela.total} já tinha sido lançada junto com as outras — a linha foi vinculada, sem duplicar no Conta Azul.`,
    });
  }

  // Vencimento vem da FATURA quando não veio no body.
  if (!data_vencimento && linha.fatura_id) {
    const { data: fat } = await fin(supabase).from('cartao_faturas').select('vencimento').eq('id', linha.fatura_id).maybeSingle();
    if (fat?.vencimento) data_vencimento = fat.vencimento;
  }

  // Conta pagadora: se não veio, usa a pagadora_padrao do bar (Ordinário Inter / Descubra Inter).
  // Bar SEM nenhuma pagadora configurada é falha de CONFIGURAÇÃO, não campo esquecido na tela —
  // separamos as duas coisas pra mensagem não mandar o financeiro procurar um campo que não existe
  // (o seletor vem vazio, porque ele lista só as contas com pagadora=true). Ver bar 6/PREFS, 03/08/2026.
  let barSemPagadora = false;
  if (!conta_financeira_id && Number.isFinite(barId)) {
    const { data: cp } = await (supabase.schema('bronze' as any) as any)
      .from('bronze_contaazul_contas_financeiras')
      .select('contaazul_id').eq('bar_id', barId).eq('pagadora_padrao', true).maybeSingle();
    if (cp?.contaazul_id) conta_financeira_id = cp.contaazul_id;
    else {
      const { count } = await (supabase.schema('bronze' as any) as any)
        .from('bronze_contaazul_contas_financeiras')
        .select('contaazul_id', { count: 'exact', head: true })
        .eq('bar_id', barId).eq('ativo', true).eq('pagadora', true);
      barSemPagadora = !count;
    }
  }
  // Fornecedor = TITULAR do cartão (de-para por cartao_final). Se não veio no body, resolve pelo mapa.
  let titularConhecido: string | null = null;
  if (!pessoa_id && Number.isFinite(barId) && linha.cartao_final) {
    const { data: map } = await fin(supabase)
      .from('cartao_fornecedor_map')
      .select('contaazul_pessoa_id').eq('bar_id', barId).eq('cartao_final', linha.cartao_final).maybeSingle();
    if (map?.contaazul_pessoa_id) pessoa_id = map.contaazul_pessoa_id;
    else {
      /*
        AUTO-CURA DO VÍNCULO EM OUTRO BAR.

        O cartão é físico: o titular é a MESMA PESSOA em qualquer bar — só o id dela no Conta Azul
        muda, porque cada bar tem o próprio CA. O de-para, porém, é por bar, e só era preenchido
        quando alguém clicava em "vincular". Resultado: quem lançava uma despesa de cartão
        escolhendo um bar onde ninguém tinha vinculado ainda batia em "vincule o titular" — foi o
        que o financeiro pegou no Escritório Central com o cartão ••2322 (20/08/2026). Naquele dia
        faltavam 15 vínculos: 6 no Escritório Central, 5 na Prefeitura e 4 no Primo Pobre.

        Aqui, em vez de mandar o operador ir vincular à mão, resolvemos: pega o nome do titular de
        qualquer bar que já tenha esse cartão, acha a mesma pessoa no CA do bar de destino (1º +
        último nome, igual à propagação da tela) e GRAVA o vínculo — o próximo lançamento já acha
        direto.
      */
      const { data: outro } = await fin(supabase)
        .from('cartao_fornecedor_map')
        .select('nome').eq('cartao_final', linha.cartao_final)
        .not('nome', 'is', null).order('bar_id').limit(20);
      // o nome mais COMPLETO vence: alguns vínculos antigos guardaram o nome truncado do extrato
      const nomeTitular = ((outro as any[]) || [])
        .map((r) => String(r.nome || ''))
        .sort((a, b) => b.length - a.length)[0] || null;
      titularConhecido = nomeTitular;

      if (nomeTitular) {
        const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
        const toks = norm(nomeTitular).split(/\s+/).filter(Boolean);
        const primeiro = toks[0] || '';
        const ultimo = toks.length > 1 ? toks[toks.length - 1] : '';
        if (primeiro) {
          const { data: cands } = await (supabase.schema('bronze' as any) as any)
            .from('bronze_contaazul_pessoas')
            .select('contaazul_id, nome').eq('bar_id', barId).eq('ativo', true)
            .ilike('nome', `${primeiro}%`).limit(50);
          const hit = ((cands as any[]) || [])
            .filter((c) => !ultimo || norm(String(c.nome)).endsWith(ultimo))
            .sort((a, b) => String(a.nome).length - String(b.nome).length)[0];
          if (hit?.contaazul_id) {
            pessoa_id = hit.contaazul_id;
            await fin(supabase).from('cartao_fornecedor_map').upsert(
              { bar_id: barId, cartao_final: linha.cartao_final, contaazul_pessoa_id: hit.contaazul_id, nome: hit.nome },
              { onConflict: 'bar_id,cartao_final' },
            );
          }
        }
      }
    }
  }

  const faltando: string[] = [];
  if (!Number.isFinite(barId)) faltando.push('bar');
  if (!categoria_id) faltando.push('categoria');
  if (!pessoa_id) {
    // Chegou aqui = nem o mapa do bar nem a busca por nome acharam. Dizer QUEM é o titular e o que
    // falta é o que separa "erro que se resolve em 10s" de "erro que vira mensagem no WhatsApp".
    faltando.push(
      titularConhecido
        ? `fornecedor (titular) do cartão ••${linha.cartao_final}: "${titularConhecido}" não está cadastrado no Conta Azul deste bar. Cadastre-o lá (ou vincule à mão na seção "Fornecedor por cartão")`
        : `fornecedor (titular) do cartão${linha.cartao_final ? ` ••${linha.cartao_final}` : ''} — vincule o titular na seção "Fornecedor por cartão"`,
    );
  }
  if (!conta_financeira_id) {
    faltando.push(
      barSemPagadora
        ? `conta pagadora — o bar ${barId} não tem NENHUMA conta configurada como pagadora. Um admin precisa marcar em Configurações › Integrações › Conta Azul › "Contas pagadoras"`
        : 'conta pagadora',
    );
  }
  if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(String(data_vencimento))) faltando.push('vencimento da fatura');
  if (faltando.length) {
    return NextResponse.json({ success: false, error: `Complete antes de lançar: ${faltando.join(', ')}.` }, { status: 400 });
  }

  // Descrição no CA: estabelecimento (+ parcela) + ref curta da linha (evita bloqueio
  // anti-duplicado do CA quando há 2 compras iguais no mesmo dia/categoria).
  const ref = String(linha.dedupe_hash).slice(0, 6);
  const descricao = `${linha.descricao}${linha.parcela ? ` (${linha.parcela})` : ''} [${ref}]`;
  const observacao = `Cartão ${linha.banco}${linha.cartao_final ? ` final ${linha.cartao_final}` : ''} — ${linha.descricao}`;

  // Modo da competência e até onde gerar. Sem parcela na linha, nada muda: um lançamento, competência
  // na data da transação — exatamente como era.
  const modo: ModoCompetencia = body.modo_competencia === 'mensal' ? 'mensal' : 'compra';
  const gerarRestantes = parcela ? body.gerar_restantes === true : false;
  const ateParcela = parcela ? (gerarRestantes ? parcela.total : parcela.n) : 1;
  if (modo === 'mensal' && body.competencia_inicial && !/^\d{4}-\d{2}(-\d{2})?$/.test(String(body.competencia_inicial))) {
    return NextResponse.json({ success: false, error: 'competencia_inicial inválida (use AAAA-MM)' }, { status: 400 });
  }
  const competenciaInicial = body.competencia_inicial
    ? `${String(body.competencia_inicial).slice(0, 7)}-01`
    : null;

  // --- a parcela ja esta no Conta Azul, lancada por FORA do Zykor? ---
  // cartao_compra_parcelada so conhece o que passou por aqui. Parcela lancada na mao direto no CA
  // (o jeito antigo: "as vezes nao sou eu que faco, e a Catrine") nao aparece la, e o Mini Lousa do
  // Deboche tem as 6 parcelas lancadas assim. Sem esta checagem, a fatura de setembro traria a 3/6 e
  // ela seria lancada em cima. Nao bloqueia de vez: devolve a evidencia pra tela e quem lanca decide
  // vincular ou lancar mesmo assim.
  if (parcela && body.forcar !== true) {
    const { data: noCa } = await (supabase as any).schema('financial')
      .rpc('fn_parcelas_no_ca', { p_bar: barId, p_total: parcela.total, p_valor: Number(linha.valor) });
    const conflitos = ((noCa || []) as any[])
      .filter((r) => r.n >= parcela.n && r.n <= ateParcela)
      .sort((a, b) => a.n - b.n);
    if (conflitos.length) {
      return NextResponse.json({
        success: false,
        parcela_ja_no_ca: conflitos,
        error: conflitos.length === 1
          ? `A parcela ${conflitos[0].n} de ${parcela.total} parece já estar no Conta Azul: "${conflitos[0].descricao}" (competência ${conflitos[0].data_competencia}, ${Number(conflitos[0].valor_bruto).toFixed(2)}).`
          : `${conflitos.length} das parcelas que você quer lançar parecem já estar no Conta Azul (${conflitos.map((c) => c.n).join(', ')} de ${parcela.total}).`,
      }, { status: 409 });
    }
  }

  // Vincular a linha a um lancamento que JA existe no CA, sem criar nada — a saida do 409 acima.
  if (parcela && chaveParcelada && body.acao === 'vincular_existente') {
    await registrarParcelada(supabase, {
      chaveParcelada, compraParcelada, linha, barId, parcela,
      feitas: [parcela.n], contaazulIds: body.contaazul_id ? [String(body.contaazul_id)] : [],
      modo, competenciaInicial, user,
    });
    const { data: vinculada } = await fin(supabase)
      .from('cartao_fatura_linhas')
      .update({
        status: 'lancado',
        contaazul_lancamento_id: body.contaazul_id ? String(body.contaazul_id) : null,
        bar_id: barId, categoria_id, categoria_nome: categoria_nome || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id).select().single();
    return NextResponse.json({
      success: true, vinculado: true, linha: vinculada,
      mensagem: `Vinculada ao lançamento que já existia no Conta Azul — nada foi criado. A partir de agora o Zykor reconhece as parcelas dessa compra sozinho.`,
    });
  }

  try {
    const contaazulIds: string[] = [];
    let contaazul_id: string | null = null;

    if (!parcela) {
      // caminho de sempre: compra à vista, um lançamento só
      ({ contaazul_id } = await criarContaPagarCA({
        barId, data_competencia: linha.data_transacao, data_vencimento,
        valor: Number(linha.valor), descricao, categoria_id, pessoa_id, conta_financeira_id,
        centro_custo_id: body.centro_custo_id || undefined, observacao,
      }));
      if (contaazul_id) contaazulIds.push(contaazul_id);
    } else {
      const plano = planejarParcelas({
        de: parcela.n, ate: ateParcela, total: parcela.total,
        valorParcela: Number(linha.valor),
        dataTransacao: linha.data_transacao,
        vencimentoAtual: String(data_vencimento),
        modo, competenciaInicial,
      });
      const desc = (n: number) => `${linha.descricao} (Parcela ${n} de ${parcela.total}) [${ref}]`;

      if (modo === 'compra') {
        // competência única = data da compra → cabe tudo num evento financeiro só, com N parcelas.
        ({ contaazul_id } = await criarContaPagarCA({
          barId, data_competencia: linha.data_transacao,
          data_vencimento: plano[0].data_vencimento, valor: plano[0].valor,
          descricao, categoria_id, pessoa_id, conta_financeira_id,
          centro_custo_id: body.centro_custo_id || undefined, observacao,
          parcelas: plano.map((p) => ({ data_vencimento: p.data_vencimento, valor: p.valor, descricao: desc(p.n) })),
        }));
        if (contaazul_id) contaazulIds.push(contaazul_id);
      } else {
        // competência mês a mês → um evento por parcela (competência diferente não cabe no mesmo).
        // Se cair no meio, o que já subiu fica gravado: a próxima tentativa vincula em vez de repetir.
        const feitas: number[] = [];
        try {
          for (const p of plano) {
            const r = await criarContaPagarCA({
              barId, data_competencia: p.data_competencia, data_vencimento: p.data_vencimento,
              valor: p.valor, descricao: desc(p.n), categoria_id, pessoa_id, conta_financeira_id,
              centro_custo_id: body.centro_custo_id || undefined, observacao,
            });
            if (r.contaazul_id) contaazulIds.push(r.contaazul_id);
            if (!contaazul_id) contaazul_id = r.contaazul_id;
            feitas.push(p.n);
          }
        } catch (e) {
          if (feitas.length && chaveParcelada) {
            await registrarParcelada(supabase, { chaveParcelada, compraParcelada, linha, barId, parcela, feitas, contaazulIds, modo, competenciaInicial, user });
          }
          throw e;
        }
      }

      if (chaveParcelada) {
        await registrarParcelada(supabase, {
          chaveParcelada, compraParcelada, linha, barId, parcela,
          feitas: plano.map((p) => p.n), contaazulIds, modo, competenciaInicial, user,
        });
      }
    }

    const { data: atualizada } = await fin(supabase)
      .from('cartao_fatura_linhas')
      .update({
        status: 'lancado',
        contaazul_lancamento_id: contaazul_id,
        bar_id: barId,
        categoria_id,
        categoria_nome: categoria_nome || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    // Aprende: estabelecimento -> categoria (no bar da linha), pra próxima fatura já vir sugerido.
    // Best-effort — nunca falha o lançamento.
    try {
      const kw = keywordDe(String(linha.descricao || ''));
      if (kw) {
        const { data: existente } = await fin(supabase)
          .from('cartao_categoria_map')
          .select('hits').eq('bar_id', barId).eq('keyword', kw).maybeSingle();
        await fin(supabase).from('cartao_categoria_map').upsert({
          bar_id: barId, keyword: kw,
          categoria_id, categoria_nome: categoria_nome || null,
          hits: (existente?.hits || 0) + 1, updated_at: new Date().toISOString(),
        }, { onConflict: 'bar_id,keyword' });
      }
    } catch (e) {
      console.error('[cartao-fatura/lancar] aprender categoria falhou (ignorado):', e);
    }

    const geradas = parcela ? ateParcela - parcela.n : 0;
    return NextResponse.json({
      success: true,
      linha: atualizada,
      parcelas_geradas: geradas,
      mensagem: geradas > 0
        ? `Lançado com as ${geradas} parcela(s) restante(s)${modo === 'mensal' ? ', competência mês a mês' : `, todas na competência de ${String(linha.data_transacao).slice(0, 10).split('-').reverse().join('/')}`}. As próximas faturas vão vincular sozinhas.`
        : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Falha ao lançar no Conta Azul' }, { status: 400 });
  }
}

/**
 * Guarda quais parcelas da compra já foram pro Conta Azul.
 *
 * É isso que impede o lançamento em dobro quando a fatura do mês seguinte trouxer a mesma parcela:
 * a rota consulta por `chave` antes de lançar e, achando a parcela na lista, só vincula a linha.
 * Melhor-esforço nunca: se isso falhar depois de já ter criado no CA, a gente prefere estourar o
 * erro — parcela criada e não registrada é justamente a que voltaria a ser lançada no mês seguinte.
 */
async function registrarParcelada(supabase: any, args: {
  chaveParcelada: string;
  compraParcelada: any;
  linha: any;
  barId: number;
  parcela: { n: number; total: number };
  feitas: number[];
  contaazulIds: string[];
  modo: ModoCompetencia;
  competenciaInicial: string | null;
  user: any;
}) {
  const { chaveParcelada, compraParcelada, linha, barId, parcela, feitas, contaazulIds, modo, competenciaInicial, user } = args;
  const jaLancadas = new Set<number>([...(compraParcelada?.parcelas_lancadas || []), ...feitas]);
  const ids = Array.from(new Set([...(compraParcelada?.contaazul_ids || []), ...contaazulIds]));

  const { error } = await fin(supabase).from('cartao_compra_parcelada').upsert({
    chave: chaveParcelada,
    bar_id: barId,
    banco: linha.banco || null,
    cartao_final: linha.cartao_final || null,
    descricao: linha.descricao,
    data_transacao: linha.data_transacao,
    total_parcelas: parcela.total,
    valor_parcela: Number(linha.valor),
    modo_competencia: modo,
    competencia_inicial: modo === 'mensal' ? competenciaInicial : null,
    parcelas_lancadas: Array.from(jaLancadas).sort((a, b) => a - b),
    contaazul_ids: ids,
    criado_por: compraParcelada?.criado_por || user?.email || 'app',
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'chave' });
  if (error) throw new Error(`Lançado no Conta Azul, mas falhou ao registrar as parcelas: ${error.message}`);
}
