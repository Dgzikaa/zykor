import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA, type SinalLanc,
} from '@/lib/financeiro/contaazul-lancador';
import { enviarPixDireto } from '@/lib/inter/enviarPixDireto';

export const dynamic = 'force-dynamic';

// Classifica um insumo numa das 4 categorias de custo do CA (por tipo_local + categoria do cadastro),
// espelhando a lógica da Compras/CMV (cmv-semanal/buscar-dados-automaticos). Fallback = Outros.
type TipoCA = 'Bebidas' | 'Comida' | 'Drinks' | 'Outros';
const CAT_CANDIDATOS: Record<TipoCA, string[]> = {
  Bebidas: ['Custo Bebidas'],
  Comida: ['Custo Comida', 'Custo Comidas'],
  Drinks: ['Custo Drinks'],
  Outros: ['Custo Outros'],
};
function classificarCA(ins: { codigo?: string | null; categoria?: string | null; tipo_local?: string | null }): TipoCA {
  const cod = String(ins.codigo || '').toLowerCase();
  const cat = String(ins.categoria || '').toUpperCase();
  const tl = String(ins.tipo_local || '').toLowerCase();
  const has = (arr: string[]) => arr.some((k) => cat.includes(k));
  if (cod.startsWith('pd')) return 'Drinks';
  if (cod.startsWith('pc')) return 'Comida';
  if (/\(F\)/.test(cat)) return 'Outros'; // funcionários (CMA, não CMV)
  if (has(['NÃO-ALCÓOLICOS', 'NAO-ALCOOLICOS']) && tl === 'cozinha') return 'Drinks';
  if (tl === 'bar') return 'Bebidas';
  if (has(['RETORNÁVEIS', 'RETORNAVEIS', 'VINHOS', 'LONG NECK', 'LATA', 'ARTESANAL', 'POLPA', 'FRUTA', 'NÃO-ALCÓOLICOS', 'NAO-ALCOOLICOS', 'AMBEV', 'HEINEKEN', 'CERVEJ', 'CHOPP'])) return 'Bebidas';
  if (has(['DESTILADOS', 'IMPÉRIO', 'IMPERIO', 'POLPAS', 'ARMAZÉM (B)', 'ARMAZEM (B)', 'HORTIFRUTI (B)', 'MERCADO (B)', 'DRINK'])) return 'Drinks';
  if (has(['COZINHA', 'ARMAZÉM (C)', 'ARMAZEM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'PÃES', 'PAES', 'PEIXE', 'PROTEÍNA', 'PROTEINA', 'TEMPERO', 'FEIJOADA', 'LÍQUIDO', 'LIQUIDO'])) return 'Comida';
  return 'Outros';
}

/**
 * Lança no Conta Azul os 2 eventos de uma troca (item 2, passo 4):
 *   - RECEITA a receber no bar EMISSOR (bar_origem)
 *   - DESPESA a pagar no bar RECEBEDOR (bar_destino)
 * Categoria "Custo X" por TIPO do insumo (agrupa os itens por tipo). Prefixo [Zykor] automático.
 * SEM baixa (só a competência entra na DRE). Idempotente por financial.lancamento_manual_ca_log.
 *
 * body: { dryRun?: boolean }  — dryRun=true retorna o PLANO sem postar nada no CA (preview).
 * ⚠️ CA v2 não tem DELETE — use o dryRun pra conferir antes de lançar de verdade.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;

  const { id: trocaId } = await params;
  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false; // default = preview (seguro)

  const sb = getLancadorAdmin();
  const fin = (sb.schema('financial' as any) as any);

  const { data: troca, error: eT } = await fin.from('trocas')
    .select('id,bar_origem,bar_destino,valor,data_competencia,status,descricao,inter_codigo_solicitacao,troca_itens(insumo_codigo,quantidade,custo_unitario,subtotal)')
    .eq('id', trocaId).single();
  if (eT || !troca) return NextResponse.json({ success: false, error: 'Troca não encontrada' }, { status: 404 });
  // só o emissor ou o recebedor podem lançar
  if (![troca.bar_origem, troca.bar_destino].includes(user.bar_id)) {
    return NextResponse.json({ success: false, error: 'Sem acesso a esta troca' }, { status: 403 });
  }
  // Não bloqueia re-execução: o CA é idempotente (lancamento_manual_ca_log pula o que já
  // criou) e o PIX só reenvia se NÃO houver um pagamento ATIVO (não-reprovado) — ver abaixo.
  // Assim dá pra re-tentar o PIX depois de um REPROVADO sem duplicar nada no Conta Azul.

  const itens = (troca.troca_itens || []) as any[];
  if (itens.length === 0) return NextResponse.json({ success: false, error: 'Troca sem itens' }, { status: 400 });

  // classifica pelos insumos do EMISSOR (a mercadoria saiu de lá)
  const codes = Array.from(new Set(itens.map((i) => String(i.insumo_codigo))));
  const { data: insRows } = await (sb.schema('operations' as any) as any)
    .from('insumos').select('codigo,categoria,tipo_local').eq('bar_id', troca.bar_origem).in('codigo', codes);
  const insMap = new Map<string, any>((insRows || []).map((r: any) => [String(r.codigo).toLowerCase(), r]));

  // agrupa valor por tipo de custo
  const porTipo: Record<string, number> = {};
  for (const it of itens) {
    const ins = insMap.get(String(it.insumo_codigo).toLowerCase()) || { codigo: it.insumo_codigo };
    const tipo = classificarCA(ins);
    porTipo[tipo] = (porTipo[tipo] || 0) + (Number(it.subtotal) || Number(it.quantidade) * Number(it.custo_unitario) || 0);
  }

  const comp = String(troca.data_competencia).slice(0, 10);
  const descBase = `Troca de insumo (bar ${troca.bar_origem} → bar ${troca.bar_destino})${troca.descricao ? ` · ${troca.descricao}` : ''}`;

  // monta o plano: por tipo → receita no emissor + despesa no recebedor
  type Leg = { bar: number; sinal: SinalLanc; tipoCA: string; valor: number; categoria_nome?: string; categoria_id?: string; conta_id?: string; ok: boolean; erro?: string };
  const plano: Leg[] = [];
  for (const [tipo, valor] of Object.entries(porTipo)) {
    if (!(valor > 0)) continue;
    plano.push({ bar: troca.bar_origem, sinal: 'RECEITA', tipoCA: tipo, valor: Math.round(valor * 100) / 100, ok: false });
    plano.push({ bar: troca.bar_destino, sinal: 'DESPESA', tipoCA: tipo, valor: Math.round(valor * 100) / 100, ok: false });
  }

  // resolve categoria + conta + token por perna
  const contaCache = new Map<number, any>();
  const tokenCache = new Map<number, any>();
  for (const leg of plano) {
    const cat = await resolveCategoriaId(leg.bar, CAT_CANDIDATOS[leg.tipoCA as TipoCA], leg.sinal);
    if (!cat) { leg.erro = `Categoria "${CAT_CANDIDATOS[leg.tipoCA as TipoCA][0]}" (${leg.sinal}) não existe no CA do bar ${leg.bar}`; continue; }
    leg.categoria_id = cat.id; leg.categoria_nome = cat.nome;
    if (!contaCache.has(leg.bar)) contaCache.set(leg.bar, await resolveContaPadrao(leg.bar));
    const conta = contaCache.get(leg.bar);
    if (!conta) { leg.erro = `Sem conta financeira ativa no CA do bar ${leg.bar}`; continue; }
    leg.conta_id = conta.id;
    if (!tokenCache.has(leg.bar)) tokenCache.set(leg.bar, await getCAToken(leg.bar));
    const tk = tokenCache.get(leg.bar);
    if ('error' in tk) { leg.erro = `${tk.error} (bar ${leg.bar})`; continue; }
    leg.ok = true;
  }

  // PIX da troca: quem PAGA é o RECEBEDOR dos insumos (bar_destino); quem RECEBE é o
  // EMISSOR (bar_origem). Sai da credencial Inter padrão do bar_destino, cai na chave
  // PIX de recebimento do bar_origem. (Config em pagamento_config_bar / pagadora_padrao.)
  const { data: contaPadPagador } = await (sb.schema('bronze' as any) as any)
    .from('bronze_contaazul_contas_financeiras')
    .select('inter_credencial_id').eq('bar_id', troca.bar_destino).eq('pagadora_padrao', true).maybeSingle();
  const { data: cfgRecebedor } = await fin.from('pagamento_config_bar')
    .select('chave_pix_recebimento').eq('bar_id', troca.bar_origem).maybeSingle();
  const pixCredId = Number(contaPadPagador?.inter_credencial_id) || null;
  const pixChave = cfgRecebedor?.chave_pix_recebimento || null;
  const pixValor = Math.round(Number(troca.valor) * 100) / 100;
  const pixErroPlano = !(pixValor > 0) ? 'Valor da troca é zero'
    : !pixCredId ? `Sem credencial Inter padrão no bar pagador (${troca.bar_destino})`
    : !pixChave ? `Sem chave PIX de recebimento cadastrada no bar ${troca.bar_origem}`
    : null;
  const pixPlano = {
    pagador_bar: troca.bar_destino, recebedor_bar: troca.bar_origem,
    valor: pixValor, chave: pixChave, ok: !pixErroPlano, erro: pixErroPlano,
    ja_enviado: !!troca.inter_codigo_solicitacao,
  };

  if (dryRun) {
    return NextResponse.json({ success: true, dryRun: true, competencia: comp, plano, pix: pixPlano });
  }

  // execução real — aborta se qualquer perna não resolveu (CA não tem DELETE: tudo-ou-nada por segurança)
  const bloqueio = plano.find((l) => !l.ok);
  if (bloqueio) return NextResponse.json({ success: false, error: bloqueio.erro || 'Perna do lançamento não resolvida', plano }, { status: 400 });

  const resultados: any[] = [];
  for (const leg of plano) {
    const chave = `${trocaId}:${leg.tipoCA}:${leg.sinal}:${leg.bar}`;
    const { data: ja } = await fin.from('lancamento_manual_ca_log')
      .select('id,ca_protocol_id').eq('bar_id', leg.bar).eq('tipo', 'troca').eq('chave', chave).maybeSingle();
    if (ja) { resultados.push({ ...leg, ok: true, protocolId: ja.ca_protocol_id, idempotente: true }); continue; }

    const tk = tokenCache.get(leg.bar);
    const r = await criarLancamentoCA({
      token: tk.token, sinal: leg.sinal, competencia: comp, valor: leg.valor,
      descricao: descBase, observacao: 'Troca de insumo entre bares via Zykor',
      categoriaId: leg.categoria_id!, contaId: leg.conta_id!,
    });
    await fin.from('lancamento_manual_ca_log').insert({
      bar_id: leg.bar, tipo: 'troca', competencia: comp, chave, sinal: leg.sinal, valor: leg.valor,
      descricao: descBase, categoria_id: leg.categoria_id, categoria_nome: leg.categoria_nome, conta_id: leg.conta_id,
      data_vencimento: comp, ca_protocol_id: r.protocolId, ca_status: r.ok ? (r.status || 'ok') : `erro: ${r.erro}`,
      baixado: false, criado_por: user.email || 'app',
    });
    resultados.push({ ...leg, ok: r.ok, protocolId: r.protocolId, erro: r.erro });
  }

  const todasOk = resultados.every((r) => r.ok);
  if (todasOk) {
    const recId = resultados.find((r) => r.sinal === 'RECEITA')?.protocolId || null;
    const desId = resultados.find((r) => r.sinal === 'DESPESA')?.protocolId || null;
    await fin.from('trocas').update({ status: 'ca_lancado', ca_lancamento_receita_id: recId, ca_lancamento_despesa_id: desId, atualizado_em: new Date().toISOString() }).eq('id', trocaId);
  }

  // PIX: fonte da verdade = financial.pix_enviados (o webhook mantém o status). Só envia se
  // o CA fechou e NÃO houver um PIX ativo (não-reprovado). Após um REPROVADO, re-envia com
  // chave de idempotência NOVA (por nº de tentativas) — senão o banco devolveria o reprovado.
  let pixCodigo: string | null = null;
  let pixErro: string | null = null;
  let pixStatus: string | null = null;
  if (todasOk) {
    const { data: pixHist } = await fin.from('pix_enviados')
      .select('inter_codigo_solicitacao, inter_status, status, data_envio')
      .eq('pagamento_zykor_id', `troca:${trocaId}`)
      .order('data_envio', { ascending: false });
    const historico = (pixHist || []) as any[];
    const ativo = historico.find((p) => p.inter_status !== 'REPROVADO' && p.status !== 'erro');

    if (ativo) {
      // Já existe PIX vivo (enviado/agendado/pago) — não reenvia.
      pixCodigo = ativo.inter_codigo_solicitacao;
      pixStatus = ativo.inter_status;
    } else if (pixErroPlano) {
      pixErro = pixErroPlano;
    } else {
      try {
        const hojeStr = new Date().toISOString().slice(0, 10);
        const rp = await enviarPixDireto({
          barId: troca.bar_destino, credencialId: pixCredId!, chave: pixChave!,
          valor: pixValor, descricao: `Troca de insumo — pagamento ao bar ${troca.bar_origem}`,
          destinatario: `Bar ${troca.bar_origem}`, dataPagamento: hojeStr,
          seedIdempotencia: `troca:${trocaId}:${historico.length}`, // key nova por tentativa
          refPagamento: `troca:${trocaId}`,
        });
        pixCodigo = rp.codigoSolicitacao;
        pixStatus = 'ENVIADO';
      } catch (e: any) {
        pixErro = e?.message || 'Falha no PIX';
      }
    }
    await fin.from('trocas').update({ inter_codigo_solicitacao: pixCodigo, inter_pix_erro: pixErro }).eq('id', trocaId);
  }

  return NextResponse.json({ success: todasOk, competencia: comp, resultados, pix: { codigo: pixCodigo, status: pixStatus, erro: pixErro } });
}
