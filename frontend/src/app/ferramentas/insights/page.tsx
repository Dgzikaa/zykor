'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lightbulb, Clock, XCircle, CreditCard, Calendar, Swords, Users, DollarSign, Sparkles } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { CurvaHorariaTab } from './components/CurvaHorariaTab';
import { CancelamentosTab } from './components/CancelamentosTab';
import { MeiosPagamentoTab } from './components/MeiosPagamentoTab';
import { ReservasTab } from './components/ReservasTab';
import { ConcorrenciaTab } from './components/ConcorrenciaTab';
import { CohortTab } from './components/CohortTab';
import { CacRoasTab } from './components/CacRoasTab';
import { ReviewsNLPTab } from './components/ReviewsNLPTab';

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function InsightsPage() {
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('💡 Insights Estratégicos');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Default: últimos 30 dias até ontem
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const trintaDiasAtras = new Date(ontem);
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 29);

  const [dataInicio, setDataInicio] = useState(formatDate(trintaDiasAtras));
  const [dataFim, setDataFim] = useState(formatDate(ontem));

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
                  Análises de comportamento operacional para decisão executiva
                </p>
              </div>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 w-40" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 w-40" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="curva" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-1 h-auto">
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
            <TabsTrigger value="concorrencia" className="flex items-center gap-2 py-2">
              <Swords className="w-4 h-4" />
              <span className="hidden lg:inline">Concorrência</span>
            </TabsTrigger>
            <TabsTrigger value="cohort" className="flex items-center gap-2 py-2">
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">Cohort</span>
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
          <TabsContent value="concorrencia" className="mt-4">
            <ConcorrenciaTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
          <TabsContent value="cohort" className="mt-4">
            <CohortTab weeks={12} />
          </TabsContent>
          <TabsContent value="cac" className="mt-4">
            <CacRoasTab />
          </TabsContent>
          <TabsContent value="nlp" className="mt-4">
            <ReviewsNLPTab dataInicio={dataInicio} dataFim={dataFim} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
