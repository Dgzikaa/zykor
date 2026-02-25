import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Usar Service Role Key para bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com Supabase' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const eventoSymplaId = formData.get('evento_sympla_id') as string;
    const barId = parseInt(formData.get('bar_id') as string);

    if (!file || !eventoSymplaId || !barId) {
      return NextResponse.json(
        { error: 'Arquivo CSV, evento_sympla_id e bar_id são obrigatórios' },
        { status: 400 }
      );
    }

    // Ler conteúdo do arquivo
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV vazio ou inválido' },
        { status: 400 }
      );
    }

    // Encontrar linha do cabeçalho
    let headerIndex = -1;
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      if (lines[i].includes('ingresso') || lines[i].includes('N? ingresso')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      return NextResponse.json(
        { error: 'Cabeçalho do CSV não encontrado' },
        { status: 400 }
      );
    }

    const header = lines[headerIndex].split(';');
    const rows = lines.slice(headerIndex + 1);

    // Mapear colunas
    const colIndexes = {
      ordem: header.findIndex(h => h.includes('Ordem')),
      numeroIngresso: header.findIndex(h => h.includes('ingresso') && !h.includes('Tipo')),
      nome: header.findIndex(h => h === 'Nome'),
      sobrenome: header.findIndex(h => h === 'Sobrenome'),
      tipoIngresso: header.findIndex(h => h.includes('Tipo de ingresso')),
      valor: header.findIndex(h => h === 'Valor'),
      dataCompra: header.findIndex(h => h.includes('Data compra')),
      numeroPedido: header.findIndex(h => h.includes('pedido')),
      email: header.findIndex(h => h === 'Email' || h === 'E-mail'),
      estadoPagamento: header.findIndex(h => h.includes('Estado de pagamento')),
      statusCheckin: header.findIndex(h => h.includes('Check-in') && !h.includes('Data')),
      dataCheckin: header.findIndex(h => h.includes('Data Check-in')),
    };

    if (colIndexes.numeroIngresso === -1) {
      return NextResponse.json(
        { error: 'Coluna "Nº ingresso" não encontrada no CSV' },
        { status: 400 }
      );
    }

    console.log(`📊 Processando ${rows.length} linhas do CSV...`);

    const participantesParaInserir = [];
    let comCheckin = 0;
    let semCheckin = 0;

    for (const row of rows) {
      const cols = row.split(';');
      
      const numeroIngresso = cols[colIndexes.numeroIngresso]?.trim();
      if (!numeroIngresso) continue;

      const nome = cols[colIndexes.nome]?.trim() || '';
      const sobrenome = cols[colIndexes.sobrenome]?.trim() || '';
      const nomeCompleto = `${nome} ${sobrenome}`.trim();
      const email = cols[colIndexes.email]?.trim();
      const tipoIngresso = cols[colIndexes.tipoIngresso]?.trim();
      const numeroPedido = cols[colIndexes.numeroPedido]?.trim();
      const statusPedido = cols[colIndexes.estadoPagamento]?.trim();
      const statusCheckin = cols[colIndexes.statusCheckin]?.trim().toLowerCase();
      const dataCheckin = cols[colIndexes.dataCheckin]?.trim();

      const fezCheckin = statusCheckin === 'sim' || statusCheckin === 'confirmado';
      
      if (fezCheckin) comCheckin++;
      else semCheckin++;

      // Formatar data de checkin
      let dataCheckinFormatada = null;
      if (fezCheckin && dataCheckin) {
        try {
          const [datePart, timePart] = dataCheckin.split(' ');
          if (datePart) {
            const [day, month, year] = datePart.split('/');
            if (day && month && year) {
              dataCheckinFormatada = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              if (timePart) {
                dataCheckinFormatada += `T${timePart}`;
              } else {
                dataCheckinFormatada += 'T00:00:00';
              }
            }
          }
        } catch (e) {
          // Ignora erro
        }
      }

      participantesParaInserir.push({
        participante_sympla_id: `${eventoSymplaId}_${numeroIngresso}`,
        evento_sympla_id: eventoSymplaId,
        bar_id: barId,
        pedido_id: numeroPedido || null,
        nome_completo: nomeCompleto || null,
        email: email || null,
        tipo_ingresso: tipoIngresso || null,
        numero_ticket: numeroIngresso,
        fez_checkin: fezCheckin,
        data_checkin: dataCheckinFormatada,
        status_pedido: statusPedido || null,
        raw_data: {
          source: 'csv_import',
          imported_at: new Date().toISOString()
        }
      });
    }

    // Inserir em lotes
    const tamanhoLote = 500;
    let totalInseridos = 0;
    let erros = 0;

    for (let i = 0; i < participantesParaInserir.length; i += tamanhoLote) {
      const lote = participantesParaInserir.slice(i, i + tamanhoLote);
      
      console.log(`📦 Inserindo lote ${Math.floor(i/tamanhoLote) + 1}: ${lote.length} registros`);
      
      const { data, error } = await supabase
        .from('sympla_participantes')
        .insert(lote)
        .select();

      if (error) {
        console.error(`❌ Erro ao inserir lote ${Math.floor(i/tamanhoLote) + 1}:`, error.message);
        erros += lote.length;
      } else {
        const inseridos = data?.length || 0;
        totalInseridos += inseridos;
        console.log(`✅ Lote ${Math.floor(i/tamanhoLote) + 1}: ${inseridos} registros inseridos`);
      }
    }
    
    console.log(`\n📊 RESUMO: ${totalInseridos} inseridos, ${erros} erros`);

    // Recalcular métricas
    try {
      const { data: evento } = await supabase
        .from('sympla_eventos')
        .select('data_inicio')
        .eq('evento_sympla_id', eventoSymplaId)
        .eq('bar_id', barId)
        .single();

      if (evento) {
        await supabase.rpc('update_eventos_base_with_sympla_yuzer', {
          p_bar_id: barId,
          p_data_inicio: evento.data_inicio,
          p_data_fim: evento.data_inicio
        });

        await supabase.rpc('calculate_evento_metrics', {
          evento_id: null
        });
      }
    } catch (e) {
      console.warn('Erro ao recalcular métricas:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'CSV importado com sucesso',
      stats: {
        total_linhas: rows.length,
        total_inseridos: totalInseridos,
        com_checkin: comCheckin,
        sem_checkin: semCheckin,
        erros
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao importar CSV:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao importar CSV' },
      { status: 500 }
    );
  }
}
