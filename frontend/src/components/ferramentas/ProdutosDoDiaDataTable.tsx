'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from '@/components/ui/data-table';
import { useBar } from '@/contexts/BarContext';
import {
  PackageIcon,
  TrendingUpIcon,
  ClockIcon,
  DollarSignIcon,
  UsersIcon,
  StarIcon
} from 'lucide-react';

interface ProdutoDoDia {
  produto_descricao: string;
  grupo_descricao: string;
  total_quantidade: number;
  total_valor: number;
  hora_pico: number;
  quantidade_pico: number;
  categoria: 'normal' | 'happy_hour' | 'banda';
  is_banda?: boolean; // Campo adicional do bronze_contahub_vendas_analitico
}

interface ResumoDoDia {
  produto_mais_vendido: string;
  faturamento_produto_top: number;
  total_faturamento: number;
  total_pessoas: number;
  horario_pico_faturamento: number;
  total_produtos_vendidos: number;
  produtos_unicos: number;
}

interface ProdutosDoDiaDataTableProps {
  dataSelecionada: string;
}

export default function ProdutosDoDiaDataTable({ dataSelecionada }: ProdutosDoDiaDataTableProps) {
  const { selectedBar } = useBar();
  const [dados, setDados] = useState<ProdutoDoDia[]>([]);
  const [resumo, setResumo] = useState<ResumoDoDia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarDados = async () => {
    if (!selectedBar) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ferramentas/produtos-por-hora', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data_selecionada: dataSelecionada,
          bar_id: selectedBar.id
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      // Processar dados para o formato necessário
      const { dadosProcessados, resumoCalculado } = processarDados(result.dados || []);
      setDados(dadosProcessados);
      setResumo(resumoCalculado);
    } catch (error) {
      console.error('Erro ao buscar produtos do dia:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const processarDados = (dadosRaw: any[]): { dadosProcessados: ProdutoDoDia[], resumoCalculado: ResumoDoDia } => {
    const produtosAgregados: Record<string, ProdutoDoDia> = {};
    let totalFaturamento = 0;
    let totalProdutosVendidos = 0;
    let horarioPicoFaturamento = { hora: 0, valor: 0 };
    const faturamentoPorHora: Record<number, number> = {};

    dadosRaw.forEach(item => {
      const key = item.produto_descricao;
      totalFaturamento += item.valor_total;
      totalProdutosVendidos += item.quantidade;

      // Categorizar produto usando dados do contahub_analitico
      let categoria: 'normal' | 'happy_hour' | 'banda' = 'normal';
      if (item.is_banda) {
        // Usar informação do vd_mesadesc (banda/dj) do contahub_analitico
        categoria = 'banda';
      } else if (item.produto_descricao.includes('[DD]') || item.produto_descricao.includes('[HH]')) {
        categoria = 'happy_hour';
      } else if (item.produto_descricao.includes('[') && item.produto_descricao.includes(']')) {
        // Fallback para produtos com prefixo [Banda] no nome
        categoria = 'banda';
      }
      
      if (!produtosAgregados[key]) {
        produtosAgregados[key] = {
          produto_descricao: item.produto_descricao,
          grupo_descricao: item.grupo_descricao,
          total_quantidade: 0,
          total_valor: 0,
          hora_pico: item.hora,
          quantidade_pico: item.quantidade,
          categoria
        };
      }
      
      produtosAgregados[key].total_quantidade += item.quantidade;
      produtosAgregados[key].total_valor += item.valor_total;
      
      // Atualizar hora de pico se esta hora tem mais vendas
      if (item.quantidade > produtosAgregados[key].quantidade_pico) {
        produtosAgregados[key].hora_pico = item.hora;
        produtosAgregados[key].quantidade_pico = item.quantidade;
      }

      // Calcular faturamento por hora
      if (!faturamentoPorHora[item.hora]) {
        faturamentoPorHora[item.hora] = 0;
      }
      faturamentoPorHora[item.hora] += item.valor_total;
    });

    // Encontrar horário de pico de faturamento
    Object.entries(faturamentoPorHora).forEach(([hora, valor]) => {
      if (valor > horarioPicoFaturamento.valor) {
        horarioPicoFaturamento = { hora: parseInt(hora), valor };
      }
    });

    const dadosProcessados = Object.values(produtosAgregados)
      .sort((a, b) => b.total_quantidade - a.total_quantidade);

    // Produto mais vendido
    const produtoMaisVendido = dadosProcessados[0];

    const resumoCalculado: ResumoDoDia = {
      produto_mais_vendido: produtoMaisVendido?.produto_descricao || 'N/A',
      faturamento_produto_top: produtoMaisVendido?.total_valor || 0,
      total_faturamento: totalFaturamento,
      total_pessoas: 0, // Será buscado da API de horário de pico
      horario_pico_faturamento: horarioPicoFaturamento.hora,
      total_produtos_vendidos: totalProdutosVendidos,
      produtos_unicos: dadosProcessados.length
    };

    return { dadosProcessados, resumoCalculado };
  };

  useEffect(() => {
    if (dataSelecionada && selectedBar) {
      buscarDados();
    }
  }, [dataSelecionada, selectedBar?.id]);

  // Colunas para cada categoria
  const colunasProdutos: DataTableColumn<ProdutoDoDia>[] = [
    {
      key: 'produto_descricao',
      title: 'Produto',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <PackageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              {value.replace(/\[DD\]|\[HH\]|\[.*?\]/g, '').trim()}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {row.grupo_descricao}
            </p>
          </div>
        </div>
      ),
      width: 'w-2/5'
    },
    {
      key: 'total_quantidade',
      title: 'Quantidade',
      sortable: true,
      align: 'left',
      width: 'w-1/4',
      render: (value) => (
        <Badge variant="outline" className="font-mono font-bold text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 text-left max-w-[100px]">
          {value.toLocaleString()}
        </Badge>
      )
    },
    {
      key: 'total_valor',
      title: 'Valor Total',
      sortable: true,
      align: 'right',
      width: 'w-1/4',
      render: (value) => (
        <span className="font-mono font-bold text-green-700 dark:text-green-400 block text-left max-w-[100px]">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'hora_pico',
      title: 'Pico',
      sortable: true,
      align: 'center',
      width: 'w-1/4',
      render: (value, row) => (
        <div className="text-center">
          <p className="font-bold text-orange-600 dark:text-orange-400 text-left max-w-[100px]">
            {value.toString().padStart(2, '0')}:00
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 font-medium text-left max-w-[100px]">
            {row.quantidade_pico} unidades
          </p>
        </div>
      )
    }
  ];

  const formatarHora = (hora: number) => `${hora.toString().padStart(2, '0')}:00`;

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Carregando produtos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="text-center text-red-600 dark:text-red-400 text-sm">
            <p>Erro: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filtrar dados por categoria
  const produtosNormais = dados.filter(p => p.categoria === 'normal');
  const produtosHappyHour = dados.filter(p => p.categoria === 'happy_hour');
  const produtosBanda = dados.filter(p => p.categoria === 'banda');

  // Calcular totais por categoria
  const totaisNormais = {
    quantidade: produtosNormais.reduce((sum, p) => sum + p.total_quantidade, 0),
    valor: produtosNormais.reduce((sum, p) => sum + p.total_valor, 0)
  };
  
  const totaisHappyHour = {
    quantidade: produtosHappyHour.reduce((sum, p) => sum + p.total_quantidade, 0),
    valor: produtosHappyHour.reduce((sum, p) => sum + p.total_valor, 0)
  };
  
  const totaisBanda = {
    quantidade: produtosBanda.reduce((sum, p) => sum + p.total_quantidade, 0),
    valor: produtosBanda.reduce((sum, p) => sum + p.total_valor, 0)
  };

  return (
    <div className="space-y-6">

      {/* DataTables por Categoria */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-gray-900 dark:text-white flex items-center justify-center gap-2 text-lg">
            <PackageIcon className="h-5 w-5" />
            Produtos do Dia - {dataSelecionada}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Análise detalhada por categoria de produtos
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="normal" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-700 h-auto">
              <TabsTrigger value="normal" className="flex flex-col items-center justify-center gap-1 py-4 px-2 h-auto min-h-[80px] data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
                <div className="flex items-center gap-1 text-center">
                  <TrendingUpIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Top Produtos</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 group-data-[state=active]:text-gray-600 dark:group-data-[state=active]:text-gray-300 text-center leading-tight">
                  {produtosNormais.length} itens
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 group-data-[state=active]:text-gray-600 dark:group-data-[state=active]:text-gray-300 text-center leading-tight">
                  {totaisNormais.quantidade} produtos
                </div>
                <div className="text-xs font-medium text-green-600 dark:text-green-400 group-data-[state=active]:text-green-700 dark:group-data-[state=active]:text-green-300 text-center">
                  R$ {totaisNormais.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </TabsTrigger>
              <TabsTrigger value="happy_hour" className="flex flex-col items-center justify-center gap-1 py-4 px-2 h-auto min-h-[80px] data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
                <div className="flex items-center gap-1 text-center">
                  <ClockIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Happy Hour</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 group-data-[state=active]:text-gray-600 dark:group-data-[state=active]:text-gray-300 text-center leading-tight">
                  {produtosHappyHour.length} itens
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 group-data-[state=active]:text-gray-600 dark:group-data-[state=active]:text-gray-300 text-center leading-tight">
                  {totaisHappyHour.quantidade} produtos
                </div>
                <div className="text-xs font-medium text-green-600 dark:text-green-400 group-data-[state=active]:text-green-700 dark:group-data-[state=active]:text-green-300 text-center">
                  R$ {totaisHappyHour.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </TabsTrigger>
              <TabsTrigger value="banda" className="flex flex-col items-center justify-center gap-1 py-4 px-2 h-auto min-h-[80px] data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-600 dark:data-[state=active]:text-white text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
                <div className="flex items-center gap-1 text-center">
                  <UsersIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Banda</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 group-data-[state=active]:text-gray-600 dark:group-data-[state=active]:text-gray-300 text-center leading-tight">
                  {produtosBanda.length} itens
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 group-data-[state=active]:text-gray-600 dark:group-data-[state=active]:text-gray-300 text-center leading-tight">
                  {totaisBanda.quantidade} produtos
                </div>
                <div className="text-xs font-medium text-green-600 dark:text-green-400 group-data-[state=active]:text-green-700 dark:group-data-[state=active]:text-green-300 text-center">
                  R$ {totaisBanda.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="normal" className="mt-6">
              <DataTable
                data={produtosNormais}
                columns={colunasProdutos}
                searchPlaceholder="Buscar produtos..."
                pageSize={10}
                emptyMessage="Nenhum produto normal encontrado"
              />
            </TabsContent>

            <TabsContent value="happy_hour" className="mt-6">
              <DataTable
                data={produtosHappyHour}
                columns={colunasProdutos}
                searchPlaceholder="Buscar produtos happy hour..."
                pageSize={10}
                emptyMessage="Nenhum produto de happy hour encontrado"
              />
            </TabsContent>

            <TabsContent value="banda" className="mt-6">
              <DataTable
                data={produtosBanda}
                columns={colunasProdutos}
                searchPlaceholder="Buscar produtos da banda..."
                pageSize={10}
                emptyMessage="Nenhum produto de banda encontrado"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
