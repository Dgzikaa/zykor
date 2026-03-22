import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Dados mockados para demonstração
    const mockAgeData = [
      {
        date: "2025-07-25",
        audience_age_name: "13-17",
        audience_age_size: 40
      },
      {
        date: "2025-07-25",
        audience_age_name: "18-24",
        audience_age_size: 1523
      },
      {
        date: "2025-07-25",
        audience_age_name: "25-34",
        audience_age_size: 14270
      },
      {
        date: "2025-07-25",
        audience_age_name: "35-44",
        audience_age_size: 14713
      },
      {
        date: "2025-07-25",
        audience_age_name: "45-54",
        audience_age_size: 6448
      },
      {
        date: "2025-07-25",
        audience_age_name: "55-64",
        audience_age_size: 591
      },
      {
        date: "2025-07-25",
        audience_age_name: "65+",
        audience_age_size: 163
      }
    ];

    return NextResponse.json({
      success: true,
      data: mockAgeData
    });

  } catch (error) {
    console.error('Erro ao buscar dados de idade:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 
