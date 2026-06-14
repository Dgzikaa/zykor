import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getOrcamentacaoCompleta } from '@/app/estrategico/orcamentacao/services/orcamentacao-service';

// Rota dinamica (usa request.url) — cache via headers HTTP na resposta
export const dynamic = 'force-dynamic';
export const revalidate = 120;

// IMPORTANTE: esta rota (botao "Atualizar") DEVE usar a MESMA fonte do
// carregamento inicial (page.tsx -> getOrcamentacaoCompleta). Antes ela tinha
// uma estrutura de categorias propria e divergente (ex: 'CMV' em %, 'RECEITA
// BRUTA', 'CUSTO-EMPRESA FUNCIONARIOS'), entao ao clicar Atualizar a tabela
// inteira trocava de formato. Agora delega pro service: uma fonte de verdade so.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const mesInicio = searchParams.get('mes_inicio') || '1';
    const quantidade = parseInt(searchParams.get('quantidade') || '12');

    if (!barId || !ano) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const data = await getOrcamentacaoCompleta(
      supabase,
      parseInt(barId),
      parseInt(ano),
      parseInt(mesInicio),
      quantidade
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro na API de orçamento todos-meses:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
