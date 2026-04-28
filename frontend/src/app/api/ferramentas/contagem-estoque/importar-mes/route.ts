import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tbl } from '@/lib/supabase/table-schemas';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

const SPREADSHEET_ID = '1QhuD52kQrdCv4XMfKR5NSRMttx6NzVBZO0S8ajQK1H8';
const API_KEY = 'AIzaSyBKprFuR1gpvoTB4hV16rKlBk3oF0v1BhQ';
const BAR_ID = 3;

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD
 */
function converterData(dataStr: string): string | null {
  if (!dataStr || !dataStr.includes('/')) return null;
  const partes = dataStr.split('/');
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Busca dados do Google Sheets para uma data específica
 */
async function buscarContagemData(data: string): Promise<any[]> {
  try {
    const range = 'INSUMOS!A1:ZZZ200';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erro ao acessar planilha: ${response.status}`);
    
    const data_response = await response.json();
    const linhas = data_response.values || [];
    
    if (linhas.length < 7) throw new Error('Planilha sem dados suficientes');
    
    const linhaDatas = linhas[3] || [];
    let colunaData = -1;
    
    for (let i = 0; i < linhaDatas.length; i++) {
      const valor = linhaDatas[i];
      if (valor && valor.includes('/')) {
        const dataFormatada = converterData(valor);
        if (dataFormatada === data) {
          colunaData = i;
          break;
        }
      }
    }
    
    if (colunaData === -1) return [];
    
    const insumos: any[] = [];
    
    for (let i = 6; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!linha || linha.length < 7) continue;
      
      const codigo = linha[3]?.toString().trim();
      const nome = linha[6]?.toString().trim();
      const categoria = linha[4]?.toString().trim();
      
      if (!codigo || !nome) continue;
      
      const estoqueFechado = parseFloat(linha[colunaData]) || null;
      const estoqueFlutuante = parseFloat(linha[colunaData + 1]) || null;
      const pedido = parseFloat(linha[colunaData + 2]) || null;
      
      if (estoqueFechado !== null && estoqueFechado > 0) {
        insumos.push({
          codigo,
          nome,
          categoria,
          contagens: {
            [data]: {
              estoque_fechado: estoqueFechado,
              estoque_flutuante: estoqueFlutuante,
              pedido: pedido || 0,
            },
          },
        });
      }
    }
    
    return insumos;
  } catch (error) {
    console.error('Erro ao buscar contagem:', error);
    throw error;
  }
}

/**
 * POST - Importar um mês específico
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ano, mes } = body;
    
    if (!ano || !mes) {
      return NextResponse.json({
        success: false,
        error: 'ano e mes são obrigatórios'
      }, { status: 400 });
    }

    // Calcular datas do mês
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0); // Último dia do mês
    
    // Gerar array de datas
    const datas: string[] = [];
    for (let d = new Date(dataInicio); d <= dataFim; d.setDate(d.getDate() + 1)) {
      datas.push(d.toISOString().split('T')[0]);
    }

    // Conectar ao Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Buscar insumos do sistema
    const { data: insumosSistema, error: errorInsumos } = await tbl(supabase, 'insumos')
      .select('id, codigo, nome, tipo_local, unidade_medida, custo_unitario')
      .eq('ativo', true);
    
    if (errorInsumos) throw new Error(`Erro ao buscar insumos: ${errorInsumos.message}`);
    
    // Criar mapa de código -> insumo
    const mapaInsumos = new Map();
    insumosSistema?.forEach((insumo: any) => {
      mapaInsumos.set(insumo.codigo, insumo);
    });
    
    const stats = {
      total_datas: datas.length,
      processadas: 0,
      importadas: 0,
      sem_dados: 0,
      erros: 0,
    };
    
    // Processar cada data
    for (const data of datas) {
      try {
        const insumosSheet = await buscarContagemData(data);
        
        if (insumosSheet.length === 0) {
          stats.sem_dados++;
          stats.processadas++;
          continue;
        }
        
        // Processar cada insumo
        for (const insumoSheet of insumosSheet) {
          const insumoSistema = mapaInsumos.get(insumoSheet.codigo);
          if (!insumoSistema) continue;
          
          const contagemData = insumoSheet.contagens[data];
          if (!contagemData) continue;
          
          // Buscar estoque anterior
          const dataAnterior = new Date(data + 'T00:00:00');
          dataAnterior.setDate(dataAnterior.getDate() - 1);
          const dataAnteriorStr = dataAnterior.toISOString().split('T')[0];
          
          const { data: contagemAnterior } = await tbl(supabase, 'contagem_estoque_insumos')
            .select('estoque_final')
            .eq('bar_id', BAR_ID)
            .eq('insumo_id', insumoSistema.id)
            .eq('data_contagem', dataAnteriorStr)
            .single();
          
          const payload = {
            bar_id: BAR_ID,
            data_contagem: data,
            insumo_id: insumoSistema.id,
            insumo_codigo: insumoSistema.codigo,
            insumo_nome: insumoSistema.nome,
            estoque_inicial: contagemAnterior?.estoque_final || null,
            estoque_final: contagemData.estoque_fechado,
            quantidade_pedido: contagemData.pedido || 0,
            tipo_local: insumoSistema.tipo_local,
            categoria: insumoSistema.categoria || insumoSheet.categoria,
            unidade_medida: insumoSistema.unidade_medida,
            custo_unitario: insumoSistema.custo_unitario || 0,
            observacoes: 'Importado retroativamente',
            usuario_contagem: 'Sistema Retroativo',
            updated_at: new Date().toISOString(),
          };
          
          const { error } = await tbl(supabase, 'contagem_estoque_insumos')
            .insert([payload]);
          
          if (error) {
            console.error(`Erro: ${error.message}`);
            stats.erros++;
          } else {
            stats.importadas++;
          }
        }
        
        stats.processadas++;
      } catch (error) {
        console.error(`Erro ao processar ${data}:`, error);
        stats.erros++;
        stats.processadas++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Mês ${mes}/${ano} importado`,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

