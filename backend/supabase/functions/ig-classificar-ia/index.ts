/**
 * 🤖 Classificar comments + DMs via Claude
 *
 * Itera comments e mensagens com sentimento/categoria NULL e classifica
 * via Anthropic API. Atualiza colunas sentimento + categoria.
 *
 * Sentimento: positivo | neutro | negativo
 * Categoria: reserva | duvida | reclamacao | elogio | spam | outro
 *
 * Roda a cada 10min via cron. Batch de até 20 por execução pra evitar
 * gastar muito token de uma vez.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODELO = 'claude-haiku-4-5-20251001';

interface Classificacao {
  sentimento: 'positivo' | 'neutro' | 'negativo';
  categoria: 'reserva' | 'duvida' | 'reclamacao' | 'elogio' | 'spam' | 'outro';
}

async function classificarLote(textos: string[]): Promise<(Classificacao | null)[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return textos.map(() => null);

  const prompt = `Voce eh um classificador de comentarios/DMs de bar (Ordinario Bar / Deboche Bar) no Instagram.

Para cada texto, retorne:
- sentimento: positivo | neutro | negativo
- categoria: reserva | duvida | reclamacao | elogio | spam | outro

Exemplos:
- "como faço reserva?" → { sentimento: "neutro", categoria: "reserva" }
- "amei o show ontem!" → { sentimento: "positivo", categoria: "elogio" }
- "demoraram 1h pra trazer minha comida" → { sentimento: "negativo", categoria: "reclamacao" }
- "qual o horario?" → { sentimento: "neutro", categoria: "duvida" }

Textos a classificar (1 por linha, numerados):
${textos.map((t, i) => `${i + 1}. ${t.replace(/\n/g, ' ').slice(0, 300)}`).join('\n')}

Responda APENAS com JSON array no formato:
[{"sentimento":"...","categoria":"..."}, ...]
mesma ordem dos textos.`;

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) {
      console.error('[ig-classificar] anthropic erro:', await r.text());
      return textos.map(() => null);
    }
    const j = await r.json();
    const content = j.content?.[0]?.text || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return textos.map(() => null);
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (e) {
    console.error('[ig-classificar] erro:', e);
    return textos.map(() => null);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pega 20 comments + 20 mensagens não classificados
    const { data: comments } = await supabase
      .schema('integrations').from('instagram_comentarios')
      .select('id, texto').is('sentimento', null).not('texto', 'is', null)
      .order('id', { ascending: false }).limit(20);

    const { data: mensagens } = await supabase
      .schema('integrations').from('instagram_mensagens')
      .select('id, texto').eq('autor', 'cliente').is('sentimento', null).not('texto', 'is', null)
      .order('id', { ascending: false }).limit(20);

    let classificadosComments = 0;
    let classificadasMsgs = 0;

    if (comments?.length) {
      const textos = comments.map((c: any) => c.texto);
      const classif = await classificarLote(textos);
      for (let i = 0; i < comments.length; i++) {
        const c = classif[i];
        if (!c) continue;
        const { error } = await supabase.schema('integrations').from('instagram_comentarios')
          .update({ sentimento: c.sentimento, categoria: c.categoria })
          .eq('id', comments[i].id);
        if (!error) classificadosComments++;
      }
    }

    if (mensagens?.length) {
      const textos = mensagens.map((m: any) => m.texto);
      const classif = await classificarLote(textos);
      for (let i = 0; i < mensagens.length; i++) {
        const c = classif[i];
        if (!c) continue;
        const { error } = await supabase.schema('integrations').from('instagram_mensagens')
          .update({ sentimento: c.sentimento, categoria: c.categoria })
          .eq('id', mensagens[i].id);
        if (!error) classificadasMsgs++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        comments_processados: comments?.length ?? 0,
        comments_classificados: classificadosComments,
        mensagens_processadas: mensagens?.length ?? 0,
        mensagens_classificadas: classificadasMsgs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, erro: e?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
