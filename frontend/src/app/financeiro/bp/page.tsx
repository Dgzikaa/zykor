// Business Plan agora vive em Financeiro. Reaproveita 100% a página existente
// (mesma busca de dados + BpClient) — fonte única, sem duplicar lógica.
export { default } from '../../estrategico/bp/page';
export const revalidate = 600;
