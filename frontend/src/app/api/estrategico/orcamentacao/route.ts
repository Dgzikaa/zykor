import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes');

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

    // 1. Buscar dados planejados da tabela orcamentacao
    let queryPlanejado = supabase
      .from('orcamentacao')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .eq('ano', parseInt(ano));

    if (mes && mes !== 'todos') {
      queryPlanejado = queryPlanejado.eq('mes', parseInt(mes));
    }

    const { data: dadosPlanejados, error: errorPlanejado } = await queryPlanejado;

    if (errorPlanejado) {
      console.error('Erro ao buscar dados planejados:', errorPlanejado);
    }

    // 2. Buscar dados realizados do Conta Azul (por competência, não por pagamento)
    let queryNibo = supabase
      .from('lancamentos_financeiros')
      .select('categoria, status, valor, data_competencia')
      .eq('bar_id', parseInt(barId))
      .gte('data_competencia', `${ano}-01-01`)
      .lte('data_competencia', `${ano}-12-31`);
      // REMOVIDO: filtro por status - para orçamentação usamos competência, não pagamento

    if (mes && mes !== 'todos') {
      const mesFormatado = mes.padStart(2, '0');
      queryNibo = queryNibo
        .gte('data_competencia', `${ano}-${mesFormatado}-01`)
        .lte('data_competencia', `${ano}-${mesFormatado}-31`);
    }

    const { data: dadosNibo, error: errorNibo } = await queryNibo;

    if (errorNibo) {
      console.error('Erro ao buscar dados Conta Azul:', errorNibo);
    }

    // 2.1. Buscar lançamentos manuais da DRE (não tem bar_id - são globais)
    let queryManuais = supabase
      .from('dre_manual')
      .select('categoria, categoria_macro, valor, data_competencia, descricao')
      .gte('data_competencia', `${ano}-01-01`)
      .lte('data_competencia', `${ano}-12-31`);

    if (mes && mes !== 'todos') {
      const mesFormatado = mes.padStart(2, '0');
      queryManuais = queryManuais
        .gte('data_competencia', `${ano}-${mesFormatado}-01`)
        .lte('data_competencia', `${ano}-${mesFormatado}-31`);
    }

    const { data: dadosManuais, error: errorManuais } = await queryManuais;

    if (errorManuais) {
      console.error('Erro ao buscar lançamentos manuais:', errorManuais);
    }

    // 3. Mapear categorias NIBO para categorias do orçamento
    const categoriasMap = new Map([
      // Despesas Variáveis
      ['IMPOSTO/TX MAQ/COMISSAO', 'IMPOSTO/TX MAQ/COMISSAO'],
      ['IMPOSTO', 'IMPOSTO/TX MAQ/COMISSAO'],
      ['TAXA MAQUININHA', 'IMPOSTO/TX MAQ/COMISSAO'],
      ['COMISSÃO', 'IMPOSTO/TX MAQ/COMISSAO'],
      ['COMISSAO', 'IMPOSTO/TX MAQ/COMISSAO'],
      ['COMISSÃO 10%', 'IMPOSTO/TX MAQ/COMISSAO'],
      
      // CMV
      ['Custo Comida', 'CMV'],
      ['Custo Drinks', 'CMV'],
      ['Custo Bebidas', 'CMV'],
      ['CUSTO COMIDA', 'CMV'],
      ['CUSTO DRINKS', 'CMV'],
      ['CUSTO BEBIDAS', 'CMV'],
      
      // Pessoal
      ['CUSTO-EMPRESA FUNCIONÁRIOS', 'CUSTO-EMPRESA FUNCIONARIOS'],
      ['CUSTO-EMPRESA FUNCIONARIOS', 'CUSTO-EMPRESA FUNCIONARIOS'],
      ['SALARIO FUNCIONARIOS', 'CUSTO-EMPRESA FUNCIONARIOS'],
      ['SALÁRIO FUNCIONÁRIOS', 'CUSTO-EMPRESA FUNCIONARIOS'],
      ['PROVISÃO TRABALHISTA', 'PROVISÃO TRABALHISTA'],
      ['PROVISAO TRABALHISTA', 'PROVISÃO TRABALHISTA'],
      ['FREELA SEGURANÇA', 'FREELA SEGURANÇA'],
      ['FREELA SEGURANCA', 'FREELA SEGURANÇA'],
      ['FREELA ATENDIMENTO', 'FREELA ATENDIMENTO'],
      ['FREELA COZINHA', 'FREELA COZINHA'],
      ['FREELA BAR', 'FREELA BAR'],
      ['FREELA LIMPEZA', 'FREELA LIMPEZA'],
      ['ADICIONAIS', 'ADICIONAIS'],
      
      // Administrativas
      ['RECURSOS HUMANOS', 'RECURSOS HUMANOS'],
      ['Administrativo Ordinário', 'Administrativo Ordinário'],
      
      // Ocupação
      ['ALUGUEL/CONDOMÍNIO/IPTU', 'ALUGUEL/CONDOMÍNIO/IPTU'],
      ['LUZ', 'LUZ'],
      ['ÁGUA', 'ÁGUA'],
      ['AGUA', 'ÁGUA'],
      ['GÁS', 'GÁS'],
      ['GAS', 'GÁS'],
      ['INTERNET', 'INTERNET'],
      
      // Operacionais
      ['Manutenção', 'Manutenção'],
      ['MANUTENÇÃO', 'Manutenção'],
      ['Materiais de Limpeza e Descartáveis', 'Materiais de Limpeza e Descartáveis'],
      ['Materiais Operação', 'Materiais Operação'],
      ['Equipamentos Operação', 'Equipamentos Operação'],
      ['Utensílios', 'Utensílios'],
      
      // Marketing e Eventos
      ['Marketing', 'Marketing'],
      ['Produção Eventos', 'Produção Eventos'],
      ['Atrações Programação', 'Atrações Programação'],
      
      // Receitas
      ['RECEITA BRUTA', 'RECEITA BRUTA'],
      ['RECEITA', 'RECEITA BRUTA'],
      ['FATURAMENTO', 'RECEITA BRUTA'],
      ['VENDAS', 'RECEITA BRUTA'],
      
      // Não Operacionais
      ['CONTRATOS', 'CONTRATOS'],
      ['CONTRATO', 'CONTRATOS'],
      ['Contratos', 'CONTRATOS'],
      ['OUTRAS RECEITAS', 'Outras Receitas'],
      ['Outras Receitas', 'Outras Receitas'],
      ['Ambev Bonificações Contrato Anual', 'CONTRATOS'],
      ['Ambev Bonificação Contrato Cash-back Março', 'CONTRATOS'],
      ['Ambev Bonificação Contrato Cash-back Fevereiro', 'CONTRATOS'],
      ['Ambev Bonificação Contrato Cash-back Junho', 'CONTRATOS'],
      ['Ambev Bonificação Contrato Cash-back Julho', 'CONTRATOS'],
      ['Escritório Central', 'Escritório Central'], // Manter como categoria própria
      ['ESCRITÓRIO CENTRAL', 'Escritório Central'],
      ['Dividendos', 'Dividendos'],
      ['DIVIDENDOS', 'Dividendos'],
      ['PRO LABORE', 'PRO LABORE'],
      ['Despesas Financeiras', 'Despesas Financeiras'],
      ['Outros Sócios', 'Outros Sócios'],
      ['Aporte de capital', 'Aporte de capital'],
      ['Empréstimos de Sócios', 'Empréstimos de Sócios'],
      ['Outros Investimentos', 'Outros Investimentos'],
      ['Escritório Central', 'Escritório Central'],
      ['VALE TRANSPORTE', 'VALE TRANSPORTE']
    ]);

    // 4. Calcular valores realizados por categoria
    const valoresRealizados = new Map<string, number>();
    let receitaTotal = 0;
    
    // Primeiro, calcular receita total para porcentagens (Conta Azul + Manuais)
    dadosNibo?.forEach(item => {
      if (!item.categoria) return;
      
      const valor = Math.abs(parseFloat(item.valor) || 0);
      
      // Categorias que são receita
      if (['Receita de Eventos', 'Stone Crédito', 'Stone Débito', 'Stone Pix', 'Dinheiro', 'Pix Direto na Conta', 'RECEITA BRUTA'].includes(item.categoria)) {
        receitaTotal += valor;
      }
    });

    // Adicionar receitas dos lançamentos manuais
    dadosManuais?.forEach(item => {
      if (item.categoria_macro === 'Receita') {
        const valor = Math.abs(parseFloat(item.valor) || 0);
        receitaTotal += valor;
      }
    });
    
    // Depois, calcular valores por categoria
    dadosNibo?.forEach(item => {
      if (!item.categoria) return;
      
      const valorOriginal = parseFloat(item.valor) || 0;
      const valor = Math.abs(valorOriginal);
      
      // Mapear categoria normalmente
      const categoriaNormalizada = categoriasMap.get(item.categoria) || item.categoria;
      
      if (!valoresRealizados.has(categoriaNormalizada)) {
        valoresRealizados.set(categoriaNormalizada, 0);
      }
      
      valoresRealizados.set(categoriaNormalizada, 
        valoresRealizados.get(categoriaNormalizada)! + valor
      );
    });

    // 4.1. Processar lançamentos manuais
    dadosManuais?.forEach(item => {
      if (!item.categoria) return;
      
      const valorOriginal = parseFloat(item.valor) || 0;
      const valor = Math.abs(valorOriginal);
      
      // Para lançamentos manuais, usar a categoria diretamente ou mapear pela categoria_macro
      let categoriaNormalizada = item.categoria;
      
      // Se não encontrar a categoria específica, tentar mapear pela categoria_macro
      if (!categoriasMap.has(item.categoria) && item.categoria_macro) {
        categoriaNormalizada = categoriasMap.get(item.categoria_macro) || item.categoria_macro;
      }
      
      // Receita manual já foi contabilizada no cálculo inicial
      
      if (!valoresRealizados.has(categoriaNormalizada)) {
        valoresRealizados.set(categoriaNormalizada, 0);
      }
      
      valoresRealizados.set(categoriaNormalizada, 
        valoresRealizados.get(categoriaNormalizada)! + valor
      );
    });
    
    // Converter valores absolutos para porcentagens onde necessário
    const categoriasPercentuais = ['IMPOSTO/TX MAQ/COMISSAO', 'CMV'];
    categoriasPercentuais.forEach(categoria => {
      if (valoresRealizados.has(categoria) && receitaTotal > 0) {
        const valorAbsoluto = valoresRealizados.get(categoria)!;
        const porcentagem = (valorAbsoluto / receitaTotal) * 100;
        valoresRealizados.set(categoria, porcentagem);
      }
    });

    // 5. Estrutura base das categorias (conforme lista do usuário)
    const estruturaBase = [
      // Custos Diretos
      { categoria: 'IMPOSTO/TX MAQ/COMISSAO', tipo: 'despesa' },
      { categoria: 'CMV', tipo: 'despesa' },
      
      // Pessoal
      { categoria: 'CUSTO-EMPRESA FUNCIONARIOS', tipo: 'despesa' },
      { categoria: 'ADICIONAIS', tipo: 'despesa' },
      { categoria: 'FREELA ATENDIMENTO', tipo: 'despesa' },
      { categoria: 'FREELA BAR', tipo: 'despesa' },
      { categoria: 'FREELA COZINHA', tipo: 'despesa' },
      { categoria: 'FREELA LIMPEZA', tipo: 'despesa' },
      { categoria: 'FREELA SEGURANÇA', tipo: 'despesa' },
      { categoria: 'PRO LABORE', tipo: 'despesa' },
      
      // Administrativas
      { categoria: 'Escritório Central', tipo: 'despesa' },
      { categoria: 'Administrativo Ordinário', tipo: 'despesa' },
      { categoria: 'RECURSOS HUMANOS', tipo: 'despesa' },
      
      // Marketing e Eventos
      { categoria: 'Marketing', tipo: 'despesa' },
      { categoria: 'Atrações Programação', tipo: 'despesa' },
      { categoria: 'Produção Eventos', tipo: 'despesa' },
      
      // Operacionais
      { categoria: 'Materiais Operação', tipo: 'despesa' },
      { categoria: 'Estorno', tipo: 'despesa' },
      { categoria: 'Equipamentos Operação', tipo: 'despesa' },
      { categoria: 'Materiais de Limpeza e Descartáveis', tipo: 'despesa' },
      { categoria: 'Utensílios', tipo: 'despesa' },
      { categoria: 'Outros Operação', tipo: 'despesa' },
      
      // Fixas
      { categoria: 'ALUGUEL/CONDOMÍNIO/IPTU', tipo: 'despesa' },
      { categoria: 'ÁGUA', tipo: 'despesa' },
      { categoria: 'GÁS', tipo: 'despesa' },
      { categoria: 'INTERNET', tipo: 'despesa' },
      { categoria: 'Manutenção', tipo: 'despesa' },
      { categoria: 'LUZ', tipo: 'despesa' },
      
      // Não Operacionais
      { categoria: 'CONTRATOS', tipo: 'receita' }
    ];

    // 6. Combinar dados planejados + realizados
    const dadosFinais: any[] = [];
    const categoriasProcessadas = new Set();

    // Processar dados planejados existentes
    dadosPlanejados?.forEach(item => {
      let valorRealizado = valoresRealizados.get(item.categoria_nome) || 0;
      
      // Se não encontrou no Conta Azul, usa o valor realizado da tabela orçamentação (fallback)
      if (valorRealizado === 0 && item.valor_realizado) {
        valorRealizado = Number(item.valor_realizado);
      }
      
      dadosFinais.push({
        id: item.id,
        bar_id: item.bar_id,
        ano: item.ano,
        mes: item.mes,
        categoria: item.categoria_nome,
        subcategoria: item.subcategoria,
        valor_planejado: Number(item.valor_planejado) || 0,
        valor_realizado: valorRealizado,
        percentual_realizado: item.valor_planejado > 0 ? (valorRealizado / item.valor_planejado) * 100 : 0,
        observacoes: item.observacoes,
        criado_em: item.criado_em,
        atualizado_em: item.atualizado_em
      });
      
      categoriasProcessadas.add(item.categoria_nome);
    });

    // Processar categorias que só têm dados realizados (sem planejamento)
    // Lógica: 1º busca no Conta Azul, se não encontrar, busca na tabela orçamentação
    estruturaBase.forEach(base => {
      if (!categoriasProcessadas.has(base.categoria)) {
        let valorRealizado = valoresRealizados.get(base.categoria) || 0;
        
        // Se não encontrou no Conta Azul, busca na tabela orçamentação (fallback)
        if (valorRealizado === 0) {
          const dadoOrcamentacao = dadosPlanejados?.find(item => 
            item.categoria_nome === base.categoria && item.valor_realizado
          );
          valorRealizado = dadoOrcamentacao?.valor_realizado || 0;
        }
        
        // Sempre incluir todas as categorias da estrutura base (mesmo com valor 0)
        dadosFinais.push({
          id: null,
          bar_id: parseInt(barId),
          ano: parseInt(ano),
          mes: mes ? parseInt(mes) : null,
          categoria: base.categoria,
          subcategoria: null,
          valor_planejado: 0,
          valor_realizado: valorRealizado,
          percentual_realizado: 0,
          observacoes: null,
          criado_em: null,
          atualizado_em: null
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: dadosFinais
    });

  } catch (error) {
    console.error('Erro na API de orçamento:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bar_id, ano, mes, categoria_nome, subcategoria, valor_planejado, valor_projetado, valor_realizado, observacoes, tipo } = body;

    if (!bar_id || !ano || !categoria_nome) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Preparar dados para inserção/atualização
    const dadosUpsert: any = {
      bar_id,
      ano,
      mes,
      categoria_nome,
      subcategoria
    };

    // Adicionar valor planejado se fornecido
    if (valor_planejado !== undefined) {
      dadosUpsert.valor_planejado = Number(valor_planejado) || 0;
    }

    // Adicionar valor projetado se fornecido
    if (valor_projetado !== undefined) {
      dadosUpsert.valor_projetado = Number(valor_projetado) || 0;
    }

    // Adicionar valor realizado se fornecido
    if (valor_realizado !== undefined) {
      dadosUpsert.valor_realizado = Number(valor_realizado) || 0;
    }

    // Adicionar observações se fornecidas
    if (observacoes !== undefined) {
      dadosUpsert.observacoes = observacoes;
    }

    // Determinar tipo se não fornecido
    if (!tipo) {
      const valorReferencia = valor_planejado !== undefined ? valor_planejado : valor_realizado;
      dadosUpsert.tipo = valorReferencia >= 0 ? 'receita' : 'despesa';
    } else {
      dadosUpsert.tipo = tipo;
    }

    // Inserir ou atualizar
    const { data, error } = await supabase
      .from('orcamentacao')
      .upsert(dadosUpsert, {
        onConflict: 'bar_id,ano,mes,categoria_nome,subcategoria'
      })
      .select();

    if (error) {
      console.error('Erro ao salvar orçamento:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar dados do orçamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data[0]
    });

  } catch (error) {
    console.error('Erro na API de orçamento (POST):', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, valor_planejado, observacoes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID é obrigatório para atualização' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('orcamentacao')
      .update({
        valor_planejado: Number(valor_planejado),
        observacoes
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Erro ao atualizar orçamento:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao atualizar dados do orçamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data[0]
    });

  } catch (error) {
    console.error('Erro na API de orçamento (PUT):', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

