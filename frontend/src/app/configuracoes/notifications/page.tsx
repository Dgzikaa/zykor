'use client';

import { Bell, Smartphone } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { PushToggle } from '@/components/PushToggle';

export default function NotificationsPage() {
  const { selectedBar } = useBar();

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5" />
          <h1 className="text-xl font-bold">Notificações</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Receba alertas do Zykor direto no celular — sem custo, sem WhatsApp.</p>

        <Card>
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <Smartphone className="w-4 h-4 text-blue-500" /> Notificações push neste aparelho
            </div>
            <p className="text-sm text-muted-foreground">
              Ative pra receber avisos do Zykor (financeiro, eventos, pendências) mesmo com o app fechado.
              É preciso ativar em <b>cada aparelho</b>.
            </p>
            <PushToggle barId={selectedBar?.id} />
            <p className="text-xs text-muted-foreground border-t pt-3">
              📱 <b>iPhone:</b> abra o Zykor no Safari → Compartilhar → <b>Adicionar à Tela de Início</b>, abra pelo ícone instalado e então ative aqui (o iOS só permite push pelo app instalado).
            </p>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
