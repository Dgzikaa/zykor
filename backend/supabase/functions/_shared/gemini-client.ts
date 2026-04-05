/**
 * 🤖 Gemini AI Client - Configuração Centralizada
 * 
 * Módulo compartilhado para interação com a API do Google Gemini.
 * Usado por todas as funções de agentes IA.
 */

import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';
import { withRetry, isRetriableError } from './retry.ts';

export interface GeminiConfig {
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

// ============================================================
// Tool Use / Function Calling Types
// ============================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { 
      type: string; 
      description: string; 
      enum?: string[];
      items?: { type: string };
    }>;
    required: string[];
  };
}

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  response: Record<string, unknown>;
}

/**
 * Criar cliente Gemini com configuração padrão
 */
export function createGeminiClient(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey || Deno.env.get('GEMINI_API_KEY');
  
  if (!key) {
    throw new Error('GEMINI_API_KEY não configurada');
  }
  
  return new GoogleGenerativeAI(key);
}

/**
 * Obter modelo Gemini configurado
 */
export function getGeminiModel(
  client: GoogleGenerativeAI,
  config: GeminiConfig = {}
) {
  // Usar gemini-1.5-flash que é mais estável e disponível
  const modelName = config.model || 'gemini-1.5-flash';
  
  return client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: config.temperature ?? 0.7,
      topP: config.topP ?? 0.95,
      topK: config.topK ?? 40,
      maxOutputTokens: config.maxOutputTokens ?? 8192,
    },
  });
}

/**
 * Gerar resposta do Gemini com tratamento de erros
 * Usando API REST diretamente para evitar problemas de versão
 */
export async function generateGeminiResponse(
  prompt: string,
  config: GeminiConfig = {},
  history?: GeminiMessage[]
): Promise<string> {
  return await withRetry(
    async () => {
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada');
      }

      // Usar API v1 diretamente - modelo estável de 2026
      const model = config.model || 'gemini-2.0-flash-exp';
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      
      const requestBody = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.95,
          topK: config.topK ?? 40,
          maxOutputTokens: config.maxOutputTokens ?? 8192,
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error: any = new Error(`API Gemini retornou ${response.status}: ${errorText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Resposta inválida da API Gemini');
      }

      return data.candidates[0].content.parts[0].text;
    },
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      retryOn: (error) => {
        // Retry em erros 429 (rate limit) e 5xx (server errors)
        return isRetriableError(error);
      }
    }
  );
}

/**
 * Gerar resposta com streaming (para respostas longas)
 */
export async function* generateGeminiStream(
  prompt: string,
  config: GeminiConfig = {}
): AsyncGenerator<string, void, unknown> {
  try {
    const client = createGeminiClient();
    const model = getGeminiModel(client, config);
    
    const result = await model.generateContentStream(prompt);
    
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    console.error('❌ Erro ao gerar stream do Gemini:', error);
    throw new Error(`Erro na API Gemini: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Validar resposta do Gemini (remover markdown, limpar texto)
 */
export function cleanGeminiResponse(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
}

/**
 * Extrair JSON da resposta do Gemini
 */
export function extractJsonFromGemini<T = unknown>(text: string): T {
  const cleaned = cleanGeminiResponse(text);
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ Erro ao parsear JSON do Gemini:', cleaned);
    throw new Error('Resposta do Gemini não é um JSON válido');
  }
}

// ============================================================
// Tool Use / Function Calling
// ============================================================

/**
 * Gerar resposta com suporte a Tool Use (Function Calling)
 * 
 * O Gemini pode chamar ferramentas definidas para buscar dados,
 * executar queries, etc. O loop continua até o modelo retornar texto.
 * 
 * @param prompt - Mensagem do usuário + system prompt
 * @param tools - Definições das ferramentas disponíveis
 * @param executeToolFn - Função que executa cada ferramenta chamada
 * @param config - Configurações do Gemini
 * @param maxIterations - Limite de iterações (segurança)
 */
export async function generateWithTools(
  prompt: string,
  tools: ToolDefinition[],
  executeToolFn: (call: FunctionCall) => Promise<Record<string, unknown>>,
  config: GeminiConfig = {},
  maxIterations: number = 5
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const model = config.model || 'gemini-2.0-flash-exp';
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  // Histórico de conversa para multi-turn
  const contents: Array<{
    role: string;
    parts: Array<Record<string, unknown>>;
  }> = [{ role: 'user', parts: [{ text: prompt }] }];

  for (let i = 0; i < maxIterations; i++) {
    const requestBody = {
      contents,
      tools: [{ functionDeclarations: tools }],
      generationConfig: {
        temperature: config.temperature ?? 0.3,
        topP: config.topP ?? 0.95,
        topK: config.topK ?? 40,
        maxOutputTokens: config.maxOutputTokens ?? 4096,
      }
    };

    console.log(`🔄 [Tool Use] Iteração ${i + 1}/${maxIterations}`);

    const data = await withRetry(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error: any = new Error(`Gemini API ${response.status}: ${errorText}`);
          error.status = response.status;
          throw error;
        }

        return await response.json();
      },
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        retryOn: isRetriableError
      }
    );
    const candidate = data.candidates?.[0];
    
    if (!candidate?.content?.parts) {
      throw new Error('Resposta inválida do Gemini');
    }

    // Adicionar resposta do modelo ao histórico
    contents.push(candidate.content);

    // Verificar se o modelo quer chamar funções
    const functionCalls = candidate.content.parts.filter(
      (p: Record<string, unknown>) => p.functionCall
    );

    if (functionCalls.length === 0) {
      // Modelo retornou texto - terminamos
      const textPart = candidate.content.parts.find(
        (p: Record<string, unknown>) => p.text
      );
      const finalText = (textPart?.text as string) || '';
      console.log(`✅ [Tool Use] Resposta final gerada (${finalText.length} chars)`);
      return finalText;
    }

    // Executar todas as chamadas de função
    console.log(`🔧 [Tool Use] ${functionCalls.length} função(ões) chamada(s)`);
    
    for (const part of functionCalls) {
      const call = part.functionCall as { name: string; args: Record<string, unknown> };
      console.log(`   → Executando: ${call.name}`);
      
      try {
        const result = await executeToolFn({ 
          name: call.name, 
          args: call.args || {} 
        });

        // Adicionar resposta da função ao histórico
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: call.name,
              response: result
            }
          }]
        });
        
        console.log(`   ✓ ${call.name} executada com sucesso`);
      } catch (error) {
        console.error(`   ✗ Erro em ${call.name}:`, error);
        
        // Retornar erro como resposta da função
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: call.name,
              response: { 
                error: true, 
                message: error instanceof Error ? error.message : 'Erro desconhecido' 
              }
            }
          }]
        });
      }
    }
  }

  throw new Error(`Agente atingiu limite de ${maxIterations} iterações`);
}
