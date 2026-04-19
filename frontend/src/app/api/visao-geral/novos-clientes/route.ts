import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');
    const mes = searchParams.get('mes'); // Formato: YYYY-MM

    if (!barId) {
      return NextResponse.json({
        success: false,
        error: 'barId é obrigatório'
      }, { status: 400 });
    }

    const barIdNum = parseInt(barId);
    
    // Se não especificar mês, usar mês atual
    const mesReferencia = mes || new Date().toISOString().slice(0, 7);
    const [ano, mesNum] = mesReferencia.split('-');
    
    // Calcular mês anterior para comparação
    const dataAtual = new Date(parseInt(ano), parseInt(mesNum) - 1, 1);
    const mesAnterior = new Date(dataAtual);
    mesAnterior.setMonth(mesAnterior.getMonth() - 1);
    
    const mesAtualStr = `${dataAtual.getFullYear()}-${(dataAtual.getMonth() + 1).toString().padStart(2, '0')}`;
    const mesAnteriorStr = `${mesAnterior.getFullYear()}-${(mesAnterior.getMonth() + 1).toString().padStart(2, '0')}`;

    // Query para calcular novos clientes por mês
    const { data: novosClientesData, error: novosClientesError } = await supabase.rpc('calcular_novos_clientes_por_mes', {
      p_bar_id: barIdNum,
      p_mes_atual: mesAtualStr,
      p_mes_anterior: mesAnteriorStr
    });

    // Se a função RPC não existir (calcular_novos_clientes_por_mes), usar fallback direto
    // Nota: execute_sql não existe no banco - usar exec_sql/execute_raw_sql ou query direta
    if (novosClientesError && novosClientesError.code === '42883') {
      // Fallback: query direta via Supabase (tabela visitas)
        const { data: fallbackData, error: fallbackError } = await supabase
          .schema('silver')
          .from('cliente_visitas')
          .select('cliente_fone, data_visita')
          .eq('bar_id', barIdNum)
          .not('cliente_fone', 'is', null)
          .gte('data_visita', `${mesAnteriorStr}-01`)
          .lte('data_visita', `${mesAtualStr}-31`);

        if (fallbackError) {
          throw fallbackError;
        }

        // Processar dados manualmente
        const clientesPrimeiraVisita = new Map<string, string>();
        
        fallbackData?.forEach(registro => {
          const fone = registro.cliente_fone;
          const data = registro.data_visita;
          
          if (!clientesPrimeiraVisita.has(fone) || data < clientesPrimeiraVisita.get(fone)!) {
            clientesPrimeiraVisita.set(fone, data);
          }
        });

        let novosClientesMesAtual = 0;
        let novosClientesMesAnterior = 0;

        clientesPrimeiraVisita.forEach((primeiraVisita, fone) => {
          if (primeiraVisita.startsWith(mesAtualStr)) {
            novosClientesMesAtual++;
          } else if (primeiraVisita.startsWith(mesAnteriorStr)) {
            novosClientesMesAnterior++;
          }
        });

        const variacao = novosClientesMesAnterior > 0 
          ? ((novosClientesMesAtual - novosClientesMesAnterior) / novosClientesMesAnterior) * 100 
          : 0;

        return NextResponse.json({
          success: true,
          data: {
            mesAtual: {
              mes: mesAtualStr,
              novosClientes: novosClientesMesAtual,
              nome: new Date(parseInt(ano), parseInt(mesNum) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            },
            mesAnterior: {
              mes: mesAnteriorStr,
              novosClientes: novosClientesMesAnterior,
              nome: mesAnterior.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            },
            variacao: {
              absoluta: novosClientesMesAtual - novosClientesMesAnterior,
              percentual: Math.round(variacao * 100) / 100
            },
            meta: 3000, // Meta padrão
            detalhes: {
              totalClientesUnicos: clientesPrimeiraVisita.size,
              metodo: 'fallback'
            }
          }
        });
    }

    // Se chegou aqui, a função RPC funcionou
    const resultado = novosClientesData?.[0];
    
    return NextResponse.json({
      success: true,
      data: {
        mesAtual: {
          mes: mesAtualStr,
          novosClientes: resultado?.novos_mes_atual || 0,
          nome: new Date(parseInt(ano), parseInt(mesNum) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        },
        mesAnterior: {
          mes: mesAnteriorStr,
          novosClientes: resultado?.novos_mes_anterior || 0,
          nome: mesAnterior.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        },
        variacao: {
          absoluta: (resultado?.novos_mes_atual || 0) - (resultado?.novos_mes_anterior || 0),
          percentual: resultado?.variacao_percentual || 0
        },
        meta: 3000, // Meta padrão
        detalhes: {
          totalClientesUnicos: resultado?.total_clientes || 0,
          metodo: 'rpc'
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao calcular novos clientes:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
