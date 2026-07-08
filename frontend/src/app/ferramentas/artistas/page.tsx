'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Award } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import ArtistasTab from './ArtistasTab';
import LabelsTab from './LabelsTab';
import InsightsTab from './InsightsTab';

export default function FerramentasArtistasPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [periodo, setPeriodo] = useState(12);
  const [aba, setAba] = useState('artistas');
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('🎤 Artistas & Labels');
    return () => setPageTitle('');
  }, [setPageTitle]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 py-4 max-w-7xl space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Artistas & Labels — visão da casa</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {aba === 'artistas'
                  ? <>ROI, retorno e <b>lift</b> por artista. Cada noite conta pro <b>principal</b> dela (maior cachê) — apoio não herda o público.</>
                  : aba === 'labels'
                  ? <>Como cada <b>label</b> (noite recorrente) evolui semana a semana e quais <b>artistas</b> rendem mais em cada uma.</>
                  : <>Leitura rápida de <b>cada dia da semana</b> e do <b>momentum de cada artista</b> — pra dar previsibilidade e embasar manter/renovar.</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[6, 12, 24].map(m => (
              <button key={m} onClick={() => setPeriodo(m)} className={`px-2.5 h-8 rounded-md text-sm border transition ${periodo === m ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>{m}m</button>
            ))}
            <Link href="/analitico/atracoes" className="text-sm rounded-md border border-gray-300 dark:border-gray-600 px-3 h-8 inline-flex items-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Visão do artista →</Link>
          </div>
        </div>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="dark:bg-gray-800">
            <TabsTrigger value="artistas" className="dark:data-[state=active]:bg-gray-900 dark:text-gray-300 dark:data-[state=active]:text-white">Artistas</TabsTrigger>
            <TabsTrigger value="labels" className="dark:data-[state=active]:bg-gray-900 dark:text-gray-300 dark:data-[state=active]:text-white">Labels</TabsTrigger>
            <TabsTrigger value="insights" className="dark:data-[state=active]:bg-gray-900 dark:text-gray-300 dark:data-[state=active]:text-white">Insights</TabsTrigger>
          </TabsList>
          <TabsContent value="artistas"><ArtistasTab barId={barId} periodo={periodo} /></TabsContent>
          <TabsContent value="labels"><LabelsTab barId={barId} periodo={periodo} /></TabsContent>
          <TabsContent value="insights"><InsightsTab barId={barId} periodo={periodo} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
