import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';
import { assinaturaCedente, mesmoCedente } from '@/app/financeiro/pedidos-pagamento/boletoBarcode';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/boleto/identificar?linha=<dígitos>
 *
 * Quem bipa o boleto no leitor só tem os 44/47/48 dígitos — e eles NÃO trazem nome nem CNPJ do
 * beneficiário (não existe esse campo no código de barras). O que dá pra fazer sem custo é olhar
 * pra trás: se já pagamos um boleto do MESMO CEDENTE (mesmo banco + mesma agência/conta/carteira
 * no campo livre), o fornecedor daquele pedido serve de sugestão — junto com CNPJ, vínculo no
 * Conta Azul e categoria. Ver `boletoBarcode.ts` (assinaturaCedente/pontuacaoCedente).
 *
 * De quebra avisa DUPLICADO: linha digitável idêntica já lançada = risco de pagar duas vezes.
 *
 * Só sugere quando o histórico é UNÂNIME sobre quem é o fornecedor — se dois fornecedores
 * diferentes casam com a mesma assinatura, não chuta: devolve null e o operador preenche.
 * Nada é gravado aqui; o humano confere antes de criar o pedido.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const linha = (new URL(request.url).searchParams.get('linha') || '').replace(/\D/g, '');
  if (![44, 47, 48].includes(linha.length)) {
    return NextResponse.json({ success: false, error: 'linha digitável inválida (44, 47 ou 48 dígitos)' }, { status: 400 });
  }
  // Banco sem layout conhecido → alvo.chave = null → nada casa. Segue só pra checar duplicado.
  const alvo = assinaturaCedente(linha);

  const supabase = await getAdminClient();
  const { data: hist, error } = await fin(supabase)
    .from('pedidos_pagamento')
    .select('id, status, valor, descricao, data_vencimento, linha_digitavel, beneficiario_nome, cpf_cnpj, contaazul_pessoa_id, categoria_id, categoria_nome, created_at')
    .eq('bar_id', user.bar_id)
    .not('linha_digitavel', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[BOLETO][IDENTIFICAR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const norm = (s?: string | null) => (s || '').trim().toLowerCase();
  const doc = (s?: string | null) => (s || '').replace(/\D/g, '');

  // 1) Duplicado: mesma linha digitável já lançada (ignora cancelado/recusado).
  const duplicado = (hist || []).find(
    (h: any) => doc(h.linha_digitavel) === linha && !['cancelado', 'recusado', 'rejeitado'].includes(String(h.status)),
  ) || null;

  // 2) Candidatos do mesmo cedente, do mais recente pro mais antigo.
  const candidatos = (hist || [])
    .map((h: any) => ({ h }))
    .filter((c: any) =>
      mesmoCedente(alvo, assinaturaCedente(doc(c.h.linha_digitavel)))
      && (c.h.beneficiario_nome || c.h.cpf_cnpj || c.h.contaazul_pessoa_id));

  let sugestao: Record<string, unknown> | null = null;
  if (candidatos.length) {
    // Unanimidade: todo mundo que casou tem que apontar pro mesmo fornecedor. A identidade é o
    // CNPJ; sem ele, o vínculo do CA; sem ele, o nome. Divergiu → não sugere nada.
    const idDe = (h: any) => doc(h.cpf_cnpj) || h.contaazul_pessoa_id || norm(h.beneficiario_nome);
    const ids = new Set(candidatos.map((c: any) => idDe(c.h)).filter(Boolean));
    if (ids.size === 1) {
      const melhor = candidatos[0].h; // mais recente (a query já vem ordenada)
      // Campos podem estar espalhados entre os pedidos antigos — pega o 1º preenchido de cada.
      const primeiro = (campo: string) => candidatos.map((c: any) => c.h[campo]).find((v: any) => !!v) || null;
      sugestao = {
        beneficiario_nome: primeiro('beneficiario_nome'),
        cpf_cnpj: primeiro('cpf_cnpj'),
        contaazul_pessoa_id: primeiro('contaazul_pessoa_id'),
        categoria_id: primeiro('categoria_id'),
        categoria_nome: primeiro('categoria_nome'),
        baseado_em: {
          pedido_id: melhor.id,
          descricao: melhor.descricao,
          created_at: melhor.created_at,
          ocorrencias: candidatos.length,
          cedente: alvo?.chave || null,
        },
      };
    }
  }

  return NextResponse.json({
    success: true,
    sugestao,
    duplicado: duplicado
      ? {
          id: duplicado.id, status: duplicado.status, valor: duplicado.valor,
          descricao: duplicado.descricao, data_vencimento: duplicado.data_vencimento,
          created_at: duplicado.created_at,
        }
      : null,
  });
}
