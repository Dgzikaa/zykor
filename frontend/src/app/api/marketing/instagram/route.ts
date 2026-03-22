import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Dados mockados para demonstração
    const mockInstagramData = [
      {
        date: "2025-06-25",
        follower_count_1d: 145,
        reach: 58339,
        reach_1d: 58339
      },
      {
        date: "2025-06-26",
        follower_count_1d: 220,
        reach: 73806,
        reach_1d: 73806
      },
      {
        date: "2025-06-27",
        follower_count_1d: 245,
        reach: 73298,
        reach_1d: 73298
      },
      {
        date: "2025-06-28",
        follower_count_1d: 201,
        reach: 72495,
        reach_1d: 72495
      },
      {
        date: "2025-06-29",
        follower_count_1d: 185,
        reach: 58730,
        reach_1d: 58730
      },
      {
        date: "2025-06-30",
        follower_count_1d: 184,
        reach: 41313,
        reach_1d: 41313
      },
      {
        date: "2025-07-01",
        follower_count_1d: 134,
        reach: 7414,
        reach_1d: 7414
      },
      {
        date: "2025-07-02",
        follower_count_1d: 169,
        reach: 39955,
        reach_1d: 39955
      },
      {
        date: "2025-07-03",
        follower_count_1d: 190,
        reach: 33574,
        reach_1d: 33574
      },
      {
        date: "2025-07-04",
        follower_count_1d: 193,
        reach: 41383,
        reach_1d: 41383
      }
    ];

    return NextResponse.json({
      success: true,
      data: mockInstagramData
    });

  } catch (error) {
    console.error('Erro ao buscar dados do Instagram:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 
