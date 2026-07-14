import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { linhaDigitavelValida } from '@/app/financeiro/pedidos-pagamento/boletoBarcode';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lê um boleto (foto ou PDF) com IA de visão e extrai os campos pra virar pedido.
 * POST /api/financeiro/boleto/ler  (multipart: file)
 * Retorna { valor, vencimento, beneficiario, cpf_cnpj, linha_digitavel, banco }.
 * NÃO grava nada — só extrai; o humano confere e confirma antes de criar o pedido.
 */
const PROMPT = `Você lê BOLETOS BANCÁRIOS brasileiros. Extraia os dados do boleto na imagem/PDF.
Responda APENAS com um JSON válido (sem texto antes ou depois), neste formato:
{
  "valor": number | null,            // valor do documento, em reais (ex.: 152.29)
  "vencimento": "AAAA-MM-DD" | null, // data de vencimento
  "beneficiario": string | null,     // nome do beneficiário/cedente (quem recebe)
  "cpf_cnpj": string | null,         // CPF/CNPJ do beneficiário, só dígitos
  "linha_digitavel": string | null,  // linha digitável, só dígitos (SEM pontos/espaços)
  "banco": string | null             // nome/numero do banco emissor
}
LINHA DIGITÁVEL — leia com MÁXIMA atenção, dígito por dígito, é o campo mais crítico:
- Boleto bancário tem EXATAMENTE 47 dígitos, agrupados como 5.5 5.6 5.6 1 14 (ex.: "34191.09099 96013.762933 83332.550009 1 15080000338016").
- Contas de consumo/tributo (começam com 8) têm 48 dígitos.
- Transcreva TODOS os dígitos, preserve zeros à esquerda, NÃO pule nem duplique nenhum. Confira o total antes de responder.
Se um campo não for legível, use null. Não invente.`;

// Instrução extra no retry quando a 1ª leitura da linha veio inválida (ex.: 46 dígitos = 1 perdido).
const RETRY_LINHA = (lida: string) =>
  `A linha digitável que você leu antes ("${lida}", ${lida.length} dígitos) está INVÁLIDA — o número de dígitos ou o dígito verificador não bate, provavelmente você pulou ou trocou um dígito. ` +
  `Releia a linha digitável do boleto MUITO devagar, dígito por dígito, conferindo os grupos (5.5 5.6 5.6 1 14 = 47 dígitos para boleto bancário). Responda o MESMO JSON, corrigindo só a linha_digitavel.`;

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: 'IA não configurada (ANTHROPIC_API_KEY)' }, { status: 500 });

  let file: File | null = null;
  try {
    const form = await request.formData();
    file = form.get('file') as File | null;
  } catch {
    return NextResponse.json({ success: false, error: 'envie o arquivo (multipart)' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ success: false, error: 'arquivo do boleto é obrigatório' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, error: 'arquivo acima de 10MB' }, { status: 400 });

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const mime = file.type || 'image/jpeg';
  const isPdf = mime === 'application/pdf';
  const block: any = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };

  // Estrutura sempre presente — a IA preenche o que conseguir ler; o resto fica null
  // e a pessoa completa manualmente. NUNCA falha dura: leitura parcial é o caso comum.
  const vazio = { valor: null, vencimento: null, beneficiario: null, cpf_cnpj: null, linha_digitavel: null, banco: null };

  const avisosDe = (d: any): string[] => {
    const faltando: string[] = [];
    if (d.valor == null) faltando.push('valor');
    if (!d.vencimento) faltando.push('vencimento');
    if (!d.linha_digitavel) faltando.push('linha digitável');
    else if (!linhaDigitavelValida(d.linha_digitavel)) faltando.push('linha digitável (confira os dígitos)');
    if (!d.beneficiario) faltando.push('beneficiário');
    return faltando;
  };

  // Uma passada da IA → JSON parseado (dados) + se leu algo. Aceita instrução extra (retry).
  const lerComIA = async (anthropic: Anthropic, extra?: string) => {
    const text = extra ? `${PROMPT}\n\n${extra}` : PROMPT;
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [block, { type: 'text', text }] }],
    });
    // Concatena TODOS os blocos de texto (mais robusto que content[0]).
    const texto = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    let dados: any = { ...vazio };
    let leu = false;
    if (jsonMatch) {
      try { dados = { ...vazio, ...JSON.parse(jsonMatch[0]) }; leu = true; } catch { /* parse falhou → segue vazio */ }
    }
    if (dados.cpf_cnpj) dados.cpf_cnpj = String(dados.cpf_cnpj).replace(/\D/g, '');
    if (dados.linha_digitavel) dados.linha_digitavel = String(dados.linha_digitavel).replace(/\D/g, '');
    return { dados, leu };
  };

  try {
    const anthropic = new Anthropic({ apiKey });
    let { dados, leu } = await lerComIA(anthropic);

    // Se a linha veio mas está inválida (ex.: 46 díg. = 1 dígito perdido no OCR), tenta UMA
    // releitura focada. Fica com a versão válida; se nenhuma validar, mantém a 1ª (a pessoa corrige).
    if (dados.linha_digitavel && !linhaDigitavelValida(dados.linha_digitavel)) {
      try {
        const retry = await lerComIA(anthropic, RETRY_LINHA(dados.linha_digitavel));
        if (retry.dados.linha_digitavel && linhaDigitavelValida(retry.dados.linha_digitavel)) {
          dados = { ...dados, ...retry.dados };
          leu = leu || retry.leu;
        }
      } catch { /* retry best-effort — segue com a 1ª leitura */ }
    }

    const linha_valida = !!dados.linha_digitavel && linhaDigitavelValida(dados.linha_digitavel);
    // Sempre 200: mesmo sem ler nada, a pessoa preenche manualmente. `leu`+`avisos` guiam a UI.
    return NextResponse.json({ success: true, leu, dados, linha_valida, avisos: avisosDe(dados) });
  } catch (e: any) {
    console.error('[boleto/ler]', e);
    // IA indisponível/erro: devolve estrutura vazia p/ preenchimento manual (não trava o fluxo).
    return NextResponse.json({
      success: true, leu: false, dados: { ...vazio }, avisos: avisosDe(vazio),
      erro_ia: e?.message || 'erro na leitura por IA',
    });
  }
}
