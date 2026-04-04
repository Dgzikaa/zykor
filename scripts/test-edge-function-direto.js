import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../frontend/.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testarEdgeFunction() {
  console.log('🧪 Testando Edge Function contaazul-sync\n')

  const url = `${SUPABASE_URL}/functions/v1/contaazul-sync`
  
  const body = {
    bar_id: 3,
    sync_mode: 'custom',
    date_from: '2020-01-01',
    date_to: '2030-12-31'
  }

  console.log('📡 URL:', url)
  console.log('📦 Body:', JSON.stringify(body, null, 2))
  console.log()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    console.log('📊 Status:', response.status, response.statusText)
    
    const text = await response.text()
    console.log('📄 Resposta (raw):', text)
    
    try {
      const json = JSON.parse(text)
      console.log('\n📋 Resposta (JSON):')
      console.log(JSON.stringify(json, null, 2))
    } catch (e) {
      console.log('\n⚠️  Resposta não é JSON válido')
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

testarEdgeFunction()
