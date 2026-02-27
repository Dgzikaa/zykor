'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingState } from '@/components/ui/loading-state';
import { RefreshCw } from 'lucide-react';

export default function CMOSemanalRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ano = searchParams.get('ano');
    const semana = searchParams.get('semana');
    
    if (ano && semana) {
      router.replace(`/ferramentas/cmo?ano=${ano}&semana=${semana}`);
    } else {
      router.replace('/ferramentas/cmo');
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingState
        title="Redirecionando..."
        subtitle="Aguarde um momento"
        icon={<RefreshCw className="w-4 h-4" />}
      />
    </div>
  );
}
