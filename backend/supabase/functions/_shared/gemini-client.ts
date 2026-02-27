/**
 * 🤖 Gemini AI Client - Configuração Centralizada
 * 
 * Módulo compartilhado para interação com a API do Google Gemini.
 * Usado por todas as funções de agentes IA.
 */

import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';

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
  try {
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
      throw new Error(`API Gemini retornou ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Resposta inválida da API Gemini');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('❌ Erro ao gerar resposta do Gemini:', error);
    throw new Error(`Erro na API Gemini: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
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
export function extractJsonFromGemini<T = any>(text: string): T {
  const cleaned = cleanGeminiResponse(text);
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('❌ Erro ao parsear JSON do Gemini:', cleaned);
    throw new Error('Resposta do Gemini não é um JSON válido');
  }
}
