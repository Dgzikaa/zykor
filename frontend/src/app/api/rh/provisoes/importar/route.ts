import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rh/provisoes/importar
 * Importa provisões de dados externos (planilha)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, provisoes } = body;

    if (!bar_id || !provisoes || !Array.isArray(provisoes)) {
      return NextResponse.json(
        { error: 'bar_id e provisoes (array) são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Mapear provisões para formato do banco
    const provisoesParaInserir = provisoes.map((prov: {
      funcionario_nome: string;
      mes: number;
      ano: number;
      salario_bruto_produtividade?: number;
      comissao_bonus?: number;
      decimo_terceiro?: number;
      ferias?: number;
      dias_ferias_vencidos?: number;
      ferias_vencidas?: number;
      terco_ferias?: number;
      inss_provisao?: number;
      fgts_provisao?: number;
      multa_fgts?: number;
      provisao_certa?: number;
      provisao_eventual?: number;
      percentual_salario?: number;
    }) => ({
      bar_id,
      funcionario_nome: prov.funcionario_nome,
      funcionario_id: null, // Será vinculado depois se necessário
      mes: prov.mes,
      ano: prov.ano,
      salario_bruto_produtividade: prov.salario_bruto_produtividade || 0,
      comissao_bonus: prov.comissao_bonus || 0,
      decimo_terceiro: prov.decimo_terceiro || 0,
      ferias: prov.ferias || 0,
      dias_ferias_vencidos: prov.dias_ferias_vencidos || 0,
      ferias_vencidas: prov.ferias_vencidas || 0,
      terco_ferias: prov.terco_ferias || 0,
      inss_provisao: prov.inss_provisao || 0,
      fgts_provisao: prov.fgts_provisao || 0,
      multa_fgts: prov.multa_fgts || 0,
      provisao_certa: prov.provisao_certa || 0,
      provisao_eventual: prov.provisao_eventual || 0,
      percentual_salario: prov.percentual_salario || 0
    }));

    // Inserir em lotes de 100
    const batchSize = 100;
    let totalInseridos = 0;
    const erros: string[] = [];

    for (let i = 0; i < provisoesParaInserir.length; i += batchSize) {
      const batch = provisoesParaInserir.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('provisoes_trabalhistas')
        .insert(batch);

      if (error) {
        erros.push(`Lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        totalInseridos += batch.length;
      }
    }

    return NextResponse.json({
      success: erros.length === 0,
      message: `${totalInseridos} provisões importadas com sucesso`,
      total_enviados: provisoes.length,
      total_inseridos: totalInseridos,
      erros: erros.length > 0 ? erros : undefined
    });

  } catch (error) {
    console.error('Erro ao importar provisões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
