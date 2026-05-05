import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Normaliza nome: lower, sem acento, espaços colapsados, remove sufixo "(Excluído)". */
function normalizar(nome: string): string {
  return String(nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(excluido\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trigram set (igual ao pg_trgm: padding 2 espaços antes, 1 depois). */
function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

/** Similarity 0..1 estilo pg_trgm (Jaccard sobre trigrams). */
function similaridade(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersec = 0;
  for (const t of ta) if (tb.has(t)) intersec += 1;
  const uniao = ta.size + tb.size - intersec;
  return uniao === 0 ? 0 : intersec / uniao;
}

interface CandidatoEntrada {
  nome: string;
  documento?: string | null;
}

interface FornecedorLocal {
  contaazul_id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
}

interface MatchResultado {
  input: CandidatoEntrada;
  tipo: 'doc' | 'exact' | 'fuzzy' | 'none';
  pessoa: FornecedorLocal | null;
  score: number;
  similares: Array<{ contaazul_id: string; nome: string; score: number }>;
}

const SIM_FUZZY = 0.85; // limite pra match automático
const SIM_SUGESTAO = 0.55; // limite pra exibir como sugestão

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = Number(body.bar_id);
    const candidatos: CandidatoEntrada[] = Array.isArray(body.candidatos) ? body.candidatos : [];

    if (!Number.isFinite(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    if (candidatos.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const supabase = getSupabaseAdmin();
    // Pagina manualmente — Supabase tem default limit 1000 e Ord tem 1375+ fornecedores
    const fornecedoresRaw: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data: pessoas, error } = await (supabase
        .schema('integrations' as any) as any)
        .from('contaazul_pessoas')
        .select('contaazul_id, nome, documento, email, telefone, perfil, ativo')
        .eq('bar_id', barId)
        .eq('perfil', 'FORNECEDOR')
        .neq('ativo', false)
        .range(from, from + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const arr = (pessoas as any[]) || [];
      fornecedoresRaw.push(...arr);
      if (arr.length < PAGE) break;
      from += PAGE;
      if (from > 50000) break; // hard cap segurança
    }
    const pessoas = fornecedoresRaw;
    const error: null = null;
    void error;

    // Filtra "(Excluído)" no nome — soft-delete CA que não veio com ativo=false
    const fornecedores: FornecedorLocal[] = ((pessoas as any[]) || [])
      .filter(p => p.contaazul_id && !/\(excluido\)/i.test(String(p.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')))
      .map(p => ({
        contaazul_id: p.contaazul_id,
        nome: p.nome,
        documento: (p.documento || '').replace(/\D/g, '') || null,
        email: p.email || null,
        telefone: p.telefone || null,
      }));

    // Pré-computa normalizações
    const indexNorm = fornecedores.map(f => ({
      f,
      nomeNorm: normalizar(f.nome),
    }));
    const porDoc = new Map<string, FornecedorLocal>();
    const porNomeNorm = new Map<string, FornecedorLocal>();
    for (const { f, nomeNorm } of indexNorm) {
      if (f.documento) porDoc.set(f.documento, f);
      if (nomeNorm) porNomeNorm.set(nomeNorm, f);
    }

    const matches: MatchResultado[] = candidatos.map(cand => {
      const docLimpo = String(cand.documento || '').replace(/\D/g, '');
      const nomeNorm = normalizar(cand.nome);

      // L1: match por documento (mais forte)
      if (docLimpo.length === 11 || docLimpo.length === 14) {
        const hit = porDoc.get(docLimpo);
        if (hit) {
          return { input: cand, tipo: 'doc', pessoa: hit, score: 1, similares: [] };
        }
      }

      // L2: match exato por nome normalizado
      const exato = porNomeNorm.get(nomeNorm);
      if (exato) {
        return { input: cand, tipo: 'exact', pessoa: exato, score: 1, similares: [] };
      }

      // L3: fuzzy
      const ranked = indexNorm
        .map(({ f, nomeNorm: nf }) => ({
          f,
          score: similaridade(nomeNorm, nf),
        }))
        .filter(r => r.score >= SIM_SUGESTAO)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const top = ranked[0];
      if (top && top.score >= SIM_FUZZY) {
        return {
          input: cand,
          tipo: 'fuzzy',
          pessoa: top.f,
          score: top.score,
          similares: ranked.slice(1).map(r => ({
            contaazul_id: r.f.contaazul_id,
            nome: r.f.nome,
            score: r.score,
          })),
        };
      }

      return {
        input: cand,
        tipo: 'none',
        pessoa: null,
        score: 0,
        similares: ranked.map(r => ({
          contaazul_id: r.f.contaazul_id,
          nome: r.f.nome,
          score: r.score,
        })),
      };
    });

    return NextResponse.json({
      matches,
      total_fornecedores_indexados: fornecedores.length,
    });
  } catch (err: any) {
    console.error('[CA-MATCH] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 });
  }
}
