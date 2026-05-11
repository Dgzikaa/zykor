import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
const MODEL = 'claude-haiku-4-5';
const BATCH_SIZE = 10;
const MAX_REVIEWS_POR_CHAMADA = 30;

/**
 * GET /api/ferramentas/insights/reviews-nlp?bar_id=N&data_inicio=...&data_fim=...&analisar=true
 *
 * Análise de temas dos reviews via IA (Anthropic).
 *
 * - Sempre retorna a agregação dos reviews JÁ ANALISADOS no período
 * - Se analisar=true, processa em segundo plano reviews novos (sem análise)
 *   em lotes de 10, max 30 por chamada
 *
 * Fonte: bronze.bronze_google_reviews + bronze.bronze_falae_respostas
 * Cache: public.review_analise_temas
 */
export const maxDuration = 120;

interface AnaliseIA {
  ref_id: string;
  temas: string[];
  sentimento: 'positivo' | 'neutro' | 'negativo';
}

async function analisarLote(reviews: Array<{ ref_id: string; texto: string; stars: number | null }>): Promise<AnaliseIA[]> {
  const lista = reviews
    .map((r, i) => `[${i + 1}] (id=${r.ref_id}) stars=${r.stars ?? 'n/a'}\n${r.texto.slice(0, 500)}`)
    .join('\n\n---\n\n');

  const prompt = `Analise os reviews de um bar abaixo. Para CADA UM, extraia:
- temas: array de 1 a 3 temas principais em PORTUGUÊS minúsculo, ex: "comida", "atendimento", "ambiente", "música", "preço", "drink", "fila", "banheiro", "estacionamento", "demora", "cerveja", "couvert", "espaço", "limpeza"
- sentimento: "positivo", "neutro" ou "negativo"

Reviews:
${lista}

Retorne SOMENTE JSON, sem markdown, no formato:
{"reviews":[{"ref_id":"...","temas":["..."],"sentimento":"..."}]}`;

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const txt = resp.content[0]?.type === 'text' ? resp.content[0].text : '';
  const limpo = txt.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(limpo);
    return Array.isArray(parsed.reviews) ? parsed.reviews : [];
  } catch {
    console.error('[reviews-nlp] JSON inválido:', limpo.slice(0, 200));
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const dataInicio = sp.get('data_inicio');
    const dataFim = sp.get('data_fim');
    const analisar = sp.get('analisar') === 'true';

    if (!barId || !dataInicio || !dataFim) {
      return NextResponse.json({ error: 'bar_id, data_inicio e data_fim obrigatórios' }, { status: 400 });
    }

    let analisadosAgora = 0;
    let erros: string[] = [];

    // Processar reviews novos se solicitado
    if (analisar) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 });
      }

      // 1. Buscar reviews Google ainda não analisados
      const { data: jaAnalisados } = await supabase
        .schema('public' as never)
        .from('review_analise_temas')
        .select('fonte, ref_id')
        .eq('bar_id', barId)
        .gte('data_review', dataInicio)
        .lte('data_review', dataFim);

      const setExist = new Set<string>(
        (jaAnalisados ?? []).map((r: any) => `${r.fonte}:${r.ref_id}`),
      );

      // Google reviews
      const { data: googleRevs } = await supabase
        .schema('bronze' as never)
        .from('bronze_google_reviews')
        .select('review_id, text, stars, published_at_date')
        .eq('bar_id', barId)
        .gte('published_at_date', dataInicio)
        .lte('published_at_date', dataFim)
        .not('text', 'is', null)
        .order('published_at_date', { ascending: false })
        .limit(MAX_REVIEWS_POR_CHAMADA * 2);

      // Falaê (texto vem em discursive_question)
      const { data: falaeRevs } = await supabase
        .schema('bronze' as never)
        .from('bronze_falae_respostas')
        .select('falae_id, discursive_question, nps, data_visita')
        .eq('bar_id', barId)
        .gte('data_visita', dataInicio)
        .lte('data_visita', dataFim)
        .not('discursive_question', 'is', null)
        .order('data_visita', { ascending: false })
        .limit(MAX_REVIEWS_POR_CHAMADA * 2);

      type ToAnalyze = {
        fonte: 'google' | 'falae';
        ref_id: string;
        texto: string;
        stars: number | null;
        data_review: string;
      };

      const novos: ToAnalyze[] = [];
      for (const r of googleRevs ?? []) {
        const refId = String((r as any).review_id);
        if (setExist.has(`google:${refId}`)) continue;
        const txt = String((r as any).text || '').trim();
        if (txt.length < 8) continue;
        novos.push({
          fonte: 'google',
          ref_id: refId,
          texto: txt,
          stars: Number((r as any).stars) || null,
          data_review: String((r as any).published_at_date).split('T')[0],
        });
      }
      for (const r of falaeRevs ?? []) {
        const refId = String((r as any).falae_id);
        if (setExist.has(`falae:${refId}`)) continue;
        const txt = String((r as any).discursive_question || '').trim();
        if (txt.length < 8) continue;
        novos.push({
          fonte: 'falae',
          ref_id: refId,
          texto: txt,
          stars: null,
          data_review: String((r as any).data_visita).split('T')[0],
        });
      }

      // Limitar
      const aProcessar = novos.slice(0, MAX_REVIEWS_POR_CHAMADA);

      // Analisar em lotes
      for (let i = 0; i < aProcessar.length; i += BATCH_SIZE) {
        const lote = aProcessar.slice(i, i + BATCH_SIZE);
        try {
          const analises = await analisarLote(
            lote.map(r => ({ ref_id: r.ref_id, texto: r.texto, stars: r.stars })),
          );

          const inserts = analises
            .map(a => {
              const orig = lote.find(l => l.ref_id === a.ref_id);
              if (!orig) return null;
              return {
                bar_id: barId,
                fonte: orig.fonte,
                ref_id: orig.ref_id,
                data_review: orig.data_review,
                stars: orig.stars,
                texto: orig.texto.slice(0, 1000),
                temas: a.temas?.slice(0, 5) ?? [],
                sentimento: ['positivo', 'neutro', 'negativo'].includes(a.sentimento) ? a.sentimento : 'neutro',
                modelo: MODEL,
              };
            })
            .filter(Boolean) as any[];

          if (inserts.length > 0) {
            const { error: errIns } = await supabase
              .schema('public' as never)
              .from('review_analise_temas')
              .upsert(inserts, { onConflict: 'fonte,ref_id' });
            if (errIns) erros.push(errIns.message);
            else analisadosAgora += inserts.length;
          }
        } catch (e: any) {
          erros.push(e?.message || 'Erro no lote');
        }
      }
    }

    // Agregação dos analisados no período
    const { data: analisados } = await supabase
      .schema('public' as never)
      .from('review_analise_temas')
      .select('fonte, ref_id, data_review, stars, texto, temas, sentimento')
      .eq('bar_id', barId)
      .gte('data_review', dataInicio)
      .lte('data_review', dataFim)
      .order('data_review', { ascending: false });

    type A = { fonte: string; ref_id: string; data_review: string; stars: number | null; texto: string; temas: string[]; sentimento: string };
    const arr = (analisados ?? []) as A[];

    const temaMap = new Map<string, { total: number; positivos: number; neutros: number; negativos: number; exemplos: string[] }>();
    let totPositivos = 0, totNeutros = 0, totNegativos = 0;
    for (const r of arr) {
      if (r.sentimento === 'positivo') totPositivos++;
      else if (r.sentimento === 'neutro') totNeutros++;
      else if (r.sentimento === 'negativo') totNegativos++;
      for (const t of r.temas ?? []) {
        const tema = String(t).toLowerCase().trim();
        if (!tema) continue;
        const cur = temaMap.get(tema) ?? { total: 0, positivos: 0, neutros: 0, negativos: 0, exemplos: [] };
        cur.total += 1;
        if (r.sentimento === 'positivo') cur.positivos += 1;
        else if (r.sentimento === 'neutro') cur.neutros += 1;
        else if (r.sentimento === 'negativo') cur.negativos += 1;
        if (cur.exemplos.length < 3 && r.texto) cur.exemplos.push(r.texto.slice(0, 180));
        temaMap.set(tema, cur);
      }
    }

    const temas = Array.from(temaMap.entries())
      .map(([tema, v]) => ({
        tema,
        total: v.total,
        positivos: v.positivos,
        neutros: v.neutros,
        negativos: v.negativos,
        pct_positivo: v.total > 0 ? (v.positivos / v.total) * 100 : 0,
        pct_negativo: v.total > 0 ? (v.negativos / v.total) * 100 : 0,
        exemplos: v.exemplos,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, data_fim: dataFim },
      processou_agora: analisadosAgora,
      erros: erros.length > 0 ? erros : undefined,
      total_reviews_analisados: arr.length,
      sentimento: { positivos: totPositivos, neutros: totNeutros, negativos: totNegativos },
      temas,
    });
  } catch (err: any) {
    console.error('[reviews-nlp] exceção', err);
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 });
  }
}
