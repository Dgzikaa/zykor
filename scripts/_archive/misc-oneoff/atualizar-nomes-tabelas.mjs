#!/usr/bin/env node

/**
 * Script para atualizar referências às tabelas Bronze/Silver no código
 * Substitui nomes antigos pelos novos seguindo estrutura por módulo
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const MAPEAMENTO = {
  // Bronze
  "'contahub_periodo'": "'bronze_contahub_vendas_periodo'",
  '"contahub_periodo"': '"bronze_contahub_vendas_periodo"',
  '`contahub_periodo`': '`bronze_contahub_vendas_periodo`',
  'contahub_periodo': 'bronze_contahub_vendas_periodo',
  
  "'contahub_pagamentos'": "'bronze_contahub_financeiro_pagamentos'",
  '"contahub_pagamentos"': '"bronze_contahub_financeiro_pagamentos"',
  '`contahub_pagamentos`': '`bronze_contahub_financeiro_pagamentos`',
  'contahub_pagamentos': 'bronze_contahub_financeiro_pagamentos',
  
  "'contahub_analitico'": "'bronze_contahub_vendas_analitico'",
  '"contahub_analitico"': '"bronze_contahub_vendas_analitico"',
  '`contahub_analitico`': '`bronze_contahub_vendas_analitico`',
  'contahub_analitico': 'bronze_contahub_vendas_analitico',
  
  "'contahub_tempo'": "'bronze_contahub_producao_tempo'",
  '"contahub_tempo"': '"bronze_contahub_producao_tempo"',
  '`contahub_tempo`': '`bronze_contahub_producao_tempo`',
  'contahub_tempo': 'bronze_contahub_producao_tempo',
  
  "'contahub_fatporhora'": "'bronze_contahub_operacional_fatporhora'",
  '"contahub_fatporhora"': '"bronze_contahub_operacional_fatporhora"',
  '`contahub_fatporhora`': '`bronze_contahub_operacional_fatporhora`',
  'contahub_fatporhora': 'bronze_contahub_operacional_fatporhora',
  
  "'contahub_cancelamentos'": "'bronze_contahub_vendas_cancelamentos'",
  '"contahub_cancelamentos"': '"bronze_contahub_vendas_cancelamentos"',
  '`contahub_cancelamentos`': '`bronze_contahub_vendas_cancelamentos`',
  'contahub_cancelamentos': 'bronze_contahub_vendas_cancelamentos',
  
  // Silver
  'silver_pagamentos': 'silver_contahub_financeiro_pagamentos',
  "'silver_pagamentos'": "'silver_contahub_financeiro_pagamentos'",
  '"silver_pagamentos"': '"silver_contahub_financeiro_pagamentos"',
  '`silver_pagamentos`': '`silver_contahub_financeiro_pagamentos`',
};

// Padrões que devem ser verificados mas NÃO substituídos automaticamente
const VERIFICAR_MANUAL = [
  /bronze_contahub_(periodo|pagamentos|analitico|tempo|fatporhora|cancelamentos)(?!_)/g,
];

const DIRETORIOS_ALVO = [
  'backend/supabase/functions',
  'frontend/src/app/api',
  'frontend/src/app/estrategico',
  'frontend/src/app/gestao',
  'frontend/src/lib',
];

const EXTENSOES = ['.ts', '.tsx', '.js', '.jsx'];

async function* listarArquivos(dir) {
  try {
    const arquivos = await readdir(dir, { withFileTypes: true });
    
    for (const arquivo of arquivos) {
      const caminho = join(dir, arquivo.name);
      
      if (arquivo.isDirectory()) {
        if (!arquivo.name.startsWith('.') && arquivo.name !== 'node_modules') {
          yield* listarArquivos(caminho);
        }
      } else {
        const ext = arquivo.name.substring(arquivo.name.lastIndexOf('.'));
        if (EXTENSOES.includes(ext)) {
          yield caminho;
        }
      }
    }
  } catch (error) {
    // Diretório não existe, ignorar
  }
}

async function processarArquivo(caminho) {
  try {
    let conteudo = await readFile(caminho, 'utf-8');
    let modificado = false;
    let substituicoes = [];
    
    // Aplicar mapeamentos
    for (const [antigo, novo] of Object.entries(MAPEAMENTO)) {
      if (conteudo.includes(antigo)) {
        conteudo = conteudo.replaceAll(antigo, novo);
        modificado = true;
        substituicoes.push(`${antigo} → ${novo}`);
      }
    }
    
    if (modificado) {
      await writeFile(caminho, conteudo, 'utf-8');
      return { caminho, substituicoes, modificado: true };
    }
    
    return { caminho, substituicoes: [], modificado: false };
    
  } catch (error) {
    return { caminho, erro: error.message, modificado: false };
  }
}

async function main() {
  console.log('🚀 Iniciando atualização de nomes de tabelas...\n');
  
  let totalArquivos = 0;
  let totalModificados = 0;
  const arquivosModificados = [];
  
  for (const dir of DIRETORIOS_ALVO) {
    console.log(`📂 Processando diretório: ${dir}`);
    
    for await (const arquivo of listarArquivos(dir)) {
      totalArquivos++;
      const resultado = await processarArquivo(arquivo);
      
      if (resultado.modificado) {
        totalModificados++;
        arquivosModificados.push(resultado);
        console.log(`   ✅ ${arquivo}`);
        resultado.substituicoes.forEach(sub => {
          console.log(`      - ${sub}`);
        });
      }
      
      if (resultado.erro) {
        console.error(`   ❌ ${arquivo}: ${resultado.erro}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DA MIGRAÇÃO');
  console.log('='.repeat(60));
  console.log(`📁 Arquivos analisados: ${totalArquivos}`);
  console.log(`✅ Arquivos modificados: ${totalModificados}`);
  console.log('='.repeat(60));
  
  if (arquivosModificados.length > 0) {
    console.log('\n📝 Arquivos alterados:');
    arquivosModificados.forEach(({ caminho, substituicoes }) => {
      console.log(`\n${caminho}:`);
      substituicoes.forEach(sub => console.log(`  - ${sub}`));
    });
  }
  
  console.log('\n🎯 Próximos passos:');
  console.log('1. Rodar: npm run type-check (frontend)');
  console.log('2. Testar Edge Functions');
  console.log('3. Validar páginas principais');
  console.log('4. Remover views de compatibilidade quando tudo validado');
}

main().catch(console.error);
