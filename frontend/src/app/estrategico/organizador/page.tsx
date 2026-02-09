import { getBarIdServer, getBarNomeServer } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { getOrganizadores } from './services/organizador-service';
import { OrganizadorClient } from './components/OrganizadorClient';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { Card } from '@/components/ui/card';
import { Target } from 'lucide-react';

export default async function OrganizadorPage() {
  const barId = await getBarIdServer();
  const barNome = await getBarNomeServer();

  if (!barId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Selecione um Bar
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um bar no seletor acima para visualizar o Organizador de Visão.
          </p>
        </Card>
      </div>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const initialData = await getOrganizadores(supabase, barId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <BarSyncCheck />
      <OrganizadorClient 
        initialData={initialData} 
        barId={barId} 
        barNome={barNome || 'Bar Selecionado'} 
      />
    </div>
  );
}
