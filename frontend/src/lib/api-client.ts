/**
 * Cliente API que adiciona automaticamente headers de autenticação
 */

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Fazer chamada API autenticada
 */
export async function apiCall(endpoint: string, options: ApiOptions = {}) {
  try {
    // Headers padrão
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Cookie httpOnly é enviado automaticamente pelo navegador
    // Não precisa adicionar token manualmente
    
    // Manter x-user-data para compatibilidade temporária
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('sgb_user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          headers['x-user-data'] = encodeURIComponent(userData);
          if (user.id) headers['x-user-id'] = user.id;
          if (user.email) headers['x-user-email'] = user.email;
        } catch (e) {
          console.warn('Erro ao parsear dados do usuário:', e);
        }
      }
    }

    // Configuração da requisição
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
      credentials: 'include', // Incluir cookies (httpOnly)
    };

    // Adicionar body se necessário
    if (options.body && options.method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // Fazer a requisição
    const response = await fetch(endpoint, fetchOptions);

    // Verificar se a resposta é OK
    if (!response.ok) {
      // Se 401, token expirado - redirecionar para login
      if (response.status === 401 && typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
        throw new Error('Sessão expirada');
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ API Error ${response.status}:`, errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // Retornar dados JSON
    const data = await response.json();
    // Log silencioso por padrão - apenas verbose quando necessário
    if (process.env.NEXT_PUBLIC_VERBOSE_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log(`API Response from ${endpoint}`);
    }
    return data;
  } catch (error) {
    console.error(`Erro na API ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Funções de conveniência para cada método HTTP
 */
export const api = {
  get: (endpoint: string, headers?: Record<string, string>) =>
    apiCall(endpoint, { method: 'GET', headers }),

  post: (endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    apiCall(endpoint, { method: 'POST', body, headers }),

  put: (endpoint: string, body?: unknown, headers?: Record<string, string>) =>
    apiCall(endpoint, { method: 'PUT', body, headers }),

  delete: (endpoint: string, headers?: Record<string, string>) =>
    apiCall(endpoint, { method: 'DELETE', headers }),
};

/**
 * Cliente específico para checklists
 */
export const checklistsApi = {
  // Listar checklists
  list: (params?: {
    setor?: string;
    tipo?: string;
    status?: string;
    busca?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value);
      });
    }

    const endpoint = `/api/checklists${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return api.get(endpoint);
  },

  // Criar checklist
  create: (checklist: unknown) => api.post('/api/checklists', checklist),

  // Atualizar checklist
  update: (id: string, checklist: unknown) =>
    api.put(`/api/checklists?id=${id}`, checklist),

  // Deletar checklist
  delete: (id: string) => api.delete(`/api/checklists?id=${id}`),
};

/**
 * Cliente específico para uploads
 */
export const uploadsApi = {
  // Fazer upload de arquivo (com FormData)
  upload: async (formData: FormData) => {
    try {
      const userData = localStorage.getItem('sgb_user');
      const headers: Record<string, string> = {};

      if (userData) {
        headers['x-user-data'] = encodeURIComponent(userData);
      }

      const response = await fetch('/api/configuracoes/uploads', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro no upload:', error);
      throw error;
    }
  },

  // Listar uploads
  list: (params?: { folder?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }

    const endpoint = `/api/configuracoes/uploads${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return api.get(endpoint);
  },

  // Deletar arquivo
  delete: (fileId: string) => api.delete(`/api/configuracoes/uploads?id=${fileId}`),
};
