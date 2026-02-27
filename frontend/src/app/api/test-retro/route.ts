import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('🧪 TEST API CHAMADA!')
  return NextResponse.json({ 
    success: true, 
    message: 'API funcionando!',
    timestamp: new Date().toISOString()
  })
}
