import type { Metadata } from 'next';
import RascunhoClient from './RascunhoClient';

export const metadata: Metadata = {
  title: 'Planejamento Comercial — Rascunho',
};

/**
 * RASCUNHO de redesign do Planejamento Comercial.
 *
 * Rota proposital fora do menu (lib/navigation/menu.ts) e sem entrada própria em
 * route-permissions — herda o gate da área /estrategico. Serve só pra avaliar a
 * direção do layout (fim do scroll lateral). Dados são fictícios; não toca o banco.
 */
export default function PlanejamentoComercialRascunhoPage() {
  return <RascunhoClient />;
}
