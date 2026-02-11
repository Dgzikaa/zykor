'use client';

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeftRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { HorarioPicoChart } from '@/components/ferramentas/HorarioPicoChart';
import ProdutosDoDiaDataTable from '@/components/ferramentas/ProdutosDoDiaDataTable';

export default function EventosAnaliticoPage() {
  const { setPageTitle } = usePageTitle();
  const [dataSelecionada, setDataSelecionada] = useState(() => {
    // Definir data padrão como ontem
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    return ontem.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  });

  useEffect(() => {
    setPageTitle('📊 Análise de Eventos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Função para lidar com mudança de data - só atualiza se for uma data válida e completa
  const handleDataChange = (novaData: string) => {
    if (novaData && novaData.length === 10 && novaData !== dataSelecionada) {
      const dataObj = new Date(novaData + 'T00:00:00');
      if (!isNaN(dataObj.getTime())) {
        setDataSelecionada(novaData);
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-8px)] bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 py-1 pb-6 max-w-[98vw]">
        <div className="space-y-4">
          {/* Botão de Comparativo */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <ArrowLeftRight className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Comparativo de Eventos
                    </h3>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Compare eventos entre diferentes períodos (dia, semana, mês)
                    </p>
                  </div>
                </div>
                <Link href="/analitico/eventos/comparativo">
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Abrir Comparativo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Horário de Pico - Primeiro */}
          <HorarioPicoChart 
            dataSelecionada={dataSelecionada} 
            onDataChange={handleDataChange}
          />
          
          {/* Resumo do Dia e DataTable */}
          <ProdutosDoDiaDataTable dataSelecionada={dataSelecionada} />
        </div>
      </div>
    </div>
  );
}
