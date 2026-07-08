'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useUser } from '@/contexts/UserContext';
import { userHasModule } from '@/lib/permissions/resolver';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bell, Inbox, Send, History, Smartphone, Zap } from 'lucide-react';
import InboxTab from './_components/InboxTab';
import RegrasTab from './_components/RegrasTab';
import EnviarTab from './_components/EnviarTab';
import HistoricoTab from './_components/HistoricoTab';
import DispositivosTab from './_components/DispositivosTab';
import CondicoesTab from './_components/CondicoesTab';

export default function NotificationsPage() {
  const { user } = useUser();
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('🔔 Central de Notificações');
    return () => setPageTitle('');
  }, [setPageTitle]);
  // Gestão das notificações (Alertas/Enviar/Histórico) segue o MÓDULO Configurações, não o role.
  // Admin sempre passa. Quem não tem o módulo vê só a Caixa de entrada + Dispositivos.
  const podeGerir =
    user?.role === 'admin' || userHasModule((user as any)?.modulos_permitidos, 'configuracoes');
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
            {podeGerir && (
              <TabsTrigger value="alertas" className="gap-1.5">
                <Zap className="w-4 h-4" /> Alertas
              </TabsTrigger>
            )}
            {podeGerir && (
              <TabsTrigger value="enviar" className="gap-1.5">
                <Send className="w-4 h-4" /> Enviar aviso
              </TabsTrigger>
            )}
            {podeGerir && (
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

          {podeGerir && (
            <TabsContent value="alertas" className="mt-4 space-y-8">
              <section className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold">Alertas do sistema</h2>
                  <p className="text-sm text-muted-foreground">
                    Eventos que o Zykor já detecta (produção, checklist, financeiro…). Escolha quem
                    recebe e por quais canais.
                  </p>
                </div>
                <RegrasTab />
              </section>
              <section className="space-y-3 border-t pt-6">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" /> Meus alertas
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Crie alertas sob medida — você define a condição (estoque &lt; X, faturamento
                    abaixo da meta, compra cara…).
                  </p>
                </div>
                <CondicoesTab />
              </section>
            </TabsContent>
          )}

          {podeGerir && (
            <TabsContent value="enviar" className="mt-4">
              <EnviarTab />
            </TabsContent>
          )}

          {podeGerir && (
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
