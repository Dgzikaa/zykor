'use client';

// LEGADO: o painel do Instagram foi promovido pra landing do hub Comunicação
// (/receitas/comunicacao). Esta rota permanece funcionando via o mesmo
// componente compartilhado até ser aposentada.
import { InstagramDashboard } from '@/components/instagram/InstagramDashboard';

export default function InstagramDashboardPage() {
  return <InstagramDashboard />;
}
