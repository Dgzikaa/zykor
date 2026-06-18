import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
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
  "linha_digitavel": string | null,  // linha digitável, só dígitos (47 ou 48)
  "banco": string | null             // nome/numero do banco emissor
}
Se um campo não for legível, use null. Não invente. A linha digitável é a sequência de números no topo do boleto.`;

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

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }],
    });
    const texto = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ success: false, error: 'não consegui ler o boleto', bruto: texto }, { status: 422 });
    const dados = JSON.parse(jsonMatch[0]);
    if (dados.cpf_cnpj) dados.cpf_cnpj = String(dados.cpf_cnpj).replace(/\D/g, '');
    if (dados.linha_digitavel) dados.linha_digitavel = String(dados.linha_digitavel).replace(/\D/g, '');
    return NextResponse.json({ success: true, dados });
  } catch (e: any) {
    console.error('[boleto/ler]', e);
    return NextResponse.json({ success: false, error: e?.message || 'erro na leitura por IA' }, { status: 500 });
  }
}
