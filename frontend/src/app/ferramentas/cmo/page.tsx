'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, History, Bell, GitCompare } from 'lucide-react';
import CMOSimulador from '@/components/ferramentas/cmo/CMOSimulador';
import CMODashboard from '@/components/ferramentas/cmo/CMODashboard';
import CMOProdutividade from '@/components/ferramentas/cmo/CMOProdutividade';
import CMOComparar from '@/components/ferramentas/cmo/CMOComparar';
import CMOAlertas from '@/components/ferramentas/cmo/CMOAlertas';
import CMOHistorico from '@/components/ferramentas/cmo/CMOHistorico';
import { usePageTitle } from '@/contexts/PageTitleContext';

export default function CMOPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('simulador');
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('👥 CMO');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['simulador', 'dashboard', 'comparar', 'alertas', 'historico'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="simulador" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Simulador</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="comparar" className="flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            <span className="hidden sm:inline">Comparar</span>
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulador" className="mt-6">
          <CMOSimulador />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6 space-y-6">
          <CMOProdutividade />
          <CMODashboard />
        </TabsContent>

        <TabsContent value="comparar" className="mt-6">
          <CMOComparar />
        </TabsContent>

        <TabsContent value="alertas" className="mt-6">
          <CMOAlertas />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <CMOHistorico />
        </TabsContent>
      </Tabs>
    </div>
  );
}
