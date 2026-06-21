import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/ferramentas/insumos/sincronizar-mestre
 * Sincroniza custo + fornecedor + embalagem do cadastro de insumos (bar 3) a partir
 * das planilhas mestre do Google Sheets, casando por código (i0XXX).
 * - Custo geral/cozinha: aba INSUMOS (A=preço, D=cód, E=categoria).
 * - Drinks: aba base_ingredientes (B=cód, D=fornecedor, E=quantidade/embalagem, G=valor).
 */
const SHEET_CUSTO = '1Se2Gwy7oRJ5H1ZQtUqZwL2g_H90SPiYFRHtsJVBHGIk';
const SHEET_DRINKS = '1mAVk0YJEx6HiWc2Dx87ea6pqKsrBc-AdCGSjn_KU59I';

const parseBRL = (s: string): number | null => {
  if (!s) return null;
  const v = s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function fetchSheet(id: string, range: string, key: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?key=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets ${id.slice(0, 8)}…: HTTP ${r.status}`);
  const j = await r.json();
  return (j.values as string[][]) || [];
}

type Row = { codigo: string; custo: number | null; fornecedor: string | null; embalagem: string | null; categoria: string | null };

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.bar_id !== 3) {
    return NextResponse.json({ success: false, error: 'Importador disponível só para o Ordinário (bar 3) por enquanto.' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data: creds } = await (supabase as any)
    .from('api_credentials').select('configuracoes').eq('sistema', 'google_sheets').eq('bar_id', 3).limit(1);
  const key = creds?.[0]?.configuracoes?.api_key;
  if (!key) return NextResponse.json({ success: false, error: 'API key do Google Sheets não encontrada' }, { status: 500 });

  const map = new Map<string, Row>();
  const up = (codigo: string): Row => {
    let m = map.get(codigo);
    if (!m) { m = { codigo, custo: null, fornecedor: null, embalagem: null, categoria: null }; map.set(codigo, m); }
    return m;
  };

  try {
    const custoRows = await fetchSheet(SHEET_CUSTO, 'INSUMOS!A6:G2000', key);
    for (const row of custoRows) {
      const codigo = (row[3] || '').toString().trim();
      if (!/^i\d/.test(codigo)) continue;
      const m = up(codigo);
      const c = parseBRL((row[0] || '').toString());
      if (c) m.custo = c;
      const cat = (row[4] || '').toString().trim();
      if (cat) m.categoria = cat;
    }
    const drinkRows = await fetchSheet(SHEET_DRINKS, 'base_ingredientes!A4:N2000', key);
    for (const row of drinkRows) {
      const codigo = (row[1] || '').toString().trim();
      if (!/^i\d/.test(codigo)) continue;
      const m = up(codigo);
      const forn = (row[3] || '').toString().trim();
      if (forn) m.fornecedor = forn;
      const qtd = (row[4] || '').toString().trim();
      if (qtd) m.embalagem = qtd;
      if (!m.custo) { const v = parseBRL((row[6] || '').toString()); if (v) m.custo = v; }
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: `Falha ao ler planilhas: ${e?.message}` }, { status: 502 });
  }

  const rows = Array.from(map.values());
  if (!rows.length) return NextResponse.json({ success: false, error: 'Nenhuma linha lida das planilhas' }, { status: 400 });

  const { data, error } = await (supabase as any).schema('operations').rpc('upsert_insumos_master', { p_bar_id: 3, p_rows: rows });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const res = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    success: true,
    lidos: rows.length,
    atualizados: Number(res?.atualizados ?? 0),
    sem_match: Number(res?.sem_match ?? 0),
  });
}
