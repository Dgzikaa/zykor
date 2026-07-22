'use client';

/**
 * Comunicação › Instagram (landing do hub de mídia, área Receitas).
 *
 * Painel do Instagram (perfil + botão "Sincronizar agora" + evolução de
 * seguidores + top posts). O conteúdo orgânico (KPIs por período) virou a aba
 * "Orgânico" (/receitas/comunicacao/organico). Componente compartilhado com o
 * legado /marketing/instagram.
 */

import { InstagramDashboard } from '@/components/instagram/InstagramDashboard';

export default function ComunicacaoInstagramPage() {
  return <InstagramDashboard />;
}
