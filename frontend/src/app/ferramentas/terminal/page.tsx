'use client';

// Tela aposentada — o Terminal de Produção antigo apontava para um modelo de dados que
// nunca foi para o banco (receitas/producoes) e suas APIs não existem. Substituído por
// /operacional/producoes, construído sobre as fichas técnicas vivas (producao_base/ficha_item).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TerminalRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/operacional/producoes'); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      Redirecionando para Produções…
    </div>
  );
}
