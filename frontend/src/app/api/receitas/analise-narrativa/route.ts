import { NextRequest, NextResponse } from 'next/server';
import { zykorAI } from '@/lib/ai/setup';

/**
 * Narrativa IA-assistida (Bloco 3) — gera RASCUNHO dos cards de análise
 * (Problemas / Oportunidades / Reflexões) a partir do comparativo de dia-da-semana
 * (3 janelas) + contexto do período que o sócio informa. O sócio edita/aprova depois.
 *
 * POST { mes, labels, dias, contexto }
 *   dias = saída de /api/receitas/analise-dia-semana
 * Retorna { problemas:[{titulo,texto}], oportunidades:[...], reflexoes:[...] }
 */
export const dynamic = 'force-dynamic';

const SYSTEM = `Você é o analista de receita de um bar/casa de shows, escrevendo em português do Brasil.
Recebe o faturamento MÉDIO por dia da semana do mês de referência comparado em 3 janelas:
YoY (mesmo mês do ano anterior), MoM (mês anterior) e Tri (média do trimestre anterior),
com os deltas (%) e a classificação (promotor = subiu, detrator = caiu) por janela.
Também recebe o CONTEXTO do período (mudanças de operação: programação, happy hour, temáticas, eventos).

Regras:
- Baseie-se nos NÚMEROS fornecidos. Cite deltas e dias concretos.
- Se o contexto explicar uma variação, conecte causa→efeito. Se NÃO houver contexto pra um dado, descreva o padrão SEM inventar causa.
- Problemas: dias/janelas que caíram (detratores) e merecem atenção.
- Oportunidades: dias que cresceram (promotores) pra escalar, ou dias fracos com potencial.
- Reflexões: leituras estratégicas do trimestre.
- Seja específico e curto (cada texto 1-3 frases). Nada de encher linguiça.

Responda SOMENTE com JSON válido, sem markdown, no formato:
{"problemas":[{"titulo":"...","texto":"..."}],"oportunidades":[{"titulo":"...","texto":"..."}],"reflexoes":[{"titulo":"...","texto":"..."}]}`;

function parseJson(content: string): any | null {
  const limpo = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const m = limpo.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'body inválido' }, { status: 400 });
  }

  const { mes, labels, dias, contexto } = body || {};
  if (!Array.isArray(dias) || !dias.length) {
    return NextResponse.json({ success: false, error: 'dias (comparativo) é obrigatório' }, { status: 400 });
  }

  const query = [
    `Mês de referência: ${labels?.atual ?? mes}.`,
    `Janelas de comparação — YoY: ${labels?.yoy ?? '?'}, MoM: ${labels?.mom ?? '?'}, Tri: ${labels?.tri ?? '?'}.`,
    contexto?.trim() ? `Contexto do período (informado pelo sócio):\n${contexto.trim()}` : 'Contexto do período: (não informado — não invente causas).',
    'Gere os cards de análise conforme as regras.',
  ].join('\n\n');

  try {
    const resp = await zykorAI.processQuery(query, { comparativo_dia_semana: dias }, SYSTEM);
    const parsed = parseJson(resp.content);
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'IA não retornou JSON válido', raw: resp.content?.slice(0, 500) }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      problemas: parsed.problemas ?? [],
      oportunidades: parsed.oportunidades ?? [],
      reflexoes: parsed.reflexoes ?? [],
      meta: { provider: resp.provider, model: resp.model, tokens: resp.tokensUsed },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao gerar narrativa' }, { status: 500 });
  }
}
