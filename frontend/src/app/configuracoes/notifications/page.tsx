'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useUser } from '@/contexts/UserContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bell, Inbox, SlidersHorizontal, Send, History, Smartphone } from 'lucide-react';
import InboxTab from './_components/InboxTab';
import RegrasTab from './_components/RegrasTab';
import EnviarTab from './_components/EnviarTab';
import HistoricoTab from './_components/HistoricoTab';
import DispositivosTab from './_components/DispositivosTab';

export default function NotificationsPage() {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('inbox');

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-6 max-w-4xl">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5" />
          <h1 className="text-xl font-bold">Central de Notificações</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Sua caixa de entrada em tempo real e, para admins, o controle de quem recebe o quê e por
          onde.
        </p>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="inbox" className="gap-1.5">
              <Inbox className="w-4 h-4" /> Caixa de entrada
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="regras" className="gap-1.5">
                <SlidersHorizontal className="w-4 h-4" /> Regras
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="enviar" className="gap-1.5">
                <Send className="w-4 h-4" /> Enviar aviso
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="historico" className="gap-1.5">
                <History className="w-4 h-4" /> Histórico
              </TabsTrigger>
            )}
            <TabsTrigger value="dispositivos" className="gap-1.5">
              <Smartphone className="w-4 h-4" /> Dispositivos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            <InboxTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="regras" className="mt-4">
              <RegrasTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="enviar" className="mt-4">
              <EnviarTab />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="historico" className="mt-4">
              <HistoricoTab />
            </TabsContent>
          )}

          <TabsContent value="dispositivos" className="mt-4">
            <DispositivosTab />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}
