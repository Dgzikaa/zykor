'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Users, Shield, Target, Database } from 'lucide-react';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  modulos_permitidos: string[] | Record<string, any>;
}

interface Meta {
  id: number;
  nome: string;
  valor: number;
  periodo: string;
  ativo: boolean;
}

interface Funcao {
  id: number;
  nome: string;
  permissoes: string[];
}

interface Modulo {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

export default function ConfiguracaoPage() {
  const { selectedBar } = useBar();
  const [activeTab, setActiveTab] = useState('usuarios');

  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('⚙️ Configuração');
    return () => setPageTitle('');
  }, [setPageTitle]);

  if (!selectedBar?.id) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-600 font-medium">
            ⚠️ Selecione um bar primeiro
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-black mb-2">
          Configurações do Sistema
        </h1>
        <p className="text-gray-700 font-medium">
          Gerencie usuários, permissões, metas e importações de dados -{' '}
          {selectedBar.nome}
        </p>
      </div>

      {/* Tabs de Configuração */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Usuários & Permissões
          </TabsTrigger>
          <TabsTrigger value="metas" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="importacao" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Importação de Dados
          </TabsTrigger>
          <TabsTrigger value="sistema" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* Tab de Usuários */}
        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Gestão de Usuários e Permissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Funcionalidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Metas */}
        <TabsContent value="metas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Metas e Objetivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Funcionalidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Importação */}
        <TabsContent value="importacao">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Importação de Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Funcionalidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Sistema */}
        <TabsContent value="sistema">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Configurações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Funcionalidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
