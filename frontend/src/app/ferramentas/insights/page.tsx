'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lightbulb, Clock, XCircle, CreditCard, Calendar, Users, DollarSign, Sparkles } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { CurvaHorariaTab } from './components/CurvaHorariaTab';
import { CancelamentosTab } from './components/CancelamentosTab';
import { MeiosPagamentoTab } from './components/MeiosPagamentoTab';
import { ReservasTab } from './components/ReservasTab';
import { CohortTab } from './components/CohortTab';
import { CacRoasTab } from './components/CacRoasTab';
import { ReviewsNLPTab } from './components/ReviewsNLPTab';

const MESES_LABEL = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function calcularRangeMes(ano: number, mes: number): { inicio: string; fim: string } {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { inicio, fim };
}

export default function InsightsPage() {
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('💡 Insights Estratégicos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const now = new Date();
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [mes, setMes] = useState<number>(now.getMonth() + 1);

  const { dataInicio, dataFim } = useMemo(() => {
    const { inicio, fim } = calcularRangeMes(ano, mes);
    return { dataInicio: inicio, dataFim: fim };
  }, [ano, mes]);

  // Anos disponíveis: ano atual + 2 anos anteriores
  const anos = useMemo(() => {
    const atual = now.getFullYear();
    return [atual, atual - 1, atual - 2];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[calc(100vh-8px)] bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 py-4 pb-8 max-w-[98vw]">
        <Card className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-700">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Insights Estratégicos
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Análises mensais para decisão executiva
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={String(m)}>{MESES_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
                <SelectTrigger className="h-9 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="curva" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1 h-auto">
            <TabsTrigger value="curva" className="flex items-center gap-2 py-2">
              <Clock className="w-4 h-4" />
              <span className="hidden lg:inline">Curva horária</span>
            </TabsTrigger>
            <TabsTrigger value="cancel" className="flex items-center gap-2 py-2">
              <XCircle className="w-4 h-4" />
              <span className="hidden lg:inline">Cancelamentos</span>
            </TabsTrigger>
            <TabsTrigger value="meios" className="flex items-center gap-2 py-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden lg:inline">Meios pgto</span>
            </TabsTrigger>
            <TabsTrigger value="reservas" className="flex items-center gap-2 py-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden lg:inline">Reservas</span>
            </TabsTrigger>
            <TabsTrigger value="cohort" className="flex items-center gap-2 py-2">
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Retenção</span>
            </TabsTrigger>
            <TabsTrigger value="cac" className="flex items-center gap-2 py-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden lg:inline">CAC/ROAS</span>
            </TabsTrigger>
            <TabsTrigger value="nlp" className="flex items-center gap-2 py-2">
              <Sparkles className="w-4 h-4" />
              <span className="hidden lg:inline">Reviews IA</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="curva" className="mt-4">
            <CurvaHorariaTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
          <TabsContent value="cancel" className="mt-4">
            <CancelamentosTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
          <TabsContent value="meios" className="mt-4">
            <MeiosPagamentoTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
          <TabsContent value="reservas" className="mt-4">
            <ReservasTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
          <TabsContent value="cohort" className="mt-4">
            <CohortTab weeks={24} />
          </TabsContent>
          <TabsContent value="cac" className="mt-4">
            <CacRoasTab ano={ano} />
          </TabsContent>
          <TabsContent value="nlp" className="mt-4">
            <ReviewsNLPTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
