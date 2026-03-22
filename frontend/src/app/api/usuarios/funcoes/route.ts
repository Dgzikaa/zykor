import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Funções disponíveis no sistema
const FUNCOES_DISPONIVEL = [
  {
    id: 'funcionario',
    nome: 'Funcionário',
    descricao: 'Acesso básico às funcionalidades operacionais',
    nivel: 1,
    cor: 'bg-blue-100 text-blue-800 border-blue-200',
    icone: '👤',
  },
  {
    id: 'gerente',
    nome: 'Gerente',
    descricao: 'Acesso a relatórios e gestão de funcionários',
    nivel: 2,
    cor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icone: '👨‍💼',
  },
  {
    id: 'admin',
    nome: 'Administrador',
    descricao: 'Acesso completo a todas as funcionalidades',
    nivel: 3,
    cor: 'bg-red-100 text-red-800 border-red-200',
    icone: '👑',
  },
];

export async function GET() {
  try {
    // Aqui você pode adicionar lógica para buscar funções específicas por bar
    // ou implementar diferentes tipos de funções baseadas no plano do bar

    return NextResponse.json({
      success: true,
      funcoes: FUNCOES_DISPONIVEL,
      total: FUNCOES_DISPONIVEL.length,
    });
  } catch (error) {
    console.error('❌ Erro na API de funções:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
