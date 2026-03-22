import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ativo = searchParams.get('ativo') !== 'false'; // default: true
    const somentePagamento = searchParams.get('somente_pagamento') === 'true';

    // Validar bar_id - OBRIGATÓRIO para separar dados por bar
    if (!barId) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório',
        categorias: [],
        total: 0
      }, { status: 400 });
    }

    // Buscar categorias da tabela nibo_categorias FILTRADAS POR BAR
    // IMPORTANTE: usar nibo_id como identificador para a API do NIBO
    let query = supabase
      .from('nibo_categorias')
      .select('id, nibo_id, bar_id, categoria_nome, categoria_macro, ativo, criado_em, atualizado_em')
      .eq('bar_id', parseInt(barId))
      .order('categoria_macro')
      .order('categoria_nome');

    // Filtrar por ativo se necessário
    if (ativo) {
      query = query.eq('ativo', true);
    }

    const { data: categorias, error } = await query;

    if (error) {
      console.error('Erro ao buscar categorias:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar categorias', details: error.message },
        { status: 500 }
      );
    }

    // Agrupar categorias por categoria_macro para facilitar seleção
    const categoriasAgrupadas = categorias?.reduce((acc: Record<string, any[]>, cat) => {
      const macro = cat.categoria_macro || 'Outros';
      if (!acc[macro]) {
        acc[macro] = [];
      }
      acc[macro].push(cat);
      return acc;
    }, {});

    // Mapear para usar nibo_id como 'id' para o frontend
    // Se nibo_id não existir, manter o id interno (fallback)
    let categoriasFormatadas = categorias?.map(cat => ({
      ...cat,
      id: cat.nibo_id || cat.id // Usar nibo_id se disponível
    })) || [];

    // Para contas a pagar, remove categorias de entrada/financeiras não-pagáveis.
    if (somentePagamento) {
      const normalize = (value: string) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .trim();

      const proibidasExatas = new Set([
        'APORTE DE CAPITAL',
        'CONTRATOS',
        'OUTRAS RECEITAS',
        'DIVIDENDOS',
        'EMPRESTIMOS DE SOCIOS',
        'OUTROS INVESTIMENTOS',
        'RECEITA BRUTA',
        'RECEITA',
        'FATURAMENTO',
        'VENDAS'
      ]);

      categoriasFormatadas = categoriasFormatadas.filter((cat) => {
        // Para agendamento no NIBO, categoria sem nibo_id nao e valida.
        if (!cat.nibo_id) {
          return false;
        }

        const nome = normalize(String(cat.categoria_nome || ''));
        const macro = normalize(String(cat.categoria_macro || ''));
        if (proibidasExatas.has(nome) || proibidasExatas.has(macro)) {
          return false;
        }

        // Bloqueio por padrão textual para evitar categorias claramente de receita.
        const texto = `${nome} ${macro}`;
        return !/(^| )RECEITA( |$)|FATURAMENTO|VENDAS/.test(texto);
      });
    }

    return NextResponse.json({
      success: true,
      categorias: categoriasFormatadas,
      categoriasAgrupadas,
      total: categorias?.length || 0,
      aviso: categorias?.some(c => !c.nibo_id) 
        ? 'Algumas categorias não têm nibo_id. Execute POST /api/financeiro/nibo/categorias/sync para sincronizar.' 
        : undefined
    });

  } catch (error) {
    console.error('[NIBO-CATEGORIAS] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar categorias' },
      { status: 500 }
    );
  }
}
