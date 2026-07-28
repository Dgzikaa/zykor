import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createServiceRoleClient();

/** PostgREST corta em 1000 por request — paginamos até acabar. */
const PAGINA = 1000;

const COLUNAS: Array<{ key: string; label: string; num?: boolean }> = [
  { key: 'cliente_nome', label: 'Cliente' },
  { key: 'cliente_fone_norm', label: 'Telefone' },
  { key: 'segmento', label: 'Segmento' },
  { key: 'frequencia', label: 'Visitas' },
  { key: 'recencia_dias', label: 'Dias sem vir' },
  { key: 'ticket_medio', label: 'Ticket médio', num: true },
  { key: 'monetario', label: 'Total gasto', num: true },
  { key: 'ultima_visita', label: 'Última visita' },
  { key: 'primeira_visita', label: 'Primeira visita' },
];

function celula(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/analitico/clientes/rfm/export?bar_id=3[&segmento=Em risco]
 *
 * CSV da base INTEIRA de RFM, em streaming.
 *
 * A tela usa /rfm, que devolve no máximo 500 linhas (é lista pra olhar, não pra exportar) — e o
 * botão exportava só o que estava na memória, 100 clientes. Como o Ordinário tem ~119 mil
 * clientes, não dá pra resolver subindo o limite: carregar isso no state trava o navegador.
 *
 * Aqui o CSV é montado no servidor e vai saindo por página de 1000, sem nunca ter a base toda
 * em memória. Mesmo formato do export-csv.ts do front (separador ';' + BOM) pra abrir no Excel
 * pt-BR com acento certo.
 */
export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = req.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
  const segmento = sp.get('segmento');

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('﻿' + COLUNAS.map(c => celula(c.label)).join(';') + '\r\n'));

        for (let inicio = 0; ; inicio += PAGINA) {
          let q = (supabase as any)
            .schema('crm')
            .from('cliente_rfm')
            .select(COLUNAS.map(c => c.key).join(','))
            .eq('bar_id', barId)
            .order('monetario', { ascending: false })
            // desempate estável: sem isso o Postgres pode repetir/pular linha entre páginas
            .order('cliente_fone_norm', { ascending: true })
            .range(inicio, inicio + PAGINA - 1);
          if (segmento) q = q.eq('segmento', segmento);

          const { data, error } = await q;
          if (error) throw error;
          const linhas = (data || []) as any[];
          if (linhas.length === 0) break;

          const bloco = linhas.map((row) =>
            COLUNAS.map((c) => {
              const v = row[c.key];
              return celula(c.num ? Number(v ?? 0).toFixed(2) : v);
            }).join(';'),
          ).join('\r\n');
          controller.enqueue(encoder.encode(bloco + '\r\n'));

          if (linhas.length < PAGINA) break;
        }
        controller.close();
      } catch (e: any) {
        console.error('[rfm/export] erro:', e);
        // Já foi enviado header/linhas: não dá pra virar 500. Marca no próprio arquivo pra
        // ninguém tratar um CSV truncado como se fosse a base completa.
        controller.enqueue(encoder.encode(`\r\n"ERRO NA EXPORTACAO - ARQUIVO INCOMPLETO: ${String(e?.message || e).replace(/"/g, "'")}"\r\n`));
        controller.close();
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const nome = `segmentos-${segmento ? segmento.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() : 'todos'}-${stamp}.csv`;
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  });
}
