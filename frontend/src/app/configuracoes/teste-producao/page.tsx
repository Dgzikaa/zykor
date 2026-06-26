'use client';

// Tela aposentada — protótipo de teste do timer de produção sobre o modelo morto
// (receitas/producoes, que nunca foram para o banco). Substituído por /operacional/producoes.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TesteProducaoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/operacional/producoes'); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      Redirecionando para Produções…
    </div>
  );
}
