import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CustoDiluido {
  id: number;
  descricao: string;
  valor_total: number;
  tipo_diluicao: 'dias_uteis' | 'dias_evento' | 'semanas' | 'mensal';
  parcela_atual?: number;
  total_parcelas?: number;
}

interface EventoData {
  data_evento: string;
  dia_semana: string;
}

// GET - Calcular custos diluídos para um período
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || (new Date().getMonth() + 1).toString());
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);
    const dataEvento = searchParams.get('data_evento'); // Opcional: calcular para um dia específico

    // 1. Buscar custos diluídos ativos do mês
    const { data: custos, error: custosError } = await supabase
      .from('custos_mensais_diluidos')
      .select('*')
      .eq('bar_id', barId)
      .eq('mes', mes)
      .eq('ano', ano)
      .eq('ativo', true);

    if (custosError) {
      throw new Error('Erro ao buscar custos diluídos');
    }

    if (!custos || custos.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          custos_por_dia: {},
          total_mes: 0,
          custos_detalhados: []
        }
      });
    }

    // 2. Buscar eventos do mês para saber quantos dias têm eventos
    const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
    const dataFim = mes === 12 
      ? `${ano + 1}-01-01` 
      : `${ano}-${(mes + 1).toString().padStart(2, '0')}-01`;

    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select('data_evento, dia_semana')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lt('data_evento', dataFim)
      .order('data_evento');

    if (eventosError) {
      throw new Error('Erro ao buscar eventos');
    }

    // 3. Calcular diluição para cada custo
    const custosPorDia = new Map<string, number>();
    const custosDetalhados: any[] = [];

    for (const custo of custos as CustoDiluido[]) {
      const valorDiluido = calcularDiluicao(
        custo,
        mes,
        ano,
        eventos as EventoData[]
      );

      custosDetalhados.push({
        id: custo.id,
        descricao: custo.descricao,
        valor_total: custo.valor_total,
        tipo_diluicao: custo.tipo_diluicao,
        valor_por_dia: valorDiluido.valor_por_dia,
        dias_aplicaveis: valorDiluido.dias_aplicaveis,
        distribuicao: valorDiluido.distribuicao
      });

      // Somar custos por dia
      for (const [data, valor] of Object.entries(valorDiluido.distribuicao)) {
        custosPorDia.set(data, (custosPorDia.get(data) || 0) + valor);
      }
    }

    // 4. Se foi solicitado um dia específico, retornar apenas esse dia
    if (dataEvento) {
      const custoDia = custosPorDia.get(dataEvento) || 0;
      const custosDoDia = custosDetalhados.map(c => ({
        ...c,
        valor_dia: c.distribuicao[dataEvento] || 0
      }));

      return NextResponse.json({
        success: true,
        data: {
          data_evento: dataEvento,
          custo_total_dia: custoDia,
          custos_detalhados: custosDoDia
        }
      });
    }

    // 5. Retornar todos os dias
    const custosPorDiaArray = Array.from(custosPorDia.entries()).map(([data, valor]) => ({
      data,
      custo_total: valor
    }));

    return NextResponse.json({
      success: true,
      data: {
        custos_por_dia: Object.fromEntries(custosPorDia),
        custos_por_dia_array: custosPorDiaArray,
        total_mes: custos.reduce((sum, c) => sum + parseFloat(c.valor_total.toString()), 0),
        custos_detalhados: custosDetalhados
      }
    });

  } catch (error) {
    console.error('Erro ao calcular diluição:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular diluição de custos' },
      { status: 500 }
    );
  }
}

// Função para calcular a diluição de um custo
function calcularDiluicao(
  custo: CustoDiluido,
  mes: number,
  ano: number,
  eventos: EventoData[]
): {
  valor_por_dia: number;
  dias_aplicaveis: number;
  distribuicao: Record<string, number>;
} {
  const distribuicao: Record<string, number> = {};
  let diasAplicaveis = 0;
  let valorPorDia = 0;

  switch (custo.tipo_diluicao) {
    case 'dias_evento':
      // Dilui apenas nos dias que têm eventos
      diasAplicaveis = eventos.length;
      valorPorDia = diasAplicaveis > 0 ? custo.valor_total / diasAplicaveis : 0;
      
      eventos.forEach(evento => {
        distribuicao[evento.data_evento] = valorPorDia;
      });
      break;

    case 'dias_uteis': {
      // Dilui em todos os dias úteis do mês (seg-sáb)
      const diasUteis = calcularDiasUteis(mes, ano);
      diasAplicaveis = diasUteis.length;
      valorPorDia = diasAplicaveis > 0 ? custo.valor_total / diasAplicaveis : 0;
      
      diasUteis.forEach(data => {
        distribuicao[data] = valorPorDia;
      });
      break;
    }

    case 'semanas': {
      // Dilui por semana (divide por 4 ou 5 semanas)
      const semanasDoMes = calcularSemanas(mes, ano, eventos);
      diasAplicaveis = eventos.length;
      
      semanasDoMes.forEach(semana => {
        const valorSemana = custo.valor_total / semanasDoMes.length;
        const eventosDaSemana = semana.eventos.length;
        const valorPorEvento = eventosDaSemana > 0 ? valorSemana / eventosDaSemana : 0;
        
        semana.eventos.forEach(data => {
          distribuicao[data] = valorPorEvento;
        });
      });
      
      valorPorDia = diasAplicaveis > 0 ? custo.valor_total / diasAplicaveis : 0;
      break;
    }

    case 'mensal':
      // Valor fixo mensal - não dilui, aplica o total no primeiro evento
      if (eventos.length > 0) {
        distribuicao[eventos[0].data_evento] = custo.valor_total;
        diasAplicaveis = 1;
        valorPorDia = custo.valor_total;
      }
      break;
  }

  return {
    valor_por_dia: valorPorDia,
    dias_aplicaveis: diasAplicaveis,
    distribuicao
  };
}

// Calcular dias úteis do mês (segunda a sábado)
function calcularDiasUteis(mes: number, ano: number): string[] {
  const diasUteis: string[] = [];
  const ultimoDia = new Date(ano, mes, 0).getDate();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const data = new Date(ano, mes - 1, dia);
    const diaSemana = data.getDay();
    
    // 0 = domingo, 1-6 = segunda a sábado
    if (diaSemana !== 0) {
      const dataStr = `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
      diasUteis.push(dataStr);
    }
  }

  return diasUteis;
}

// Calcular semanas do mês com eventos
function calcularSemanas(mes: number, ano: number, eventos: EventoData[]): Array<{ semana: number; eventos: string[] }> {
  const semanas = new Map<number, string[]>();

  eventos.forEach(evento => {
    const data = new Date(evento.data_evento);
    // Calcular número da semana no mês (1-5)
    const dia = data.getDate();
    const semana = Math.ceil(dia / 7);
    
    if (!semanas.has(semana)) {
      semanas.set(semana, []);
    }
    semanas.get(semana)!.push(evento.data_evento);
  });

  return Array.from(semanas.entries()).map(([semana, eventos]) => ({
    semana,
    eventos
  }));
}


