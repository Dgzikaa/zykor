import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Dados mockados para demonstração
    const mockGoogleData = [
      {
        date: "2025-06-25",
        review_average_rating: 4.87,
        review_count: 407,
        review_total_count: 2009
      },
      {
        date: "2025-06-26",
        review_average_rating: 4.87,
        review_count: 407,
        review_total_count: 2009
      },
      {
        date: "2025-06-27",
        review_average_rating: 4.87,
        review_count: 407,
        review_total_count: 2009
      },
      {
        date: "2025-06-28",
        review_average_rating: 4.88,
        review_count: 408,
        review_total_count: 2010
      },
      {
        date: "2025-06-29",
        review_average_rating: 4.88,
        review_count: 409,
        review_total_count: 2011
      },
      {
        date: "2025-06-30",
        review_average_rating: 4.89,
        review_count: 410,
        review_total_count: 2012
      },
      {
        date: "2025-07-01",
        review_average_rating: 4.89,
        review_count: 411,
        review_total_count: 2013
      },
      {
        date: "2025-07-02",
        review_average_rating: 4.90,
        review_count: 412,
        review_total_count: 2014
      },
      {
        date: "2025-07-03",
        review_average_rating: 4.90,
        review_count: 413,
        review_total_count: 2015
      },
      {
        date: "2025-07-04",
        review_average_rating: 4.91,
        review_count: 414,
        review_total_count: 2016
      }
    ];

    return NextResponse.json({
      success: true,
      data: mockGoogleData
    });

  } catch (error) {
    console.error('Erro ao buscar dados do Google:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 
