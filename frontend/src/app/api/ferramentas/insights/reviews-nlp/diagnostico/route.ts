import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * GET /api/ferramentas/insights/reviews-nlp/diagnostico
 * Endpoint de teste rápido pra confirmar:
 *  - ANTHROPIC_API_KEY presente
 *  - Anthropic responde no Vercel
 *  - Modelo claude-haiku-4-5 disponível
 */
export const maxDuration = 30;

export async function GET() {
  const result: any = {
    has_anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY),
    key_length: (process.env.ANTHROPIC_API_KEY || '').length,
    has_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    has_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  if (!result.has_anthropic_key) {
    return NextResponse.json({ ok: false, ...result, error: 'ANTHROPIC_API_KEY ausente' }, { status: 500 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const t0 = Date.now();
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 30,
      messages: [{ role: 'user', content: 'Responda só "ok"' }],
    });
    const t1 = Date.now();
    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : '';
    return NextResponse.json({
      ok: true,
      ...result,
      anthropic_response: text,
      duration_ms: t1 - t0,
      model: resp.model,
      usage: resp.usage,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      ...result,
      error: e?.message || String(e),
      status: e?.status,
      type: e?.constructor?.name,
    }, { status: 500 });
  }
}
