'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PesquisaTab } from './PesquisaTab';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Smile, BarChart3, Building2, MessagesSquare } from 'lucide-react';
import PesquisaFelicidadePage from '../pesquisa-felicidade/page';

/**
 * Hub de Pesquisas (ata de 13/08/2026).
 *
 * "PESQUISAS TEM BEM MAIS DO QUE FELICIDADE, MUDARIA PRA PESQUISAS COM TODAS AS PESQUISAS, ABA PRA
 * A PRÓPRIA AVALIAÇÃO, ABA DE RECONHECIMENTOS."
 *
 * A Felicidade é reaproveitada inteira — ela já tem as próprias abas internas. A rota antiga
 * /rh/pesquisa-felicidade continua de pé (links salvos não quebram), mas saiu do menu.
 */

export default function PesquisasPage() {
  const { setPageTitle } = usePageTitle();
  const [aba, setAba] = useState('analises');
  // Depende de `aba` de propósito: a tela da Felicidade escreve o próprio título ao montar e
  // apaga ao desmontar. Como efeito de filho roda antes do do pai, reafirmar aqui a cada troca
  // de aba mantém "Pesquisas" no header.
  useEffect(() => {
    setPageTitle('📋 Pesquisas');
    return () => setPageTitle('');
  }, [setPageTitle, aba]);

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <Tabs value={aba} onValueChange={setAba} className="w-full">
          {/* Ordem definida pelo Gonza (20/08/2026): a leitura primeiro, depois cada pesquisa.
              Calibração e Reconhecimentos saíram em 21/08/2026 (Rodrigo): a Calibração depende
              da Avaliação de Desempenho, que ainda não existe, e Reconhecimentos não estava em
              uso. As rotas /api/rh/calibracoes e /api/rh/reconhecimentos continuam de pé — o
              dia em que voltarem, volta só a aba. */}
          <TabsList className="mb-4">
            <TabsTrigger value="analises"><BarChart3 className="w-4 h-4 mr-1.5" />Análises</TabsTrigger>
            <TabsTrigger value="felicidade"><Smile className="w-4 h-4 mr-1.5" />Pesquisa da Felicidade</TabsTrigger>
            <TabsTrigger value="marca"><Building2 className="w-4 h-4 mr-1.5" />Marca Empregadora</TabsTrigger>
            <TabsTrigger value="feedback"><MessagesSquare className="w-4 h-4 mr-1.5" />Feedback</TabsTrigger>
          </TabsList>

          {/* Análises = a leitura histórica (ainda vem da planilha), com as abas internas dela */}
          <TabsContent value="analises"><PesquisaFelicidadePage /></TabsContent>
          <TabsContent value="felicidade"><PesquisaTab tipo="felicidade" /></TabsContent>
          <TabsContent value="marca"><PesquisaTab tipo="marca_empregadora" /></TabsContent>
          <TabsContent value="feedback"><PesquisaTab tipo="feedback" /></TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
