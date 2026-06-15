import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);

// Detalhe da cesta de consumo de um evento (ContaHub + Yuzer), para auditoria do Mix.
// Lê o RPC public.evento_cesta_detalhe e devolve agrupado por categoria.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data');
    const barIdParam = searchParams.get('bar_id');
    if (!data || !barIdParam) {
      return NextResponse.json(
        { success: false, error: 'data e bar_id são obrigatórios' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    const { data: rows, error } = await (supabase as any).rpc('evento_cesta_detalhe', {
      p_bar_id: barId,
      p_data: data,
    });
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar cesta', details: error.message },
        { status: 500 }
      );
    }

    type Item = {
      sistema: string;
      categoria: string;
      grupo: string;
      produto: string;
      quantidade: number;
      valor: number;
    };
    const itens: Item[] = ((rows || []) as any[])
      .map((r) => ({
        sistema: r.sistema,
        categoria: r.categoria,
        grupo: r.grupo,
        produto: r.produto,
        quantidade: num(r.quantidade),
        valor: num(r.valor),
      }))
      .sort((a, b) => b.valor - a.valor);

    // categorias da cesta (entram no mix) e as fora dela
    const ORDEM = ['comida', 'bebida', 'drink', 'sem_classificacao', 'eco_copo', 'ingresso', 'fora'];
    const grupos = ORDEM.map((cat) => {
      const lista = itens.filter((i) => i.categoria === cat);
      return {
        categoria: cat,
        total_valor: lista.reduce((s, i) => s + i.valor, 0),
        total_qtd: lista.reduce((s, i) => s + i.quantidade, 0),
        itens: lista,
      };
    }).filter((g) => g.itens.length > 0);

    const cestaCats = ['comida', 'bebida', 'drink'];
    const totalCesta = grupos
      .filter((g) => cestaCats.includes(g.categoria))
      .reduce((s, g) => s + g.total_valor, 0);

    return NextResponse.json({
      success: true,
      data,
      bar_id: barId,
      total_cesta: totalCesta,
      grupos,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno',
        details: error instanceof Error ? error.message : 'desconhecido',
      },
      { status: 500 }
    );
  }
}
