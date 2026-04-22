import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { SupabaseClient } from '@supabase/supabase-js';

// Cache por 2 minutos, revalidar em background por até 10 minutos
export const revalidate = 120;

// Helper para buscar todos os registros com paginação
async function fetchAllPaginated<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filters: { column: string; operator: string; value: any }[],
  pageSize: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    // Aplicar filtros
    for (const filter of filters) {
      if (filter.operator === 'eq') query = query.eq(filter.column, filter.value);
      else if (filter.operator === 'gt') query = query.gt(filter.column, filter.value);
      else if (filter.operator === 'gte') query = query.gte(filter.column, filter.value);
      else if (filter.operator === 'lte') query = query.lte(filter.column, filter.value);
      else if (filter.operator === 'lt') query = query.lt(filter.column, filter.value);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Erro ao buscar ${table}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as T[]);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get('ano'); // opcional - se não passar, busca todos
    
    // Obter bar_id do header x-selected-bar-id
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Buscar todas as semanas de gold.desempenho (já inclui marketing)
    let query = (supabase as any)
      .schema('gold')
      .from('desempenho')
      .select('*')
      .eq('bar_id', barId)
      .eq('granularidade', 'semanal')
      .order('ano', { ascending: true })
      .order('numero_semana', { ascending: true });
    
    if (ano) {
      query = query.eq('ano', parseInt(ano));
    }

    const { data: semanas, error } = await query;

    if (error) {
      console.error('Erro ao buscar semanas:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Buscar dados de Conta Assinada para todas as semanas
    // Primeiro, obter as datas min/max das semanas
    const datas = semanas?.map(s => ({ inicio: s.data_inicio, fim: s.data_fim })) || [];
    const dataMin = datas.length > 0 ? datas.reduce((min, d) => d.inicio < min ? d.inicio : min, datas[0].inicio) : null;
    const dataMax = datas.length > 0 ? datas.reduce((max, d) => d.fim > max ? d.fim : max, datas[0].fim) : null;

    // Buscar todos os pagamentos de Conta Assinada no período
    let contaAssinadaMap = new Map<string, number>();
    // Buscar todos os descontos no período
    let descontosMap = new Map<string, { 
      valor: number; 
      detalhes: Map<string, { 
        motivo_exibicao: string;
        valor: number; 
        qtd: number;
        por_dia: Map<string, { valor: number; qtd: number }>
      }> 
    }>();
    
    if (dataMin && dataMax) {
      // Conta Assinada - buscar com paginação
      const pagamentos = await fetchAllPaginated<{ data_pagamento: string; valor_bruto: number }>(
        supabase,
        'faturamento_pagamentos',
        'data_pagamento, valor_bruto',
        [
          { column: 'bar_id', operator: 'eq', value: barId },
          { column: 'meio', operator: 'eq', value: 'Conta Assinada' },
          { column: 'data_pagamento', operator: 'gte', value: dataMin },
          { column: 'data_pagamento', operator: 'lte', value: dataMax },
        ]
      );

      // Agrupar por semana
      pagamentos.forEach(p => {
        const semana = semanas?.find(s => 
          p.data_pagamento >= s.data_inicio && p.data_pagamento <= s.data_fim
        );
        if (semana) {
          const key = `${semana.ano}-${semana.numero_semana}`;
          contaAssinadaMap.set(key, (contaAssinadaMap.get(key) || 0) + Number(p.valor_bruto || 0));
        }
      });

      // Descontos de visitas - buscar com paginação
      const descontos = await fetchAllPaginated<{ data_visita: string; valor_desconto: number; motivo_desconto: string }>(
        supabase,
        'visitas',
        'data_visita, valor_desconto, motivo_desconto',
        [
          { column: 'bar_id', operator: 'eq', value: barId },
          { column: 'valor_desconto', operator: 'gt', value: 0 },
          { column: 'data_visita', operator: 'gte', value: dataMin },
          { column: 'data_visita', operator: 'lte', value: dataMax },
        ]
      );

      // Função para agrupar motivos inteligentemente
      const agruparMotivo = (motivo: string): { categoria: string; exibicao: string } => {
        const m = motivo.toLowerCase().trim();
        
        // BANDA: banda, músico, doze, 12, STZ, 7 na roda, sete, Sambadona, DJ, Roadie, etc.
        if (
          m.includes('banda') || m.includes('musico') || m.includes('músico') ||
          m.includes('doze') || m.includes('12') ||
          m.includes('stz') ||
          m.includes('7 na roda') || m.includes('sete na roda') || m === '7' || m === 'sete' ||
          m.includes('sambadona') ||
          m.includes('dj ') || m.startsWith('dj') || m.endsWith(' dj') ||
          m.includes('roadie') || m.includes('roudier')
        ) {
          return { categoria: 'banda', exibicao: 'Banda/DJ/Músicos' };
        }
        
        // SÓCIO: sócio, socio (case-insensitive)
        if (m.includes('socio') || m.includes('sócio')) {
          return { categoria: 'sócio', exibicao: 'Sócio' };
        }
        
        // ANIVERSÁRIO: aniversário, aniversario, niver, etc.
        if (
          m.includes('aniversar') || m.includes('aniversár') ||
          m.includes('niver')
        ) {
          return { categoria: 'aniversário', exibicao: 'Aniversário' };
        }
        
        // Outros mantém o motivo original normalizado
        return { categoria: m, exibicao: motivo.trim() };
      };

      // Agrupar por semana, por motivo (case-insensitive + agrupamento inteligente) e por dia da semana
      descontos?.forEach(d => {
        const semana = semanas?.find(s => 
          d.data_visita >= s.data_inicio && d.data_visita <= s.data_fim
        );
        if (semana) {
          const key = `${semana.ano}-${semana.numero_semana}`;
          const valorDesconto = Number(d.valor_desconto || 0);
          const motivoOriginal = d.motivo_desconto || 'Sem motivo';
          
          // Agrupar motivo inteligentemente
          const { categoria: motivoNormalizado, exibicao: motivoExibicao } = agruparMotivo(motivoOriginal);
          
          // Dia da semana
          const data = new Date(d.data_visita + 'T00:00:00');
          const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          const diaSemana = diasSemana[data.getDay()];
          
          if (!descontosMap.has(key)) {
            descontosMap.set(key, { valor: 0, detalhes: new Map() });
          }
          const semanaData = descontosMap.get(key)!;
          semanaData.valor += valorDesconto;
          
          // Agrupar por motivo normalizado
          if (!semanaData.detalhes.has(motivoNormalizado)) {
            semanaData.detalhes.set(motivoNormalizado, { 
              motivo_exibicao: motivoExibicao, // Usar nome agrupado (ex: "Banda/DJ/Músicos")
              valor: 0, 
              qtd: 0,
              por_dia: new Map()
            });
          }
          const motivoData = semanaData.detalhes.get(motivoNormalizado)!;
          motivoData.valor += valorDesconto;
          motivoData.qtd += 1;
          
          // Agrupar por dia da semana
          if (!motivoData.por_dia.has(diaSemana)) {
            motivoData.por_dia.set(diaSemana, { valor: 0, qtd: 0 });
          }
          const diaData = motivoData.por_dia.get(diaSemana)!;
          diaData.valor += valorDesconto;
          diaData.qtd += 1;
        }
      });
    }

    // Gold.desempenho já inclui marketing e conta assinada/descontos via service
    const semanasCompletas = semanas || [];

    // Calcular semana atual ISO
    const hoje = new Date();
    const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semanaAtual = Math.ceil((((d.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
    const anoAtual = d.getUTCFullYear();

    return NextResponse.json({
      success: true,
      semanas: semanasCompletas,
      semanaAtual,
      anoAtual,
      totalSemanas: semanasCompletas.length,
      barId
    });

  } catch (error) {
    console.error('Erro na API de todas semanas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
