import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();
const num = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);

// Consumo por horário (top-N produtos por hora) — ContaHub qry=95 via gold.consumo_por_horario.
// Serve o gráfico dentro do evento (1 dia) e a futura aba Produtos (intervalo).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get('data'); // dia único
    const inicio = searchParams.get('inicio') || data;
    const fim = searchParams.get('fim') || data;
    const barIdParam = searchParams.get('bar_id');
    const top = parseInt(searchParams.get('top') || '5');
    const categoria = searchParams.get('categoria'); // COMIDA/BEBIDA/DRINK ou null
    const metric = searchParams.get('metric') === 'valor' ? 'valor' : 'qtd';

    if (!inicio || !fim || !barIdParam) {
      return NextResponse.json(
        { success: false, error: 'data (ou inicio/fim) e bar_id são obrigatórios' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    const { data: rows, error } = await (supabase as any).rpc('consumo_por_horario', {
      p_bar_id: barId,
      p_data_inicio: inicio,
      p_data_fim: fim,
      p_top: top,
      p_categoria: categoria,
      p_metric: metric,
    });
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar consumo por hora', details: error.message },
        { status: 500 }
      );
    }

    // Agrupa por hora: top-N produtos + "Outros" (total − soma do top-N)
    const porHora = new Map<number, any>();
    for (const r of (rows || []) as any[]) {
      const h = Number(r.hora);
      if (!porHora.has(h)) {
        porHora.set(h, {
          hora: h,
          total_qtd: num(r.hora_total_qtd),
          total_valor: num(r.hora_total_valor),
          produtos: [] as any[],
        });
      }
      porHora.get(h).produtos.push({
        produto: r.produto_desc,
        grupo: r.grupo_desc,
        categoria: r.categoria_mix,
        quantidade: num(r.quantidade),
        valor: num(r.valor),
        rank: Number(r.rank),
      });
    }

    const horas = Array.from(porHora.values())
      .sort((a, b) => a.hora - b.hora)
      .map((h) => {
        const somaTopQtd = h.produtos.reduce((s: number, p: any) => s + p.quantidade, 0);
        const somaTopValor = h.produtos.reduce((s: number, p: any) => s + p.valor, 0);
        const outrosQtd = Math.max(0, h.total_qtd - somaTopQtd);
        const outrosValor = Math.max(0, h.total_valor - somaTopValor);
        return {
          ...h,
          outros_qtd: outrosQtd,
          outros_valor: outrosValor,
        };
      });

    return NextResponse.json({
      success: true,
      bar_id: barId,
      inicio,
      fim,
      metric,
      categoria: categoria || null,
      horas,
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
