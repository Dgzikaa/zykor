// ========================================
// TIPOS
// ========================================
export interface DataImportante {
  data: string
  nome: string
  tipo: string
  diaSemana: string
  potencial: 'maximo' | 'alto' | 'medio' | 'baixo'
  dica: string
  categoria?: string
}

export interface DadosHistorico2025 {
  data: string
  diaSemana: string
  comandas: number
  faturamento: number
  pessoas: number
  ticketMedio: number
  evento?: string
}

export interface FaturamentoPorDia {
  diaSemana: string
  diaSemanaNum: number
  totalDias: number
  faturamentoTotal: number
  mediaFaturamento: number
}

export interface EventoConcorrenciaBD {
  id: string
  nome: string
  descricao?: string
  local_nome: string
  local_endereco?: string
  cidade: string
  data_evento: string
  horario_inicio?: string
  tipo: string
  impacto: 'alto' | 'medio' | 'baixo'
  fonte: string
  url_fonte?: string
  preco_minimo?: number
  preco_maximo?: number
  imagem_url?: string
  status: string
  verificado: boolean
  notas?: string
  created_at: string
}

// ========================================
// DADOS DE 2026 - DATAS IMPORTANTES
// ========================================
export const DATAS_2026: DataImportante[] = [
  // Janeiro
  { data: '2026-01-01', nome: 'Ano Novo', tipo: 'nacional', diaSemana: 'Quinta', potencial: 'alto', dica: 'Véspera é QUARTA - ótimo para evento especial' },
  
  // Fevereiro - Carnaval
  { data: '2026-02-08', nome: 'Supercopa do Brasil', tipo: 'futebol', diaSemana: 'Domingo', potencial: 'alto', dica: 'Primeira decisão do ano' },
  { data: '2026-02-14', nome: 'Carnaval (Sábado)', tipo: 'carnaval', diaSemana: 'Sábado', potencial: 'maximo', dica: 'Início do Carnaval - lotação máxima!' },
  { data: '2026-02-15', nome: 'Carnaval (Domingo)', tipo: 'carnaval', diaSemana: 'Domingo', potencial: 'maximo', dica: 'Domingo de Carnaval' },
  { data: '2026-02-16', nome: 'Carnaval (Segunda)', tipo: 'carnaval', diaSemana: 'Segunda', potencial: 'maximo', dica: 'Segunda de Carnaval' },
  { data: '2026-02-17', nome: 'Carnaval (Terça)', tipo: 'carnaval', diaSemana: 'Terça', potencial: 'maximo', dica: 'Terça de Carnaval - pico!' },
  { data: '2026-02-18', nome: 'Quarta de Cinzas', tipo: 'carnaval', diaSemana: 'Quarta', potencial: 'alto', dica: 'Ressaca de Carnaval - feijoada?' },
  
  // Abril - Páscoa
  { data: '2026-04-03', nome: 'Sexta-feira Santa', tipo: 'nacional', diaSemana: 'Sexta', potencial: 'alto', dica: 'Feriadão da Páscoa - sexta é ouro!' },
  { data: '2026-04-04', nome: 'Sábado de Aleluia', tipo: 'pascoa', diaSemana: 'Sábado', potencial: 'maximo', dica: 'Pós-Sexta Santa - evento especial' },
  { data: '2026-04-05', nome: 'Domingo de Páscoa', tipo: 'pascoa', diaSemana: 'Domingo', potencial: 'alto', dica: 'Almoço especial de Páscoa' },
  { data: '2026-04-21', nome: 'Tiradentes / Aniv. BSB', tipo: 'nacional', diaSemana: 'Terça', potencial: 'alto', dica: 'Terça-feira - possível emenda + Aniversário Brasília' },
  
  // Maio
  { data: '2026-05-01', nome: 'Dia do Trabalho', tipo: 'nacional', diaSemana: 'Sexta', potencial: 'maximo', dica: 'SEXTA - feriadão perfeito!' },
  { data: '2026-05-10', nome: 'Dia das Mães', tipo: 'especial', diaSemana: 'Domingo', potencial: 'alto', dica: 'Almoço especial - reservas antecipadas' },
  
  // Junho - Copa do Mundo + Festas Juninas
  { data: '2026-06-04', nome: 'Corpus Christi', tipo: 'nacional', diaSemana: 'Quinta', potencial: 'maximo', dica: 'Quinta + emenda sexta = feriadão!' },
  { data: '2026-06-05', nome: 'Emenda Corpus Christi', tipo: 'emenda', diaSemana: 'Sexta', potencial: 'maximo', dica: 'Sexta de emenda - alta demanda' },
  { data: '2026-06-12', nome: 'Dia dos Namorados', tipo: 'especial', diaSemana: 'Sexta', potencial: 'maximo', dica: 'SEXTA - noite romântica perfeita!' },
  { data: '2026-06-13', nome: 'São João (Véspera)', tipo: 'festa_junina', diaSemana: 'Sábado', potencial: 'maximo', dica: 'Festa Junina no sábado!' },
  { data: '2026-06-14', nome: 'Copa: Brasil Jogo 1', tipo: 'copa', diaSemana: 'Domingo', potencial: 'maximo', dica: 'ESTREIA DO BRASIL NA COPA! 🇧🇷' },
  { data: '2026-06-18', nome: 'Copa: Brasil Jogo 2', tipo: 'copa', diaSemana: 'Quinta', potencial: 'maximo', dica: 'Segundo jogo do Brasil' },
  { data: '2026-06-22', nome: 'Copa: Brasil Jogo 3', tipo: 'copa', diaSemana: 'Segunda', potencial: 'maximo', dica: 'Terceiro jogo - decisivo?' },
  { data: '2026-06-24', nome: 'São João (tradicional)', tipo: 'festa_junina', diaSemana: 'Quarta', potencial: 'alto', dica: 'Arraiá especial' },
  { data: '2026-06-29', nome: 'São Pedro', tipo: 'festa_junina', diaSemana: 'Segunda', potencial: 'medio', dica: 'Final das festas juninas' },
  
  // Julho - Copa do Mundo (mata-mata)
  { data: '2026-07-01', nome: 'Copa: Oitavas', tipo: 'copa', diaSemana: 'Quarta', potencial: 'maximo', dica: 'Oitavas de final - mata-mata!' },
  { data: '2026-07-05', nome: 'Copa: Quartas', tipo: 'copa', diaSemana: 'Domingo', potencial: 'maximo', dica: 'Quartas de final' },
  { data: '2026-07-09', nome: 'Copa: Semifinal', tipo: 'copa', diaSemana: 'Quinta', potencial: 'maximo', dica: 'Semifinal - tensão máxima!' },
  { data: '2026-07-13', nome: 'Copa: FINAL', tipo: 'copa', diaSemana: 'Segunda', potencial: 'maximo', dica: '🏆 FINAL DA COPA DO MUNDO!' },
  
  // Agosto
  { data: '2026-08-09', nome: 'Dia dos Pais', tipo: 'especial', diaSemana: 'Domingo', potencial: 'alto', dica: 'Almoço especial - churrasco?' },
  
  // Setembro
  { data: '2026-09-07', nome: 'Independência', tipo: 'nacional', diaSemana: 'Segunda', potencial: 'maximo', dica: 'SEGUNDA - feriadão domingo+segunda!' },
  
  // Outubro
  { data: '2026-10-12', nome: 'N. Sra. Aparecida', tipo: 'nacional', diaSemana: 'Segunda', potencial: 'maximo', dica: 'SEGUNDA - feriadão perfeito!' },
  { data: '2026-10-21', nome: 'Copa do Brasil Final 1', tipo: 'futebol', diaSemana: 'Quarta', potencial: 'alto', dica: 'Final da Copa do Brasil - Ida' },
  { data: '2026-10-28', nome: 'Copa do Brasil Final 2', tipo: 'futebol', diaSemana: 'Quarta', potencial: 'alto', dica: 'Final da Copa do Brasil - Volta' },
  { data: '2026-10-31', nome: 'Halloween', tipo: 'tematico', diaSemana: 'Sábado', potencial: 'maximo', dica: 'SÁBADO - festa fantasia!' },
  
  // Novembro
  { data: '2026-11-02', nome: 'Finados', tipo: 'nacional', diaSemana: 'Segunda', potencial: 'alto', dica: 'Segunda - emenda de domingo' },
  { data: '2026-11-15', nome: 'Proclamação República', tipo: 'nacional', diaSemana: 'Domingo', potencial: 'medio', dica: 'Domingo - dia normal' },
  { data: '2026-11-28', nome: 'Final Libertadores', tipo: 'futebol', diaSemana: 'Sábado', potencial: 'maximo', dica: '🏆 FINAL DA LIBERTADORES!' },
  
  // Dezembro
  { data: '2026-12-24', nome: 'Véspera de Natal', tipo: 'natal', diaSemana: 'Quinta', potencial: 'medio', dica: 'Happy hour corporativo' },
  { data: '2026-12-25', nome: 'Natal', tipo: 'natal', diaSemana: 'Sexta', potencial: 'baixo', dica: 'Fechado ou horário especial' },
  { data: '2026-12-31', nome: 'Réveillon', tipo: 'reveillon', diaSemana: 'Quinta', potencial: 'maximo', dica: '🎆 RÉVEILLON - evento do ano!' },
]

// Feriadões (períodos de múltiplos dias)
export const FERIADOES_2026 = [
  { nome: 'Carnaval', inicio: '2026-02-14', fim: '2026-02-18', dias: 5, potencial: 'maximo' as const, descricao: 'Sáb-Qua: 5 dias de festa!' },
  { nome: 'Páscoa', inicio: '2026-04-03', fim: '2026-04-05', dias: 3, potencial: 'alto' as const, descricao: 'Sex-Dom: Feriadão religioso' },
  { nome: 'Tiradentes + Emenda', inicio: '2026-04-18', fim: '2026-04-21', dias: 4, potencial: 'alto' as const, descricao: 'Sáb-Ter: Possível emenda segunda' },
  { nome: 'Dia do Trabalho', inicio: '2026-05-01', fim: '2026-05-03', dias: 3, potencial: 'maximo' as const, descricao: 'Sex-Dom: Feriadão perfeito!' },
  { nome: 'Corpus Christi', inicio: '2026-06-04', fim: '2026-06-07', dias: 4, potencial: 'maximo' as const, descricao: 'Qui-Dom: Com emenda sexta!' },
  { nome: 'Independência', inicio: '2026-09-05', fim: '2026-09-07', dias: 3, potencial: 'maximo' as const, descricao: 'Sáb-Seg: Feriadão nacional' },
  { nome: 'Aparecida', inicio: '2026-10-10', fim: '2026-10-12', dias: 3, potencial: 'maximo' as const, descricao: 'Sáb-Seg: Outro feriadão perfeito' },
  { nome: 'Finados', inicio: '2026-10-31', fim: '2026-11-02', dias: 3, potencial: 'alto' as const, descricao: 'Sáb-Seg: Halloween + Finados' },
  { nome: 'Natal/Ano Novo', inicio: '2026-12-24', fim: '2027-01-01', dias: 9, potencial: 'alto' as const, descricao: 'Período festivo - corporativos' },
]

// ========================================
// DADOS HISTÓRICOS 2025
// ========================================
export const TOP_DIAS_2025: DadosHistorico2025[] = [
  { data: '2025-12-12', diaSemana: 'Sexta', comandas: 1153, faturamento: 129943.78, pessoas: 1292, ticketMedio: 112.70, evento: 'Confraternizações' },
  { data: '2025-12-05', diaSemana: 'Sexta', comandas: 1096, faturamento: 128058.96, pessoas: 1204, ticketMedio: 116.84, evento: 'Confraternizações' },
  { data: '2025-12-19', diaSemana: 'Sexta', comandas: 1064, faturamento: 127081.09, pessoas: 1181, ticketMedio: 119.44, evento: 'Confraternizações' },
  { data: '2025-11-29', diaSemana: 'Sábado', comandas: 1044, faturamento: 114729.15, pessoas: 1104, ticketMedio: 109.89, evento: 'Black Friday Weekend' },
  { data: '2025-12-21', diaSemana: 'Domingo', comandas: 903, faturamento: 113028.92, pessoas: 947, ticketMedio: 125.17, evento: 'Pré-Natal' },
  { data: '2025-12-17', diaSemana: 'Quarta', comandas: 876, faturamento: 103764.31, pessoas: 956, ticketMedio: 118.45, evento: 'Confraternizações' },
  { data: '2025-12-20', diaSemana: 'Sábado', comandas: 685, faturamento: 82225.48, pessoas: 729, ticketMedio: 120.04, evento: 'Pré-Natal' },
  { data: '2025-04-04', diaSemana: 'Sexta', comandas: 804, faturamento: 78667.18, pessoas: 823, ticketMedio: 97.84, evento: 'Sexta-feira Santa' },
  { data: '2025-12-03', diaSemana: 'Quarta', comandas: 717, faturamento: 76747.08, pessoas: 759, ticketMedio: 107.04, evento: 'Confraternizações' },
  { data: '2025-02-21', diaSemana: 'Sexta', comandas: 780, faturamento: 75903.54, pessoas: 789, ticketMedio: 97.31, evento: 'Pré-Carnaval' },
  { data: '2025-12-30', diaSemana: 'Terça', comandas: 618, faturamento: 69725.80, pessoas: 709, ticketMedio: 108.31, evento: 'Entre Natal e Réveillon' },
  { data: '2025-03-21', diaSemana: 'Sexta', comandas: 741, faturamento: 69238.20, pessoas: 763, ticketMedio: 93.44, evento: 'Sexta Normal' },
  { data: '2025-12-18', diaSemana: 'Quinta', comandas: 512, faturamento: 58626.06, pessoas: 531, ticketMedio: 114.50, evento: 'Confraternizações' },
  { data: '2025-02-15', diaSemana: 'Sábado', comandas: 554, faturamento: 54128.48, pessoas: 565, ticketMedio: 97.70, evento: 'Pré-Carnaval' },
  { data: '2025-12-06', diaSemana: 'Sábado', comandas: 489, faturamento: 53811.21, pessoas: 531, ticketMedio: 110.04, evento: 'Confraternizações' },
  { data: '2025-03-22', diaSemana: 'Sábado', comandas: 573, faturamento: 52799.69, pessoas: 589, ticketMedio: 92.15, evento: 'Sábado Normal' },
  { data: '2025-12-23', diaSemana: 'Terça', comandas: 505, faturamento: 51956.12, pessoas: 512, ticketMedio: 96.01, evento: 'Véspera de Natal' },
]

export const FATURAMENTO_POR_DIA_2025: FaturamentoPorDia[] = [
  { diaSemana: 'Domingo', diaSemanaNum: 0, totalDias: 7, faturamentoTotal: 144382.59, mediaFaturamento: 20626.08 },
  { diaSemana: 'Segunda', diaSemanaNum: 1, totalDias: 4, faturamentoTotal: 79555.74, mediaFaturamento: 19888.94 },
  { diaSemana: 'Terça', diaSemanaNum: 2, totalDias: 8, faturamentoTotal: 144648.01, mediaFaturamento: 18081.00 },
  { diaSemana: 'Quarta', diaSemanaNum: 3, totalDias: 9, faturamentoTotal: 370514.37, mediaFaturamento: 41168.26 },
  { diaSemana: 'Quinta', diaSemanaNum: 4, totalDias: 8, faturamentoTotal: 190430.13, mediaFaturamento: 23803.77 },
  { diaSemana: 'Sexta', diaSemanaNum: 5, totalDias: 10, faturamentoTotal: 746797.19, mediaFaturamento: 74679.72 },
  { diaSemana: 'Sábado', diaSemanaNum: 6, totalDias: 11, faturamentoTotal: 510178.84, mediaFaturamento: 46379.89 },
]

export const COMPARACAO_DATAS: { [key: string]: { data2025: string; faturamento2025: number; evento2025: string } } = {
  '2026-02-14': { data2025: '2025-03-01', faturamento2025: 0, evento2025: 'Carnaval 2025' },
  '2026-04-03': { data2025: '2025-04-04', faturamento2025: 78667.18, evento2025: 'Sexta-feira Santa 2025' },
}

export const DATAS_CONCORRENCIA_2026: DataImportante[] = []

export const IDEIAS_ACOES = [
  { titulo: 'Pacotes Corporativos', descricao: 'Monte pacotes de confraternização Nov-Dez com preço fechado por pessoa', categoria: 'Vendas', prioridade: 'alta' as const },
  { titulo: 'Parcerias Empresas', descricao: 'Feche parcerias com empresas próximas para happy hours mensais', categoria: 'Parcerias', prioridade: 'alta' as const },
  { titulo: 'Programa Fidelidade', descricao: 'Lançar programa de pontos para aumentar recorrência', categoria: 'Fidelização', prioridade: 'media' as const },
  { titulo: 'Reservas Antecipadas', descricao: 'Sistema de reservas para datas especiais com desconto antecipado', categoria: 'Vendas', prioridade: 'alta' as const },
  { titulo: 'Lives/Transmissões', descricao: 'Transmitir jogos importantes com promoções especiais', categoria: 'Eventos', prioridade: 'alta' as const },
  { titulo: 'Menu Temático', descricao: 'Criar cardápios especiais para datas (Junino, Copa, Halloween)', categoria: 'Produto', prioridade: 'media' as const },
  { titulo: 'Influenciadores Locais', descricao: 'Parcerias com micro-influenciadores de Brasília', categoria: 'Marketing', prioridade: 'media' as const },
  { titulo: 'Eventos Privados', descricao: 'Oferecer espaço para eventos fechados (aniversários, empresas)', categoria: 'Vendas', prioridade: 'alta' as const },
]

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
