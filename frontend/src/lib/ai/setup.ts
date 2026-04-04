// Setup e configuração do Zykor AI Assistant
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Configuração dos provedores de IA
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'auto';
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  anthropic: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  fallbackProvider: 'openai' | 'anthropic';
  rateLimiting: {
    requestsPerMinute: number;
    requestsPerHour: number;
    tokensPerMinute: number;
  };
}

interface ProviderHealthStatus {
  openai: { available: boolean; lastCheck: number; error: string | null };
  anthropic: { available: boolean; lastCheck: number; error: string | null };
}

// Configuração padrão
const DEFAULT_CONFIG: AIConfig = {
  provider: 'auto',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4-turbo-preview',
    maxTokens: 4000,
    temperature: 0.1 // Baixa temperatura para análises mais precisas
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4000,
    temperature: 0.1
  },
  fallbackProvider: 'openai',
  rateLimiting: {
    requestsPerMinute: 50,
    requestsPerHour: 1000,
    tokensPerMinute: 100000
  }
};

// Tipos para respostas da IA
export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  processingTime: number;
  confidence: number;
  metadata: Record<string, any>;
}

export interface AIAnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  metrics: Record<string, number>;
  charts?: {
    type: 'line' | 'bar' | 'pie' | 'area';
    data: any[];
    labels: string[];
  }[];
  confidence: number;
  sources: string[];
}

// Rate limiting
class RateLimiter {
  private requests: number[] = [];
  private tokens: number[] = [];

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Limpar requests antigos
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    return this.requests.length < DEFAULT_CONFIG.rateLimiting.requestsPerMinute;
  }

  recordRequest(tokens: number): void {
    const now = Date.now();
    this.requests.push(now);
    this.tokens.push(tokens);
  }

  getUsage(): { requestsPerMinute: number; tokensPerMinute: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.requests.filter(time => time > oneMinuteAgo);
    const recentTokens = this.tokens
      .filter((_, index) => this.requests[index] > oneMinuteAgo)
      .reduce((sum, tokens) => sum + tokens, 0);

    return {
      requestsPerMinute: recentRequests.length,
      tokensPerMinute: recentTokens
    };
  }
}

export class ZykorAI {
  private config: AIConfig;
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private rateLimiter = new RateLimiter();
  private healthStatus: ProviderHealthStatus = {
    openai: { available: false, lastCheck: 0, error: null as string | null },
    anthropic: { available: false, lastCheck: 0, error: null as string | null }
  };

  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeProviders();
  }

  // Inicializar provedores
  private initializeProviders(): void {
    // OpenAI
    if (this.config.openai.apiKey) {
      try {
        this.openai = new OpenAI({
          apiKey: this.config.openai.apiKey
        });
        console.log('✅ OpenAI inicializado');
      } catch (error) {
        console.error('❌ Erro ao inicializar OpenAI:', error);
      }
    }

    // Anthropic
    if (this.config.anthropic.apiKey) {
      try {
        this.anthropic = new Anthropic({
          apiKey: this.config.anthropic.apiKey
        });
        console.log('✅ Anthropic inicializado');
      } catch (error) {
        console.error('❌ Erro ao inicializar Anthropic:', error);
      }
    }

    // Verificar saúde dos provedores
    this.checkProvidersHealth();
  }

  // Verificar saúde dos provedores
  private async checkProvidersHealth(): Promise<void> {
    const now = Date.now();
    
    // Verificar OpenAI
    if (this.openai && (now - this.healthStatus.openai.lastCheck > 300000)) { // 5 min
      try {
        await this.openai.models.list();
        this.healthStatus.openai = { available: true, lastCheck: now, error: null };
      } catch (error) {
        this.healthStatus.openai = { 
          available: false, 
          lastCheck: now, 
          error: (error as Error).message 
        };
      }
    }

    // Verificar Anthropic
    if (this.anthropic && (now - this.healthStatus.anthropic.lastCheck > 300000)) { // 5 min
      try {
        // Anthropic não tem endpoint de health, então fazemos uma request simples
        await this.anthropic.messages.create({
          model: this.config.anthropic.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        });
        this.healthStatus.anthropic = { available: true, lastCheck: now, error: null };
      } catch (error) {
        this.healthStatus.anthropic = { 
          available: false, 
          lastCheck: now, 
          error: (error as Error).message 
        };
      }
    }
  }

  // Escolher melhor provedor
  private chooseBestProvider(): 'openai' | 'anthropic' | null {
    if (this.config.provider !== 'auto') {
      const provider = this.config.provider;
      if (this.healthStatus[provider].available) {
        return provider;
      }
    }

    // Auto: escolher baseado na disponibilidade e performance
    if (this.healthStatus.openai.available && this.healthStatus.anthropic.available) {
      // Ambos disponíveis: escolher baseado na task
      return 'anthropic'; // Claude é melhor para análise de dados
    } else if (this.healthStatus.openai.available) {
      return 'openai';
    } else if (this.healthStatus.anthropic.available) {
      return 'anthropic';
    }

    return null;
  }

  // Processar consulta com IA
  async processQuery(
    query: string, 
    context: Record<string, any> = {},
    systemPrompt?: string
  ): Promise<AIResponse> {
    // Verificar rate limiting
    if (!this.rateLimiter.canMakeRequest()) {
      throw new Error('Rate limit excedido. Tente novamente em alguns segundos.');
    }

    // Verificar saúde dos provedores
    await this.checkProvidersHealth();

    // Escolher provedor
    const provider = this.chooseBestProvider();
    if (!provider) {
      throw new Error('Nenhum provedor de IA disponível no momento');
    }

    const startTime = Date.now();
    let response: AIResponse;

    try {
      if (provider === 'openai') {
        response = await this.processWithOpenAI(query, context, systemPrompt);
      } else {
        response = await this.processWithAnthropic(query, context, systemPrompt);
      }

      response.processingTime = Date.now() - startTime;
      
      // Registrar uso
      this.rateLimiter.recordRequest(response.tokensUsed);
      
      return response;

    } catch (error) {
      console.error(`Erro no provedor ${provider}:`, error);

      // Tentar fallback
      const fallbackProvider = provider === 'openai' ? 'anthropic' : 'openai';
      if (this.healthStatus[fallbackProvider].available) {
        console.log(`Tentando fallback para ${fallbackProvider}`);
        
        try {
          if (fallbackProvider === 'openai') {
            response = await this.processWithOpenAI(query, context, systemPrompt);
          } else {
            response = await this.processWithAnthropic(query, context, systemPrompt);
          }
          
          response.processingTime = Date.now() - startTime;
          this.rateLimiter.recordRequest(response.tokensUsed);
          
          return response;
        } catch (fallbackError) {
          console.error(`Erro no fallback ${fallbackProvider}:`, fallbackError);
        }
      }

      throw new Error(`Erro na IA: ${(error as Error).message}`);
    }
  }

  // Processar com OpenAI
  private async processWithOpenAI(
    query: string, 
    context: Record<string, any>,
    systemPrompt?: string
  ): Promise<AIResponse> {
    if (!this.openai) {
      throw new Error('OpenAI não inicializado');
    }

    const messages: any[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Adicionar contexto se fornecido
    if (Object.keys(context).length > 0) {
      messages.push({
        role: 'system',
        content: `Contexto adicional: ${JSON.stringify(context, null, 2)}`
      });
    }

    messages.push({ role: 'user', content: query });

    const completion = await this.openai.chat.completions.create({
      model: this.config.openai.model,
      messages,
      max_tokens: this.config.openai.maxTokens,
      temperature: this.config.openai.temperature,
      stream: false
    });

    const response = completion.choices[0]?.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;

    return {
      content: response,
      provider: 'openai',
      model: this.config.openai.model,
      tokensUsed,
      processingTime: 0, // Será preenchido externamente
      confidence: this.calculateConfidence(response),
      metadata: {
        finishReason: completion.choices[0]?.finish_reason,
        usage: completion.usage
      }
    };
  }

  // Processar com Anthropic
  private async processWithAnthropic(
    query: string, 
    context: Record<string, any>,
    systemPrompt?: string
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic não inicializado');
    }

    let fullPrompt = query;

    // Adicionar contexto se fornecido
    if (Object.keys(context).length > 0) {
      fullPrompt = `Contexto: ${JSON.stringify(context, null, 2)}\n\nConsulta: ${query}`;
    }

    const message = await this.anthropic.messages.create({
      model: this.config.anthropic.model,
      max_tokens: this.config.anthropic.maxTokens,
      temperature: this.config.anthropic.temperature,
      system: systemPrompt || 'Você é um assistente especializado em análise de dados para gestão de bares.',
      messages: [{ role: 'user', content: fullPrompt }]
    });

    const response = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const tokensUsed = message.usage.input_tokens + message.usage.output_tokens;

    return {
      content: response,
      provider: 'anthropic',
      model: this.config.anthropic.model,
      tokensUsed,
      processingTime: 0, // Será preenchido externamente
      confidence: this.calculateConfidence(response),
      metadata: {
        stopReason: message.stop_reason,
        usage: message.usage
      }
    };
  }

  // Calcular confiança da resposta
  private calculateConfidence(response: string): number {
    // Implementar heurísticas para calcular confiança
    let confidence = 0.5; // Base

    // Mais texto = mais confiança (até um limite)
    const length = response.length;
    confidence += Math.min(length / 1000, 0.3);

    // Presença de números e dados específicos
    const numberMatches = response.match(/\d+(\.\d+)?/g);
    if (numberMatches && numberMatches.length > 3) {
      confidence += 0.2;
    }

    // Estrutura organizada (listas, seções)
    if (response.includes('•') || response.includes('-') || response.includes('1.')) {
      confidence += 0.1;
    }

    // Palavras de incerteza diminuem confiança
    const uncertaintyWords = ['talvez', 'possivelmente', 'pode ser', 'aproximadamente'];
    const uncertaintyCount = uncertaintyWords.reduce((count, word) => 
      count + (response.toLowerCase().split(word).length - 1), 0
    );
    confidence -= uncertaintyCount * 0.05;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  // Obter status dos provedores
  getProviderStatus(): ProviderHealthStatus {
    return { ...this.healthStatus };
  }

  // Obter estatísticas de uso
  getUsageStats(): {
    currentUsage: { requestsPerMinute: number; tokensPerMinute: number };
    limits: typeof DEFAULT_CONFIG.rateLimiting;
    providers: ProviderHealthStatus;
  } {
    return {
      currentUsage: this.rateLimiter.getUsage(),
      limits: this.config.rateLimiting,
      providers: this.getProviderStatus()
    };
  }

  // Configurar novos parâmetros
  updateConfig(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeProviders();
  }
}

// Instância global
export const zykorAI = new ZykorAI();

// Hook para React
export const useZykorAI = () => {
  return {
    processQuery: zykorAI.processQuery.bind(zykorAI),
    getProviderStatus: zykorAI.getProviderStatus.bind(zykorAI),
    getUsageStats: zykorAI.getUsageStats.bind(zykorAI),
    updateConfig: zykorAI.updateConfig.bind(zykorAI)
  };
};
