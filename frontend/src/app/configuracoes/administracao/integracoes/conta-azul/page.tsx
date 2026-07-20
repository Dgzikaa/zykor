'use client';

import { useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import ContaAzulIntegrationCard from '@/components/configuracoes/ContaAzulIntegrationCard';
import { Wallet } from 'lucide-react';

// Lar da tela de conexão do Conta Azul (por bar): configurar credenciais + OAuth + sincronizar.
// O card em si (ContaAzulIntegrationCard) já existia, mas morava em /configuracoes/integracoes,
// que o middleware bloqueia ("Página removida"). Movido pra cá — a área viva de integrações,
// linkada pela ação do catálogo (catalog.ts → contaazul.acoes). Cada bar tem sua própria conexão.
export default function ContaAzulIntegracaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  useEffect(() => {
    setPageTitle('💰 Conta Azul');
    return () => setPageTitle('');
  }, [setPageTitle]);

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: '#00B2FF' }}>
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Conta Azul</h1>
            <p className="text-sm text-muted-foreground">
              Cada bar/empresa tem sua própria conexão. Configurando o bar: <b>{selectedBar?.nome || '—'}</b>.
            </p>
          </div>
        </div>

        <ContaAzulIntegrationCard selectedBar={selectedBar} />
      </div>
    </ProtectedRoute>
  );
}
