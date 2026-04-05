// NOTA: Tabelas nibo_* são legado (deprecated desde 04/2026).
// Dados financeiros agora vêm via Conta Azul (contaazul_lancamentos).
// As tabelas nibo_* mantidas apenas para dados históricos. Não usar em código novo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agente_alertas: {
        Row: {
          bar_id: number | null
          created_at: string | null
          dados: Json | null
          enviado: boolean | null
          id: string
          insight_id: string | null
          lido: boolean | null
          mensagem: string
          severidade: string
          tipo_alerta: string
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          dados?: Json | null
          enviado?: boolean | null
          id?: string
          insight_id?: string | null
          lido?: boolean | null
          mensagem: string
          severidade: string
          tipo_alerta: string
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          dados?: Json | null
          enviado?: boolean | null
          id?: string
          insight_id?: string | null
          lido?: boolean | null
          mensagem?: string
          severidade?: string
          tipo_alerta?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_alertas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_alertas_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "agente_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_aprendizado: {
        Row: {
          aplicado: boolean | null
          bar_id: number | null
          contexto: Json
          created_at: string | null
          feedback: string | null
          id: string
          resultado: Json | null
          score: number | null
          tipo_evento: string
        }
        Insert: {
          aplicado?: boolean | null
          bar_id?: number | null
          contexto: Json
          created_at?: string | null
          feedback?: string | null
          id?: string
          resultado?: Json | null
          score?: number | null
          tipo_evento: string
        }
        Update: {
          aplicado?: boolean | null
          bar_id?: number | null
          contexto?: Json
          created_at?: string | null
          feedback?: string | null
          id?: string
          resultado?: Json | null
          score?: number | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_aprendizado_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_configuracoes: {
        Row: {
          ativo: boolean | null
          bar_id: number | null
          created_at: string | null
          frequencia_scan: number | null
          id: string
          metricas_monitoradas: Json | null
          notificacoes_ativas: boolean | null
          thresholds: Json | null
          tipo_agente: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bar_id?: number | null
          created_at?: string | null
          frequencia_scan?: number | null
          id?: string
          metricas_monitoradas?: Json | null
          notificacoes_ativas?: boolean | null
          thresholds?: Json | null
          tipo_agente: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bar_id?: number | null
          created_at?: string | null
          frequencia_scan?: number | null
          id?: string
          metricas_monitoradas?: Json | null
          notificacoes_ativas?: boolean | null
          thresholds?: Json | null
          tipo_agente?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_configuracoes_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_conversas: {
        Row: {
          bar_id: number | null
          contexto_usado: Json | null
          created_at: string | null
          gerou_aprendizado: boolean | null
          id: number
          mensagem: string
          modelo: string | null
          resposta: string
          tokens_usados: number | null
          usuario_id: string | null
        }
        Insert: {
          bar_id?: number | null
          contexto_usado?: Json | null
          created_at?: string | null
          gerou_aprendizado?: boolean | null
          id?: number
          mensagem: string
          modelo?: string | null
          resposta: string
          tokens_usados?: number | null
          usuario_id?: string | null
        }
        Update: {
          bar_id?: number | null
          contexto_usado?: Json | null
          created_at?: string | null
          gerou_aprendizado?: boolean | null
          id?: number
          mensagem?: string
          modelo?: string | null
          resposta?: string
          tokens_usados?: number | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_conversas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_feedbacks: {
        Row: {
          aplicado: boolean | null
          bar_id: number | null
          comentario: string | null
          created_at: string | null
          feedback: string
          id: number
          referencia_id: number | null
          tipo: string
        }
        Insert: {
          aplicado?: boolean | null
          bar_id?: number | null
          comentario?: string | null
          created_at?: string | null
          feedback: string
          id?: number
          referencia_id?: number | null
          tipo: string
        }
        Update: {
          aplicado?: boolean | null
          bar_id?: number | null
          comentario?: string | null
          created_at?: string | null
          feedback?: string
          id?: number
          referencia_id?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_feedbacks_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_historico: {
        Row: {
          agent_used: string | null
          bar_id: number | null
          chart_data: Json | null
          content: string
          created_at: string | null
          deep_links: Json | null
          id: string
          metrics: Json | null
          role: string
          session_id: string
          suggestions: string[] | null
          user_id: string | null
        }
        Insert: {
          agent_used?: string | null
          bar_id?: number | null
          chart_data?: Json | null
          content: string
          created_at?: string | null
          deep_links?: Json | null
          id?: string
          metrics?: Json | null
          role: string
          session_id: string
          suggestions?: string[] | null
          user_id?: string | null
        }
        Update: {
          agent_used?: string | null
          bar_id?: number | null
          chart_data?: Json | null
          content?: string
          created_at?: string | null
          deep_links?: Json | null
          id?: string
          metrics?: Json | null
          role?: string
          session_id?: string
          suggestions?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
      agente_ia_metricas: {
        Row: {
          bar_id: number | null
          created_at: string | null
          custo_estimado: number | null
          id: number
          modelo: string | null
          sucesso: boolean | null
          tempo_resposta: number | null
          tipo_operacao: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          custo_estimado?: number | null
          id?: number
          modelo?: string | null
          sucesso?: boolean | null
          tempo_resposta?: number | null
          tipo_operacao: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          custo_estimado?: number | null
          id?: number
          modelo?: string | null
          sucesso?: boolean | null
          tempo_resposta?: number | null
          tipo_operacao?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_ia_metricas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_insights: {
        Row: {
          acao_sugerida: string | null
          arquivado: boolean | null
          bar_id: number | null
          categoria: string
          created_at: string | null
          dados_suporte: Json | null
          descricao: string
          id: string
          impacto: string | null
          prioridade: number | null
          scan_id: string | null
          tipo: string
          titulo: string
          visualizado: boolean | null
        }
        Insert: {
          acao_sugerida?: string | null
          arquivado?: boolean | null
          bar_id?: number | null
          categoria: string
          created_at?: string | null
          dados_suporte?: Json | null
          descricao: string
          id?: string
          impacto?: string | null
          prioridade?: number | null
          scan_id?: string | null
          tipo: string
          titulo: string
          visualizado?: boolean | null
        }
        Update: {
          acao_sugerida?: string | null
          arquivado?: boolean | null
          bar_id?: number | null
          categoria?: string
          created_at?: string | null
          dados_suporte?: Json | null
          descricao?: string
          id?: string
          impacto?: string | null
          prioridade?: number | null
          scan_id?: string | null
          tipo?: string
          titulo?: string
          visualizado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_insights_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_insights_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "agente_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_memoria_vetorial: {
        Row: {
          aprendido_de: string | null
          bar_id: number | null
          confirmacoes: number | null
          conteudo: string
          contexto: Json | null
          created_at: string | null
          id: number
          relevancia: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          aprendido_de?: string | null
          bar_id?: number | null
          confirmacoes?: number | null
          conteudo: string
          contexto?: Json | null
          created_at?: string | null
          id?: number
          relevancia?: number | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          aprendido_de?: string | null
          bar_id?: number | null
          confirmacoes?: number | null
          conteudo?: string
          contexto?: Json | null
          created_at?: string | null
          id?: number
          relevancia?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_memoria_vetorial_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_metricas: {
        Row: {
          bar_id: number | null
          categoria: string
          created_at: string | null
          id: string
          metadata: Json | null
          metrica: string
          periodo_referencia: string | null
          valor: number | null
          valor_anterior: number | null
          variacao_percentual: number | null
        }
        Insert: {
          bar_id?: number | null
          categoria: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metrica: string
          periodo_referencia?: string | null
          valor?: number | null
          valor_anterior?: number | null
          variacao_percentual?: number | null
        }
        Update: {
          bar_id?: number | null
          categoria?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metrica?: string
          periodo_referencia?: string | null
          valor?: number | null
          valor_anterior?: number | null
          variacao_percentual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_metricas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_padroes_detectados: {
        Row: {
          bar_id: number | null
          confianca: number | null
          created_at: string | null
          dados_suporte: Json | null
          descricao: string
          id: number
          ocorrencias: number | null
          status: string | null
          tipo: string
        }
        Insert: {
          bar_id?: number | null
          confianca?: number | null
          created_at?: string | null
          dados_suporte?: Json | null
          descricao: string
          id?: number
          ocorrencias?: number | null
          status?: string | null
          tipo: string
        }
        Update: {
          bar_id?: number | null
          confianca?: number | null
          created_at?: string | null
          dados_suporte?: Json | null
          descricao?: string
          id?: number
          ocorrencias?: number | null
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_padroes_detectados_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_regras_dinamicas: {
        Row: {
          acao: Json
          ativa: boolean | null
          bar_id: number | null
          condicao: Json
          created_at: string | null
          descricao: string | null
          execucoes: number | null
          id: number
          nome: string
          origem: string
          prioridade: string | null
          taxa_sucesso: number | null
          updated_at: string | null
        }
        Insert: {
          acao: Json
          ativa?: boolean | null
          bar_id?: number | null
          condicao: Json
          created_at?: string | null
          descricao?: string | null
          execucoes?: number | null
          id?: number
          nome: string
          origem: string
          prioridade?: string | null
          taxa_sucesso?: number | null
          updated_at?: string | null
        }
        Update: {
          acao?: Json
          ativa?: boolean | null
          bar_id?: number | null
          condicao?: Json
          created_at?: string | null
          descricao?: string | null
          execucoes?: number | null
          id?: number
          nome?: string
          origem?: string
          prioridade?: string | null
          taxa_sucesso?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agente_regras_dinamicas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_scans: {
        Row: {
          alertas_gerados: number | null
          bar_id: number | null
          created_at: string | null
          dados_coletados: Json | null
          erro: string | null
          id: string
          insights_encontrados: number | null
          status: string | null
          tempo_execucao_ms: number | null
          tipo_scan: string
        }
        Insert: {
          alertas_gerados?: number | null
          bar_id?: number | null
          created_at?: string | null
          dados_coletados?: Json | null
          erro?: string | null
          id?: string
          insights_encontrados?: number | null
          status?: string | null
          tempo_execucao_ms?: number | null
          tipo_scan: string
        }
        Update: {
          alertas_gerados?: number | null
          bar_id?: number | null
          created_at?: string | null
          dados_coletados?: Json | null
          erro?: string | null
          id?: string
          insights_encontrados?: number | null
          status?: string | null
          tempo_execucao_ms?: number | null
          tipo_scan?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_scans_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_uso: {
        Row: {
          agent_name: string
          bar_id: number | null
          cache_hit: boolean | null
          created_at: string | null
          error_message: string | null
          feedback_rating: number | null
          feedback_text: string | null
          id: string
          intent: string | null
          metadata: Json | null
          query: string | null
          response_time_ms: number | null
          session_id: string | null
          success: boolean | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          agent_name: string
          bar_id?: number | null
          cache_hit?: boolean | null
          created_at?: string | null
          error_message?: string | null
          feedback_rating?: number | null
          feedback_text?: string | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          query?: string | null
          response_time_ms?: number | null
          session_id?: string | null
          success?: boolean | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          agent_name?: string
          bar_id?: number | null
          cache_hit?: boolean | null
          created_at?: string | null
          error_message?: string | null
          feedback_rating?: number | null
          feedback_text?: string | null
          id?: string
          intent?: string | null
          metadata?: Json | null
          query?: string | null
          response_time_ms?: number | null
          session_id?: string | null
          success?: boolean | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      alertas_enviados: {
        Row: {
          bar_id: number
          categoria: string
          criado_em: string | null
          dados: Json | null
          enviado_discord: boolean | null
          id: number
          mensagem: string
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por_id: number | null
          tipo: string
          titulo: string
        }
        Insert: {
          bar_id: number
          categoria: string
          criado_em?: string | null
          dados?: Json | null
          enviado_discord?: boolean | null
          id?: number
          mensagem: string
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por_id?: number | null
          tipo: string
          titulo: string
        }
        Update: {
          bar_id?: number
          categoria?: string
          criado_em?: string | null
          dados?: Json | null
          enviado_discord?: boolean | null
          id?: number
          mensagem?: string
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por_id?: number | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_enviados_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      api_credentials: {
        Row: {
          access_token: string | null
          ambiente: string | null
          api_key: string | null
          api_token: string | null
          ativo: boolean | null
          atualizado_em: string | null
          authorization_code: string | null
          bar_id: number | null
          base_url: string | null
          client_id: string | null
          client_secret: string | null
          configuracoes: Json | null
          criado_em: string | null
          empresa_cnpj: string | null
          empresa_id: string | null
          empresa_nome: string | null
          expires_at: string | null
          id: number
          last_token_refresh: string | null
          oauth_state: string | null
          password: string | null
          redirect_uri: string | null
          refresh_token: string | null
          scopes: string | null
          sistema: string
          token_refresh_count: number | null
          token_type: string | null
          username: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token?: string | null
          ambiente?: string | null
          api_key?: string | null
          api_token?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          authorization_code?: string | null
          bar_id?: number | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          configuracoes?: Json | null
          criado_em?: string | null
          empresa_cnpj?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          expires_at?: string | null
          id?: number
          last_token_refresh?: string | null
          oauth_state?: string | null
          password?: string | null
          redirect_uri?: string | null
          refresh_token?: string | null
          scopes?: string | null
          sistema: string
          token_refresh_count?: number | null
          token_type?: string | null
          username?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string | null
          ambiente?: string | null
          api_key?: string | null
          api_token?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          authorization_code?: string | null
          bar_id?: number | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          configuracoes?: Json | null
          criado_em?: string | null
          empresa_cnpj?: string | null
          empresa_id?: string | null
          empresa_nome?: string | null
          expires_at?: string | null
          id?: number
          last_token_refresh?: string | null
          oauth_state?: string | null
          password?: string | null
          redirect_uri?: string | null
          refresh_token?: string | null
          scopes?: string | null
          sistema?: string
          token_refresh_count?: number | null
          token_type?: string | null
          username?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_credentials_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          adicional_noturno: number | null
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number
          cor: string | null
          criado_em: string | null
          id: number
          nome: string
        }
        Insert: {
          adicional_noturno?: number | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id: number
          cor?: string | null
          criado_em?: string | null
          id?: number
          nome: string
        }
        Update: {
          adicional_noturno?: number | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number
          cor?: string | null
          criado_em?: string | null
          id?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      areas_contagem: {
        Row: {
          ativo: boolean | null
          bar_id: number
          created_at: string | null
          descricao: string | null
          id: number
          nome: string
          ordem: number | null
          tipo: string | null
          updated_at: string | null
          usuario_criacao_id: number | null
          usuario_criacao_nome: string | null
        }
        Insert: {
          ativo?: boolean | null
          bar_id?: number
          created_at?: string | null
          descricao?: string | null
          id?: number
          nome: string
          ordem?: number | null
          tipo?: string | null
          updated_at?: string | null
          usuario_criacao_id?: number | null
          usuario_criacao_nome?: string | null
        }
        Update: {
          ativo?: boolean | null
          bar_id?: number
          created_at?: string | null
          descricao?: string | null
          id?: number
          nome?: string
          ordem?: number | null
          tipo?: string | null
          updated_at?: string | null
          usuario_criacao_id?: number | null
          usuario_criacao_nome?: string | null
        }
        Relationships: []
      }
      audit_trail: {
        Row: {
          bar_id: number | null
          category: string
          changes: Json | null
          created_at: string | null
          description: string
          endpoint: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          method: string | null
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string | null
          request_id: string | null
          session_id: string | null
          severity: string
          table_name: string | null
          timestamp: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          bar_id?: number | null
          category: string
          changes?: Json | null
          created_at?: string | null
          description: string
          endpoint?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          method?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: string | null
          request_id?: string | null
          session_id?: string | null
          severity?: string
          table_name?: string | null
          timestamp?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          bar_id?: number | null
          category?: string
          changes?: Json | null
          created_at?: string | null
          description?: string
          endpoint?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          method?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string | null
          request_id?: string | null
          session_id?: string | null
          severity?: string
          table_name?: string | null
          timestamp?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          bar_id: number
          criado_em: string | null
          detalhes: Json | null
          erro_mensagem: string | null
          finalizado_em: string | null
          id: number
          job_id: string | null
          operacao: string
          registros_processados: number | null
          sistema: string
          status: string
          tempo_execucao: unknown
        }
        Insert: {
          bar_id: number
          criado_em?: string | null
          detalhes?: Json | null
          erro_mensagem?: string | null
          finalizado_em?: string | null
          id?: number
          job_id?: string | null
          operacao: string
          registros_processados?: number | null
          sistema: string
          status: string
          tempo_execucao?: unknown
        }
        Update: {
          bar_id?: number
          criado_em?: string | null
          detalhes?: Json | null
          erro_mensagem?: string | null
          finalizado_em?: string | null
          id?: number
          job_id?: string | null
          operacao?: string
          registros_processados?: number | null
          sistema?: string
          status?: string
          tempo_execucao?: unknown
        }
        Relationships: []
      }
      backup_configuracoes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          dia_mes: number | null
          dia_semana: number | null
          email_notificacao: string | null
          empresa_id: string
          frequencia: string | null
          horario: string | null
          id: string
          notificar_email: boolean | null
          proximo_backup: string | null
          retencao_dias: number | null
          tipos_incluidos: string[] | null
          ultimo_backup: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          email_notificacao?: string | null
          empresa_id: string
          frequencia?: string | null
          horario?: string | null
          id?: string
          notificar_email?: boolean | null
          proximo_backup?: string | null
          retencao_dias?: number | null
          tipos_incluidos?: string[] | null
          ultimo_backup?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          email_notificacao?: string | null
          empresa_id?: string
          frequencia?: string | null
          horario?: string | null
          id?: string
          notificar_email?: boolean | null
          proximo_backup?: string | null
          retencao_dias?: number | null
          tipos_incluidos?: string[] | null
          ultimo_backup?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_configuracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          arquivo_url: string | null
          concluido_em: string | null
          created_at: string | null
          criado_por: string | null
          empresa_id: string
          erro_mensagem: string | null
          expira_em: string | null
          id: string
          iniciado_em: string | null
          registros_total: number | null
          status: string | null
          tabelas_incluidas: string[] | null
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          arquivo_url?: string | null
          concluido_em?: string | null
          created_at?: string | null
          criado_por?: string | null
          empresa_id: string
          erro_mensagem?: string | null
          expira_em?: string | null
          id?: string
          iniciado_em?: string | null
          registros_total?: number | null
          status?: string | null
          tabelas_incluidas?: string[] | null
          tamanho_bytes?: number | null
          tipo: string
        }
        Update: {
          arquivo_url?: string | null
          concluido_em?: string | null
          created_at?: string | null
          criado_por?: string | null
          empresa_id?: string
          erro_mensagem?: string | null
          expira_em?: string | null
          id?: string
          iniciado_em?: string | null
          registros_total?: number | null
          status?: string | null
          tabelas_incluidas?: string[] | null
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "backups_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backups_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_api_configs: {
        Row: {
          api_name: string | null
          bar_id: number | null
          config_data: Json | null
          created_at: string | null
          id: number
        }
        Insert: {
          api_name?: string | null
          bar_id?: number | null
          config_data?: Json | null
          created_at?: string | null
          id?: number
        }
        Update: {
          api_name?: string | null
          bar_id?: number | null
          config_data?: Json | null
          created_at?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_api_configs_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_notification_configs: {
        Row: {
          bar_id: number | null
          config_data: Json | null
          created_at: string | null
          id: number
          notification_type: string | null
        }
        Insert: {
          bar_id?: number | null
          config_data?: Json | null
          created_at?: string | null
          id?: number
          notification_type?: string | null
        }
        Update: {
          bar_id?: number | null
          config_data?: Json | null
          created_at?: string | null
          id?: number
          notification_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_notification_configs_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_stats: {
        Row: {
          bar_id: number | null
          created_at: string | null
          id: number
          metrics: Json | null
          stat_date: string | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          id?: number
          metrics?: Json | null
          stat_date?: string | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          id?: number
          metrics?: Json | null
          stat_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_stats_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bars: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          cnpj: string | null
          config: Json | null
          criado_em: string | null
          endereco: string | null
          id: number
          metas: Json | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cnpj?: string | null
          config?: Json | null
          criado_em?: string | null
          endereco?: string | null
          id?: number
          metas?: Json | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cnpj?: string | null
          config?: Json | null
          criado_em?: string | null
          endereco?: string | null
          id?: number
          metas?: Json | null
          nome?: string
        }
        Relationships: []
      }
      caixa_impostos_movimentos: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          centro_custo: string | null
          comprovante_url: string | null
          criado_em: string | null
          data: string | null
          data_consolidado: boolean | null
          fornecedor_descricao: string
          id: number
          observacoes: string | null
          projeto: string | null
          tipo: string
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          bar_id?: number
          centro_custo?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data?: string | null
          data_consolidado?: boolean | null
          fornecedor_descricao: string
          id?: number
          observacoes?: string | null
          projeto?: string | null
          tipo: string
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          centro_custo?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data?: string | null
          data_consolidado?: boolean | null
          fornecedor_descricao?: string
          id?: number
          observacoes?: string | null
          projeto?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      caixa_investimentos_movimentos: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          centro_custo: string | null
          comprovante_url: string | null
          criado_em: string | null
          data: string | null
          data_consolidado: boolean | null
          fornecedor_descricao: string
          id: number
          observacoes: string | null
          projeto: string | null
          solicitante: string | null
          tipo: string
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          bar_id?: number
          centro_custo?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data?: string | null
          data_consolidado?: boolean | null
          fornecedor_descricao: string
          id?: number
          observacoes?: string | null
          projeto?: string | null
          solicitante?: string | null
          tipo: string
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          centro_custo?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data?: string | null
          data_consolidado?: boolean | null
          fornecedor_descricao?: string
          id?: number
          observacoes?: string | null
          projeto?: string | null
          solicitante?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      caixa_recebimentos_futuros: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          criado_em: string | null
          data_prevista: string
          descricao: string | null
          id: number
          origem: string
          status: string | null
          tipo: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          data_prevista: string
          descricao?: string | null
          id?: number
          origem: string
          status?: string | null
          tipo?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          data_prevista?: string
          descricao?: string | null
          id?: number
          origem?: string
          status?: string | null
          tipo?: string | null
          valor?: number
        }
        Relationships: []
      }
      caixa_valores_terceiros: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          criado_em: string | null
          data_atualizacao: string
          detalhes: string | null
          fornecedor: string
          id: number
          informacoes_valiosas: string | null
          status: string | null
          tipo: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          data_atualizacao: string
          detalhes?: string | null
          fornecedor: string
          id?: number
          informacoes_valiosas?: string | null
          status?: string | null
          tipo?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          data_atualizacao?: string
          detalhes?: string | null
          fornecedor?: string
          id?: number
          informacoes_valiosas?: string | null
          status?: string | null
          tipo?: string | null
          valor?: number
        }
        Relationships: []
      }
      calendario_historico: {
        Row: {
          bar_id: number
          criado_em: string | null
          data: string
          id: number
          motivo_anterior: string | null
          motivo_novo: string | null
          observacao_anterior: string | null
          observacao_novo: string | null
          qtd_dias_afetados: number | null
          status_anterior: string | null
          status_novo: string
          tipo_acao: string
          usuario_id: number | null
          usuario_nome: string | null
        }
        Insert: {
          bar_id: number
          criado_em?: string | null
          data: string
          id?: number
          motivo_anterior?: string | null
          motivo_novo?: string | null
          observacao_anterior?: string | null
          observacao_novo?: string | null
          qtd_dias_afetados?: number | null
          status_anterior?: string | null
          status_novo: string
          tipo_acao: string
          usuario_id?: number | null
          usuario_nome?: string | null
        }
        Update: {
          bar_id?: number
          criado_em?: string | null
          data?: string
          id?: number
          motivo_anterior?: string | null
          motivo_novo?: string | null
          observacao_anterior?: string | null
          observacao_novo?: string | null
          qtd_dias_afetados?: number | null
          status_anterior?: string | null
          status_novo?: string
          tipo_acao?: string
          usuario_id?: number | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      calendario_operacional: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          criado_em: string | null
          criado_por: number | null
          data: string
          id: number
          motivo: string | null
          observacao: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string | null
          bar_id: number
          criado_em?: string | null
          criado_por?: number | null
          data: string
          id?: number
          motivo?: string | null
          observacao?: string | null
          status: string
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          criado_por?: number | null
          data?: string
          id?: number
          motivo?: string | null
          observacao?: string | null
          status?: string
        }
        Relationships: []
      }
      cargos: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number
          criado_em: string | null
          descricao: string | null
          id: number
          nivel: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id: number
          criado_em?: string | null
          descricao?: string | null
          id?: number
          nivel?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          descricao?: string | null
          id?: number
          nivel?: number | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          anexos: Json | null
          atribuido_para: string | null
          atualizado_em: string | null
          avaliacao_comentario: string | null
          avaliacao_em: string | null
          avaliacao_nota: number | null
          bar_id: number
          categoria: Database["public"]["Enums"]["categoria_chamado"]
          criado_em: string | null
          criado_por: string
          dados_extras: Json | null
          descricao: string
          fechado_em: string | null
          id: string
          modulo: string | null
          numero_chamado: number
          primeira_resposta_em: string | null
          prioridade: Database["public"]["Enums"]["prioridade_chamado"]
          resolvido_em: string | null
          sla_primeira_resposta_horas: number | null
          sla_resolucao_horas: number | null
          sla_violado: boolean | null
          status: Database["public"]["Enums"]["status_chamado"]
          tags: string[] | null
          titulo: string
        }
        Insert: {
          anexos?: Json | null
          atribuido_para?: string | null
          atualizado_em?: string | null
          avaliacao_comentario?: string | null
          avaliacao_em?: string | null
          avaliacao_nota?: number | null
          bar_id: number
          categoria?: Database["public"]["Enums"]["categoria_chamado"]
          criado_em?: string | null
          criado_por: string
          dados_extras?: Json | null
          descricao: string
          fechado_em?: string | null
          id?: string
          modulo?: string | null
          numero_chamado?: number
          primeira_resposta_em?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          resolvido_em?: string | null
          sla_primeira_resposta_horas?: number | null
          sla_resolucao_horas?: number | null
          sla_violado?: boolean | null
          status?: Database["public"]["Enums"]["status_chamado"]
          tags?: string[] | null
          titulo: string
        }
        Update: {
          anexos?: Json | null
          atribuido_para?: string | null
          atualizado_em?: string | null
          avaliacao_comentario?: string | null
          avaliacao_em?: string | null
          avaliacao_nota?: number | null
          bar_id?: number
          categoria?: Database["public"]["Enums"]["categoria_chamado"]
          criado_em?: string | null
          criado_por?: string
          dados_extras?: Json | null
          descricao?: string
          fechado_em?: string | null
          id?: string
          modulo?: string | null
          numero_chamado?: number
          primeira_resposta_em?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          resolvido_em?: string | null
          sla_primeira_resposta_horas?: number | null
          sla_resolucao_horas?: number | null
          sla_violado?: boolean | null
          status?: Database["public"]["Enums"]["status_chamado"]
          tags?: string[] | null
          titulo?: string
        }
        Relationships: []
      }
      chamados_historico: {
        Row: {
          acao: string
          campo_alterado: string | null
          chamado_id: string
          criado_em: string | null
          detalhes: Json | null
          id: string
          usuario_id: string
          usuario_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao: string
          campo_alterado?: string | null
          chamado_id: string
          criado_em?: string | null
          detalhes?: Json | null
          id?: string
          usuario_id: string
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          campo_alterado?: string | null
          chamado_id?: string
          criado_em?: string | null
          detalhes?: Json | null
          id?: string
          usuario_id?: string
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_historico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_mensagens: {
        Row: {
          anexos: Json | null
          autor_id: string
          autor_nome: string | null
          autor_tipo: string | null
          chamado_id: string
          criado_em: string | null
          id: string
          lido: boolean | null
          lido_em: string | null
          mensagem: string
          tipo: Database["public"]["Enums"]["tipo_mensagem_chamado"]
        }
        Insert: {
          anexos?: Json | null
          autor_id: string
          autor_nome?: string | null
          autor_tipo?: string | null
          chamado_id: string
          criado_em?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          mensagem: string
          tipo?: Database["public"]["Enums"]["tipo_mensagem_chamado"]
        }
        Update: {
          anexos?: Json | null
          autor_id?: string
          autor_nome?: string | null
          autor_tipo?: string | null
          chamado_id?: string
          criado_em?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          mensagem?: string
          tipo?: Database["public"]["Enums"]["tipo_mensagem_chamado"]
        }
        Relationships: [
          {
            foreignKeyName: "chamados_mensagens_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_agendamentos: {
        Row: {
          bar_id: number
          checklist_id: string
          criado_em: string | null
          criado_por: string
          data_agendada: string
          deadline: string | null
          id: string
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["prioridade_enum"]
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_agendamento_enum"]
        }
        Insert: {
          bar_id: number
          checklist_id: string
          criado_em?: string | null
          criado_por: string
          data_agendada: string
          deadline?: string | null
          id?: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_enum"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_agendamento_enum"]
        }
        Update: {
          bar_id?: number
          checklist_id?: string
          criado_em?: string | null
          criado_por?: string
          data_agendada?: string
          deadline?: string | null
          id?: string
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_enum"]
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_agendamento_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_agendamentos_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_auto_executions: {
        Row: {
          alerta_enviado: boolean | null
          checklist_agendamento_id: string | null
          checklist_execucao_id: string | null
          checklist_schedule_id: string | null
          criado_em: string | null
          data_alerta: string | null
          data_limite: string | null
          id: string
          notificacao_enviada: boolean | null
          status: string | null
        }
        Insert: {
          alerta_enviado?: boolean | null
          checklist_agendamento_id?: string | null
          checklist_execucao_id?: string | null
          checklist_schedule_id?: string | null
          criado_em?: string | null
          data_alerta?: string | null
          data_limite?: string | null
          id?: string
          notificacao_enviada?: boolean | null
          status?: string | null
        }
        Update: {
          alerta_enviado?: boolean | null
          checklist_agendamento_id?: string | null
          checklist_execucao_id?: string | null
          checklist_schedule_id?: string | null
          criado_em?: string | null
          data_alerta?: string | null
          data_limite?: string | null
          id?: string
          notificacao_enviada?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_auto_executions_checklist_agendamento_id_fkey"
            columns: ["checklist_agendamento_id"]
            isOneToOne: false
            referencedRelation: "checklist_agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_automation_logs: {
        Row: {
          checklist_auto_execution_id: string | null
          checklist_schedule_id: string | null
          criado_em: string | null
          dados: Json | null
          id: string
          mensagem: string | null
          nivel: string | null
          tipo: string
        }
        Insert: {
          checklist_auto_execution_id?: string | null
          checklist_schedule_id?: string | null
          criado_em?: string | null
          dados?: Json | null
          id?: string
          mensagem?: string | null
          nivel?: string | null
          tipo: string
        }
        Update: {
          checklist_auto_execution_id?: string | null
          checklist_schedule_id?: string | null
          criado_em?: string | null
          dados?: Json | null
          id?: string
          mensagem?: string | null
          nivel?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_automation_logs_checklist_auto_execution_id_fkey"
            columns: ["checklist_auto_execution_id"]
            isOneToOne: false
            referencedRelation: "checklist_auto_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_estatisticas: {
        Row: {
          bar_id: number
          created_at: string | null
          id: number
          nome: string | null
          telefone: string
          tempo_medio_minutos: number | null
          tempos_detalhados: number[] | null
          ticket_medio: number | null
          ticket_medio_consumo: number | null
          ticket_medio_entrada: number | null
          total_consumo: number | null
          total_entrada: number | null
          total_gasto: number | null
          total_visitas: number | null
          total_visitas_com_tempo: number | null
          ultima_visita: string | null
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          id?: number
          nome?: string | null
          telefone: string
          tempo_medio_minutos?: number | null
          tempos_detalhados?: number[] | null
          ticket_medio?: number | null
          ticket_medio_consumo?: number | null
          ticket_medio_entrada?: number | null
          total_consumo?: number | null
          total_entrada?: number | null
          total_gasto?: number | null
          total_visitas?: number | null
          total_visitas_com_tempo?: number | null
          ultima_visita?: string | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          id?: number
          nome?: string | null
          telefone?: string
          tempo_medio_minutos?: number | null
          tempos_detalhados?: number[] | null
          ticket_medio?: number | null
          ticket_medio_consumo?: number | null
          ticket_medio_entrada?: number | null
          total_consumo?: number | null
          total_entrada?: number | null
          total_gasto?: number | null
          total_visitas?: number | null
          total_visitas_com_tempo?: number | null
          ultima_visita?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cliente_perfil_consumo: {
        Row: {
          bar_id: number
          categorias_favoritas: Json | null
          created_at: string | null
          dias_preferidos: Json | null
          email: string | null
          frequencia_mensal: number | null
          id: number
          nome: string | null
          primeira_visita: string | null
          produtos_favoritos: Json | null
          tags: Json | null
          telefone: string
          ticket_medio_consumo: number | null
          total_itens_consumidos: number | null
          total_visitas: number | null
          ultima_visita: string | null
          updated_at: string | null
          valor_total_consumo: number | null
        }
        Insert: {
          bar_id: number
          categorias_favoritas?: Json | null
          created_at?: string | null
          dias_preferidos?: Json | null
          email?: string | null
          frequencia_mensal?: number | null
          id?: number
          nome?: string | null
          primeira_visita?: string | null
          produtos_favoritos?: Json | null
          tags?: Json | null
          telefone: string
          ticket_medio_consumo?: number | null
          total_itens_consumidos?: number | null
          total_visitas?: number | null
          ultima_visita?: string | null
          updated_at?: string | null
          valor_total_consumo?: number | null
        }
        Update: {
          bar_id?: number
          categorias_favoritas?: Json | null
          created_at?: string | null
          dias_preferidos?: Json | null
          email?: string | null
          frequencia_mensal?: number | null
          id?: number
          nome?: string | null
          primeira_visita?: string | null
          produtos_favoritos?: Json | null
          tags?: Json | null
          telefone?: string
          ticket_medio_consumo?: number | null
          total_itens_consumidos?: number | null
          total_visitas?: number | null
          ultima_visita?: string | null
          updated_at?: string | null
          valor_total_consumo?: number | null
        }
        Relationships: []
      }
      cmv_manual: {
        Row: {
          atualizado_em: string
          bar_id: number
          cmv_percentual: number
          cmv_valor: number | null
          compras_periodo: number | null
          criado_em: string
          criado_por: number | null
          estoque_final: number | null
          estoque_inicial: number | null
          faturamento_periodo: number | null
          fonte: string | null
          id: number
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          periodo_tipo: string
        }
        Insert: {
          atualizado_em?: string
          bar_id: number
          cmv_percentual: number
          cmv_valor?: number | null
          compras_periodo?: number | null
          criado_em?: string
          criado_por?: number | null
          estoque_final?: number | null
          estoque_inicial?: number | null
          faturamento_periodo?: number | null
          fonte?: string | null
          id?: number
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          periodo_tipo: string
        }
        Update: {
          atualizado_em?: string
          bar_id?: number
          cmv_percentual?: number
          cmv_valor?: number | null
          compras_periodo?: number | null
          criado_em?: string
          criado_por?: number | null
          estoque_final?: number | null
          estoque_inicial?: number | null
          faturamento_periodo?: number | null
          fonte?: string | null
          id?: number
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          periodo_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_manual_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      cmv_semanal: {
        Row: {
          ajuste_bonificacoes: number | null
          ano: number
          bar_id: number
          bonificacao_cashback_mensal: number | null
          bonificacao_contrato_anual: number | null
          chegadeira: number | null
          cmv_alimentos: number | null
          cmv_bebidas: number | null
          cmv_calculado: number | null
          cmv_descartaveis: number | null
          cmv_limpo_percentual: number | null
          cmv_outros: number | null
          cmv_percentual: number | null
          cmv_real: number | null
          cmv_teorico_percentual: number | null
          compras_bebidas: number | null
          compras_cozinha: number | null
          compras_custo_bebidas: number | null
          compras_custo_comida: number | null
          compras_custo_drinks: number | null
          compras_custo_outros: number | null
          compras_drinks: number | null
          compras_periodo: number | null
          consumo_adm: number | null
          consumo_artista: number | null
          consumo_beneficios: number | null
          consumo_rh: number | null
          consumo_socios: number | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          estoque_final: number | null
          estoque_final_bebidas: number | null
          estoque_final_cozinha: number | null
          estoque_final_drinks: number | null
          estoque_inicial: number | null
          estoque_inicial_bebidas: number | null
          estoque_inicial_cozinha: number | null
          estoque_inicial_drinks: number | null
          faturamento_bruto: number | null
          faturamento_cmvivel: number | null
          gap: number | null
          id: number
          mesa_adm_casa: number | null
          mesa_banda_dj: number | null
          mesa_beneficios_cliente: number | null
          mesa_rh: number | null
          observacoes: string | null
          outros_ajustes: number | null
          responsavel: string | null
          semana: number
          status: string | null
          total_consumo_socios: number | null
          updated_at: string | null
          vendas_brutas: number | null
          vendas_liquidas: number | null
          vr_repique: number | null
        }
        Insert: {
          ajuste_bonificacoes?: number | null
          ano: number
          bar_id: number
          bonificacao_cashback_mensal?: number | null
          bonificacao_contrato_anual?: number | null
          chegadeira?: number | null
          cmv_alimentos?: number | null
          cmv_bebidas?: number | null
          cmv_calculado?: number | null
          cmv_descartaveis?: number | null
          cmv_limpo_percentual?: number | null
          cmv_outros?: number | null
          cmv_percentual?: number | null
          cmv_real?: number | null
          cmv_teorico_percentual?: number | null
          compras_bebidas?: number | null
          compras_cozinha?: number | null
          compras_custo_bebidas?: number | null
          compras_custo_comida?: number | null
          compras_custo_drinks?: number | null
          compras_custo_outros?: number | null
          compras_drinks?: number | null
          compras_periodo?: number | null
          consumo_adm?: number | null
          consumo_artista?: number | null
          consumo_beneficios?: number | null
          consumo_rh?: number | null
          consumo_socios?: number | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          estoque_final?: number | null
          estoque_final_bebidas?: number | null
          estoque_final_cozinha?: number | null
          estoque_final_drinks?: number | null
          estoque_inicial?: number | null
          estoque_inicial_bebidas?: number | null
          estoque_inicial_cozinha?: number | null
          estoque_inicial_drinks?: number | null
          faturamento_bruto?: number | null
          faturamento_cmvivel?: number | null
          gap?: number | null
          id?: number
          mesa_adm_casa?: number | null
          mesa_banda_dj?: number | null
          mesa_beneficios_cliente?: number | null
          mesa_rh?: number | null
          observacoes?: string | null
          outros_ajustes?: number | null
          responsavel?: string | null
          semana: number
          status?: string | null
          total_consumo_socios?: number | null
          updated_at?: string | null
          vendas_brutas?: number | null
          vendas_liquidas?: number | null
          vr_repique?: number | null
        }
        Update: {
          ajuste_bonificacoes?: number | null
          ano?: number
          bar_id?: number
          bonificacao_cashback_mensal?: number | null
          bonificacao_contrato_anual?: number | null
          chegadeira?: number | null
          cmv_alimentos?: number | null
          cmv_bebidas?: number | null
          cmv_calculado?: number | null
          cmv_descartaveis?: number | null
          cmv_limpo_percentual?: number | null
          cmv_outros?: number | null
          cmv_percentual?: number | null
          cmv_real?: number | null
          cmv_teorico_percentual?: number | null
          compras_bebidas?: number | null
          compras_cozinha?: number | null
          compras_custo_bebidas?: number | null
          compras_custo_comida?: number | null
          compras_custo_drinks?: number | null
          compras_custo_outros?: number | null
          compras_drinks?: number | null
          compras_periodo?: number | null
          consumo_adm?: number | null
          consumo_artista?: number | null
          consumo_beneficios?: number | null
          consumo_rh?: number | null
          consumo_socios?: number | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          estoque_final?: number | null
          estoque_final_bebidas?: number | null
          estoque_final_cozinha?: number | null
          estoque_final_drinks?: number | null
          estoque_inicial?: number | null
          estoque_inicial_bebidas?: number | null
          estoque_inicial_cozinha?: number | null
          estoque_inicial_drinks?: number | null
          faturamento_bruto?: number | null
          faturamento_cmvivel?: number | null
          gap?: number | null
          id?: number
          mesa_adm_casa?: number | null
          mesa_banda_dj?: number | null
          mesa_beneficios_cliente?: number | null
          mesa_rh?: number | null
          observacoes?: string | null
          outros_ajustes?: number | null
          responsavel?: string | null
          semana?: number
          status?: string | null
          total_consumo_socios?: number | null
          updated_at?: string | null
          vendas_brutas?: number | null
          vendas_liquidas?: number | null
          vr_repique?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cmv_semanal_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      contagem_estoque_historico: {
        Row: {
          contagem_id: number | null
          created_at: string | null
          data_alteracao: string | null
          estoque_fechado_anterior: number | null
          estoque_fechado_novo: number | null
          estoque_flutuante_anterior: number | null
          estoque_flutuante_novo: number | null
          id: number
          motivo: string | null
          preco_anterior: number | null
          preco_novo: number | null
          usuario_id: number | null
          usuario_nome: string | null
          variacao_estoque_fechado: number | null
          variacao_estoque_flutuante: number | null
          variacao_preco: number | null
          variacao_valor_total: number | null
        }
        Insert: {
          contagem_id?: number | null
          created_at?: string | null
          data_alteracao?: string | null
          estoque_fechado_anterior?: number | null
          estoque_fechado_novo?: number | null
          estoque_flutuante_anterior?: number | null
          estoque_flutuante_novo?: number | null
          id?: number
          motivo?: string | null
          preco_anterior?: number | null
          preco_novo?: number | null
          usuario_id?: number | null
          usuario_nome?: string | null
          variacao_estoque_fechado?: number | null
          variacao_estoque_flutuante?: number | null
          variacao_preco?: number | null
          variacao_valor_total?: number | null
        }
        Update: {
          contagem_id?: number | null
          created_at?: string | null
          data_alteracao?: string | null
          estoque_fechado_anterior?: number | null
          estoque_fechado_novo?: number | null
          estoque_flutuante_anterior?: number | null
          estoque_flutuante_novo?: number | null
          id?: number
          motivo?: string | null
          preco_anterior?: number | null
          preco_novo?: number | null
          usuario_id?: number | null
          usuario_nome?: string | null
          variacao_estoque_fechado?: number | null
          variacao_estoque_flutuante?: number | null
          variacao_preco?: number | null
          variacao_valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contagem_estoque_historico_contagem_id_fkey"
            columns: ["contagem_id"]
            isOneToOne: false
            referencedRelation: "contagem_estoque_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagem_estoque_historico_contagem_id_fkey"
            columns: ["contagem_id"]
            isOneToOne: false
            referencedRelation: "v_contagem_atual"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagem_estoque_historico_contagem_id_fkey"
            columns: ["contagem_id"]
            isOneToOne: false
            referencedRelation: "v_contagem_com_historico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagem_estoque_historico_contagem_id_fkey"
            columns: ["contagem_id"]
            isOneToOne: false
            referencedRelation: "v_contagem_consolidada_por_area"
            referencedColumns: ["id"]
          },
        ]
      }
      contagem_estoque_insumos: {
        Row: {
          bar_id: number
          categoria: string | null
          consumo_periodo: number | null
          contagem_anomala: boolean | null
          created_at: string | null
          custo_unitario: number | null
          data_contagem: string
          estoque_final: number
          estoque_inicial: number | null
          id: number
          insumo_codigo: string
          insumo_id: number
          insumo_nome: string
          motivo_anomalia: string | null
          observacoes: string | null
          quantidade_pedido: number | null
          score_anomalia: number | null
          tipo_anomalia: string[] | null
          tipo_local: string | null
          unidade_medida: string
          updated_at: string | null
          usuario_contagem: string | null
          valor_consumo: number | null
        }
        Insert: {
          bar_id?: number
          categoria?: string | null
          consumo_periodo?: number | null
          contagem_anomala?: boolean | null
          created_at?: string | null
          custo_unitario?: number | null
          data_contagem: string
          estoque_final: number
          estoque_inicial?: number | null
          id?: number
          insumo_codigo: string
          insumo_id: number
          insumo_nome: string
          motivo_anomalia?: string | null
          observacoes?: string | null
          quantidade_pedido?: number | null
          score_anomalia?: number | null
          tipo_anomalia?: string[] | null
          tipo_local?: string | null
          unidade_medida: string
          updated_at?: string | null
          usuario_contagem?: string | null
          valor_consumo?: number | null
        }
        Update: {
          bar_id?: number
          categoria?: string | null
          consumo_periodo?: number | null
          contagem_anomala?: boolean | null
          created_at?: string | null
          custo_unitario?: number | null
          data_contagem?: string
          estoque_final?: number
          estoque_inicial?: number | null
          id?: number
          insumo_codigo?: string
          insumo_id?: number
          insumo_nome?: string
          motivo_anomalia?: string | null
          observacoes?: string | null
          quantidade_pedido?: number | null
          score_anomalia?: number | null
          tipo_anomalia?: string[] | null
          tipo_local?: string | null
          unidade_medida?: string
          updated_at?: string | null
          usuario_contagem?: string | null
          valor_consumo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contagem_estoque_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      contagem_estoque_produtos: {
        Row: {
          alerta_preenchimento: boolean | null
          alerta_variacao: boolean | null
          area_id: number | null
          bar_id: number
          categoria: string
          created_at: string | null
          data_contagem: string
          descricao: string
          estoque_fechado: number
          estoque_flutuante: number
          estoque_total: number | null
          id: number
          observacoes: string | null
          preco: number
          produto_id: string | null
          updated_at: string | null
          usuario_id: number | null
          usuario_nome: string | null
          valor_total: number | null
          variacao_percentual: number | null
        }
        Insert: {
          alerta_preenchimento?: boolean | null
          alerta_variacao?: boolean | null
          area_id?: number | null
          bar_id?: number
          categoria: string
          created_at?: string | null
          data_contagem?: string
          descricao: string
          estoque_fechado?: number
          estoque_flutuante?: number
          estoque_total?: number | null
          id?: number
          observacoes?: string | null
          preco?: number
          produto_id?: string | null
          updated_at?: string | null
          usuario_id?: number | null
          usuario_nome?: string | null
          valor_total?: number | null
          variacao_percentual?: number | null
        }
        Update: {
          alerta_preenchimento?: boolean | null
          alerta_variacao?: boolean | null
          area_id?: number | null
          bar_id?: number
          categoria?: string
          created_at?: string | null
          data_contagem?: string
          descricao?: string
          estoque_fechado?: number
          estoque_flutuante?: number
          estoque_total?: number | null
          id?: number
          observacoes?: string | null
          preco?: number
          produto_id?: string | null
          updated_at?: string | null
          usuario_id?: number | null
          usuario_nome?: string | null
          valor_total?: number | null
          variacao_percentual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contagem_estoque_produtos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas_contagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagem_estoque_produtos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "v_contagem_consolidada_por_area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "contagem_estoque_produtos_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "v_resumo_por_area"
            referencedColumns: ["area_id"]
          },
        ]
      }
      contahub_alertas: {
        Row: {
          created_at: string | null
          data_evento: string
          descricao: string | null
          detalhes: Json | null
          diferenca: number | null
          id: number
          resolvido_em: string | null
          severidade: string
          status: string | null
          tipo_alerta: string
          titulo: string
          valor_atual: number | null
          valor_esperado: number | null
        }
        Insert: {
          created_at?: string | null
          data_evento: string
          descricao?: string | null
          detalhes?: Json | null
          diferenca?: number | null
          id?: number
          resolvido_em?: string | null
          severidade: string
          status?: string | null
          tipo_alerta: string
          titulo: string
          valor_atual?: number | null
          valor_esperado?: number | null
        }
        Update: {
          created_at?: string | null
          data_evento?: string
          descricao?: string | null
          detalhes?: Json | null
          diferenca?: number | null
          id?: number
          resolvido_em?: string | null
          severidade?: string
          status?: string | null
          tipo_alerta?: string
          titulo?: string
          valor_atual?: number | null
          valor_esperado?: number | null
        }
        Relationships: []
      }
      contahub_analitico: {
        Row: {
          ano: number | null
          bar_id: number | null
          comandaorigem: string | null
          created_at: string | null
          custo: number | null
          desconto: number | null
          grp_desc: string | null
          id: number
          idempotency_key: string | null
          itemorigem: string | null
          itm: number | null
          itm_obs: string | null
          loc_desc: string | null
          mes: number | null
          prd: string | null
          prd_desc: string | null
          prefixo: string | null
          qtd: number | null
          tipo: string | null
          tipovenda: string | null
          trn: number | null
          trn_desc: string | null
          trn_dtgerencial: string | null
          updated_at: string | null
          usr_lancou: string | null
          valorfinal: number | null
          vd_localizacao: string | null
          vd_mesadesc: string | null
        }
        Insert: {
          ano?: number | null
          bar_id?: number | null
          comandaorigem?: string | null
          created_at?: string | null
          custo?: number | null
          desconto?: number | null
          grp_desc?: string | null
          id?: number
          idempotency_key?: string | null
          itemorigem?: string | null
          itm?: number | null
          itm_obs?: string | null
          loc_desc?: string | null
          mes?: number | null
          prd?: string | null
          prd_desc?: string | null
          prefixo?: string | null
          qtd?: number | null
          tipo?: string | null
          tipovenda?: string | null
          trn?: number | null
          trn_desc?: string | null
          trn_dtgerencial?: string | null
          updated_at?: string | null
          usr_lancou?: string | null
          valorfinal?: number | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Update: {
          ano?: number | null
          bar_id?: number | null
          comandaorigem?: string | null
          created_at?: string | null
          custo?: number | null
          desconto?: number | null
          grp_desc?: string | null
          id?: number
          idempotency_key?: string | null
          itemorigem?: string | null
          itm?: number | null
          itm_obs?: string | null
          loc_desc?: string | null
          mes?: number | null
          prd?: string | null
          prd_desc?: string | null
          prefixo?: string | null
          qtd?: number | null
          tipo?: string | null
          tipovenda?: string | null
          trn?: number | null
          trn_desc?: string | null
          trn_dtgerencial?: string | null
          updated_at?: string | null
          usr_lancou?: string | null
          valorfinal?: number | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_analitico_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      contahub_correction_logs: {
        Row: {
          created_at: string | null
          data_evento: string
          detalhes: Json | null
          diferenca: number | null
          id: number
          status: string
          valor_banco_anterior: number | null
          valor_banco_corrigido: number | null
          valor_contahub_atual: number | null
        }
        Insert: {
          created_at?: string | null
          data_evento: string
          detalhes?: Json | null
          diferenca?: number | null
          id?: number
          status: string
          valor_banco_anterior?: number | null
          valor_banco_corrigido?: number | null
          valor_contahub_atual?: number | null
        }
        Update: {
          created_at?: string | null
          data_evento?: string
          detalhes?: Json | null
          diferenca?: number | null
          id?: number
          status?: string
          valor_banco_anterior?: number | null
          valor_banco_corrigido?: number | null
          valor_contahub_atual?: number | null
        }
        Relationships: []
      }
      contahub_corrections: {
        Row: {
          aplicado_em: string | null
          aplicado_por: string | null
          data_evento: string
          diferenca: number
          id: number
          motivo: string
          valor_anterior: number
          valor_contahub: number
          valor_corrigido: number
        }
        Insert: {
          aplicado_em?: string | null
          aplicado_por?: string | null
          data_evento: string
          diferenca: number
          id?: number
          motivo: string
          valor_anterior: number
          valor_contahub: number
          valor_corrigido: number
        }
        Update: {
          aplicado_em?: string | null
          aplicado_por?: string | null
          data_evento?: string
          diferenca?: number
          id?: number
          motivo?: string
          valor_anterior?: number
          valor_contahub?: number
          valor_corrigido?: number
        }
        Relationships: []
      }
      contahub_fatporhora: {
        Row: {
          bar_id: number | null
          created_at: string | null
          dds: number | null
          dia: string | null
          hora: number | null
          id: number
          idempotency_key: string | null
          qtd: number | null
          updated_at: string | null
          valor: number | null
          vd_dtgerencial: string | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          dds?: number | null
          dia?: string | null
          hora?: number | null
          id?: number
          idempotency_key?: string | null
          qtd?: number | null
          updated_at?: string | null
          valor?: number | null
          vd_dtgerencial?: string | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          dds?: number | null
          dia?: string | null
          hora?: number | null
          id?: number
          idempotency_key?: string | null
          qtd?: number | null
          updated_at?: string | null
          valor?: number | null
          vd_dtgerencial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_fatporhora_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      contahub_pagamentos: {
        Row: {
          autorizacao: string | null
          bar_id: number | null
          cartao: string | null
          cli: number | null
          cliente: string | null
          created_at: string | null
          dt_credito: string | null
          dt_gerencial: string | null
          dt_transacao: string | null
          hr_lancamento: string | null
          hr_transacao: string | null
          id: number
          idempotency_key: string | null
          liquido: number | null
          meio: string | null
          mesa: string | null
          motivodesconto: string | null
          pag: string | null
          perc: number | null
          taxa: number | null
          tipo: string | null
          trn: string | null
          updated_at: string | null
          usr_abriu: string | null
          usr_aceitou: string | null
          usr_lancou: string | null
          valor: number | null
          vd: string | null
          vr_pagamentos: number | null
        }
        Insert: {
          autorizacao?: string | null
          bar_id?: number | null
          cartao?: string | null
          cli?: number | null
          cliente?: string | null
          created_at?: string | null
          dt_credito?: string | null
          dt_gerencial?: string | null
          dt_transacao?: string | null
          hr_lancamento?: string | null
          hr_transacao?: string | null
          id?: number
          idempotency_key?: string | null
          liquido?: number | null
          meio?: string | null
          mesa?: string | null
          motivodesconto?: string | null
          pag?: string | null
          perc?: number | null
          taxa?: number | null
          tipo?: string | null
          trn?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_aceitou?: string | null
          usr_lancou?: string | null
          valor?: number | null
          vd?: string | null
          vr_pagamentos?: number | null
        }
        Update: {
          autorizacao?: string | null
          bar_id?: number | null
          cartao?: string | null
          cli?: number | null
          cliente?: string | null
          created_at?: string | null
          dt_credito?: string | null
          dt_gerencial?: string | null
          dt_transacao?: string | null
          hr_lancamento?: string | null
          hr_transacao?: string | null
          id?: number
          idempotency_key?: string | null
          liquido?: number | null
          meio?: string | null
          mesa?: string | null
          motivodesconto?: string | null
          pag?: string | null
          perc?: number | null
          taxa?: number | null
          tipo?: string | null
          trn?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_aceitou?: string | null
          usr_lancou?: string | null
          valor?: number | null
          vd?: string | null
          vr_pagamentos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_pagamentos_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      contahub_periodo: {
        Row: {
          bar_id: number | null
          cht_nome: string | null
          cli_dtnasc: string | null
          cli_email: string | null
          cli_fone: string | null
          cli_fone_norm: string | null
          cli_nome: string | null
          created_at: string | null
          dt_contabil: string | null
          dt_gerencial: string | null
          id: number
          idempotency_key: string | null
          motivo: string | null
          pessoas: number | null
          qtd_itens: number | null
          semana: number | null
          tipovenda: string | null
          ultimo_pedido: string | null
          updated_at: string | null
          usr_abriu: string | null
          vd_dtcontabil: string | null
          vd_localizacao: string | null
          vd_mesadesc: string | null
          vr_couvert: number | null
          vr_desconto: number | null
          vr_pagamentos: number | null
          vr_produtos: number | null
          vr_repique: number | null
        }
        Insert: {
          bar_id?: number | null
          cht_nome?: string | null
          cli_dtnasc?: string | null
          cli_email?: string | null
          cli_fone?: string | null
          cli_fone_norm?: string | null
          cli_nome?: string | null
          created_at?: string | null
          dt_contabil?: string | null
          dt_gerencial?: string | null
          id?: number
          idempotency_key?: string | null
          motivo?: string | null
          pessoas?: number | null
          qtd_itens?: number | null
          semana?: number | null
          tipovenda?: string | null
          ultimo_pedido?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          vd_dtcontabil?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
          vr_couvert?: number | null
          vr_desconto?: number | null
          vr_pagamentos?: number | null
          vr_produtos?: number | null
          vr_repique?: number | null
        }
        Update: {
          bar_id?: number | null
          cht_nome?: string | null
          cli_dtnasc?: string | null
          cli_email?: string | null
          cli_fone?: string | null
          cli_fone_norm?: string | null
          cli_nome?: string | null
          created_at?: string | null
          dt_contabil?: string | null
          dt_gerencial?: string | null
          id?: number
          idempotency_key?: string | null
          motivo?: string | null
          pessoas?: number | null
          qtd_itens?: number | null
          semana?: number | null
          tipovenda?: string | null
          ultimo_pedido?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          vd_dtcontabil?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
          vr_couvert?: number | null
          vr_desconto?: number | null
          vr_pagamentos?: number | null
          vr_produtos?: number | null
          vr_repique?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_periodo_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      contahub_processing_queue: {
        Row: {
          bar_id: number
          batch_size: number | null
          completed_at: string | null
          created_at: string | null
          data_date: string
          data_type: string
          error_message: string | null
          id: string
          processed_count: number | null
          raw_data_id: number | null
          retry_count: number | null
          started_at: string | null
          status: string
          total_count: number | null
          updated_at: string | null
          worker_function: string | null
        }
        Insert: {
          bar_id: number
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string | null
          data_date: string
          data_type: string
          error_message?: string | null
          id?: string
          processed_count?: number | null
          raw_data_id?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_count?: number | null
          updated_at?: string | null
          worker_function?: string | null
        }
        Update: {
          bar_id?: number
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string | null
          data_date?: string
          data_type?: string
          error_message?: string | null
          id?: string
          processed_count?: number | null
          raw_data_id?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
          total_count?: number | null
          updated_at?: string | null
          worker_function?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contahub_processing_queue_raw_data_id_fkey"
            columns: ["raw_data_id"]
            isOneToOne: false
            referencedRelation: "contahub_raw_data"
            referencedColumns: ["id"]
          },
        ]
      }
      contahub_prodporhora: {
        Row: {
          bar_id: number
          created_at: string | null
          data_gerencial: string
          grupo_descricao: string | null
          hora: number
          id: number
          idempotency_key: string | null
          produto_descricao: string
          produto_id: string
          quantidade: number
          updated_at: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          data_gerencial: string
          grupo_descricao?: string | null
          hora: number
          id?: number
          idempotency_key?: string | null
          produto_descricao: string
          produto_id: string
          quantidade: number
          updated_at?: string | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          data_gerencial?: string
          grupo_descricao?: string | null
          hora?: number
          id?: number
          idempotency_key?: string | null
          produto_descricao?: string
          produto_id?: string
          quantidade?: number
          updated_at?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: []
      }
      contahub_quality_monitor: {
        Row: {
          created_at: string | null
          data_evento: string
          detalhes: Json | null
          diferenca: number | null
          id: number
          percentual_precisao: number | null
          status_qualidade: string
          tipo_validacao: string
          valor_atual: number | null
          valor_esperado: number | null
        }
        Insert: {
          created_at?: string | null
          data_evento: string
          detalhes?: Json | null
          diferenca?: number | null
          id?: number
          percentual_precisao?: number | null
          status_qualidade: string
          tipo_validacao: string
          valor_atual?: number | null
          valor_esperado?: number | null
        }
        Update: {
          created_at?: string | null
          data_evento?: string
          detalhes?: Json | null
          diferenca?: number | null
          id?: number
          percentual_precisao?: number | null
          status_qualidade?: string
          tipo_validacao?: string
          valor_atual?: number | null
          valor_esperado?: number | null
        }
        Relationships: []
      }
      contahub_raw_data: {
        Row: {
          bar_id: number
          created_at: string | null
          data_date: string
          data_type: string
          grupo_filtro: string | null
          id: number
          processed: boolean | null
          processed_at: string | null
          raw_json: Json
          record_count: number | null
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          data_date: string
          data_type: string
          grupo_filtro?: string | null
          id?: number
          processed?: boolean | null
          processed_at?: string | null
          raw_json: Json
          record_count?: number | null
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          data_date?: string
          data_type?: string
          grupo_filtro?: string | null
          id?: number
          processed?: boolean | null
          processed_at?: string | null
          raw_json?: Json
          record_count?: number | null
        }
        Relationships: []
      }
      contahub_retry_control: {
        Row: {
          created_at: string | null
          data_evento: string
          detalhes: Json | null
          id: number
          max_tentativas: number | null
          proxima_tentativa: string | null
          status: string | null
          tentativa_atual: number | null
          tipo_sync: string
          ultimo_erro: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_evento: string
          detalhes?: Json | null
          id?: number
          max_tentativas?: number | null
          proxima_tentativa?: string | null
          status?: string | null
          tentativa_atual?: number | null
          tipo_sync: string
          ultimo_erro?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_evento?: string
          detalhes?: Json | null
          id?: number
          max_tentativas?: number | null
          proxima_tentativa?: string | null
          status?: string | null
          tentativa_atual?: number | null
          tipo_sync?: string
          ultimo_erro?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contahub_stockout: {
        Row: {
          bar_id: number
          created_at: string | null
          data_consulta: string
          emp: number | null
          hora_consulta: string
          id: number
          loc: number | null
          loc_desc: string | null
          loc_inativo: string | null
          loc_statusimpressao: string | null
          prd: number | null
          prd_agrupaimpressao: string | null
          prd_ativo: string | null
          prd_balanca: string | null
          prd_cardapioonline: string | null
          prd_contagemehperda: string | null
          prd_controlaestoque: string | null
          prd_delivery: string | null
          prd_desc: string | null
          prd_disponivelonline: string | null
          prd_entregaimediata: string | null
          prd_estoque: number | null
          prd_naodesmembra: string | null
          prd_naoimprimeficha: string | null
          prd_naoimprimeproducao: string | null
          prd_nfecofins: number | null
          prd_nfecsosn: string | null
          prd_nfecstpiscofins: string | null
          prd_nfeicms: number | null
          prd_nfencm: string | null
          prd_nfeorigem: string | null
          prd_nfepis: number | null
          prd_opcoes: string | null
          prd_precovenda: number | null
          prd_produzido: string | null
          prd_qtddouble: string | null
          prd_semcustoestoque: string | null
          prd_semrepique: string | null
          prd_servico: string | null
          prd_unid: string | null
          prd_validaestoquevenda: string | null
          prd_venda: string | null
          prd_venda180: number | null
          prd_venda30: number | null
          prd_venda7: number | null
          prd_zeraestoquenacompra: string | null
          raw_data: Json | null
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          data_consulta: string
          emp?: number | null
          hora_consulta?: string
          id?: number
          loc?: number | null
          loc_desc?: string | null
          loc_inativo?: string | null
          loc_statusimpressao?: string | null
          prd?: number | null
          prd_agrupaimpressao?: string | null
          prd_ativo?: string | null
          prd_balanca?: string | null
          prd_cardapioonline?: string | null
          prd_contagemehperda?: string | null
          prd_controlaestoque?: string | null
          prd_delivery?: string | null
          prd_desc?: string | null
          prd_disponivelonline?: string | null
          prd_entregaimediata?: string | null
          prd_estoque?: number | null
          prd_naodesmembra?: string | null
          prd_naoimprimeficha?: string | null
          prd_naoimprimeproducao?: string | null
          prd_nfecofins?: number | null
          prd_nfecsosn?: string | null
          prd_nfecstpiscofins?: string | null
          prd_nfeicms?: number | null
          prd_nfencm?: string | null
          prd_nfeorigem?: string | null
          prd_nfepis?: number | null
          prd_opcoes?: string | null
          prd_precovenda?: number | null
          prd_produzido?: string | null
          prd_qtddouble?: string | null
          prd_semcustoestoque?: string | null
          prd_semrepique?: string | null
          prd_servico?: string | null
          prd_unid?: string | null
          prd_validaestoquevenda?: string | null
          prd_venda?: string | null
          prd_venda180?: number | null
          prd_venda30?: number | null
          prd_venda7?: number | null
          prd_zeraestoquenacompra?: string | null
          raw_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          data_consulta?: string
          emp?: number | null
          hora_consulta?: string
          id?: number
          loc?: number | null
          loc_desc?: string | null
          loc_inativo?: string | null
          loc_statusimpressao?: string | null
          prd?: number | null
          prd_agrupaimpressao?: string | null
          prd_ativo?: string | null
          prd_balanca?: string | null
          prd_cardapioonline?: string | null
          prd_contagemehperda?: string | null
          prd_controlaestoque?: string | null
          prd_delivery?: string | null
          prd_desc?: string | null
          prd_disponivelonline?: string | null
          prd_entregaimediata?: string | null
          prd_estoque?: number | null
          prd_naodesmembra?: string | null
          prd_naoimprimeficha?: string | null
          prd_naoimprimeproducao?: string | null
          prd_nfecofins?: number | null
          prd_nfecsosn?: string | null
          prd_nfecstpiscofins?: string | null
          prd_nfeicms?: number | null
          prd_nfencm?: string | null
          prd_nfeorigem?: string | null
          prd_nfepis?: number | null
          prd_opcoes?: string | null
          prd_precovenda?: number | null
          prd_produzido?: string | null
          prd_qtddouble?: string | null
          prd_semcustoestoque?: string | null
          prd_semrepique?: string | null
          prd_servico?: string | null
          prd_unid?: string | null
          prd_validaestoquevenda?: string | null
          prd_venda?: string | null
          prd_venda180?: number | null
          prd_venda30?: number | null
          prd_venda7?: number | null
          prd_zeraestoquenacompra?: string | null
          raw_data?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contahub_tempo: {
        Row: {
          ano: number | null
          bar_id: number | null
          categoria: string | null
          created_at: string | null
          data: string | null
          dds: number | null
          dia: string | null
          diadasemana: string | null
          grp_desc: string | null
          hora: string | null
          id: number
          idempotency_key: string | null
          itm: string | null
          itm_qtd: number | null
          loc_desc: string | null
          mes: number | null
          prd: number | null
          prd_desc: string | null
          prd_idexterno: string | null
          prefixo: string | null
          t0_lancamento: string | null
          t0_t1: number | null
          t0_t2: number | null
          t0_t3: number | null
          t1_prodini: string | null
          t1_t2: number | null
          t1_t3: number | null
          t2_prodfim: string | null
          t2_t3: number | null
          t3_entrega: string | null
          tipovenda: string | null
          updated_at: string | null
          usr_abriu: string | null
          usr_entregou: string | null
          usr_lancou: string | null
          usr_produziu: string | null
          usr_transfcancelou: string | null
          vd_localizacao: string | null
          vd_mesadesc: string | null
        }
        Insert: {
          ano?: number | null
          bar_id?: number | null
          categoria?: string | null
          created_at?: string | null
          data?: string | null
          dds?: number | null
          dia?: string | null
          diadasemana?: string | null
          grp_desc?: string | null
          hora?: string | null
          id?: number
          idempotency_key?: string | null
          itm?: string | null
          itm_qtd?: number | null
          loc_desc?: string | null
          mes?: number | null
          prd?: number | null
          prd_desc?: string | null
          prd_idexterno?: string | null
          prefixo?: string | null
          t0_lancamento?: string | null
          t0_t1?: number | null
          t0_t2?: number | null
          t0_t3?: number | null
          t1_prodini?: string | null
          t1_t2?: number | null
          t1_t3?: number | null
          t2_prodfim?: string | null
          t2_t3?: number | null
          t3_entrega?: string | null
          tipovenda?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_entregou?: string | null
          usr_lancou?: string | null
          usr_produziu?: string | null
          usr_transfcancelou?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Update: {
          ano?: number | null
          bar_id?: number | null
          categoria?: string | null
          created_at?: string | null
          data?: string | null
          dds?: number | null
          dia?: string | null
          diadasemana?: string | null
          grp_desc?: string | null
          hora?: string | null
          id?: number
          idempotency_key?: string | null
          itm?: string | null
          itm_qtd?: number | null
          loc_desc?: string | null
          mes?: number | null
          prd?: number | null
          prd_desc?: string | null
          prd_idexterno?: string | null
          prefixo?: string | null
          t0_lancamento?: string | null
          t0_t1?: number | null
          t0_t2?: number | null
          t0_t3?: number | null
          t1_prodini?: string | null
          t1_t2?: number | null
          t1_t3?: number | null
          t2_prodfim?: string | null
          t2_t3?: number | null
          t3_entrega?: string | null
          tipovenda?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_entregou?: string | null
          usr_lancou?: string | null
          usr_produziu?: string | null
          usr_transfcancelou?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_tempo_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      contahub_validation_logs: {
        Row: {
          acao_tomada: string | null
          data_evento: string
          data_validacao: string | null
          diferenca_registros: number | null
          diferenca_valor: number | null
          id: number
          observacoes: string | null
          status_integridade: string
          validado_por: string | null
        }
        Insert: {
          acao_tomada?: string | null
          data_evento: string
          data_validacao?: string | null
          diferenca_registros?: number | null
          diferenca_valor?: number | null
          id?: number
          observacoes?: string | null
          status_integridade: string
          validado_por?: string | null
        }
        Update: {
          acao_tomada?: string | null
          data_evento?: string
          data_validacao?: string | null
          diferenca_registros?: number | null
          diferenca_valor?: number | null
          id?: number
          observacoes?: string | null
          status_integridade?: string
          validado_por?: string | null
        }
        Relationships: []
      }
      contahub_vendas: {
        Row: {
          bar_id: number
          cli_dtcadastro: string | null
          cli_dtnasc: string | null
          cli_dtultima: string | null
          cli_email: string | null
          cli_fone: string | null
          cli_id: number | null
          cli_nome: string | null
          cli_obs: string | null
          cli_sexo: string | null
          created_at: string | null
          dt_gerencial: string
          id: number
          idempotency_key: string | null
          motivo: string | null
          nf_autorizada: string | null
          nf_nnf: string | null
          nf_tipo: string | null
          pessoas: number | null
          qtd_itens: number | null
          tempo_estadia_minutos: number | null
          tipovenda: string | null
          trn: number | null
          trn_couvert: number | null
          trn_desc: string | null
          trn_hrfim: string | null
          trn_hrinicio: string | null
          trn_percrepiquedefault: number | null
          trn_status: string | null
          updated_at: string | null
          usr_abriu: string | null
          usr_abriu_id: number | null
          usr_fechou: string | null
          usr_fechou_id: number | null
          usr_nome_abriu: string | null
          vd: number | null
          vd_comanda: string | null
          vd_cpf: string | null
          vd_dividepor: number | null
          vd_hrabertura: string | null
          vd_hrencerramento: string | null
          vd_hrfechamento: string | null
          vd_hrpagamento: string | null
          vd_hrprimeiro: string | null
          vd_hrsaida: string | null
          vd_hrultimo: string | null
          vd_idexterno: string | null
          vd_interna: string | null
          vd_localizacao: string | null
          vd_mesadesc: string | null
          vd_nome: string | null
          vd_obs: string | null
          vd_perda: string | null
          vd_prefixo: string | null
          vd_prepago: string | null
          vd_qtdcouvert: number | null
          vd_qtdmanobrista: number | null
          vd_senha: string | null
          vd_sinalizacao: string | null
          vd_status: string | null
          vd_transferidocancelado: string | null
          vd_vrcheio: number | null
          vd_vrdescontos: number | null
          vd_vrentrega: number | null
          vd_vrfalta: number | null
          vd_vrmanobrista: number | null
          vr_couvert: number | null
          vr_desconto: number | null
          vr_pagamentos: number | null
          vr_produtos: number | null
          vr_repique: number | null
          vr_servico: number | null
        }
        Insert: {
          bar_id: number
          cli_dtcadastro?: string | null
          cli_dtnasc?: string | null
          cli_dtultima?: string | null
          cli_email?: string | null
          cli_fone?: string | null
          cli_id?: number | null
          cli_nome?: string | null
          cli_obs?: string | null
          cli_sexo?: string | null
          created_at?: string | null
          dt_gerencial: string
          id?: number
          idempotency_key?: string | null
          motivo?: string | null
          nf_autorizada?: string | null
          nf_nnf?: string | null
          nf_tipo?: string | null
          pessoas?: number | null
          qtd_itens?: number | null
          tempo_estadia_minutos?: number | null
          tipovenda?: string | null
          trn?: number | null
          trn_couvert?: number | null
          trn_desc?: string | null
          trn_hrfim?: string | null
          trn_hrinicio?: string | null
          trn_percrepiquedefault?: number | null
          trn_status?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_abriu_id?: number | null
          usr_fechou?: string | null
          usr_fechou_id?: number | null
          usr_nome_abriu?: string | null
          vd?: number | null
          vd_comanda?: string | null
          vd_cpf?: string | null
          vd_dividepor?: number | null
          vd_hrabertura?: string | null
          vd_hrencerramento?: string | null
          vd_hrfechamento?: string | null
          vd_hrpagamento?: string | null
          vd_hrprimeiro?: string | null
          vd_hrsaida?: string | null
          vd_hrultimo?: string | null
          vd_idexterno?: string | null
          vd_interna?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
          vd_nome?: string | null
          vd_obs?: string | null
          vd_perda?: string | null
          vd_prefixo?: string | null
          vd_prepago?: string | null
          vd_qtdcouvert?: number | null
          vd_qtdmanobrista?: number | null
          vd_senha?: string | null
          vd_sinalizacao?: string | null
          vd_status?: string | null
          vd_transferidocancelado?: string | null
          vd_vrcheio?: number | null
          vd_vrdescontos?: number | null
          vd_vrentrega?: number | null
          vd_vrfalta?: number | null
          vd_vrmanobrista?: number | null
          vr_couvert?: number | null
          vr_desconto?: number | null
          vr_pagamentos?: number | null
          vr_produtos?: number | null
          vr_repique?: number | null
          vr_servico?: number | null
        }
        Update: {
          bar_id?: number
          cli_dtcadastro?: string | null
          cli_dtnasc?: string | null
          cli_dtultima?: string | null
          cli_email?: string | null
          cli_fone?: string | null
          cli_id?: number | null
          cli_nome?: string | null
          cli_obs?: string | null
          cli_sexo?: string | null
          created_at?: string | null
          dt_gerencial?: string
          id?: number
          idempotency_key?: string | null
          motivo?: string | null
          nf_autorizada?: string | null
          nf_nnf?: string | null
          nf_tipo?: string | null
          pessoas?: number | null
          qtd_itens?: number | null
          tempo_estadia_minutos?: number | null
          tipovenda?: string | null
          trn?: number | null
          trn_couvert?: number | null
          trn_desc?: string | null
          trn_hrfim?: string | null
          trn_hrinicio?: string | null
          trn_percrepiquedefault?: number | null
          trn_status?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_abriu_id?: number | null
          usr_fechou?: string | null
          usr_fechou_id?: number | null
          usr_nome_abriu?: string | null
          vd?: number | null
          vd_comanda?: string | null
          vd_cpf?: string | null
          vd_dividepor?: number | null
          vd_hrabertura?: string | null
          vd_hrencerramento?: string | null
          vd_hrfechamento?: string | null
          vd_hrpagamento?: string | null
          vd_hrprimeiro?: string | null
          vd_hrsaida?: string | null
          vd_hrultimo?: string | null
          vd_idexterno?: string | null
          vd_interna?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
          vd_nome?: string | null
          vd_obs?: string | null
          vd_perda?: string | null
          vd_prefixo?: string | null
          vd_prepago?: string | null
          vd_qtdcouvert?: number | null
          vd_qtdmanobrista?: number | null
          vd_senha?: string | null
          vd_sinalizacao?: string | null
          vd_status?: string | null
          vd_transferidocancelado?: string | null
          vd_vrcheio?: number | null
          vd_vrdescontos?: number | null
          vd_vrentrega?: number | null
          vd_vrfalta?: number | null
          vd_vrmanobrista?: number | null
          vr_couvert?: number | null
          vr_desconto?: number | null
          vr_pagamentos?: number | null
          vr_produtos?: number | null
          vr_repique?: number | null
          vr_servico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contahub_vendas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_funcionario: {
        Row: {
          area_id: number | null
          cargo_id: number | null
          criado_em: string | null
          funcionario_id: number
          id: number
          motivo_alteracao: string | null
          salario_base: number
          tipo_contratacao: string
          vale_transporte_diaria: number | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          area_id?: number | null
          cargo_id?: number | null
          criado_em?: string | null
          funcionario_id: number
          id?: number
          motivo_alteracao?: string | null
          salario_base: number
          tipo_contratacao: string
          vale_transporte_diaria?: number | null
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          area_id?: number | null
          cargo_id?: number | null
          criado_em?: string | null
          funcionario_id?: number
          id?: number
          motivo_alteracao?: string | null
          salario_base?: number
          tipo_contratacao?: string
          vale_transporte_diaria?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_funcionario_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_funcionario_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "vw_cmo_por_area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "contratos_funcionario_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_templates: {
        Row: {
          ativo: boolean | null
          bar_id: number | null
          categoria: string
          conteudo: string
          criado_em: string | null
          id: string
          nome: string
          tipo: string
          variaveis: string[] | null
          whatsapp_template_name: string | null
        }
        Insert: {
          ativo?: boolean | null
          bar_id?: number | null
          categoria: string
          conteudo: string
          criado_em?: string | null
          id?: string
          nome: string
          tipo: string
          variaveis?: string[] | null
          whatsapp_template_name?: string | null
        }
        Update: {
          ativo?: boolean | null
          bar_id?: number | null
          categoria?: string
          conteudo?: string
          criado_em?: string | null
          id?: string
          nome?: string
          tipo?: string
          variaveis?: string[] | null
          whatsapp_template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_templates_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      custos_mensais_diluidos: {
        Row: {
          ano: number
          ativo: boolean | null
          bar_id: number
          created_at: string | null
          descricao: string
          id: number
          mes: number
          observacoes: string | null
          parcela_atual: number | null
          tipo_diluicao: string
          total_parcelas: number | null
          updated_at: string | null
          valor_total: number
        }
        Insert: {
          ano: number
          ativo?: boolean | null
          bar_id: number
          created_at?: string | null
          descricao: string
          id?: number
          mes: number
          observacoes?: string | null
          parcela_atual?: number | null
          tipo_diluicao: string
          total_parcelas?: number | null
          updated_at?: string | null
          valor_total: number
        }
        Update: {
          ano?: number
          ativo?: boolean | null
          bar_id?: number
          created_at?: string | null
          descricao?: string
          id?: number
          mes?: number
          observacoes?: string | null
          parcela_atual?: number | null
          tipo_diluicao?: string
          total_parcelas?: number | null
          updated_at?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "custos_mensais_diluidos_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_bloqueados: {
        Row: {
          bar_id: number
          bloqueado_em: string | null
          bloqueado_por: string | null
          data_referencia: string
          id: number
          motivo: string | null
          snapshot: Json | null
          tabela: string
          valores_snapshot: Json | null
        }
        Insert: {
          bar_id: number
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          data_referencia: string
          id?: number
          motivo?: string | null
          snapshot?: Json | null
          tabela: string
          valores_snapshot?: Json | null
        }
        Update: {
          bar_id?: number
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          data_referencia?: string
          id?: number
          motivo?: string | null
          snapshot?: Json | null
          tabela?: string
          valores_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dados_bloqueados_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      desempenho_semanal: {
        Row: {
          adm_fixo: number | null
          adm_mkt_semana: number | null
          alimentacao: number | null
          ano: number
          ano_sistema: number | null
          atingimento: number | null
          atracoes_eventos: number | null
          atrasos_bar: number | null
          atrasos_bar_detalhes: Json | null
          atrasos_bar_perc: number | null
          atrasos_cozinha: number | null
          atrasos_cozinha_detalhes: Json | null
          atrasos_cozinha_perc: number | null
          atualizado_em: string | null
          atualizado_por: string | null
          atualizado_por_nome: string | null
          avaliacoes_5_google_trip: number | null
          bar_id: number | null
          clientes_30d: number | null
          clientes_60d: number | null
          clientes_90d: number | null
          clientes_atendidos: number | null
          clientes_ativos: number | null
          cmo: number | null
          cmo_custo: number | null
          cmo_fixo_simulacao: number | null
          cmv: number | null
          cmv_global_real: number | null
          cmv_limpo: number | null
          cmv_rs: number | null
          cmv_teorico: number | null
          comissao: number | null
          consumacao_sem_socio: number | null
          couvert_atracoes: number | null
          created_at: string | null
          custo_atracao_faturamento: number | null
          data_fim: string
          data_inicio: string
          escritorio_central: number | null
          faturamento_bar: number | null
          faturamento_cmovivel: number | null
          faturamento_entrada: number | null
          faturamento_total: number | null
          freelas: number | null
          id: number
          imposto: number | null
          lucro_rs: number | null
          m_alcance: number | null
          m_cliques: number | null
          m_conversas_iniciadas: number | null
          m_cpm: number | null
          m_ctr: number | null
          m_custo_por_clique: number | null
          m_frequencia: number | null
          m_valor_investido: number | null
          manutencao: number | null
          marketing_fixo: number | null
          materiais: number | null
          media_avaliacoes_google: number | null
          meta_semanal: number | null
          nota_felicidade_equipe: number | null
          nps_ambiente: number | null
          nps_atendimento: number | null
          nps_comida: number | null
          nps_drink: number | null
          nps_geral: number | null
          nps_limpeza: number | null
          nps_musica: number | null
          nps_preco: number | null
          nps_reservas: number | null
          numero_semana: number
          o_alcance: number | null
          o_compartilhamento: number | null
          o_engajamento: number | null
          o_interacao: number | null
          o_num_posts: number | null
          o_num_stories: number | null
          o_visu_stories: number | null
          observacoes: string | null
          ocupacao: number | null
          perc_bebidas: number | null
          perc_clientes_novos: number | null
          perc_comida: number | null
          perc_drinks: number | null
          perc_faturamento_apos_22h: number | null
          perc_faturamento_ate_19h: number | null
          perc_happy_hour: number | null
          pessoas_reservas_presentes: number | null
          pessoas_reservas_totais: number | null
          pro_labore: number | null
          qtde_itens_bar: number | null
          qtde_itens_cozinha: number | null
          qui_sab_dom: number | null
          reservas_presentes: number | null
          reservas_totais: number | null
          retencao_1m: number | null
          retencao_2m: number | null
          rh_estorno_outros_operacao: number | null
          stockout_bar: number | null
          stockout_bar_perc: number | null
          stockout_comidas: number | null
          stockout_comidas_perc: number | null
          stockout_drinks: number | null
          stockout_drinks_perc: number | null
          tempo_saida_bar: number | null
          tempo_saida_cozinha: number | null
          ticket_medio: number | null
          tm_bar: number | null
          tm_entrada: number | null
          updated_at: string | null
          utensilios: number | null
          venda_balcao: number | null
        }
        Insert: {
          adm_fixo?: number | null
          adm_mkt_semana?: number | null
          alimentacao?: number | null
          ano: number
          ano_sistema?: number | null
          atingimento?: number | null
          atracoes_eventos?: number | null
          atrasos_bar?: number | null
          atrasos_bar_detalhes?: Json | null
          atrasos_bar_perc?: number | null
          atrasos_cozinha?: number | null
          atrasos_cozinha_detalhes?: Json | null
          atrasos_cozinha_perc?: number | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          atualizado_por_nome?: string | null
          avaliacoes_5_google_trip?: number | null
          bar_id?: number | null
          clientes_30d?: number | null
          clientes_60d?: number | null
          clientes_90d?: number | null
          clientes_atendidos?: number | null
          clientes_ativos?: number | null
          cmo?: number | null
          cmo_custo?: number | null
          cmo_fixo_simulacao?: number | null
          cmv?: number | null
          cmv_global_real?: number | null
          cmv_limpo?: number | null
          cmv_rs?: number | null
          cmv_teorico?: number | null
          comissao?: number | null
          consumacao_sem_socio?: number | null
          couvert_atracoes?: number | null
          created_at?: string | null
          custo_atracao_faturamento?: number | null
          data_fim: string
          data_inicio: string
          escritorio_central?: number | null
          faturamento_bar?: number | null
          faturamento_cmovivel?: number | null
          faturamento_entrada?: number | null
          faturamento_total?: number | null
          freelas?: number | null
          id?: number
          imposto?: number | null
          lucro_rs?: number | null
          m_alcance?: number | null
          m_cliques?: number | null
          m_conversas_iniciadas?: number | null
          m_cpm?: number | null
          m_ctr?: number | null
          m_custo_por_clique?: number | null
          m_frequencia?: number | null
          m_valor_investido?: number | null
          manutencao?: number | null
          marketing_fixo?: number | null
          materiais?: number | null
          media_avaliacoes_google?: number | null
          meta_semanal?: number | null
          nota_felicidade_equipe?: number | null
          nps_ambiente?: number | null
          nps_atendimento?: number | null
          nps_comida?: number | null
          nps_drink?: number | null
          nps_geral?: number | null
          nps_limpeza?: number | null
          nps_musica?: number | null
          nps_preco?: number | null
          nps_reservas?: number | null
          numero_semana: number
          o_alcance?: number | null
          o_compartilhamento?: number | null
          o_engajamento?: number | null
          o_interacao?: number | null
          o_num_posts?: number | null
          o_num_stories?: number | null
          o_visu_stories?: number | null
          observacoes?: string | null
          ocupacao?: number | null
          perc_bebidas?: number | null
          perc_clientes_novos?: number | null
          perc_comida?: number | null
          perc_drinks?: number | null
          perc_faturamento_apos_22h?: number | null
          perc_faturamento_ate_19h?: number | null
          perc_happy_hour?: number | null
          pessoas_reservas_presentes?: number | null
          pessoas_reservas_totais?: number | null
          pro_labore?: number | null
          qtde_itens_bar?: number | null
          qtde_itens_cozinha?: number | null
          qui_sab_dom?: number | null
          reservas_presentes?: number | null
          reservas_totais?: number | null
          retencao_1m?: number | null
          retencao_2m?: number | null
          rh_estorno_outros_operacao?: number | null
          stockout_bar?: number | null
          stockout_bar_perc?: number | null
          stockout_comidas?: number | null
          stockout_comidas_perc?: number | null
          stockout_drinks?: number | null
          stockout_drinks_perc?: number | null
          tempo_saida_bar?: number | null
          tempo_saida_cozinha?: number | null
          ticket_medio?: number | null
          tm_bar?: number | null
          tm_entrada?: number | null
          updated_at?: string | null
          utensilios?: number | null
          venda_balcao?: number | null
        }
        Update: {
          adm_fixo?: number | null
          adm_mkt_semana?: number | null
          alimentacao?: number | null
          ano?: number
          ano_sistema?: number | null
          atingimento?: number | null
          atracoes_eventos?: number | null
          atrasos_bar?: number | null
          atrasos_bar_detalhes?: Json | null
          atrasos_bar_perc?: number | null
          atrasos_cozinha?: number | null
          atrasos_cozinha_detalhes?: Json | null
          atrasos_cozinha_perc?: number | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          atualizado_por_nome?: string | null
          avaliacoes_5_google_trip?: number | null
          bar_id?: number | null
          clientes_30d?: number | null
          clientes_60d?: number | null
          clientes_90d?: number | null
          clientes_atendidos?: number | null
          clientes_ativos?: number | null
          cmo?: number | null
          cmo_custo?: number | null
          cmo_fixo_simulacao?: number | null
          cmv?: number | null
          cmv_global_real?: number | null
          cmv_limpo?: number | null
          cmv_rs?: number | null
          cmv_teorico?: number | null
          comissao?: number | null
          consumacao_sem_socio?: number | null
          couvert_atracoes?: number | null
          created_at?: string | null
          custo_atracao_faturamento?: number | null
          data_fim?: string
          data_inicio?: string
          escritorio_central?: number | null
          faturamento_bar?: number | null
          faturamento_cmovivel?: number | null
          faturamento_entrada?: number | null
          faturamento_total?: number | null
          freelas?: number | null
          id?: number
          imposto?: number | null
          lucro_rs?: number | null
          m_alcance?: number | null
          m_cliques?: number | null
          m_conversas_iniciadas?: number | null
          m_cpm?: number | null
          m_ctr?: number | null
          m_custo_por_clique?: number | null
          m_frequencia?: number | null
          m_valor_investido?: number | null
          manutencao?: number | null
          marketing_fixo?: number | null
          materiais?: number | null
          media_avaliacoes_google?: number | null
          meta_semanal?: number | null
          nota_felicidade_equipe?: number | null
          nps_ambiente?: number | null
          nps_atendimento?: number | null
          nps_comida?: number | null
          nps_drink?: number | null
          nps_geral?: number | null
          nps_limpeza?: number | null
          nps_musica?: number | null
          nps_preco?: number | null
          nps_reservas?: number | null
          numero_semana?: number
          o_alcance?: number | null
          o_compartilhamento?: number | null
          o_engajamento?: number | null
          o_interacao?: number | null
          o_num_posts?: number | null
          o_num_stories?: number | null
          o_visu_stories?: number | null
          observacoes?: string | null
          ocupacao?: number | null
          perc_bebidas?: number | null
          perc_clientes_novos?: number | null
          perc_comida?: number | null
          perc_drinks?: number | null
          perc_faturamento_apos_22h?: number | null
          perc_faturamento_ate_19h?: number | null
          perc_happy_hour?: number | null
          pessoas_reservas_presentes?: number | null
          pessoas_reservas_totais?: number | null
          pro_labore?: number | null
          qtde_itens_bar?: number | null
          qtde_itens_cozinha?: number | null
          qui_sab_dom?: number | null
          reservas_presentes?: number | null
          reservas_totais?: number | null
          retencao_1m?: number | null
          retencao_2m?: number | null
          rh_estorno_outros_operacao?: number | null
          stockout_bar?: number | null
          stockout_bar_perc?: number | null
          stockout_comidas?: number | null
          stockout_comidas_perc?: number | null
          stockout_drinks?: number | null
          stockout_drinks_perc?: number | null
          tempo_saida_bar?: number | null
          tempo_saida_cozinha?: number | null
          ticket_medio?: number | null
          tm_bar?: number | null
          tm_entrada?: number | null
          updated_at?: string | null
          utensilios?: number | null
          venda_balcao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "desempenho_semanal_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_webhooks: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number
          criado_em: string | null
          id: number
          tipo: string
          webhook_url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id: number
          criado_em?: string | null
          id?: number
          tipo: string
          webhook_url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          id?: number
          tipo?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_webhooks_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_manual: {
        Row: {
          atualizado_em: string | null
          categoria: string
          categoria_macro: string
          criado_em: string | null
          data_competencia: string
          descricao: string
          id: number
          observacoes: string | null
          usuario_criacao: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          categoria: string
          categoria_macro: string
          criado_em?: string | null
          data_competencia: string
          descricao: string
          id?: number
          observacoes?: string | null
          usuario_criacao?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          categoria?: string
          categoria_macro?: string
          criado_em?: string | null
          data_competencia?: string
          descricao?: string
          id?: number
          observacoes?: string | null
          usuario_criacao?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_dre_manual_categoria"
            columns: ["categoria"]
            isOneToOne: false
            referencedRelation: "nibo_categorias"
            referencedColumns: ["categoria_nome"]
          },
        ]
      }
      empresa_usuarios: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          perfil: string | null
          usuario_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          perfil?: string | null
          usuario_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          perfil?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ambiente_fiscal: string | null
          ativo: boolean | null
          certificado_digital: string | null
          certificado_senha: string | null
          cnpj: string
          created_at: string | null
          csc_id: string | null
          csc_token: string | null
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          nome_fantasia: string | null
          numero_nfce: number | null
          razao_social: string
          regime_tributario: string | null
          serie_nfce: number | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ambiente_fiscal?: string | null
          ativo?: boolean | null
          certificado_digital?: string | null
          certificado_senha?: string | null
          cnpj: string
          created_at?: string | null
          csc_id?: string | null
          csc_token?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome_fantasia?: string | null
          numero_nfce?: number | null
          razao_social: string
          regime_tributario?: string | null
          serie_nfce?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ambiente_fiscal?: string | null
          ativo?: boolean | null
          certificado_digital?: string | null
          certificado_senha?: string | null
          cnpj?: string
          created_at?: string | null
          csc_id?: string | null
          csc_token?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome_fantasia?: string | null
          numero_nfce?: number | null
          razao_social?: string
          regime_tributario?: string | null
          serie_nfce?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      estoque_alertas: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          lido: boolean | null
          mensagem: string
          produto_id: string
          resolvido: boolean | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          lido?: boolean | null
          mensagem: string
          produto_id: string
          resolvido?: boolean | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          lido?: boolean | null
          mensagem?: string
          produto_id?: string
          resolvido?: boolean | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_alertas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_insumos: {
        Row: {
          bar_id: number
          categoria: string
          codigo: string
          created_at: string | null
          custo_total: number | null
          custo_unitario: number | null
          data_contagem: string
          descricao: string
          diferenca: number | null
          entrada: number | null
          estoque_anterior: number | null
          estoque_atual: number
          estoque_final: number | null
          estoque_inicial: number | null
          estoque_teorico: number | null
          id: number
          observacoes: string | null
          preco_unitario: number | null
          produto: string | null
          responsavel_contagem: string | null
          saida: number | null
          status: string | null
          subcategoria: string | null
          unidade_medida: string
          updated_at: string | null
          usuario_contagem: string | null
          valor_estoque: number | null
        }
        Insert: {
          bar_id: number
          categoria: string
          codigo: string
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          data_contagem: string
          descricao: string
          diferenca?: number | null
          entrada?: number | null
          estoque_anterior?: number | null
          estoque_atual: number
          estoque_final?: number | null
          estoque_inicial?: number | null
          estoque_teorico?: number | null
          id?: number
          observacoes?: string | null
          preco_unitario?: number | null
          produto?: string | null
          responsavel_contagem?: string | null
          saida?: number | null
          status?: string | null
          subcategoria?: string | null
          unidade_medida: string
          updated_at?: string | null
          usuario_contagem?: string | null
          valor_estoque?: number | null
        }
        Update: {
          bar_id?: number
          categoria?: string
          codigo?: string
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          data_contagem?: string
          descricao?: string
          diferenca?: number | null
          entrada?: number | null
          estoque_anterior?: number | null
          estoque_atual?: number
          estoque_final?: number | null
          estoque_inicial?: number | null
          estoque_teorico?: number | null
          id?: number
          observacoes?: string | null
          preco_unitario?: number | null
          produto?: string | null
          responsavel_contagem?: string | null
          saida?: number | null
          status?: string | null
          subcategoria?: string | null
          unidade_medida?: string
          updated_at?: string | null
          usuario_contagem?: string | null
          valor_estoque?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_insumos_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          comanda_id: string | null
          created_at: string | null
          custo_total: number | null
          custo_unitario: number | null
          documento: string | null
          empresa_id: string
          estoque_anterior: number
          estoque_posterior: number
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          comanda_id?: string | null
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          documento?: string | null
          empresa_id: string
          estoque_anterior: number
          estoque_posterior: number
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade: number
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          comanda_id?: string | null
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          documento?: string | null
          empresa_id?: string
          estoque_anterior?: number
          estoque_posterior?: number
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_base: {
        Row: {
          artista: string | null
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number
          c_art: number | null
          c_artistico_plan: number | null
          c_prod: number | null
          calculado_em: string | null
          capacidade_estimada: number | null
          cl_plan: number | null
          cl_real: number | null
          criado_em: string | null
          data_evento: string
          dia_semana: string | null
          fat_19h: number | null
          fat_19h_percent: number | null
          faturamento_bar: number | null
          faturamento_bar_manual: number | null
          faturamento_couvert: number | null
          faturamento_couvert_manual: number | null
          faturamento_liquido: number | null
          genero: string | null
          id: number
          lot_max: number | null
          m1_r: number | null
          nome: string
          nome_evento: string | null
          observacoes: string | null
          percent_art_fat: number | null
          percent_b: number | null
          percent_c: number | null
          percent_d: number | null
          percent_stockout: number | null
          precisa_recalculo: boolean | null
          publico_real: number | null
          real_r: number | null
          res_p: number | null
          res_tot: number | null
          semana: number | null
          sympla_checkins: number | null
          sympla_liquido: number | null
          t_bar: number | null
          t_coz: number | null
          t_medio: number | null
          tb_plan: number | null
          tb_real: number | null
          tb_real_calculado: number | null
          te_plan: number | null
          te_real: number | null
          te_real_calculado: number | null
          versao_calculo: number | null
          yuzer_ingressos: number | null
          yuzer_liquido: number | null
        }
        Insert: {
          artista?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id: number
          c_art?: number | null
          c_artistico_plan?: number | null
          c_prod?: number | null
          calculado_em?: string | null
          capacidade_estimada?: number | null
          cl_plan?: number | null
          cl_real?: number | null
          criado_em?: string | null
          data_evento: string
          dia_semana?: string | null
          fat_19h?: number | null
          fat_19h_percent?: number | null
          faturamento_bar?: number | null
          faturamento_bar_manual?: number | null
          faturamento_couvert?: number | null
          faturamento_couvert_manual?: number | null
          faturamento_liquido?: number | null
          genero?: string | null
          id?: number
          lot_max?: number | null
          m1_r?: number | null
          nome: string
          nome_evento?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          percent_stockout?: number | null
          precisa_recalculo?: boolean | null
          publico_real?: number | null
          real_r?: number | null
          res_p?: number | null
          res_tot?: number | null
          semana?: number | null
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          t_bar?: number | null
          t_coz?: number | null
          t_medio?: number | null
          tb_plan?: number | null
          tb_real?: number | null
          tb_real_calculado?: number | null
          te_plan?: number | null
          te_real?: number | null
          te_real_calculado?: number | null
          versao_calculo?: number | null
          yuzer_ingressos?: number | null
          yuzer_liquido?: number | null
        }
        Update: {
          artista?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number
          c_art?: number | null
          c_artistico_plan?: number | null
          c_prod?: number | null
          calculado_em?: string | null
          capacidade_estimada?: number | null
          cl_plan?: number | null
          cl_real?: number | null
          criado_em?: string | null
          data_evento?: string
          dia_semana?: string | null
          fat_19h?: number | null
          fat_19h_percent?: number | null
          faturamento_bar?: number | null
          faturamento_bar_manual?: number | null
          faturamento_couvert?: number | null
          faturamento_couvert_manual?: number | null
          faturamento_liquido?: number | null
          genero?: string | null
          id?: number
          lot_max?: number | null
          m1_r?: number | null
          nome?: string
          nome_evento?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          percent_stockout?: number | null
          precisa_recalculo?: boolean | null
          publico_real?: number | null
          real_r?: number | null
          res_p?: number | null
          res_tot?: number | null
          semana?: number | null
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          t_bar?: number | null
          t_coz?: number | null
          t_medio?: number | null
          tb_plan?: number | null
          tb_real?: number | null
          tb_real_calculado?: number | null
          te_plan?: number | null
          te_real?: number | null
          te_real_calculado?: number | null
          versao_calculo?: number | null
          yuzer_ingressos?: number | null
          yuzer_liquido?: number | null
        }
        Relationships: []
      }
      eventos_base_auditoria: {
        Row: {
          bar_id: number
          campo_alterado: string
          data_alteracao: string | null
          data_evento: string
          evento_id: number
          funcao_origem: string | null
          id: number
          metadata: Json | null
          motivo: string | null
          nome: string | null
          usuario_id: number | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          bar_id: number
          campo_alterado: string
          data_alteracao?: string | null
          data_evento: string
          evento_id: number
          funcao_origem?: string | null
          id?: number
          metadata?: Json | null
          motivo?: string | null
          nome?: string | null
          usuario_id?: number | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          bar_id?: number
          campo_alterado?: string
          data_alteracao?: string | null
          data_evento?: string
          evento_id?: number
          funcao_origem?: string | null
          id?: number
          metadata?: Json | null
          motivo?: string | null
          nome?: string | null
          usuario_id?: number | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_base_auditoria_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "analytics_cruzamento_completo"
            referencedColumns: ["evento_id"]
          },
          {
            foreignKeyName: "eventos_base_auditoria_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "analytics_score_preditivo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_base_auditoria_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_base_auditoria_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_base_auditoria_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "pessoas_diario_corrigido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_base_auditoria_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "view_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_cache: {
        Row: {
          artista: string | null
          atualizado_em: string | null
          bar_id: number
          c_art: number | null
          c_art_real: number | null
          c_prod: number | null
          cached_at: string
          casa_show: string | null
          cl_real: number | null
          cont_liquido: number | null
          criado_em: string | null
          custo_producao: number | null
          data_evento: string
          despesas_operacionais: number | null
          dia_semana: string | null
          fat_19h_percent: number | null
          id: number
          liquido_real: number | null
          lot_max: number | null
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_bruto: number | null
          margem_liquido: number | null
          nome: string | null
          observacoes: string | null
          percent_art_fat: number | null
          percent_b: number | null
          percent_c: number | null
          percent_d: number | null
          promoter: string | null
          publico_esperado: number | null
          real_r: number | null
          receita_bar: number | null
          receita_garantida: number | null
          receita_total: number | null
          status: string | null
          sympla_checkins: number | null
          sympla_liquido: number | null
          sympla_participantes: number | null
          sympla_total_pedidos: number | null
          t_bar: number | null
          t_coz: number | null
          tb_real: number | null
          te_real: number | null
          tipo_evento: string | null
        }
        Insert: {
          artista?: string | null
          atualizado_em?: string | null
          bar_id: number
          c_art?: number | null
          c_art_real?: number | null
          c_prod?: number | null
          cached_at?: string
          casa_show?: string | null
          cl_real?: number | null
          cont_liquido?: number | null
          criado_em?: string | null
          custo_producao?: number | null
          data_evento: string
          despesas_operacionais?: number | null
          dia_semana?: string | null
          fat_19h_percent?: number | null
          id: number
          liquido_real?: number | null
          lot_max?: number | null
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_bruto?: number | null
          margem_liquido?: number | null
          nome?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          promoter?: string | null
          publico_esperado?: number | null
          real_r?: number | null
          receita_bar?: number | null
          receita_garantida?: number | null
          receita_total?: number | null
          status?: string | null
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          sympla_participantes?: number | null
          sympla_total_pedidos?: number | null
          t_bar?: number | null
          t_coz?: number | null
          tb_real?: number | null
          te_real?: number | null
          tipo_evento?: string | null
        }
        Update: {
          artista?: string | null
          atualizado_em?: string | null
          bar_id?: number
          c_art?: number | null
          c_art_real?: number | null
          c_prod?: number | null
          cached_at?: string
          casa_show?: string | null
          cl_real?: number | null
          cont_liquido?: number | null
          criado_em?: string | null
          custo_producao?: number | null
          data_evento?: string
          despesas_operacionais?: number | null
          dia_semana?: string | null
          fat_19h_percent?: number | null
          id?: number
          liquido_real?: number | null
          lot_max?: number | null
          lucro_bruto?: number | null
          lucro_liquido?: number | null
          margem_bruto?: number | null
          margem_liquido?: number | null
          nome?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          promoter?: string | null
          publico_esperado?: number | null
          real_r?: number | null
          receita_bar?: number | null
          receita_garantida?: number | null
          receita_total?: number | null
          status?: string | null
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          sympla_participantes?: number | null
          sympla_total_pedidos?: number | null
          t_bar?: number | null
          t_coz?: number | null
          tb_real?: number | null
          te_real?: number | null
          tipo_evento?: string | null
        }
        Relationships: []
      }
      eventos_concorrencia: {
        Row: {
          cidade: string | null
          created_at: string | null
          data_evento: string
          descricao: string | null
          encontrado_em: string | null
          fonte: string
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          id_externo: string | null
          imagem_url: string | null
          impacto: string | null
          local_endereco: string | null
          local_nome: string
          nome: string
          notas: string | null
          preco_maximo: number | null
          preco_minimo: number | null
          status: string | null
          tipo: string
          updated_at: string | null
          url_fonte: string | null
          verificado: boolean | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string | null
          data_evento: string
          descricao?: string | null
          encontrado_em?: string | null
          fonte: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          id_externo?: string | null
          imagem_url?: string | null
          impacto?: string | null
          local_endereco?: string | null
          local_nome: string
          nome: string
          notas?: string | null
          preco_maximo?: number | null
          preco_minimo?: number | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          url_fonte?: string | null
          verificado?: boolean | null
        }
        Update: {
          cidade?: string | null
          created_at?: string | null
          data_evento?: string
          descricao?: string | null
          encontrado_em?: string | null
          fonte?: string
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          id_externo?: string | null
          imagem_url?: string | null
          impacto?: string | null
          local_endereco?: string | null
          local_nome?: string
          nome?: string
          notas?: string | null
          preco_maximo?: number | null
          preco_minimo?: number | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          url_fonte?: string | null
          verificado?: boolean | null
        }
        Relationships: []
      }
      execucoes_automaticas: {
        Row: {
          created_at: string | null
          data_execucao: string
          erro: string | null
          hora_execucao: string
          id: number
          resultado: Json | null
          status: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_execucao: string
          erro?: string | null
          hora_execucao: string
          id?: number
          resultado?: Json | null
          status?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_execucao?: string
          erro?: string | null
          hora_execucao?: string
          id?: number
          resultado?: Json | null
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      falae_config: {
        Row: {
          api_key: string
          bar_id: number
          company_id: string | null
          created_at: string | null
          enabled: boolean | null
          id: number
          last_sync_at: string | null
          search_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_key: string
          bar_id: number
          company_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: number
          last_sync_at?: string | null
          search_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          bar_id?: number
          company_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: number
          last_sync_at?: string | null
          search_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "falae_config_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      falae_respostas: {
        Row: {
          bar_id: number
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          consumption_id: string | null
          created_at: string
          criterios: Json | null
          discursive_question: string | null
          falae_id: string
          id: string
          nps: number
          order_id: string | null
          raw_data: Json | null
          search_id: string | null
          search_name: string | null
          synced_at: string | null
        }
        Insert: {
          bar_id: number
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          consumption_id?: string | null
          created_at: string
          criterios?: Json | null
          discursive_question?: string | null
          falae_id: string
          id?: string
          nps: number
          order_id?: string | null
          raw_data?: Json | null
          search_id?: string | null
          search_name?: string | null
          synced_at?: string | null
        }
        Update: {
          bar_id?: number
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          consumption_id?: string | null
          created_at?: string
          criterios?: Json | null
          discursive_question?: string | null
          falae_id?: string
          id?: string
          nps?: number
          order_id?: string | null
          raw_data?: Json | null
          search_id?: string | null
          search_name?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "falae_respostas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_artistas: {
        Row: {
          artista_nome: string
          banheiro_satisfacao: string | null
          bar_id: number
          camarim_localizacao: string | null
          camarim_satisfacao: string | null
          coletado_por: string | null
          created_at: string | null
          data_feedback: string
          elogios: string | null
          fechamento_cego_necessario: boolean | null
          feedback_texto: string | null
          id: number
          prioridade: number | null
          problemas_identificados: string | null
          seguranca_necessaria: boolean | null
          status: string | null
          sugestoes: string | null
          updated_at: string | null
        }
        Insert: {
          artista_nome: string
          banheiro_satisfacao?: string | null
          bar_id?: number
          camarim_localizacao?: string | null
          camarim_satisfacao?: string | null
          coletado_por?: string | null
          created_at?: string | null
          data_feedback?: string
          elogios?: string | null
          fechamento_cego_necessario?: boolean | null
          feedback_texto?: string | null
          id?: number
          prioridade?: number | null
          problemas_identificados?: string | null
          seguranca_necessaria?: boolean | null
          status?: string | null
          sugestoes?: string | null
          updated_at?: string | null
        }
        Update: {
          artista_nome?: string
          banheiro_satisfacao?: string | null
          bar_id?: number
          camarim_localizacao?: string | null
          camarim_satisfacao?: string | null
          coletado_por?: string | null
          created_at?: string | null
          data_feedback?: string
          elogios?: string | null
          fechamento_cego_necessario?: boolean | null
          feedback_texto?: string | null
          id?: number
          prioridade?: number | null
          problemas_identificados?: string | null
          seguranca_necessaria?: boolean | null
          status?: string | null
          sugestoes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_artistas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento: {
        Row: {
          adicionais: number | null
          adicional_noturno: number | null
          ano: number
          atualizado_em: string | null
          aviso_previo: number | null
          bar_id: number
          criado_em: string | null
          custo_empresa: number | null
          desc_vale_transporte: number | null
          dias_trabalhados: number | null
          drs_noturno: number | null
          estimativa: number | null
          fgts: number | null
          funcionario_id: number
          id: number
          inss: number | null
          inss_empresa: number | null
          ir: number | null
          mensalidade_sindical: number | null
          mes: number
          observacoes: string | null
          produtividade: number | null
          provisao_certa: number | null
          salario_bruto: number | null
          salario_liquido: number | null
          tempo_casa: number | null
          vale_transporte: number | null
        }
        Insert: {
          adicionais?: number | null
          adicional_noturno?: number | null
          ano: number
          atualizado_em?: string | null
          aviso_previo?: number | null
          bar_id: number
          criado_em?: string | null
          custo_empresa?: number | null
          desc_vale_transporte?: number | null
          dias_trabalhados?: number | null
          drs_noturno?: number | null
          estimativa?: number | null
          fgts?: number | null
          funcionario_id: number
          id?: number
          inss?: number | null
          inss_empresa?: number | null
          ir?: number | null
          mensalidade_sindical?: number | null
          mes: number
          observacoes?: string | null
          produtividade?: number | null
          provisao_certa?: number | null
          salario_bruto?: number | null
          salario_liquido?: number | null
          tempo_casa?: number | null
          vale_transporte?: number | null
        }
        Update: {
          adicionais?: number | null
          adicional_noturno?: number | null
          ano?: number
          atualizado_em?: string | null
          aviso_previo?: number | null
          bar_id?: number
          criado_em?: string | null
          custo_empresa?: number | null
          desc_vale_transporte?: number | null
          dias_trabalhados?: number | null
          drs_noturno?: number | null
          estimativa?: number | null
          fgts?: number | null
          funcionario_id?: number
          id?: number
          inss?: number | null
          inss_empresa?: number | null
          ir?: number | null
          mensalidade_sindical?: number | null
          mes?: number
          observacoes?: string | null
          produtividade?: number | null
          provisao_certa?: number | null
          salario_bruto?: number | null
          salario_liquido?: number | null
          tempo_casa?: number | null
          vale_transporte?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          nome: string
          prazo_recebimento: number | null
          taxa: number | null
          tef_habilitado: boolean | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          prazo_recebimento?: number | null
          taxa?: number | null
          tef_habilitado?: boolean | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          prazo_recebimento?: number | null
          taxa?: number | null
          tef_habilitado?: boolean | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fp_categoria_pluggy_mapping: {
        Row: {
          created_at: string | null
          id: string
          nossa_categoria_id: string
          pluggy_category_id: string
          pluggy_category_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nossa_categoria_id: string
          pluggy_category_id: string
          pluggy_category_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nossa_categoria_id?: string
          pluggy_category_id?: string
          pluggy_category_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fp_categoria_pluggy_mapping_nossa_categoria_id_fkey"
            columns: ["nossa_categoria_id"]
            isOneToOne: false
            referencedRelation: "fp_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fp_categorias: {
        Row: {
          ativa: boolean | null
          categoria_pai: string | null
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string | null
          usuario_cpf: string
        }
        Insert: {
          ativa?: boolean | null
          categoria_pai?: string | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string | null
          usuario_cpf: string
        }
        Update: {
          ativa?: boolean | null
          categoria_pai?: string | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
          usuario_cpf?: string
        }
        Relationships: [
          {
            foreignKeyName: "fp_categorias_categoria_pai_fkey"
            columns: ["categoria_pai"]
            isOneToOne: false
            referencedRelation: "fp_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fp_categorias_template: {
        Row: {
          categoria_pai_nome: string | null
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          categoria_pai_nome?: string | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          categoria_pai_nome?: string | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      fp_contas: {
        Row: {
          ativa: boolean | null
          banco: string
          cor: string | null
          created_at: string | null
          id: string
          nome: string
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo: string
          updated_at: string | null
          usuario_cpf: string
        }
        Insert: {
          ativa?: boolean | null
          banco: string
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo: string
          updated_at?: string | null
          usuario_cpf: string
        }
        Update: {
          ativa?: boolean | null
          banco?: string
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo?: string
          updated_at?: string | null
          usuario_cpf?: string
        }
        Relationships: []
      }
      fp_pluggy_items: {
        Row: {
          ativo: boolean | null
          banco_nome: string
          connector_id: string | null
          connector_name: string | null
          conta_id: string | null
          created_at: string | null
          erro_mensagem: string | null
          id: string
          pluggy_connector_id: string
          pluggy_item_id: string
          status: string | null
          ultima_sincronizacao: string | null
          updated_at: string | null
          usuario_cpf: string
        }
        Insert: {
          ativo?: boolean | null
          banco_nome: string
          connector_id?: string | null
          connector_name?: string | null
          conta_id?: string | null
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          pluggy_connector_id: string
          pluggy_item_id: string
          status?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string | null
          usuario_cpf: string
        }
        Update: {
          ativo?: boolean | null
          banco_nome?: string
          connector_id?: string | null
          connector_name?: string | null
          conta_id?: string | null
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          pluggy_connector_id?: string
          pluggy_item_id?: string
          status?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string | null
          usuario_cpf?: string
        }
        Relationships: [
          {
            foreignKeyName: "fp_pluggy_items_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fp_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fp_pluggy_sync_log: {
        Row: {
          created_at: string | null
          erro_mensagem: string | null
          id: string
          pluggy_item_id: string
          status: string
          transacoes_duplicadas: number | null
          transacoes_importadas: number | null
        }
        Insert: {
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          pluggy_item_id: string
          status: string
          transacoes_duplicadas?: number | null
          transacoes_importadas?: number | null
        }
        Update: {
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          pluggy_item_id?: string
          status?: string
          transacoes_duplicadas?: number | null
          transacoes_importadas?: number | null
        }
        Relationships: []
      }
      fp_pluggy_webhooks: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string
          id: string
          item_id: string | null
          payload: Json
          processed: boolean | null
          processed_at: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
        }
        Relationships: []
      }
      fp_regras_categoria: {
        Row: {
          ativa: boolean | null
          categoria_id: string
          created_at: string | null
          id: string
          palavra_chave: string
          prioridade: number | null
          updated_at: string | null
          usuario_cpf: string
        }
        Insert: {
          ativa?: boolean | null
          categoria_id: string
          created_at?: string | null
          id?: string
          palavra_chave: string
          prioridade?: number | null
          updated_at?: string | null
          usuario_cpf: string
        }
        Update: {
          ativa?: boolean | null
          categoria_id?: string
          created_at?: string | null
          id?: string
          palavra_chave?: string
          prioridade?: number | null
          updated_at?: string | null
          usuario_cpf?: string
        }
        Relationships: [
          {
            foreignKeyName: "fp_regras_categoria_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fp_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fp_transacoes: {
        Row: {
          categoria_id: string | null
          conta_id: string
          created_at: string | null
          data: string
          data_processamento: string | null
          descricao: string
          hash_original: string | null
          id: string
          observacoes: string | null
          origem_importacao: string | null
          pluggy_category_id: string | null
          pluggy_category_name: string | null
          pluggy_transaction_id: string | null
          status: string | null
          tags: string[] | null
          tipo: string
          updated_at: string | null
          usuario_cpf: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          conta_id: string
          created_at?: string | null
          data: string
          data_processamento?: string | null
          descricao: string
          hash_original?: string | null
          id?: string
          observacoes?: string | null
          origem_importacao?: string | null
          pluggy_category_id?: string | null
          pluggy_category_name?: string | null
          pluggy_transaction_id?: string | null
          status?: string | null
          tags?: string[] | null
          tipo: string
          updated_at?: string | null
          usuario_cpf: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          conta_id?: string
          created_at?: string | null
          data?: string
          data_processamento?: string | null
          descricao?: string
          hash_original?: string | null
          id?: string
          observacoes?: string | null
          origem_importacao?: string | null
          pluggy_category_id?: string | null
          pluggy_category_name?: string | null
          pluggy_transaction_id?: string | null
          status?: string | null
          tags?: string[] | null
          tipo?: string
          updated_at?: string | null
          usuario_cpf?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fp_transacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fp_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fp_transacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fp_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          area_id: number | null
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number
          cargo_id: number | null
          cpf: string | null
          criado_em: string | null
          data_admissao: string | null
          data_demissao: string | null
          dias_trabalho_semana: number | null
          email: string | null
          id: number
          nome: string
          observacoes: string | null
          salario_base: number | null
          telefone: string | null
          tipo_contratacao: string
          vale_transporte_diaria: number | null
        }
        Insert: {
          area_id?: number | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id: number
          cargo_id?: number | null
          cpf?: string | null
          criado_em?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          dias_trabalho_semana?: number | null
          email?: string | null
          id?: number
          nome: string
          observacoes?: string | null
          salario_base?: number | null
          telefone?: string | null
          tipo_contratacao?: string
          vale_transporte_diaria?: number | null
        }
        Update: {
          area_id?: number | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number
          cargo_id?: number | null
          cpf?: string | null
          criado_em?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          dias_trabalho_semana?: number | null
          email?: string | null
          id?: number
          nome?: string
          observacoes?: string | null
          salario_base?: number | null
          telefone?: string | null
          tipo_contratacao?: string
          vale_transporte_diaria?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "vw_cmo_por_area"
            referencedColumns: ["area_id"]
          },
          {
            foreignKeyName: "funcionarios_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      getin_reservations: {
        Row: {
          bar_id: number | null
          confirmation_sent: boolean | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number | null
          id: number
          info: string | null
          no_show: boolean | null
          no_show_eligible: boolean | null
          no_show_hours: number | null
          no_show_tax: number | null
          nps_answered: boolean | null
          nps_url: string | null
          people: number | null
          raw_data: Json | null
          reservation_date: string | null
          reservation_id: string
          reservation_time: string | null
          sector_id: string | null
          sector_name: string | null
          status: string | null
          unit_city_name: string | null
          unit_coordinates_lat: number | null
          unit_coordinates_lng: number | null
          unit_cover_image: string | null
          unit_cuisine_name: string | null
          unit_full_address: string | null
          unit_id: string | null
          unit_name: string | null
          unit_profile_image: string | null
          unit_zipcode: string | null
          updated_at: string | null
        }
        Insert: {
          bar_id?: number | null
          confirmation_sent?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number | null
          id?: number
          info?: string | null
          no_show?: boolean | null
          no_show_eligible?: boolean | null
          no_show_hours?: number | null
          no_show_tax?: number | null
          nps_answered?: boolean | null
          nps_url?: string | null
          people?: number | null
          raw_data?: Json | null
          reservation_date?: string | null
          reservation_id: string
          reservation_time?: string | null
          sector_id?: string | null
          sector_name?: string | null
          status?: string | null
          unit_city_name?: string | null
          unit_coordinates_lat?: number | null
          unit_coordinates_lng?: number | null
          unit_cover_image?: string | null
          unit_cuisine_name?: string | null
          unit_full_address?: string | null
          unit_id?: string | null
          unit_name?: string | null
          unit_profile_image?: string | null
          unit_zipcode?: string | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number | null
          confirmation_sent?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number | null
          id?: number
          info?: string | null
          no_show?: boolean | null
          no_show_eligible?: boolean | null
          no_show_hours?: number | null
          no_show_tax?: number | null
          nps_answered?: boolean | null
          nps_url?: string | null
          people?: number | null
          raw_data?: Json | null
          reservation_date?: string | null
          reservation_id?: string
          reservation_time?: string | null
          sector_id?: string | null
          sector_name?: string | null
          status?: string | null
          unit_city_name?: string | null
          unit_coordinates_lat?: number | null
          unit_coordinates_lng?: number | null
          unit_cover_image?: string | null
          unit_cuisine_name?: string | null
          unit_full_address?: string | null
          unit_id?: string | null
          unit_name?: string | null
          unit_profile_image?: string | null
          unit_zipcode?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "getin_reservations_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      getin_sync_logs: {
        Row: {
          created_at: string | null
          detalhes: Json | null
          id: number
          reservas_atualizadas: number | null
          reservas_extraidas: number | null
          reservas_novas: number | null
          status: string
          timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          detalhes?: Json | null
          id?: number
          reservas_atualizadas?: number | null
          reservas_extraidas?: number | null
          reservas_novas?: number | null
          status: string
          timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          detalhes?: Json | null
          id?: number
          reservas_atualizadas?: number | null
          reservas_extraidas?: number | null
          reservas_novas?: number | null
          status?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      getin_units: {
        Row: {
          about: string | null
          address: string | null
          amenities: Json | null
          bar_id: number | null
          city_slug: string | null
          complement: string | null
          coordinates_lat: number | null
          coordinates_lng: number | null
          cover_image: string | null
          created_at: string | null
          cuisine_name: string | null
          full_address: string | null
          id: number
          name: string | null
          neighborhood: string | null
          number: string | null
          opening_hours_description: string | null
          payment_description: string | null
          price_range: string | null
          price_range_description: string | null
          profile_image: string | null
          raw_data: Json | null
          reservation_config: Json | null
          slug: string | null
          telephone: string | null
          timezone: string | null
          unit_id: string
          updated_at: string | null
          website: string | null
          zipcode: string | null
        }
        Insert: {
          about?: string | null
          address?: string | null
          amenities?: Json | null
          bar_id?: number | null
          city_slug?: string | null
          complement?: string | null
          coordinates_lat?: number | null
          coordinates_lng?: number | null
          cover_image?: string | null
          created_at?: string | null
          cuisine_name?: string | null
          full_address?: string | null
          id?: number
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          opening_hours_description?: string | null
          payment_description?: string | null
          price_range?: string | null
          price_range_description?: string | null
          profile_image?: string | null
          raw_data?: Json | null
          reservation_config?: Json | null
          slug?: string | null
          telephone?: string | null
          timezone?: string | null
          unit_id: string
          updated_at?: string | null
          website?: string | null
          zipcode?: string | null
        }
        Update: {
          about?: string | null
          address?: string | null
          amenities?: Json | null
          bar_id?: number | null
          city_slug?: string | null
          complement?: string | null
          coordinates_lat?: number | null
          coordinates_lng?: number | null
          cover_image?: string | null
          created_at?: string | null
          cuisine_name?: string | null
          full_address?: string | null
          id?: number
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          opening_hours_description?: string | null
          payment_description?: string | null
          price_range?: string | null
          price_range_description?: string | null
          profile_image?: string | null
          raw_data?: Json | null
          reservation_config?: Json | null
          slug?: string | null
          telephone?: string | null
          timezone?: string | null
          unit_id?: string
          updated_at?: string | null
          website?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "getin_units_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens: {
        Row: {
          access_token: string | null
          account_id: string | null
          bar_id: number | null
          created_at: string | null
          expires_at: string | null
          id: number
          location_id: string | null
          refresh_token: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          bar_id?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          location_id?: string | null
          refresh_token?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          bar_id?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          location_id?: string | null
          refresh_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_tokens_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      google_reviews: {
        Row: {
          address: string | null
          bar_id: number | null
          city: string | null
          country_code: string | null
          created_at: string | null
          id: number
          is_local_guide: boolean | null
          latitude: number | null
          likes_count: number | null
          longitude: number | null
          neighborhood: string | null
          original_language: string | null
          place_id: string | null
          place_reviews_count: number | null
          place_title: string | null
          place_total_score: number | null
          publish_at: string | null
          published_at_date: string | null
          rating_atmosphere: number | null
          rating_food: number | null
          rating_service: number | null
          response_from_owner_date: string | null
          response_from_owner_text: string | null
          review_context: Json | null
          review_id: string
          review_image_urls: string[] | null
          review_origin: string | null
          review_url: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          reviewer_number_of_reviews: number | null
          reviewer_photo_url: string | null
          reviewer_url: string | null
          scraped_at: string | null
          source: string | null
          stars: number | null
          state: string | null
          text: string | null
          text_translated: string | null
          translated_language: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bar_id?: number | null
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: number
          is_local_guide?: boolean | null
          latitude?: number | null
          likes_count?: number | null
          longitude?: number | null
          neighborhood?: string | null
          original_language?: string | null
          place_id?: string | null
          place_reviews_count?: number | null
          place_title?: string | null
          place_total_score?: number | null
          publish_at?: string | null
          published_at_date?: string | null
          rating_atmosphere?: number | null
          rating_food?: number | null
          rating_service?: number | null
          response_from_owner_date?: string | null
          response_from_owner_text?: string | null
          review_context?: Json | null
          review_id: string
          review_image_urls?: string[] | null
          review_origin?: string | null
          review_url?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_number_of_reviews?: number | null
          reviewer_photo_url?: string | null
          reviewer_url?: string | null
          scraped_at?: string | null
          source?: string | null
          stars?: number | null
          state?: string | null
          text?: string | null
          text_translated?: string | null
          translated_language?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bar_id?: number | null
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: number
          is_local_guide?: boolean | null
          latitude?: number | null
          likes_count?: number | null
          longitude?: number | null
          neighborhood?: string | null
          original_language?: string | null
          place_id?: string | null
          place_reviews_count?: number | null
          place_title?: string | null
          place_total_score?: number | null
          publish_at?: string | null
          published_at_date?: string | null
          rating_atmosphere?: number | null
          rating_food?: number | null
          rating_service?: number | null
          response_from_owner_date?: string | null
          response_from_owner_text?: string | null
          review_context?: Json | null
          review_id?: string
          review_image_urls?: string[] | null
          review_origin?: string | null
          review_url?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          reviewer_number_of_reviews?: number | null
          reviewer_photo_url?: string | null
          reviewer_url?: string | null
          scraped_at?: string | null
          source?: string | null
          stars?: number | null
          state?: string | null
          text?: string | null
          text_translated?: string | null
          translated_language?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_reviews_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          empresa_id: string
          id: string
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grupos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          ativo: boolean | null
          bar_id: number
          categoria: string | null
          codigo: string
          created_at: string | null
          custo_unitario: number | null
          id: number
          nome: string
          observacoes: string | null
          tipo_local: string | null
          unidade_medida: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bar_id?: number
          categoria?: string | null
          codigo: string
          created_at?: string | null
          custo_unitario?: number | null
          id?: number
          nome: string
          observacoes?: string | null
          tipo_local?: string | null
          unidade_medida?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bar_id?: number
          categoria?: string | null
          codigo?: string
          created_at?: string | null
          custo_unitario?: number | null
          id?: number
          nome?: string
          observacoes?: string | null
          tipo_local?: string | null
          unidade_medida?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      insumos_historico: {
        Row: {
          bar_id: number
          categoria: string | null
          codigo: string
          created_at: string | null
          custo_unitario: number | null
          data_atualizacao: string | null
          id: number
          insumo_id: number
          nome: string
          observacoes: string | null
          origem: string | null
          tipo_local: string | null
          unidade_medida: string | null
          usuario_id: string | null
          versao: string
        }
        Insert: {
          bar_id: number
          categoria?: string | null
          codigo: string
          created_at?: string | null
          custo_unitario?: number | null
          data_atualizacao?: string | null
          id?: number
          insumo_id: number
          nome: string
          observacoes?: string | null
          origem?: string | null
          tipo_local?: string | null
          unidade_medida?: string | null
          usuario_id?: string | null
          versao: string
        }
        Update: {
          bar_id?: number
          categoria?: string | null
          codigo?: string
          created_at?: string | null
          custo_unitario?: number | null
          data_atualizacao?: string | null
          id?: number
          insumo_id?: number
          nome?: string
          observacoes?: string | null
          origem?: string | null
          tipo_local?: string | null
          unidade_medida?: string | null
          usuario_id?: string | null
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_historico_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_audit_log: {
        Row: {
          action: string | null
          created_at: string | null
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      logs_sistema: {
        Row: {
          created_at: string | null
          id: number
          log_type: string | null
          message: string | null
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          log_type?: string | null
          message?: string | null
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: number
          log_type?: string | null
          message?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      marketing_semanal: {
        Row: {
          ano: number
          bar_id: number
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          fonte: string | null
          g_click_reservas: number | null
          g_cliques: number | null
          g_cpc: number | null
          g_ctr: number | null
          g_impressoes: number | null
          g_ligacoes: number | null
          g_solicitacoes_rotas: number | null
          g_valor_investido: number | null
          gmn_cliques_website: number | null
          gmn_ligacoes: number | null
          gmn_menu_views: number | null
          gmn_solicitacoes_rotas: number | null
          gmn_total_acoes: number | null
          gmn_total_visualizacoes: number | null
          gmn_visu_maps: number | null
          gmn_visu_pesquisa: number | null
          id: number
          m_alcance: number | null
          m_cliques: number | null
          m_conversas_iniciadas: number | null
          m_cpc: number | null
          m_cpm: number | null
          m_ctr: number | null
          m_frequencia: number | null
          m_impressoes: number | null
          m_reproducoes_25: number | null
          m_reproducoes_75: number | null
          m_valor_investido: number | null
          o_alcance: number | null
          o_comentarios: number | null
          o_compartilhamento: number | null
          o_curtidas: number | null
          o_engajamento: number | null
          o_interacao: number | null
          o_num_posts: number | null
          o_num_stories: number | null
          o_retencao_stories: number | null
          o_salvamentos: number | null
          o_visu_stories: number | null
          semana: number
          updated_at: string | null
        }
        Insert: {
          ano: number
          bar_id: number
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          fonte?: string | null
          g_click_reservas?: number | null
          g_cliques?: number | null
          g_cpc?: number | null
          g_ctr?: number | null
          g_impressoes?: number | null
          g_ligacoes?: number | null
          g_solicitacoes_rotas?: number | null
          g_valor_investido?: number | null
          gmn_cliques_website?: number | null
          gmn_ligacoes?: number | null
          gmn_menu_views?: number | null
          gmn_solicitacoes_rotas?: number | null
          gmn_total_acoes?: number | null
          gmn_total_visualizacoes?: number | null
          gmn_visu_maps?: number | null
          gmn_visu_pesquisa?: number | null
          id?: number
          m_alcance?: number | null
          m_cliques?: number | null
          m_conversas_iniciadas?: number | null
          m_cpc?: number | null
          m_cpm?: number | null
          m_ctr?: number | null
          m_frequencia?: number | null
          m_impressoes?: number | null
          m_reproducoes_25?: number | null
          m_reproducoes_75?: number | null
          m_valor_investido?: number | null
          o_alcance?: number | null
          o_comentarios?: number | null
          o_compartilhamento?: number | null
          o_curtidas?: number | null
          o_engajamento?: number | null
          o_interacao?: number | null
          o_num_posts?: number | null
          o_num_stories?: number | null
          o_retencao_stories?: number | null
          o_salvamentos?: number | null
          o_visu_stories?: number | null
          semana: number
          updated_at?: string | null
        }
        Update: {
          ano?: number
          bar_id?: number
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          fonte?: string | null
          g_click_reservas?: number | null
          g_cliques?: number | null
          g_cpc?: number | null
          g_ctr?: number | null
          g_impressoes?: number | null
          g_ligacoes?: number | null
          g_solicitacoes_rotas?: number | null
          g_valor_investido?: number | null
          gmn_cliques_website?: number | null
          gmn_ligacoes?: number | null
          gmn_menu_views?: number | null
          gmn_solicitacoes_rotas?: number | null
          gmn_total_acoes?: number | null
          gmn_total_visualizacoes?: number | null
          gmn_visu_maps?: number | null
          gmn_visu_pesquisa?: number | null
          id?: number
          m_alcance?: number | null
          m_cliques?: number | null
          m_conversas_iniciadas?: number | null
          m_cpc?: number | null
          m_cpm?: number | null
          m_ctr?: number | null
          m_frequencia?: number | null
          m_impressoes?: number | null
          m_reproducoes_25?: number | null
          m_reproducoes_75?: number | null
          m_valor_investido?: number | null
          o_alcance?: number | null
          o_comentarios?: number | null
          o_compartilhamento?: number | null
          o_curtidas?: number | null
          o_engajamento?: number | null
          o_interacao?: number | null
          o_num_posts?: number | null
          o_num_stories?: number | null
          o_retencao_stories?: number | null
          o_salvamentos?: number | null
          o_visu_stories?: number | null
          semana?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_semanal_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_anuais: {
        Row: {
          ano: number
          bar_id: number | null
          created_at: string | null
          descricao: string | null
          id: number
          mes: number | null
          periodo: string
          tipo_meta: string
          updated_at: string | null
          valor_meta: number
        }
        Insert: {
          ano: number
          bar_id?: number | null
          created_at?: string | null
          descricao?: string | null
          id?: number
          mes?: number | null
          periodo: string
          tipo_meta: string
          updated_at?: string | null
          valor_meta: number
        }
        Update: {
          ano?: number
          bar_id?: number | null
          created_at?: string | null
          descricao?: string | null
          id?: number
          mes?: number | null
          periodo?: string
          tipo_meta?: string
          updated_at?: string | null
          valor_meta?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_anuais_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_caixa: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          motivo: string | null
          tipo: string
          turno_id: string
          usuario_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          id?: string
          motivo?: string | null
          tipo: string
          turno_id: string
          usuario_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          motivo?: string | null
          tipo?: string
          turno_id?: string
          usuario_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      nibo_agendamentos: {
        Row: {
          anexos: Json | null
          atualizado_em: string | null
          atualizado_por_id: string | null
          atualizado_por_nome: string | null
          bar_id: number | null
          bar_nome: string | null
          categoria_id: string | null
          categoria_nome: string | null
          centro_custo_config: Json | null
          centro_custo_id: string | null
          centro_custo_nome: string | null
          conta_bancaria_id: string | null
          conta_bancaria_id_interno: number | null
          conta_bancaria_nome: string | null
          criado_em: string | null
          criado_por_id: string | null
          criado_por_nome: string | null
          data_atualizacao: string | null
          data_competencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          deletado: boolean | null
          descricao: string | null
          frequencia_recorrencia: string | null
          id: number
          inter_codigo_solicitacao: string | null
          inter_data_aprovacao: string | null
          inter_end_to_end_id: string | null
          inter_status: string | null
          inter_webhook_recebido_em: string | null
          nibo_id: string | null
          numero_documento: string | null
          numero_parcela: number | null
          observacoes: string | null
          origem: string | null
          recorrencia_config: Json | null
          recorrente: boolean | null
          sincronizado_nibo: boolean | null
          stakeholder_id: string | null
          stakeholder_id_interno: number | null
          stakeholder_nome: string | null
          stakeholder_tipo: string | null
          status: string
          tags: Json | null
          tipo: string
          titulo: string | null
          total_parcelas: number | null
          usuario_atualizacao: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          anexos?: Json | null
          atualizado_em?: string | null
          atualizado_por_id?: string | null
          atualizado_por_nome?: string | null
          bar_id?: number | null
          bar_nome?: string | null
          categoria_id?: string | null
          categoria_nome?: string | null
          centro_custo_config?: Json | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          conta_bancaria_id?: string | null
          conta_bancaria_id_interno?: number | null
          conta_bancaria_nome?: string | null
          criado_em?: string | null
          criado_por_id?: string | null
          criado_por_nome?: string | null
          data_atualizacao?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean | null
          descricao?: string | null
          frequencia_recorrencia?: string | null
          id?: number
          inter_codigo_solicitacao?: string | null
          inter_data_aprovacao?: string | null
          inter_end_to_end_id?: string | null
          inter_status?: string | null
          inter_webhook_recebido_em?: string | null
          nibo_id?: string | null
          numero_documento?: string | null
          numero_parcela?: number | null
          observacoes?: string | null
          origem?: string | null
          recorrencia_config?: Json | null
          recorrente?: boolean | null
          sincronizado_nibo?: boolean | null
          stakeholder_id?: string | null
          stakeholder_id_interno?: number | null
          stakeholder_nome?: string | null
          stakeholder_tipo?: string | null
          status: string
          tags?: Json | null
          tipo: string
          titulo?: string | null
          total_parcelas?: number | null
          usuario_atualizacao?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          anexos?: Json | null
          atualizado_em?: string | null
          atualizado_por_id?: string | null
          atualizado_por_nome?: string | null
          bar_id?: number | null
          bar_nome?: string | null
          categoria_id?: string | null
          categoria_nome?: string | null
          centro_custo_config?: Json | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          conta_bancaria_id?: string | null
          conta_bancaria_id_interno?: number | null
          conta_bancaria_nome?: string | null
          criado_em?: string | null
          criado_por_id?: string | null
          criado_por_nome?: string | null
          data_atualizacao?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean | null
          descricao?: string | null
          frequencia_recorrencia?: string | null
          id?: number
          inter_codigo_solicitacao?: string | null
          inter_data_aprovacao?: string | null
          inter_end_to_end_id?: string | null
          inter_status?: string | null
          inter_webhook_recebido_em?: string | null
          nibo_id?: string | null
          numero_documento?: string | null
          numero_parcela?: number | null
          observacoes?: string | null
          origem?: string | null
          recorrencia_config?: Json | null
          recorrente?: boolean | null
          sincronizado_nibo?: boolean | null
          stakeholder_id?: string | null
          stakeholder_id_interno?: number | null
          stakeholder_nome?: string | null
          stakeholder_tipo?: string | null
          status?: string
          tags?: Json | null
          tipo?: string
          titulo?: string | null
          total_parcelas?: number | null
          usuario_atualizacao?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nibo_agendamentos_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      nibo_background_jobs: {
        Row: {
          bar_id: number
          batch_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: number
          job_type: string
          processed_records: number | null
          started_at: string | null
          status: string | null
          total_records: number | null
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          batch_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          job_type: string
          processed_records?: number | null
          started_at?: string | null
          status?: string | null
          total_records?: number | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          batch_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          job_type?: string
          processed_records?: number | null
          started_at?: string | null
          status?: string | null
          total_records?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nibo_categorias: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number | null
          categoria_macro: string
          categoria_nome: string
          criado_em: string | null
          id: number
          nibo_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          categoria_macro: string
          categoria_nome: string
          criado_em?: string | null
          id?: number
          nibo_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          categoria_macro?: string
          categoria_nome?: string
          criado_em?: string | null
          id?: number
          nibo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nibo_categorias_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      nibo_centros_custo: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number | null
          codigo: string | null
          criado_em: string | null
          id: number
          nibo_id: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          codigo?: string | null
          criado_em?: string | null
          id?: number
          nibo_id?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          codigo?: string | null
          criado_em?: string | null
          id?: number
          nibo_id?: string | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "nibo_centros_custo_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      nibo_logs_sincronizacao: {
        Row: {
          bar_id: number | null
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          duracao_segundos: number | null
          id: number
          mensagem_erro: string | null
          registros_erro: number | null
          registros_processados: number | null
          status: string
          tipo_sincronizacao: string
          total_registros: number | null
        }
        Insert: {
          bar_id?: number | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          duracao_segundos?: number | null
          id?: number
          mensagem_erro?: string | null
          registros_erro?: number | null
          registros_processados?: number | null
          status: string
          tipo_sincronizacao: string
          total_registros?: number | null
        }
        Update: {
          bar_id?: number | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          duracao_segundos?: number | null
          id?: number
          mensagem_erro?: string | null
          registros_erro?: number | null
          registros_processados?: number | null
          status?: string
          tipo_sincronizacao?: string
          total_registros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nibo_logs_sincronizacao_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      nibo_raw_data: {
        Row: {
          bar_id: number
          created_at: string | null
          data_type: string
          end_date: string
          id: number
          processed: boolean | null
          processed_at: string | null
          raw_json: Json
          record_count: number | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          data_type: string
          end_date: string
          id?: number
          processed?: boolean | null
          processed_at?: string | null
          raw_json: Json
          record_count?: number | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          data_type?: string
          end_date?: string
          id?: number
          processed?: boolean | null
          processed_at?: string | null
          raw_json?: Json
          record_count?: number | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      nibo_stakeholders: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number | null
          criado_em: string | null
          documento_numero: string | null
          documento_tipo: string | null
          email: string | null
          endereco: Json | null
          id: number
          informacoes_bancarias: Json | null
          nibo_id: string
          nome: string
          pix_chave: string | null
          pix_tipo: string | null
          raw_data: Json | null
          telefone: string | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          criado_em?: string | null
          documento_numero?: string | null
          documento_tipo?: string | null
          email?: string | null
          endereco?: Json | null
          id?: number
          informacoes_bancarias?: Json | null
          nibo_id: string
          nome: string
          pix_chave?: string | null
          pix_tipo?: string | null
          raw_data?: Json | null
          telefone?: string | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          criado_em?: string | null
          documento_numero?: string | null
          documento_tipo?: string | null
          email?: string | null
          endereco?: Json | null
          id?: number
          informacoes_bancarias?: Json | null
          nibo_id?: string
          nome?: string
          pix_chave?: string | null
          pix_tipo?: string | null
          raw_data?: Json | null
          telefone?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nibo_stakeholders_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      nibo_temp_agendamentos: {
        Row: {
          bar_id: number
          categoria: string | null
          created_at: string
          data_referencia: string | null
          descricao: string | null
          error_message: string | null
          id: string
          processed: boolean
          processed_at: string | null
          raw_data: Json
          tipo: string | null
          valor: number | null
        }
        Insert: {
          bar_id: number
          categoria?: string | null
          created_at?: string
          data_referencia?: string | null
          descricao?: string | null
          error_message?: string | null
          id?: string
          processed?: boolean
          processed_at?: string | null
          raw_data?: Json
          tipo?: string | null
          valor?: number | null
        }
        Update: {
          bar_id?: number
          categoria?: string | null
          created_at?: string
          data_referencia?: string | null
          descricao?: string | null
          error_message?: string | null
          id?: string
          processed?: boolean
          processed_at?: string | null
          raw_data?: Json
          tipo?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          chave_acesso: string | null
          comanda_id: string
          created_at: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          empresa_id: string
          id: string
          motivo_cancelamento: string | null
          numero: string | null
          protocolo: string | null
          retorno_sefaz: string | null
          serie: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
          url_danfe: string | null
          url_pdf: string | null
          valor_total: number
          xml: string | null
        }
        Insert: {
          chave_acesso?: string | null
          comanda_id: string
          created_at?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          empresa_id: string
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          protocolo?: string | null
          retorno_sefaz?: string | null
          serie?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          url_danfe?: string | null
          url_pdf?: string | null
          valor_total: number
          xml?: string | null
        }
        Update: {
          chave_acesso?: string | null
          comanda_id?: string
          created_at?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          empresa_id?: string
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          protocolo?: string | null
          retorno_sefaz?: string | null
          serie?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          url_danfe?: string | null
          url_pdf?: string | null
          valor_total?: number
          xml?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          agendada_para: string | null
          bar_id: number
          canais: string[]
          criada_em: string | null
          dados: Json | null
          enviada_em: string | null
          id: string
          lida_em: string | null
          mensagem: string
          status: Database["public"]["Enums"]["status_notificacao_enum"]
          tipo: Database["public"]["Enums"]["tipo_notificacao_enum"]
          titulo: string
          usuario_id: string
        }
        Insert: {
          agendada_para?: string | null
          bar_id: number
          canais?: string[]
          criada_em?: string | null
          dados?: Json | null
          enviada_em?: string | null
          id?: string
          lida_em?: string | null
          mensagem: string
          status?: Database["public"]["Enums"]["status_notificacao_enum"]
          tipo: Database["public"]["Enums"]["tipo_notificacao_enum"]
          titulo: string
          usuario_id: string
        }
        Update: {
          agendada_para?: string | null
          bar_id?: number
          canais?: string[]
          criada_em?: string | null
          dados?: Json | null
          enviada_em?: string | null
          id?: string
          lida_em?: string | null
          mensagem?: string
          status?: Database["public"]["Enums"]["status_notificacao_enum"]
          tipo?: Database["public"]["Enums"]["tipo_notificacao_enum"]
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          read: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      nps: {
        Row: {
          bar_id: number
          comentarios: string | null
          conectado_colegas: number | null
          created_at: string | null
          data_pesquisa: string
          empresa_se_preocupa: number | null
          fez_reserva: boolean | null
          funcionario_nome: string
          id: number
          media_geral: number | null
          nps_ambiente: number | null
          nps_atendimento: number | null
          nps_comida: number | null
          nps_drink: number | null
          nps_geral: number | null
          nps_limpeza: number | null
          nps_musica: number | null
          nps_preco: number | null
          nps_reservas: number | null
          qual_sua_area_atuacao: number | null
          quando_identifico: number | null
          quorum: number | null
          relacionamento_positivo: number | null
          resultado_percentual: number | null
          setor: string
          sinto_me_motivado: number | null
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          comentarios?: string | null
          conectado_colegas?: number | null
          created_at?: string | null
          data_pesquisa: string
          empresa_se_preocupa?: number | null
          fez_reserva?: boolean | null
          funcionario_nome: string
          id?: number
          media_geral?: number | null
          nps_ambiente?: number | null
          nps_atendimento?: number | null
          nps_comida?: number | null
          nps_drink?: number | null
          nps_geral?: number | null
          nps_limpeza?: number | null
          nps_musica?: number | null
          nps_preco?: number | null
          nps_reservas?: number | null
          qual_sua_area_atuacao?: number | null
          quando_identifico?: number | null
          quorum?: number | null
          relacionamento_positivo?: number | null
          resultado_percentual?: number | null
          setor: string
          sinto_me_motivado?: number | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          comentarios?: string | null
          conectado_colegas?: number | null
          created_at?: string | null
          data_pesquisa?: string
          empresa_se_preocupa?: number | null
          fez_reserva?: boolean | null
          funcionario_nome?: string
          id?: number
          media_geral?: number | null
          nps_ambiente?: number | null
          nps_atendimento?: number | null
          nps_comida?: number | null
          nps_drink?: number | null
          nps_geral?: number | null
          nps_limpeza?: number | null
          nps_musica?: number | null
          nps_preco?: number | null
          nps_reservas?: number | null
          qual_sua_area_atuacao?: number | null
          quando_identifico?: number | null
          quorum?: number | null
          relacionamento_positivo?: number | null
          resultado_percentual?: number | null
          setor?: string
          sinto_me_motivado?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_reservas: {
        Row: {
          bar_id: number
          comentarios: string | null
          created_at: string | null
          data_pesquisa: string
          dia_semana: string | null
          id: number
          nota: number
        }
        Insert: {
          bar_id?: number
          comentarios?: string | null
          created_at?: string | null
          data_pesquisa: string
          dia_semana?: string | null
          id?: number
          nota: number
        }
        Update: {
          bar_id?: number
          comentarios?: string | null
          created_at?: string | null
          data_pesquisa?: string
          dia_semana?: string | null
          id?: number
          nota?: number
        }
        Relationships: []
      }
      orcamentacao: {
        Row: {
          ano: number
          atualizado_em: string | null
          bar_id: number
          categoria_id: number | null
          categoria_nome: string
          criado_em: string | null
          diferenca: number | null
          id: string
          mes: number
          observacoes: string | null
          percentual_realizado: number | null
          subcategoria: string | null
          tipo: string
          valor_planejado: number | null
          valor_realizado: number | null
        }
        Insert: {
          ano: number
          atualizado_em?: string | null
          bar_id: number
          categoria_id?: number | null
          categoria_nome: string
          criado_em?: string | null
          diferenca?: number | null
          id?: string
          mes: number
          observacoes?: string | null
          percentual_realizado?: number | null
          subcategoria?: string | null
          tipo: string
          valor_planejado?: number | null
          valor_realizado?: number | null
        }
        Update: {
          ano?: number
          atualizado_em?: string | null
          bar_id?: number
          categoria_id?: number | null
          categoria_nome?: string
          criado_em?: string | null
          diferenca?: number | null
          id?: string
          mes?: number
          observacoes?: string | null
          percentual_realizado?: number | null
          subcategoria?: string | null
          tipo?: string
          valor_planejado?: number | null
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentacao_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      organizador_okrs: {
        Row: {
          created_at: string | null
          epico: string
          historia: string | null
          id: number
          observacoes: string | null
          ordem: number | null
          organizador_id: number | null
          responsavel: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          epico: string
          historia?: string | null
          id?: number
          observacoes?: string | null
          ordem?: number | null
          organizador_id?: number | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          epico?: string
          historia?: string | null
          id?: number
          observacoes?: string | null
          ordem?: number | null
          organizador_id?: number | null
          responsavel?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizador_okrs_organizador_id_fkey"
            columns: ["organizador_id"]
            isOneToOne: false
            referencedRelation: "organizador_visao"
            referencedColumns: ["id"]
          },
        ]
      }
      organizador_visao: {
        Row: {
          ano: number
          bar_id: number
          created_at: string | null
          created_by: string | null
          ebitda_meta: number | null
          faturamento_meta: number | null
          id: number
          imagem_1_ano: string | null
          imagem_3_anos: string | null
          mercado_alvo: string | null
          meta_10_anos: string | null
          meta_artistica: number | null
          meta_clientes_ativos: number | null
          meta_cmo: number | null
          meta_cmv_limpo: number | null
          meta_visitas: number | null
          missao: string | null
          nicho: string | null
          pessoas_meta: number | null
          posicionamento: string | null
          principais_problemas: string[] | null
          reputacao_meta: number | null
          singularidades: string[] | null
          tipo: string
          trimestre: number | null
          updated_at: string | null
          valores_centrais: string[] | null
        }
        Insert: {
          ano: number
          bar_id: number
          created_at?: string | null
          created_by?: string | null
          ebitda_meta?: number | null
          faturamento_meta?: number | null
          id?: number
          imagem_1_ano?: string | null
          imagem_3_anos?: string | null
          mercado_alvo?: string | null
          meta_10_anos?: string | null
          meta_artistica?: number | null
          meta_clientes_ativos?: number | null
          meta_cmo?: number | null
          meta_cmv_limpo?: number | null
          meta_visitas?: number | null
          missao?: string | null
          nicho?: string | null
          pessoas_meta?: number | null
          posicionamento?: string | null
          principais_problemas?: string[] | null
          reputacao_meta?: number | null
          singularidades?: string[] | null
          tipo?: string
          trimestre?: number | null
          updated_at?: string | null
          valores_centrais?: string[] | null
        }
        Update: {
          ano?: number
          bar_id?: number
          created_at?: string | null
          created_by?: string | null
          ebitda_meta?: number | null
          faturamento_meta?: number | null
          id?: number
          imagem_1_ano?: string | null
          imagem_3_anos?: string | null
          mercado_alvo?: string | null
          meta_10_anos?: string | null
          meta_artistica?: number | null
          meta_clientes_ativos?: number | null
          meta_cmo?: number | null
          meta_cmv_limpo?: number | null
          meta_visitas?: number | null
          missao?: string | null
          nicho?: string | null
          pessoas_meta?: number | null
          posicionamento?: string | null
          principais_problemas?: string[] | null
          reputacao_meta?: number | null
          singularidades?: string[] | null
          tipo?: string
          trimestre?: number | null
          updated_at?: string | null
          valores_centrais?: string[] | null
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          autorizacao: string | null
          bandeira: string | null
          comanda_id: string
          created_at: string | null
          forma_pagamento_id: string
          id: string
          nsu: string | null
          troco: number | null
          usuario_id: string
          valor: number
        }
        Insert: {
          autorizacao?: string | null
          bandeira?: string | null
          comanda_id: string
          created_at?: string | null
          forma_pagamento_id: string
          id?: string
          nsu?: string | null
          troco?: number | null
          usuario_id: string
          valor: number
        }
        Update: {
          autorizacao?: string | null
          bandeira?: string | null
          comanda_id?: string
          created_at?: string | null
          forma_pagamento_id?: string
          id?: string
          nsu?: string | null
          troco?: number | null
          usuario_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      permanent_tokens: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: number
          last_used: string | null
          token_name: string
          token_value: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: number
          last_used?: string | null
          token_name: string
          token_value: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: number
          last_used?: string | null
          token_name?: string
          token_value?: string
        }
        Relationships: []
      }
      pesquisa_felicidade: {
        Row: {
          bar_id: number
          created_at: string | null
          data_pesquisa: string
          eu_com_colega_relacionamento: number | null
          eu_com_empresa_pertencimento: number | null
          eu_com_gestor_lideranca: number | null
          eu_comigo_engajamento: number | null
          funcionario_nome: string
          id: number
          justica_reconhecimento: number | null
          media_geral: number | null
          quorum: number | null
          resultado_percentual: number | null
          setor: string
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          data_pesquisa: string
          eu_com_colega_relacionamento?: number | null
          eu_com_empresa_pertencimento?: number | null
          eu_com_gestor_lideranca?: number | null
          eu_comigo_engajamento?: number | null
          funcionario_nome: string
          id?: number
          justica_reconhecimento?: number | null
          media_geral?: number | null
          quorum?: number | null
          resultado_percentual?: number | null
          setor: string
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          data_pesquisa?: string
          eu_com_colega_relacionamento?: number | null
          eu_com_empresa_pertencimento?: number | null
          eu_com_gestor_lideranca?: number | null
          eu_comigo_engajamento?: number | null
          funcionario_nome?: string
          id?: number
          justica_reconhecimento?: number | null
          media_geral?: number | null
          quorum?: number | null
          resultado_percentual?: number | null
          setor?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_felicidade_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_responsaveis: {
        Row: {
          ativo: boolean | null
          bar_id: number
          cargo: string | null
          created_at: string | null
          id: number
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bar_id: number
          cargo?: string | null
          created_at?: string | null
          id?: number
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bar_id?: number
          cargo?: string | null
          created_at?: string | null
          id?: number
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pix_enviados: {
        Row: {
          bar_id: number | null
          beneficiario: Json | null
          created_at: string | null
          data_envio: string | null
          id: string
          status: string | null
          txid: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          bar_id?: number | null
          beneficiario?: Json | null
          created_at?: string | null
          data_envio?: string | null
          id?: string
          status?: string | null
          txid: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          bar_id?: number | null
          beneficiario?: Json | null
          created_at?: string | null
          data_envio?: string | null
          id?: string
          status?: string | null
          txid?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pix_enviados_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_cache: {
        Row: {
          cache_key: string
          cache_value: Json
          created_at: string
          expires_at: string
          id: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          cache_value?: Json
          created_at?: string
          expires_at: string
          id?: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          cache_value?: Json
          created_at?: string
          expires_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      producao_insumos_calculados: {
        Row: {
          created_at: string | null
          id: number
          insumo_id: number | null
          producao_id: number | null
          quantidade_calculada: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          insumo_id?: number | null
          producao_id?: number | null
          quantidade_calculada?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          insumo_id?: number | null
          producao_id?: number | null
          quantidade_calculada?: number | null
        }
        Relationships: []
      }
      producoes: {
        Row: {
          bar_id: number
          created_at: string | null
          criado_por_nome: string | null
          fim_producao: string | null
          id: number
          inicio_producao: string | null
          insumo_chefe_id: number | null
          insumo_chefe_nome: string | null
          observacoes: string | null
          percentual_aderencia_receita: number | null
          peso_bruto_proteina: number | null
          peso_insumo_chefe: number | null
          peso_limpo_proteina: number | null
          receita_categoria: string | null
          receita_codigo: string
          receita_nome: string
          rendimento_esperado: number | null
          rendimento_real: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          criado_por_nome?: string | null
          fim_producao?: string | null
          id?: number
          inicio_producao?: string | null
          insumo_chefe_id?: number | null
          insumo_chefe_nome?: string | null
          observacoes?: string | null
          percentual_aderencia_receita?: number | null
          peso_bruto_proteina?: number | null
          peso_insumo_chefe?: number | null
          peso_limpo_proteina?: number | null
          receita_categoria?: string | null
          receita_codigo: string
          receita_nome: string
          rendimento_esperado?: number | null
          rendimento_real?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          criado_por_nome?: string | null
          fim_producao?: string | null
          id?: number
          inicio_producao?: string | null
          insumo_chefe_id?: number | null
          insumo_chefe_nome?: string | null
          observacoes?: string | null
          percentual_aderencia_receita?: number | null
          peso_bruto_proteina?: number | null
          peso_insumo_chefe?: number | null
          peso_limpo_proteina?: number | null
          receita_categoria?: string | null
          receita_codigo?: string
          receita_nome?: string
          rendimento_esperado?: number | null
          rendimento_real?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      producoes_insumos: {
        Row: {
          created_at: string | null
          id: number
          insumo_codigo: string | null
          insumo_id: number
          insumo_nome: string
          is_chefe: boolean | null
          pessoa_responsavel_id: number | null
          producao_id: number
          quantidade_calculada: number | null
          quantidade_necessaria: number | null
          quantidade_real: number | null
          unidade_medida: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          insumo_codigo?: string | null
          insumo_id: number
          insumo_nome: string
          is_chefe?: boolean | null
          pessoa_responsavel_id?: number | null
          producao_id: number
          quantidade_calculada?: number | null
          quantidade_necessaria?: number | null
          quantidade_real?: number | null
          unidade_medida?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          insumo_codigo?: string | null
          insumo_id?: number
          insumo_nome?: string
          is_chefe?: boolean | null
          pessoa_responsavel_id?: number | null
          producao_id?: number
          quantidade_calculada?: number | null
          quantidade_necessaria?: number | null
          quantidade_real?: number | null
          unidade_medida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producoes_insumos_pessoa_responsavel_id_fkey"
            columns: ["pessoa_responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoas_responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producoes_insumos_producao_id_fkey"
            columns: ["producao_id"]
            isOneToOne: false
            referencedRelation: "producoes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          alerta_estoque_baixo: boolean | null
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_pis: number | null
          ativo: boolean | null
          cest: string | null
          cfop: string | null
          codigo: string | null
          codigo_barras: string | null
          controla_estoque: boolean | null
          created_at: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_pis: string | null
          descricao: string | null
          empresa_id: string
          estoque_atual: number | null
          estoque_maximo: number | null
          estoque_minimo: number | null
          grupo_id: string | null
          id: string
          ncm: string | null
          nome: string
          preco_custo: number | null
          preco_venda: number
          unidade: string | null
          unidade_estoque: string | null
          updated_at: string | null
        }
        Insert: {
          alerta_estoque_baixo?: boolean | null
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          ativo?: boolean | null
          cest?: string | null
          cfop?: string | null
          codigo?: string | null
          codigo_barras?: string | null
          controla_estoque?: boolean | null
          created_at?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao?: string | null
          empresa_id: string
          estoque_atual?: number | null
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          grupo_id?: string | null
          id?: string
          ncm?: string | null
          nome: string
          preco_custo?: number | null
          preco_venda: number
          unidade?: string | null
          unidade_estoque?: string | null
          updated_at?: string | null
        }
        Update: {
          alerta_estoque_baixo?: boolean | null
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          ativo?: boolean | null
          cest?: string | null
          cfop?: string | null
          codigo?: string | null
          codigo_barras?: string | null
          controla_estoque?: boolean | null
          created_at?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao?: string | null
          empresa_id?: string
          estoque_atual?: number | null
          estoque_maximo?: number | null
          estoque_minimo?: number | null
          grupo_id?: string | null
          id?: string
          ncm?: string | null
          nome?: string
          preco_custo?: number | null
          preco_venda?: number
          unidade?: string | null
          unidade_estoque?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      provisoes_trabalhistas: {
        Row: {
          ano: number
          atualizado_em: string | null
          bar_id: number
          comissao_bonus: number | null
          criado_em: string | null
          decimo_terceiro: number | null
          dias_ferias_vencidos: number | null
          ferias: number | null
          ferias_vencidas: number | null
          fgts_provisao: number | null
          funcionario_id: number | null
          funcionario_nome: string | null
          id: number
          inss_provisao: number | null
          mes: number
          multa_fgts: number | null
          percentual_salario: number | null
          provisao_certa: number | null
          provisao_eventual: number | null
          salario_bruto_produtividade: number | null
          terco_ferias: number | null
        }
        Insert: {
          ano: number
          atualizado_em?: string | null
          bar_id: number
          comissao_bonus?: number | null
          criado_em?: string | null
          decimo_terceiro?: number | null
          dias_ferias_vencidos?: number | null
          ferias?: number | null
          ferias_vencidas?: number | null
          fgts_provisao?: number | null
          funcionario_id?: number | null
          funcionario_nome?: string | null
          id?: number
          inss_provisao?: number | null
          mes: number
          multa_fgts?: number | null
          percentual_salario?: number | null
          provisao_certa?: number | null
          provisao_eventual?: number | null
          salario_bruto_produtividade?: number | null
          terco_ferias?: number | null
        }
        Update: {
          ano?: number
          atualizado_em?: string | null
          bar_id?: number
          comissao_bonus?: number | null
          criado_em?: string | null
          decimo_terceiro?: number | null
          dias_ferias_vencidos?: number | null
          ferias?: number | null
          ferias_vencidas?: number | null
          fgts_provisao?: number | null
          funcionario_id?: number | null
          funcionario_nome?: string | null
          id?: number
          inss_provisao?: number | null
          mes?: number
          multa_fgts?: number | null
          percentual_salario?: number | null
          provisao_certa?: number | null
          provisao_eventual?: number | null
          salario_bruto_produtividade?: number | null
          terco_ferias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provisoes_trabalhistas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisoes_trabalhistas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      recalculo_eventos_log: {
        Row: {
          created_at: string | null
          detalhes: Json | null
          executado_em: string | null
          id: number
          observacoes: string | null
          tempo_execucao_segundos: number | null
          tipo_execucao: string
          total_erros: number | null
          total_processados: number | null
          total_sucesso: number | null
        }
        Insert: {
          created_at?: string | null
          detalhes?: Json | null
          executado_em?: string | null
          id?: number
          observacoes?: string | null
          tempo_execucao_segundos?: number | null
          tipo_execucao: string
          total_erros?: number | null
          total_processados?: number | null
          total_sucesso?: number | null
        }
        Update: {
          created_at?: string | null
          detalhes?: Json | null
          executado_em?: string | null
          id?: number
          observacoes?: string | null
          tempo_execucao_segundos?: number | null
          tipo_execucao?: string
          total_erros?: number | null
          total_processados?: number | null
          total_sucesso?: number | null
        }
        Relationships: []
      }
      receitas: {
        Row: {
          ativo: boolean | null
          bar_id: number
          created_at: string | null
          id: number
          insumo_chefe_id: number | null
          observacoes: string | null
          receita_categoria: string | null
          receita_codigo: string
          receita_nome: string
          rendimento_esperado: number | null
          tipo_local: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bar_id: number
          created_at?: string | null
          id?: number
          insumo_chefe_id?: number | null
          observacoes?: string | null
          receita_categoria?: string | null
          receita_codigo: string
          receita_nome: string
          rendimento_esperado?: number | null
          tipo_local?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bar_id?: number
          created_at?: string | null
          id?: number
          insumo_chefe_id?: number | null
          observacoes?: string | null
          receita_categoria?: string | null
          receita_codigo?: string
          receita_nome?: string
          rendimento_esperado?: number | null
          tipo_local?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receitas_insumo_chefe_id_fkey"
            columns: ["insumo_chefe_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_historico: {
        Row: {
          bar_id: number
          created_at: string | null
          data_atualizacao: string | null
          id: number
          insumo_chefe_id: number | null
          insumos: Json | null
          observacoes: string | null
          origem: string | null
          receita_categoria: string | null
          receita_codigo: string
          receita_id: number
          receita_nome: string
          rendimento_esperado: number | null
          tipo_local: string | null
          usuario_id: string | null
          versao: string
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          data_atualizacao?: string | null
          id?: number
          insumo_chefe_id?: number | null
          insumos?: Json | null
          observacoes?: string | null
          origem?: string | null
          receita_categoria?: string | null
          receita_codigo: string
          receita_id: number
          receita_nome: string
          rendimento_esperado?: number | null
          tipo_local?: string | null
          usuario_id?: string | null
          versao: string
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          data_atualizacao?: string | null
          id?: number
          insumo_chefe_id?: number | null
          insumos?: Json | null
          observacoes?: string | null
          origem?: string | null
          receita_categoria?: string | null
          receita_codigo?: string
          receita_id?: number
          receita_nome?: string
          rendimento_esperado?: number | null
          tipo_local?: string | null
          usuario_id?: string | null
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "receitas_historico_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_insumos: {
        Row: {
          created_at: string | null
          id: number
          insumo_id: number | null
          is_chefe: boolean | null
          quantidade_necessaria: number
          receita_id: number
          receita_insumo_id: number | null
          unidade_medida: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          insumo_id?: number | null
          is_chefe?: boolean | null
          quantidade_necessaria: number
          receita_id: number
          receita_insumo_id?: number | null
          unidade_medida?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          insumo_id?: number | null
          is_chefe?: boolean | null
          quantidade_necessaria?: number
          receita_id?: number
          receita_insumo_id?: number | null
          unidade_medida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receitas_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_insumos_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_insumos_receita_insumo_id_fkey"
            columns: ["receita_insumo_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_results: {
        Row: {
          audit_date: string | null
          fix_status: string | null
          fixed_issues: number | null
          id: number
          notes: string | null
          remaining_issues: number | null
          security_issue_type: string | null
          total_issues: number | null
        }
        Insert: {
          audit_date?: string | null
          fix_status?: string | null
          fixed_issues?: number | null
          id?: number
          notes?: string | null
          remaining_issues?: number | null
          security_issue_type?: string | null
          total_issues?: number | null
        }
        Update: {
          audit_date?: string | null
          fix_status?: string | null
          fixed_issues?: number | null
          id?: number
          notes?: string | null
          remaining_issues?: number | null
          security_issue_type?: string | null
          total_issues?: number | null
        }
        Relationships: []
      }
      security_config_pending: {
        Row: {
          completed_at: string | null
          config_name: string
          config_type: string
          created_at: string | null
          current_status: string | null
          dashboard_path: string | null
          description: string | null
          id: number
          notes: string | null
          priority: string | null
        }
        Insert: {
          completed_at?: string | null
          config_name: string
          config_type: string
          created_at?: string | null
          current_status?: string | null
          dashboard_path?: string | null
          description?: string | null
          id?: number
          notes?: string | null
          priority?: string | null
        }
        Update: {
          completed_at?: string | null
          config_name?: string
          config_type?: string
          created_at?: string | null
          current_status?: string | null
          dashboard_path?: string | null
          description?: string | null
          id?: number
          notes?: string | null
          priority?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action_taken: string | null
          bar_id: number | null
          category: string
          created_at: string | null
          details: Json | null
          endpoint: string | null
          event_id: string
          event_type: string
          id: string
          ip_address: unknown
          level: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number | null
          timestamp: string
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          bar_id?: number | null
          category: string
          created_at?: string | null
          details?: Json | null
          endpoint?: string | null
          event_id: string
          event_type: string
          id?: string
          ip_address?: unknown
          level: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          timestamp?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          bar_id?: number | null
          category?: string
          created_at?: string | null
          details?: Json | null
          endpoint?: string | null
          event_id?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          level?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number | null
          timestamp?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      security_metrics: {
        Row: {
          access_events: number | null
          api_abuse_events: number | null
          auth_events: number | null
          backup_events: number | null
          bar_id: number | null
          blocked_ips: number | null
          created_at: string | null
          critical_events: number | null
          date: string
          failed_logins: number | null
          id: string
          info_events: number | null
          injection_events: number | null
          rate_limit_events: number | null
          system_events: number | null
          total_events: number | null
          unique_ips: number | null
          updated_at: string | null
          warning_events: number | null
        }
        Insert: {
          access_events?: number | null
          api_abuse_events?: number | null
          auth_events?: number | null
          backup_events?: number | null
          bar_id?: number | null
          blocked_ips?: number | null
          created_at?: string | null
          critical_events?: number | null
          date: string
          failed_logins?: number | null
          id?: string
          info_events?: number | null
          injection_events?: number | null
          rate_limit_events?: number | null
          system_events?: number | null
          total_events?: number | null
          unique_ips?: number | null
          updated_at?: string | null
          warning_events?: number | null
        }
        Update: {
          access_events?: number | null
          api_abuse_events?: number | null
          auth_events?: number | null
          backup_events?: number | null
          bar_id?: number | null
          blocked_ips?: number | null
          created_at?: string | null
          critical_events?: number | null
          date?: string
          failed_logins?: number | null
          id?: string
          info_events?: number | null
          injection_events?: number | null
          rate_limit_events?: number | null
          system_events?: number | null
          total_events?: number | null
          unique_ips?: number | null
          updated_at?: string | null
          warning_events?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "security_metrics_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      security_monitoring: {
        Row: {
          check_description: string | null
          check_type: string
          checked_at: string | null
          details: Json | null
          id: string
          status: string
        }
        Insert: {
          check_description?: string | null
          check_type: string
          checked_at?: string | null
          details?: Json | null
          id?: string
          status: string
        }
        Update: {
          check_description?: string | null
          check_type?: string
          checked_at?: string | null
          details?: Json | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      semanas_referencia: {
        Row: {
          criado_em: string | null
          data_fim: string
          data_inicio: string
          periodo_formatado: string | null
          semana: number
        }
        Insert: {
          criado_em?: string | null
          data_fim: string
          data_inicio: string
          periodo_formatado?: string | null
          semana: number
        }
        Update: {
          criado_em?: string | null
          data_fim?: string
          data_inicio?: string
          periodo_formatado?: string | null
          semana?: number
        }
        Relationships: []
      }
      simulacoes_cmo: {
        Row: {
          ano: number
          atualizado_em: string | null
          bar_id: number
          criado_em: string | null
          criado_por: string | null
          funcionarios: Json
          id: number
          mes: number
          observacoes: string | null
          total_encargos: number | null
          total_folha: number | null
          total_geral: number | null
        }
        Insert: {
          ano: number
          atualizado_em?: string | null
          bar_id: number
          criado_em?: string | null
          criado_por?: string | null
          funcionarios?: Json
          id?: number
          mes: number
          observacoes?: string | null
          total_encargos?: number | null
          total_folha?: number | null
          total_geral?: number | null
        }
        Update: {
          ano?: number
          atualizado_em?: string | null
          bar_id?: number
          criado_em?: string | null
          criado_por?: string | null
          funcionarios?: Json
          id?: number
          mes?: number
          observacoes?: string | null
          total_encargos?: number | null
          total_folha?: number | null
          total_geral?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_cmo_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_alertas: {
        Row: {
          bar_id: number | null
          criado_em: string | null
          data_referencia: string | null
          descricao: string | null
          diferenca: number | null
          fonte: string | null
          id: number
          metadata: Json | null
          notificado_discord: boolean | null
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          tipo: string
          titulo: string
          valor_encontrado: number | null
          valor_esperado: number | null
        }
        Insert: {
          bar_id?: number | null
          criado_em?: string | null
          data_referencia?: string | null
          descricao?: string | null
          diferenca?: number | null
          fonte?: string | null
          id?: number
          metadata?: Json | null
          notificado_discord?: boolean | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tipo: string
          titulo: string
          valor_encontrado?: number | null
          valor_esperado?: number | null
        }
        Update: {
          bar_id?: number | null
          criado_em?: string | null
          data_referencia?: string | null
          descricao?: string | null
          diferenca?: number | null
          fonte?: string | null
          id?: number
          metadata?: Json | null
          notificado_discord?: boolean | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tipo?: string
          titulo?: string
          valor_encontrado?: number | null
          valor_esperado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sistema_alertas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      sistema_kpis: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          categoria_kpi: string
          criado_em: string | null
          data_referencia: string
          descricao: string | null
          id: number
          nome_kpi: string
          percentual_atingido: number | null
          periodo_tipo: string | null
          status_meta: string | null
          unidade: string | null
          valor_atual: number
          valor_maximo: number | null
          valor_meta: number
          valor_minimo: number | null
        }
        Insert: {
          atualizado_em?: string | null
          bar_id: number
          categoria_kpi: string
          criado_em?: string | null
          data_referencia?: string
          descricao?: string | null
          id?: number
          nome_kpi: string
          percentual_atingido?: number | null
          periodo_tipo?: string | null
          status_meta?: string | null
          unidade?: string | null
          valor_atual: number
          valor_maximo?: number | null
          valor_meta: number
          valor_minimo?: number | null
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          categoria_kpi?: string
          criado_em?: string | null
          data_referencia?: string
          descricao?: string | null
          id?: number
          nome_kpi?: string
          percentual_atingido?: number | null
          periodo_tipo?: string | null
          status_meta?: string | null
          unidade?: string | null
          valor_atual?: number
          valor_maximo?: number | null
          valor_meta?: number
          valor_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sistema_kpis_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      sympla_eventos: {
        Row: {
          bar_id: number | null
          categoria_primaria: string | null
          categoria_secundaria: string | null
          created_at: string | null
          dados_endereco: Json | null
          dados_host: Json | null
          data_fim: string | null
          data_inicio: string | null
          evento_sympla_id: string
          evento_url: string | null
          id: number
          imagem_url: string | null
          nome_evento: string
          publicado: boolean | null
          raw_data: Json | null
          reference_id: number | null
          updated_at: string | null
        }
        Insert: {
          bar_id?: number | null
          categoria_primaria?: string | null
          categoria_secundaria?: string | null
          created_at?: string | null
          dados_endereco?: Json | null
          dados_host?: Json | null
          data_fim?: string | null
          data_inicio?: string | null
          evento_sympla_id: string
          evento_url?: string | null
          id?: number
          imagem_url?: string | null
          nome_evento: string
          publicado?: boolean | null
          raw_data?: Json | null
          reference_id?: number | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number | null
          categoria_primaria?: string | null
          categoria_secundaria?: string | null
          created_at?: string | null
          dados_endereco?: Json | null
          dados_host?: Json | null
          data_fim?: string | null
          data_inicio?: string | null
          evento_sympla_id?: string
          evento_url?: string | null
          id?: number
          imagem_url?: string | null
          nome_evento?: string
          publicado?: boolean | null
          raw_data?: Json | null
          reference_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sympla_participantes: {
        Row: {
          bar_id: number | null
          created_at: string | null
          dados_ticket: Json | null
          data_checkin: string | null
          email: string | null
          evento_sympla_id: string
          fez_checkin: boolean | null
          id: number
          nome_completo: string | null
          numero_ticket: string | null
          participante_sympla_id: string
          pedido_id: string | null
          raw_data: Json | null
          status_pedido: string | null
          tipo_ingresso: string | null
          updated_at: string | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          dados_ticket?: Json | null
          data_checkin?: string | null
          email?: string | null
          evento_sympla_id: string
          fez_checkin?: boolean | null
          id?: number
          nome_completo?: string | null
          numero_ticket?: string | null
          participante_sympla_id: string
          pedido_id?: string | null
          raw_data?: Json | null
          status_pedido?: string | null
          tipo_ingresso?: string | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          dados_ticket?: Json | null
          data_checkin?: string | null
          email?: string | null
          evento_sympla_id?: string
          fez_checkin?: boolean | null
          id?: number
          nome_completo?: string | null
          numero_ticket?: string | null
          participante_sympla_id?: string
          pedido_id?: string | null
          raw_data?: Json | null
          status_pedido?: string | null
          tipo_ingresso?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sympla_participantes_evento_sympla_id_fkey"
            columns: ["evento_sympla_id"]
            isOneToOne: false
            referencedRelation: "sympla_eventos"
            referencedColumns: ["evento_sympla_id"]
          },
          {
            foreignKeyName: "sympla_participantes_evento_sympla_id_fkey"
            columns: ["evento_sympla_id"]
            isOneToOne: false
            referencedRelation: "sympla_resumo"
            referencedColumns: ["evento_sympla_id"]
          },
        ]
      }
      sympla_pedidos: {
        Row: {
          bar_id: number | null
          created_at: string | null
          dados_comprador: Json | null
          dados_utm: Json | null
          data_pedido: string | null
          email_comprador: string | null
          evento_sympla_id: string
          id: number
          nome_comprador: string | null
          pedido_sympla_id: string
          raw_data: Json | null
          status_pedido: string | null
          taxa_sympla: number | null
          tipo_transacao: string | null
          updated_at: string | null
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          dados_comprador?: Json | null
          dados_utm?: Json | null
          data_pedido?: string | null
          email_comprador?: string | null
          evento_sympla_id: string
          id?: number
          nome_comprador?: string | null
          pedido_sympla_id: string
          raw_data?: Json | null
          status_pedido?: string | null
          taxa_sympla?: number | null
          tipo_transacao?: string | null
          updated_at?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          dados_comprador?: Json | null
          dados_utm?: Json | null
          data_pedido?: string | null
          email_comprador?: string | null
          evento_sympla_id?: string
          id?: number
          nome_comprador?: string | null
          pedido_sympla_id?: string
          raw_data?: Json | null
          status_pedido?: string | null
          taxa_sympla?: number | null
          tipo_transacao?: string | null
          updated_at?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sympla_pedidos_evento_sympla_id_fkey"
            columns: ["evento_sympla_id"]
            isOneToOne: false
            referencedRelation: "sympla_eventos"
            referencedColumns: ["evento_sympla_id"]
          },
          {
            foreignKeyName: "sympla_pedidos_evento_sympla_id_fkey"
            columns: ["evento_sympla_id"]
            isOneToOne: false
            referencedRelation: "sympla_resumo"
            referencedColumns: ["evento_sympla_id"]
          },
        ]
      }
      sympla_sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: number
          status: string | null
          sync_date: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: number
          status?: string | null
          sync_date?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: number
          status?: string | null
          sync_date?: string | null
        }
        Relationships: []
      }
      sync_logs_contahub: {
        Row: {
          bar_id: number | null
          created_at: string | null
          data_sync: string
          detalhes: Json | null
          duracao_segundos: number | null
          erro: string | null
          fim_execucao: string | null
          id: number
          inicio_execucao: string | null
          request_id: string | null
          session_token: string | null
          stack_trace: string | null
          status: string
          total_analitico: number | null
          total_fatporhora: number | null
          total_pagamentos: number | null
          total_periodo: number | null
          total_registros: number | null
          total_tempo: number | null
          triggered_by: string | null
          updated_at: string | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          data_sync: string
          detalhes?: Json | null
          duracao_segundos?: number | null
          erro?: string | null
          fim_execucao?: string | null
          id?: number
          inicio_execucao?: string | null
          request_id?: string | null
          session_token?: string | null
          stack_trace?: string | null
          status: string
          total_analitico?: number | null
          total_fatporhora?: number | null
          total_pagamentos?: number | null
          total_periodo?: number | null
          total_registros?: number | null
          total_tempo?: number | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          data_sync?: string
          detalhes?: Json | null
          duracao_segundos?: number | null
          erro?: string | null
          fim_execucao?: string | null
          id?: number
          inicio_execucao?: string | null
          request_id?: string | null
          session_token?: string | null
          stack_trace?: string | null
          status?: string
          total_analitico?: number | null
          total_fatporhora?: number | null
          total_pagamentos?: number | null
          total_periodo?: number | null
          total_registros?: number | null
          total_tempo?: number | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          criado_em: string | null
          detalhes: Json | null
          id: number
          mensagem: string | null
          tipo: string | null
        }
        Insert: {
          criado_em?: string | null
          detalhes?: Json | null
          id?: number
          mensagem?: string | null
          tipo?: string | null
        }
        Update: {
          criado_em?: string | null
          detalhes?: Json | null
          id?: number
          mensagem?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      template_tags: {
        Row: {
          cor: string | null
          criado_em: string | null
          id: string
          nome: string
        }
        Insert: {
          cor?: string | null
          criado_em?: string | null
          id?: string
          nome: string
        }
        Update: {
          cor?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      turnos: {
        Row: {
          created_at: string | null
          data_abertura: string
          data_fechamento: string | null
          empresa_id: string
          id: string
          observacao: string | null
          status: string | null
          updated_at: string | null
          usuario_abertura_id: string
          usuario_fechamento_id: string | null
          valor_abertura: number | null
          valor_fechamento: number | null
          valor_recebido: number | null
          valor_sangria: number | null
          valor_suprimento: number | null
          valor_vendas: number | null
        }
        Insert: {
          created_at?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id: string
          id?: string
          observacao?: string | null
          status?: string | null
          updated_at?: string | null
          usuario_abertura_id: string
          usuario_fechamento_id?: string | null
          valor_abertura?: number | null
          valor_fechamento?: number | null
          valor_recebido?: number | null
          valor_sangria?: number | null
          valor_suprimento?: number | null
          valor_vendas?: number | null
        }
        Update: {
          created_at?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id?: string
          id?: string
          observacao?: string | null
          status?: string | null
          updated_at?: string | null
          usuario_abertura_id?: string
          usuario_fechamento_id?: string | null
          valor_abertura?: number | null
          valor_fechamento?: number | null
          valor_recebido?: number | null
          valor_sangria?: number | null
          valor_suprimento?: number | null
          valor_vendas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_usuario_abertura_id_fkey"
            columns: ["usuario_abertura_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_usuario_fechamento_id_fkey"
            columns: ["usuario_fechamento_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      umbler_campanha_destinatarios: {
        Row: {
          campanha_id: string
          cliente_contahub_id: number | null
          created_at: string | null
          entregue_em: string | null
          enviado_em: string | null
          erro_mensagem: string | null
          id: number
          lido_em: string | null
          mensagem_id: string | null
          nome: string | null
          respondeu_em: string | null
          status: string | null
          telefone: string
        }
        Insert: {
          campanha_id: string
          cliente_contahub_id?: number | null
          created_at?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: number
          lido_em?: string | null
          mensagem_id?: string | null
          nome?: string | null
          respondeu_em?: string | null
          status?: string | null
          telefone: string
        }
        Update: {
          campanha_id?: string
          cliente_contahub_id?: number | null
          created_at?: string | null
          entregue_em?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: number
          lido_em?: string | null
          mensagem_id?: string | null
          nome?: string | null
          respondeu_em?: string | null
          status?: string | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "umbler_campanha_destinatarios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "umbler_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      umbler_campanhas: {
        Row: {
          agendado_para: string | null
          bar_id: number
          channel_id: string
          created_at: string | null
          criado_por_email: string | null
          entregues: number | null
          enviados: number | null
          erros: number | null
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          lidos: number | null
          nome: string
          respostas: number | null
          segmento_criterios: Json | null
          status: string | null
          template_mensagem: string
          template_name: string | null
          tipo: string | null
          total_destinatarios: number | null
          updated_at: string | null
          variaveis: Json | null
        }
        Insert: {
          agendado_para?: string | null
          bar_id: number
          channel_id: string
          created_at?: string | null
          criado_por_email?: string | null
          entregues?: number | null
          enviados?: number | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          lidos?: number | null
          nome: string
          respostas?: number | null
          segmento_criterios?: Json | null
          status?: string | null
          template_mensagem: string
          template_name?: string | null
          tipo?: string | null
          total_destinatarios?: number | null
          updated_at?: string | null
          variaveis?: Json | null
        }
        Update: {
          agendado_para?: string | null
          bar_id?: number
          channel_id?: string
          created_at?: string | null
          criado_por_email?: string | null
          entregues?: number | null
          enviados?: number | null
          erros?: number | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          lidos?: number | null
          nome?: string
          respostas?: number | null
          segmento_criterios?: Json | null
          status?: string | null
          template_mensagem?: string
          template_name?: string | null
          tipo?: string | null
          total_destinatarios?: number | null
          updated_at?: string | null
          variaveis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "umbler_campanhas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      umbler_config: {
        Row: {
          api_token: string
          ativo: boolean | null
          bar_id: number
          channel_id: string
          channel_name: string | null
          created_at: string | null
          id: number
          organization_id: string
          phone_number: string
          rate_limit_per_minute: number | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_token: string
          ativo?: boolean | null
          bar_id: number
          channel_id: string
          channel_name?: string | null
          created_at?: string | null
          id?: number
          organization_id: string
          phone_number: string
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string
          ativo?: boolean | null
          bar_id?: number
          channel_id?: string
          channel_name?: string | null
          created_at?: string | null
          id?: number
          organization_id?: string
          phone_number?: string
          rate_limit_per_minute?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umbler_config_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      umbler_conversas: {
        Row: {
          atendente_id: string | null
          atendente_nome: string | null
          bar_id: number
          channel_id: string
          cliente_contahub_id: number | null
          contato_id: string | null
          contato_nome: string | null
          contato_telefone: string
          created_at: string | null
          finalizada_em: string | null
          id: string
          iniciada_em: string | null
          metadata: Json | null
          satisfacao_nota: number | null
          setor: string | null
          status: string | null
          tags: string[] | null
          tempo_primeira_resposta_segundos: number | null
          tempo_total_segundos: number | null
          total_mensagens: number | null
          total_mensagens_atendente: number | null
          total_mensagens_bot: number | null
          total_mensagens_cliente: number | null
          ultima_mensagem_em: string | null
          updated_at: string | null
        }
        Insert: {
          atendente_id?: string | null
          atendente_nome?: string | null
          bar_id: number
          channel_id: string
          cliente_contahub_id?: number | null
          contato_id?: string | null
          contato_nome?: string | null
          contato_telefone: string
          created_at?: string | null
          finalizada_em?: string | null
          id: string
          iniciada_em?: string | null
          metadata?: Json | null
          satisfacao_nota?: number | null
          setor?: string | null
          status?: string | null
          tags?: string[] | null
          tempo_primeira_resposta_segundos?: number | null
          tempo_total_segundos?: number | null
          total_mensagens?: number | null
          total_mensagens_atendente?: number | null
          total_mensagens_bot?: number | null
          total_mensagens_cliente?: number | null
          ultima_mensagem_em?: string | null
          updated_at?: string | null
        }
        Update: {
          atendente_id?: string | null
          atendente_nome?: string | null
          bar_id?: number
          channel_id?: string
          cliente_contahub_id?: number | null
          contato_id?: string | null
          contato_nome?: string | null
          contato_telefone?: string
          created_at?: string | null
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string | null
          metadata?: Json | null
          satisfacao_nota?: number | null
          setor?: string | null
          status?: string | null
          tags?: string[] | null
          tempo_primeira_resposta_segundos?: number | null
          tempo_total_segundos?: number | null
          total_mensagens?: number | null
          total_mensagens_atendente?: number | null
          total_mensagens_bot?: number | null
          total_mensagens_cliente?: number | null
          ultima_mensagem_em?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umbler_conversas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      umbler_mensagens: {
        Row: {
          bar_id: number
          campanha_id: string | null
          channel_id: string
          contato_nome: string | null
          contato_telefone: string
          conteudo: string | null
          conversa_id: string | null
          created_at: string | null
          direcao: string
          entregue_em: string | null
          enviada_em: string | null
          erro_codigo: string | null
          erro_mensagem: string | null
          id: string
          lida_em: string | null
          media_url: string | null
          metadata: Json | null
          status: string | null
          template_name: string | null
          template_params: Json | null
          tipo_mensagem: string | null
          tipo_remetente: string | null
        }
        Insert: {
          bar_id: number
          campanha_id?: string | null
          channel_id: string
          contato_nome?: string | null
          contato_telefone: string
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string | null
          direcao: string
          entregue_em?: string | null
          enviada_em?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id: string
          lida_em?: string | null
          media_url?: string | null
          metadata?: Json | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
          tipo_mensagem?: string | null
          tipo_remetente?: string | null
        }
        Update: {
          bar_id?: number
          campanha_id?: string | null
          channel_id?: string
          contato_nome?: string | null
          contato_telefone?: string
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string | null
          direcao?: string
          entregue_em?: string | null
          enviada_em?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          lida_em?: string | null
          media_url?: string | null
          metadata?: Json | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
          tipo_mensagem?: string | null
          tipo_remetente?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umbler_mensagens_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umbler_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "umbler_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      umbler_webhook_logs: {
        Row: {
          bar_id: number | null
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: number
          payload: Json
          processed: boolean | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: number
          payload: Json
          processed?: boolean | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: number
          payload?: Json
          processed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "umbler_webhook_logs_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_path: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_bars: {
        Row: {
          bar_id: number | null
          created_at: string | null
          id: number
          role: string | null
          user_id: string | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          id?: number
          role?: string | null
          user_id?: string | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          id?: number
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_bars_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lgpd_settings: {
        Row: {
          created_at: string | null
          id: string
          preferences: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          preferences?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          preferences?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          id: string
          session_data: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_data?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          session_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string | null
          id: string
          settings: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          settings?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          settings?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean | null
          auth_id: string | null
          cpf: string | null
          created_at: string | null
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          auth_id?: string | null
          cpf?: string | null
          created_at?: string | null
          email: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          auth_id?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      usuarios_bar: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number | null
          bio: string | null
          biometric_credentials: Json | null
          celular: string | null
          cep: string | null
          cidade: string | null
          conta_verificada: boolean | null
          cpf: string | null
          criado_em: string | null
          data_nascimento: string | null
          email: string
          endereco: string | null
          estado: string | null
          foto_perfil: string | null
          id: number
          modulos_permitidos: Json | null
          nivel_acesso: string | null
          nome: string | null
          observacoes: string | null
          preferencias: Json | null
          reset_token: string | null
          reset_token_expiry: string | null
          role: string | null
          senha_redefinida: boolean | null
          telefone: string | null
          ultima_atividade: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          bio?: string | null
          biometric_credentials?: Json | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          conta_verificada?: boolean | null
          cpf?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          email: string
          endereco?: string | null
          estado?: string | null
          foto_perfil?: string | null
          id?: number
          modulos_permitidos?: Json | null
          nivel_acesso?: string | null
          nome?: string | null
          observacoes?: string | null
          preferencias?: Json | null
          reset_token?: string | null
          reset_token_expiry?: string | null
          role?: string | null
          senha_redefinida?: boolean | null
          telefone?: string | null
          ultima_atividade?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          bio?: string | null
          biometric_credentials?: Json | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          conta_verificada?: boolean | null
          cpf?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          email?: string
          endereco?: string | null
          estado?: string | null
          foto_perfil?: string | null
          id?: number
          modulos_permitidos?: Json | null
          nivel_acesso?: string | null
          nome?: string | null
          observacoes?: string | null
          preferencias?: Json | null
          reset_token?: string | null
          reset_token_expiry?: string | null
          role?: string | null
          senha_redefinida?: boolean | null
          telefone?: string | null
          ultima_atividade?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_bar_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_bares: {
        Row: {
          bar_id: number
          criado_em: string | null
          id: number
          usuario_id: number
        }
        Insert: {
          bar_id: number
          criado_em?: string | null
          id?: number
          usuario_id: number
        }
        Update: {
          bar_id?: number
          criado_em?: string | null
          id?: number
          usuario_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_bares_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_bares_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_bar"
            referencedColumns: ["id"]
          },
        ]
      }
      validacao_dados: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          corrigido_automaticamente: boolean | null
          criado_em: string | null
          data_referencia: string
          detalhes: Json | null
          diferenca: number | null
          fonte: string
          id: number
          percentual_diferenca: number | null
          status: string | null
          valor_calculado: number | null
          valor_esperado: number | null
        }
        Insert: {
          atualizado_em?: string | null
          bar_id: number
          corrigido_automaticamente?: boolean | null
          criado_em?: string | null
          data_referencia: string
          detalhes?: Json | null
          diferenca?: number | null
          fonte: string
          id?: number
          percentual_diferenca?: number | null
          status?: string | null
          valor_calculado?: number | null
          valor_esperado?: number | null
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          corrigido_automaticamente?: boolean | null
          criado_em?: string | null
          data_referencia?: string
          detalhes?: Json | null
          diferenca?: number | null
          fonte?: string
          id?: number
          percentual_diferenca?: number | null
          status?: string | null
          valor_calculado?: number | null
          valor_esperado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "validacao_dados_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      validacao_dados_diaria: {
        Row: {
          bar_id: number
          contahub_diferenca: number | null
          contahub_pagamentos_total: number | null
          contahub_periodo_total: number | null
          contahub_valido: boolean | null
          criado_em: string | null
          data_referencia: string
          eventos_base_real_r: number | null
          eventos_base_sympla: number | null
          eventos_base_yuzer: number | null
          id: number
          problemas_detectados: string[] | null
          sympla_eventos_count: number | null
          sympla_pedidos_total: number | null
          validacao_passou: boolean | null
          yuzer_eventos_count: number | null
          yuzer_pagamentos_total: number | null
        }
        Insert: {
          bar_id: number
          contahub_diferenca?: number | null
          contahub_pagamentos_total?: number | null
          contahub_periodo_total?: number | null
          contahub_valido?: boolean | null
          criado_em?: string | null
          data_referencia: string
          eventos_base_real_r?: number | null
          eventos_base_sympla?: number | null
          eventos_base_yuzer?: number | null
          id?: number
          problemas_detectados?: string[] | null
          sympla_eventos_count?: number | null
          sympla_pedidos_total?: number | null
          validacao_passou?: boolean | null
          yuzer_eventos_count?: number | null
          yuzer_pagamentos_total?: number | null
        }
        Update: {
          bar_id?: number
          contahub_diferenca?: number | null
          contahub_pagamentos_total?: number | null
          contahub_periodo_total?: number | null
          contahub_valido?: boolean | null
          criado_em?: string | null
          data_referencia?: string
          eventos_base_real_r?: number | null
          eventos_base_sympla?: number | null
          eventos_base_yuzer?: number | null
          id?: number
          problemas_detectados?: string[] | null
          sympla_eventos_count?: number | null
          sympla_pedidos_total?: number | null
          validacao_passou?: boolean | null
          yuzer_eventos_count?: number | null
          yuzer_pagamentos_total?: number | null
        }
        Relationships: []
      }
      validacoes_cruzadas: {
        Row: {
          atualizado_em: string | null
          bar_id: number
          contahub_diferenca: number | null
          contahub_pagamentos_total: number | null
          contahub_periodo_total: number | null
          contahub_validado: boolean | null
          criado_em: string | null
          data_referencia: string
          eventos_base_cl_real: number | null
          eventos_base_real_r: number | null
          id: number
          observacoes: string | null
          status: string | null
        }
        Insert: {
          atualizado_em?: string | null
          bar_id: number
          contahub_diferenca?: number | null
          contahub_pagamentos_total?: number | null
          contahub_periodo_total?: number | null
          contahub_validado?: boolean | null
          criado_em?: string | null
          data_referencia: string
          eventos_base_cl_real?: number | null
          eventos_base_real_r?: number | null
          id?: number
          observacoes?: string | null
          status?: string | null
        }
        Update: {
          atualizado_em?: string | null
          bar_id?: number
          contahub_diferenca?: number | null
          contahub_pagamentos_total?: number | null
          contahub_periodo_total?: number | null
          contahub_validado?: boolean | null
          criado_em?: string | null
          data_referencia?: string
          eventos_base_cl_real?: number | null
          eventos_base_real_r?: number | null
          id?: number
          observacoes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validacoes_cruzadas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      voz_cliente: {
        Row: {
          bar_id: number
          categoria: string | null
          created_at: string | null
          criticidade: string | null
          data_feedback: string
          dia_semana: string | null
          feedback: string
          fonte: string | null
          id: number
          responsavel: string | null
          semana: number | null
          status: string | null
          tom: string
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          categoria?: string | null
          created_at?: string | null
          criticidade?: string | null
          data_feedback: string
          dia_semana?: string | null
          feedback: string
          fonte?: string | null
          id?: number
          responsavel?: string | null
          semana?: number | null
          status?: string | null
          tom: string
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          categoria?: string | null
          created_at?: string | null
          criticidade?: string | null
          data_feedback?: string
          dia_semana?: string | null
          feedback?: string
          fonte?: string | null
          id?: number
          responsavel?: string | null
          semana?: number | null
          status?: string | null
          tom?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voz_cliente_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      windsor_datav2: {
        Row: {
          campaign: string | null
          campaign_bid_strategy: string | null
          campaign_budget_remaining: number | null
          campaign_buying_type: string | null
          campaign_configured_status: string | null
          campaign_created_time: string | null
          campaign_daily_budget: number | null
          campaign_effective_status: string | null
          campaign_id: string | null
          campaign_lifetime_budget: number | null
          campaign_objective: string | null
          campaign_start_time: string | null
          campaign_stop_time: string | null
          campaignid: string | null
          date: string | null
          id: number
          objective: string | null
          spend: number | null
          totalcost: number | null
        }
        Insert: {
          campaign?: string | null
          campaign_bid_strategy?: string | null
          campaign_budget_remaining?: number | null
          campaign_buying_type?: string | null
          campaign_configured_status?: string | null
          campaign_created_time?: string | null
          campaign_daily_budget?: number | null
          campaign_effective_status?: string | null
          campaign_id?: string | null
          campaign_lifetime_budget?: number | null
          campaign_objective?: string | null
          campaign_start_time?: string | null
          campaign_stop_time?: string | null
          campaignid?: string | null
          date?: string | null
          id?: number
          objective?: string | null
          spend?: number | null
          totalcost?: number | null
        }
        Update: {
          campaign?: string | null
          campaign_bid_strategy?: string | null
          campaign_budget_remaining?: number | null
          campaign_buying_type?: string | null
          campaign_configured_status?: string | null
          campaign_created_time?: string | null
          campaign_daily_budget?: number | null
          campaign_effective_status?: string | null
          campaign_id?: string | null
          campaign_lifetime_budget?: number | null
          campaign_objective?: string | null
          campaign_start_time?: string | null
          campaign_stop_time?: string | null
          campaignid?: string | null
          date?: string | null
          id?: number
          objective?: string | null
          spend?: number | null
          totalcost?: number | null
        }
        Relationships: []
      }
      windsor_google: {
        Row: {
          date: string | null
          id: number
          review_average_rating: number | null
          review_average_rating_total: number | null
          review_comment: string | null
          review_count: number | null
          review_create_time: string | null
          review_id: string | null
          review_reviewer: string | null
          review_star_rating: string | null
          review_total_count: number | null
          review_update_time: string | null
          search_keyword: string | null
          source: string | null
        }
        Insert: {
          date?: string | null
          id?: number
          review_average_rating?: number | null
          review_average_rating_total?: number | null
          review_comment?: string | null
          review_count?: number | null
          review_create_time?: string | null
          review_id?: string | null
          review_reviewer?: string | null
          review_star_rating?: string | null
          review_total_count?: number | null
          review_update_time?: string | null
          search_keyword?: string | null
          source?: string | null
        }
        Update: {
          date?: string | null
          id?: number
          review_average_rating?: number | null
          review_average_rating_total?: number | null
          review_comment?: string | null
          review_count?: number | null
          review_create_time?: string | null
          review_id?: string | null
          review_reviewer?: string | null
          review_star_rating?: string | null
          review_total_count?: number | null
          review_update_time?: string | null
          search_keyword?: string | null
          source?: string | null
        }
        Relationships: []
      }
      windsor_instagram_followers: {
        Row: {
          account_id: string | null
          account_name: string | null
          biography: string | null
          date: string | null
          follower_count_1d: number | null
          followers_count: number | null
          follows_count: number | null
          id: number
          legacy_user_id: string | null
          media_count: number | null
          name: string | null
          reach: number | null
          reach_1d: number | null
          user_id: string | null
          user_name: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          biography?: string | null
          date?: string | null
          follower_count_1d?: number | null
          followers_count?: number | null
          follows_count?: number | null
          id?: number
          legacy_user_id?: string | null
          media_count?: number | null
          name?: string | null
          reach?: number | null
          reach_1d?: number | null
          user_id?: string | null
          user_name?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          biography?: string | null
          date?: string | null
          follower_count_1d?: number | null
          followers_count?: number | null
          follows_count?: number | null
          id?: number
          legacy_user_id?: string | null
          media_count?: number | null
          name?: string | null
          reach?: number | null
          reach_1d?: number | null
          user_id?: string | null
          user_name?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      windsor_instagram_followers_daily: {
        Row: {
          date: string | null
          follower_count_1d: number | null
          id: number
          reach: number | null
          reach_1d: number | null
        }
        Insert: {
          date?: string | null
          follower_count_1d?: number | null
          id?: number
          reach?: number | null
          reach_1d?: number | null
        }
        Update: {
          date?: string | null
          follower_count_1d?: number | null
          id?: number
          reach?: number | null
          reach_1d?: number | null
        }
        Relationships: []
      }
      windsor_instagram_stories: {
        Row: {
          date: string | null
          id: number
          review_average_rating: number | null
          review_average_rating_total: number | null
          review_comment: string | null
          review_count: number | null
          review_create_time: string | null
          review_id: string | null
          review_reviewer: string | null
          review_star_rating: string | null
          review_total_count: number | null
          review_update_time: string | null
          search_keyword: string | null
          source: string | null
        }
        Insert: {
          date?: string | null
          id?: number
          review_average_rating?: number | null
          review_average_rating_total?: number | null
          review_comment?: string | null
          review_count?: number | null
          review_create_time?: string | null
          review_id?: string | null
          review_reviewer?: string | null
          review_star_rating?: string | null
          review_total_count?: number | null
          review_update_time?: string | null
          search_keyword?: string | null
          source?: string | null
        }
        Update: {
          date?: string | null
          id?: number
          review_average_rating?: number | null
          review_average_rating_total?: number | null
          review_comment?: string | null
          review_count?: number | null
          review_create_time?: string | null
          review_id?: string | null
          review_reviewer?: string | null
          review_star_rating?: string | null
          review_total_count?: number | null
          review_update_time?: string | null
          search_keyword?: string | null
          source?: string | null
        }
        Relationships: []
      }
      yuzer_eventos: {
        Row: {
          bar_id: number
          company_document: string | null
          company_name: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          evento_id: number
          id: number
          nome_evento: string | null
          raw_data: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          bar_id: number
          company_document?: string | null
          company_name?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          evento_id: number
          id?: number
          nome_evento?: string | null
          raw_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number
          company_document?: string | null
          company_name?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          evento_id?: number
          id?: number
          nome_evento?: string | null
          raw_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      yuzer_fatporhora: {
        Row: {
          bar_id: number
          created_at: string | null
          data_evento: string
          evento_id: number
          faturamento: number | null
          hora: number
          hora_formatada: string | null
          id: number
          raw_data: Json | null
          updated_at: string | null
          vendas: number | null
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          data_evento: string
          evento_id: number
          faturamento?: number | null
          hora: number
          hora_formatada?: string | null
          id?: number
          raw_data?: Json | null
          updated_at?: string | null
          vendas?: number | null
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          data_evento?: string
          evento_id?: number
          faturamento?: number | null
          hora?: number
          hora_formatada?: string | null
          id?: number
          raw_data?: Json | null
          updated_at?: string | null
          vendas?: number | null
        }
        Relationships: []
      }
      yuzer_pagamento: {
        Row: {
          aluguel_equipamentos: number | null
          bar_id: number
          created_at: string | null
          credito: number | null
          data_evento: string
          debito: number | null
          desconto_credito: number | null
          desconto_debito_pix: number | null
          dinheiro: number | null
          evento_id: number
          faturamento_bruto: number | null
          id: number
          pix: number | null
          producao: number | null
          qtd_maquinas: number | null
          quantidade_pedidos: number | null
          raw_data: Json | null
          repasse_liquido: number | null
          taxa_maquinas_calculada: number | null
          total_cancelado: number | null
          total_descontos: number | null
          updated_at: string | null
          valor_liquido: number | null
        }
        Insert: {
          aluguel_equipamentos?: number | null
          bar_id: number
          created_at?: string | null
          credito?: number | null
          data_evento: string
          debito?: number | null
          desconto_credito?: number | null
          desconto_debito_pix?: number | null
          dinheiro?: number | null
          evento_id: number
          faturamento_bruto?: number | null
          id?: number
          pix?: number | null
          producao?: number | null
          qtd_maquinas?: number | null
          quantidade_pedidos?: number | null
          raw_data?: Json | null
          repasse_liquido?: number | null
          taxa_maquinas_calculada?: number | null
          total_cancelado?: number | null
          total_descontos?: number | null
          updated_at?: string | null
          valor_liquido?: number | null
        }
        Update: {
          aluguel_equipamentos?: number | null
          bar_id?: number
          created_at?: string | null
          credito?: number | null
          data_evento?: string
          debito?: number | null
          desconto_credito?: number | null
          desconto_debito_pix?: number | null
          dinheiro?: number | null
          evento_id?: number
          faturamento_bruto?: number | null
          id?: number
          pix?: number | null
          producao?: number | null
          qtd_maquinas?: number | null
          quantidade_pedidos?: number | null
          raw_data?: Json | null
          repasse_liquido?: number | null
          taxa_maquinas_calculada?: number | null
          total_cancelado?: number | null
          total_descontos?: number | null
          updated_at?: string | null
          valor_liquido?: number | null
        }
        Relationships: []
      }
      yuzer_produtos: {
        Row: {
          bar_id: number
          categoria: string | null
          created_at: string | null
          data_evento: string
          eh_ingresso: boolean | null
          evento_id: number
          id: number
          percentual: number | null
          produto_id: number
          produto_nome: string | null
          quantidade: number | null
          raw_data: Json | null
          subcategoria: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          bar_id: number
          categoria?: string | null
          created_at?: string | null
          data_evento: string
          eh_ingresso?: boolean | null
          evento_id: number
          id?: number
          percentual?: number | null
          produto_id: number
          produto_nome?: string | null
          quantidade?: number | null
          raw_data?: Json | null
          subcategoria?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          bar_id?: number
          categoria?: string | null
          created_at?: string | null
          data_evento?: string
          eh_ingresso?: boolean | null
          evento_id?: number
          id?: number
          percentual?: number | null
          produto_id?: number
          produto_nome?: string | null
          quantidade?: number | null
          raw_data?: Json | null
          subcategoria?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      yuzer_sync_logs: {
        Row: {
          bar_id: number
          created_at: string | null
          detalhes: Json | null
          erro: string | null
          id: number
          periodo_fim: string | null
          periodo_inicio: string | null
          registros_inseridos: number | null
          registros_processados: number | null
          status: string
          tempo_execucao_ms: number | null
          tipo_sync: string
        }
        Insert: {
          bar_id: number
          created_at?: string | null
          detalhes?: Json | null
          erro?: string | null
          id?: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_inseridos?: number | null
          registros_processados?: number | null
          status: string
          tempo_execucao_ms?: number | null
          tipo_sync: string
        }
        Update: {
          bar_id?: number
          created_at?: string | null
          detalhes?: Json | null
          erro?: string | null
          id?: number
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_inseridos?: number | null
          registros_processados?: number | null
          status?: string
          tempo_execucao_ms?: number | null
          tipo_sync?: string
        }
        Relationships: []
      }
    }
    Views: {
      agente_uso_dashboard: {
        Row: {
          agent_name: string | null
          cache_hits: number | null
          data: string | null
          queries_sucesso: number | null
          rating_medio: number | null
          tempo_medio_ms: number | null
          tokens_medio: number | null
          total_feedbacks: number | null
          total_queries: number | null
        }
        Relationships: []
      }
      agente_uso_por_hora: {
        Row: {
          cache_hits: number | null
          hora: string | null
          queries: number | null
          tempo_medio: number | null
        }
        Relationships: []
      }
      analitico: {
        Row: {
          ano: number | null
          bar_id: number | null
          comandaorigem: string | null
          created_at: string | null
          custo: number | null
          desconto: number | null
          grp_desc: string | null
          id: number | null
          idempotency_key: string | null
          itemorigem: string | null
          itm: number | null
          itm_obs: string | null
          itm_qtd: number | null
          itm_valorfinal: number | null
          loc_desc: string | null
          mes: number | null
          prd: string | null
          prd_desc: string | null
          prefixo: string | null
          qtd: number | null
          tipo: string | null
          tipovenda: string | null
          trn: number | null
          trn_desc: string | null
          trn_dtgerencial: string | null
          updated_at: string | null
          usr_lancou: string | null
          valorfinal: number | null
          vd_localizacao: string | null
          vd_mesadesc: string | null
        }
        Insert: {
          ano?: number | null
          bar_id?: number | null
          comandaorigem?: string | null
          created_at?: string | null
          custo?: number | null
          desconto?: number | null
          grp_desc?: string | null
          id?: number | null
          idempotency_key?: string | null
          itemorigem?: string | null
          itm?: number | null
          itm_obs?: string | null
          itm_qtd?: number | null
          itm_valorfinal?: number | null
          loc_desc?: string | null
          mes?: number | null
          prd?: string | null
          prd_desc?: string | null
          prefixo?: string | null
          qtd?: number | null
          tipo?: string | null
          tipovenda?: string | null
          trn?: number | null
          trn_desc?: string | null
          trn_dtgerencial?: string | null
          updated_at?: string | null
          usr_lancou?: string | null
          valorfinal?: number | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Update: {
          ano?: number | null
          bar_id?: number | null
          comandaorigem?: string | null
          created_at?: string | null
          custo?: number | null
          desconto?: number | null
          grp_desc?: string | null
          id?: number | null
          idempotency_key?: string | null
          itemorigem?: string | null
          itm?: number | null
          itm_obs?: string | null
          itm_qtd?: number | null
          itm_valorfinal?: number | null
          loc_desc?: string | null
          mes?: number | null
          prd?: string | null
          prd_desc?: string | null
          prefixo?: string | null
          qtd?: number | null
          tipo?: string | null
          tipovenda?: string | null
          trn?: number | null
          trn_desc?: string | null
          trn_dtgerencial?: string | null
          updated_at?: string | null
          usr_lancou?: string | null
          valorfinal?: number | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_analitico_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_alertas: {
        Row: {
          acao_sugerida: string | null
          artista: string | null
          bar_id: number | null
          data_evento: string | null
          descricao: string | null
          evento: string | null
          prioridade: string | null
          prioridade_ordem: number | null
          tipo_alerta: string | null
          valor_atual: number | null
          valor_referencia: number | null
        }
        Relationships: []
      }
      analytics_artistas: {
        Row: {
          artista: string | null
          bar_id: number | null
          classificacao: string | null
          custo_artistico_medio: number | null
          custo_artistico_total: number | null
          dia_semana_mais_frequente: string | null
          dias_desde_ultimo_show: number | null
          faturamento_maximo: number | null
          faturamento_medio: number | null
          faturamento_minimo: number | null
          faturamento_total: number | null
          feedbacks_positivos: number | null
          media_anteriores_3_shows: number | null
          media_ultimos_3_shows: number | null
          percent_custo_artistico: number | null
          primeira_apresentacao: string | null
          publico_maximo: number | null
          publico_medio: number | null
          publico_total: number | null
          qtd_feedbacks: number | null
          ranking_faturamento: number | null
          ranking_publico: number | null
          recomendacao: string | null
          roi_artista: number | null
          sugestoes_acumuladas: string | null
          tendencia: string | null
          ticket_medio_geral: number | null
          total_shows: number | null
          ultima_apresentacao: string | null
          variacao_percentual: number | null
        }
        Relationships: []
      }
      analytics_comparacao_yoy: {
        Row: {
          ano: number | null
          bar_id: number | null
          faturamento_acumulado_ano: number | null
          faturamento_ano_anterior: number | null
          faturamento_medio: number | null
          faturamento_total: number | null
          mes: string | null
          mes_nome: string | null
          mes_num: number | null
          publico_ano_anterior: number | null
          publico_medio: number | null
          publico_total: number | null
          qtd_eventos: number | null
          semana: string | null
          semana_num: number | null
          status_yoy: string | null
          ticket_medio: number | null
          tipo_comparacao: string | null
          variacao_faturamento_yoy: number | null
          variacao_publico_yoy: number | null
        }
        Relationships: []
      }
      analytics_cruzamento_completo: {
        Row: {
          artista: string | null
          artista_camarim_satisfacao: string | null
          artista_classificacao: string | null
          artista_elogios: string | null
          artista_problemas: string | null
          artista_ranking: number | null
          artista_tendencia: string | null
          bar_id: number | null
          classificacao_nps: string | null
          classificacao_preditiva: string | null
          custo_artistico: number | null
          data_evento: string | null
          dia_semana: string | null
          evento_id: number | null
          eventos_concorrentes: string | null
          fat_00h: number | null
          fat_01h: number | null
          fat_02h: number | null
          fat_19h: number | null
          fat_20h: number | null
          fat_21h: number | null
          fat_22h: number | null
          fat_23h: number | null
          faturamento: number | null
          faturamento_bilheteria: number | null
          faturamento_cerveja: number | null
          faturamento_comida: number | null
          faturamento_drinks: number | null
          genero: string | null
          mes: number | null
          nome_evento: string | null
          nps_ambiente: number | null
          nps_atendimento: number | null
          nps_geral: number | null
          nps_musica: number | null
          percent_bebidas: number | null
          percent_comida: number | null
          percent_drinks: number | null
          performance_evento: string | null
          publico: number | null
          qtd_concorrentes: number | null
          qtd_respostas_nps: number | null
          roi_artista: number | null
          score_preditivo: number | null
          semana: number | null
          tem_concorrente_forte: number | null
          ticket_medio: number | null
        }
        Relationships: []
      }
      analytics_metas_2026: {
        Row: {
          ano: number | null
          bar_id: number | null
          descricao: string | null
          gap_para_meta: number | null
          mes: number | null
          mes_nome: string | null
          percentual_atingimento: number | null
          qtd_eventos: number | null
          status: string | null
          tipo: string | null
          tipo_meta: string | null
          valor_meta: number | null
          valor_realizado: number | null
        }
        Relationships: []
      }
      analytics_pico_horario: {
        Row: {
          desvio_padrao: number | null
          dia_semana: string | null
          hora: number | null
          hora_formatada: string | null
          media_faturamento: number | null
          media_vendas: number | null
          qtd_registros: number | null
          ranking_hora_dia: number | null
        }
        Relationships: []
      }
      analytics_score_preditivo: {
        Row: {
          artista: string | null
          bar_id: number | null
          classificacao: string | null
          data_evento: string | null
          dia_semana: string | null
          eventos_alto_impacto: number | null
          faturamento_real: number | null
          id: number | null
          media_fat_artista: number | null
          media_fat_dia_semana: number | null
          media_nps_dia_semana: number | null
          nome: string | null
          qtd_eventos_artista: number | null
          qtd_eventos_concorrencia: number | null
          score_artista: number | null
          score_concorrencia: number | null
          score_dia_semana: number | null
          score_experiencia_artista: number | null
          score_nps_historico: number | null
          score_total: number | null
        }
        Relationships: []
      }
      cliente_visitas: {
        Row: {
          bar_id: number | null
          cliente_nome: string | null
          cliente_telefone: string | null
          created_at: string | null
          id: number | null
        }
        Insert: {
          bar_id?: number | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string | null
          id?: number | null
        }
        Update: {
          bar_id?: number | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string | null
          id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_periodo_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          artista: string | null
          ativo: boolean | null
          atualizado_em: string | null
          bar_id: number | null
          c_art: number | null
          c_artistico_plan: number | null
          c_prod: number | null
          calculado_em: string | null
          capacidade_estimada: number | null
          cl_plan: number | null
          cl_real: number | null
          criado_em: string | null
          data_evento: string | null
          dia_semana: string | null
          fat_19h: number | null
          fat_19h_percent: number | null
          faturamento_bar: number | null
          faturamento_bar_manual: number | null
          faturamento_couvert: number | null
          faturamento_couvert_manual: number | null
          faturamento_liquido: number | null
          genero: string | null
          id: number | null
          lot_max: number | null
          m1_r: number | null
          nome: string | null
          nome_evento: string | null
          observacoes: string | null
          percent_art_fat: number | null
          percent_b: number | null
          percent_c: number | null
          percent_d: number | null
          precisa_recalculo: boolean | null
          publico_real: number | null
          real_r: number | null
          res_p: number | null
          res_tot: number | null
          semana: number | null
          sympla_checkins: number | null
          sympla_liquido: number | null
          t_bar: number | null
          t_coz: number | null
          t_medio: number | null
          tb_plan: number | null
          tb_real: number | null
          tb_real_calculado: number | null
          te_plan: number | null
          te_real: number | null
          te_real_calculado: number | null
          versao_calculo: number | null
          yuzer_ingressos: number | null
          yuzer_liquido: number | null
        }
        Insert: {
          artista?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          c_art?: number | null
          c_artistico_plan?: number | null
          c_prod?: number | null
          calculado_em?: string | null
          capacidade_estimada?: number | null
          cl_plan?: number | null
          cl_real?: number | null
          criado_em?: string | null
          data_evento?: string | null
          dia_semana?: string | null
          fat_19h?: number | null
          fat_19h_percent?: number | null
          faturamento_bar?: number | null
          faturamento_bar_manual?: number | null
          faturamento_couvert?: number | null
          faturamento_couvert_manual?: number | null
          faturamento_liquido?: number | null
          genero?: string | null
          id?: number | null
          lot_max?: number | null
          m1_r?: number | null
          nome?: string | null
          nome_evento?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          precisa_recalculo?: boolean | null
          publico_real?: number | null
          real_r?: number | null
          res_p?: number | null
          res_tot?: number | null
          semana?: number | null
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          t_bar?: number | null
          t_coz?: number | null
          t_medio?: number | null
          tb_plan?: number | null
          tb_real?: number | null
          tb_real_calculado?: number | null
          te_plan?: number | null
          te_real?: number | null
          te_real_calculado?: number | null
          versao_calculo?: number | null
          yuzer_ingressos?: number | null
          yuzer_liquido?: number | null
        }
        Update: {
          artista?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bar_id?: number | null
          c_art?: number | null
          c_artistico_plan?: number | null
          c_prod?: number | null
          calculado_em?: string | null
          capacidade_estimada?: number | null
          cl_plan?: number | null
          cl_real?: number | null
          criado_em?: string | null
          data_evento?: string | null
          dia_semana?: string | null
          fat_19h?: number | null
          fat_19h_percent?: number | null
          faturamento_bar?: number | null
          faturamento_bar_manual?: number | null
          faturamento_couvert?: number | null
          faturamento_couvert_manual?: number | null
          faturamento_liquido?: number | null
          genero?: string | null
          id?: number | null
          lot_max?: number | null
          m1_r?: number | null
          nome?: string | null
          nome_evento?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          precisa_recalculo?: boolean | null
          publico_real?: number | null
          real_r?: number | null
          res_p?: number | null
          res_tot?: number | null
          semana?: number | null
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          t_bar?: number | null
          t_coz?: number | null
          t_medio?: number | null
          tb_plan?: number | null
          tb_real?: number | null
          tb_real_calculado?: number | null
          te_plan?: number | null
          te_real?: number | null
          te_real_calculado?: number | null
          versao_calculo?: number | null
          yuzer_ingressos?: number | null
          yuzer_liquido?: number | null
        }
        Relationships: []
      }
      feedback_consolidado: {
        Row: {
          avaliacao_resumo: string | null
          bar_id: number | null
          comentario: string | null
          created_at: string | null
          data: string | null
          elogios: string | null
          nome_respondente: string | null
          nota_numerica: number | null
          prioridade: number | null
          problemas: string | null
          setor: string | null
          status: string | null
          sugestoes: string | null
          tipo_feedback: string | null
        }
        Relationships: []
      }
      feedback_resumo_mensal: {
        Row: {
          alta_prioridade: number | null
          bar_id: number | null
          com_problemas: number | null
          media_nota: number | null
          mes: string | null
          negativos: number | null
          positivos: number | null
          tipo_feedback: string | null
          total_respostas: number | null
        }
        Relationships: []
      }
      feedback_resumo_semanal: {
        Row: {
          bar_id: number | null
          media_nota: number | null
          negativos: number | null
          positivos: number | null
          semana: string | null
          tipo_feedback: string | null
          total_respostas: number | null
        }
        Relationships: []
      }
      getin_reservas: {
        Row: {
          bar_id: number | null
          confirmation_sent: boolean | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          date: string | null
          discount: number | null
          id: number | null
          info: string | null
          name: string | null
          no_show: boolean | null
          no_show_eligible: boolean | null
          no_show_hours: number | null
          no_show_tax: number | null
          nps_answered: boolean | null
          nps_url: string | null
          people: number | null
          phone: string | null
          raw_data: Json | null
          reservation_date: string | null
          reservation_id: string | null
          reservation_time: string | null
          sector_id: string | null
          sector_name: string | null
          status: string | null
          unit_city_name: string | null
          unit_coordinates_lat: number | null
          unit_coordinates_lng: number | null
          unit_cover_image: string | null
          unit_cuisine_name: string | null
          unit_full_address: string | null
          unit_id: string | null
          unit_name: string | null
          unit_profile_image: string | null
          unit_zipcode: string | null
          updated_at: string | null
        }
        Insert: {
          bar_id?: number | null
          confirmation_sent?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date?: never
          discount?: number | null
          id?: number | null
          info?: string | null
          name?: string | null
          no_show?: boolean | null
          no_show_eligible?: boolean | null
          no_show_hours?: number | null
          no_show_tax?: number | null
          nps_answered?: boolean | null
          nps_url?: string | null
          people?: number | null
          phone?: string | null
          raw_data?: Json | null
          reservation_date?: string | null
          reservation_id?: string | null
          reservation_time?: string | null
          sector_id?: string | null
          sector_name?: string | null
          status?: string | null
          unit_city_name?: string | null
          unit_coordinates_lat?: number | null
          unit_coordinates_lng?: number | null
          unit_cover_image?: string | null
          unit_cuisine_name?: string | null
          unit_full_address?: string | null
          unit_id?: string | null
          unit_name?: string | null
          unit_profile_image?: string | null
          unit_zipcode?: string | null
          updated_at?: string | null
        }
        Update: {
          bar_id?: number | null
          confirmation_sent?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          date?: never
          discount?: number | null
          id?: number | null
          info?: string | null
          name?: string | null
          no_show?: boolean | null
          no_show_eligible?: boolean | null
          no_show_hours?: number | null
          no_show_tax?: number | null
          nps_answered?: boolean | null
          nps_url?: string | null
          people?: number | null
          phone?: string | null
          raw_data?: Json | null
          reservation_date?: string | null
          reservation_id?: string | null
          reservation_time?: string | null
          sector_id?: string | null
          sector_name?: string | null
          status?: string | null
          unit_city_name?: string | null
          unit_coordinates_lat?: number | null
          unit_coordinates_lng?: number | null
          unit_cover_image?: string | null
          unit_cuisine_name?: string | null
          unit_full_address?: string | null
          unit_id?: string | null
          unit_name?: string | null
          unit_profile_image?: string | null
          unit_zipcode?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "getin_reservations_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_agregado_semanal: {
        Row: {
          ano: number | null
          bar_id: number | null
          comentarios_array: string[] | null
          comentarios_reservas_array: string[] | null
          data_fim: string | null
          data_inicio: string | null
          nps_ambiente: number | null
          nps_atendimento: number | null
          nps_comida: number | null
          nps_drink: number | null
          nps_geral: number | null
          nps_limpeza: number | null
          nps_musica: number | null
          nps_preco: number | null
          nps_reservas: number | null
          numero_semana: number | null
          total_respostas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      periodo: {
        Row: {
          bar_id: number | null
          cht_nome: string | null
          cli_dtnasc: string | null
          cli_email: string | null
          cli_fone: string | null
          cli_nome: string | null
          created_at: string | null
          dt_contabil: string | null
          dt_gerencial: string | null
          id: number | null
          idempotency_key: string | null
          motivo: string | null
          pessoas: number | null
          qtd_itens: number | null
          semana: number | null
          tipovenda: string | null
          ultimo_pedido: string | null
          updated_at: string | null
          usr_abriu: string | null
          vd_dtcontabil: string | null
          vd_localizacao: string | null
          vd_mesadesc: string | null
          vr_acrescimo: number | null
          vr_couvert: number | null
          vr_desconto: number | null
          vr_pagamentos: number | null
          vr_produtos: number | null
          vr_repique: number | null
          vr_taxa: number | null
          vr_total: number | null
        }
        Insert: {
          bar_id?: number | null
          cht_nome?: string | null
          cli_dtnasc?: string | null
          cli_email?: string | null
          cli_fone?: string | null
          cli_nome?: string | null
          created_at?: string | null
          dt_contabil?: string | null
          dt_gerencial?: string | null
          id?: number | null
          idempotency_key?: string | null
          motivo?: string | null
          pessoas?: number | null
          qtd_itens?: number | null
          semana?: number | null
          tipovenda?: string | null
          ultimo_pedido?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          vd_dtcontabil?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
          vr_acrescimo?: never
          vr_couvert?: number | null
          vr_desconto?: number | null
          vr_pagamentos?: number | null
          vr_produtos?: number | null
          vr_repique?: number | null
          vr_taxa?: never
          vr_total?: never
        }
        Update: {
          bar_id?: number | null
          cht_nome?: string | null
          cli_dtnasc?: string | null
          cli_email?: string | null
          cli_fone?: string | null
          cli_nome?: string | null
          created_at?: string | null
          dt_contabil?: string | null
          dt_gerencial?: string | null
          id?: number | null
          idempotency_key?: string | null
          motivo?: string | null
          pessoas?: number | null
          qtd_itens?: number | null
          semana?: number | null
          tipovenda?: string | null
          ultimo_pedido?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          vd_dtcontabil?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
          vr_acrescimo?: never
          vr_couvert?: number | null
          vr_desconto?: number | null
          vr_pagamentos?: number | null
          vr_produtos?: number | null
          vr_repique?: number | null
          vr_taxa?: never
          vr_total?: never
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_periodo_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_diario_corrigido: {
        Row: {
          bar_id: number | null
          data: string | null
          id: number | null
          total_pessoas_bruto: number | null
        }
        Insert: {
          bar_id?: number | null
          data?: string | null
          id?: number | null
          total_pessoas_bruto?: never
        }
        Update: {
          bar_id?: number | null
          data?: string | null
          id?: number | null
          total_pessoas_bruto?: never
        }
        Relationships: []
      }
      sympla_bilheteria: {
        Row: {
          bar_id: number | null
          created_at: string | null
          dados_comprador: Json | null
          dados_utm: Json | null
          data_pedido: string | null
          email_comprador: string | null
          evento_sympla_id: string | null
          id: number | null
          nome_comprador: string | null
          pedido_sympla_id: string | null
          raw_data: Json | null
          status_pedido: string | null
          taxa_sympla: number | null
          tipo_transacao: string | null
          updated_at: string | null
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          dados_comprador?: Json | null
          dados_utm?: Json | null
          data_pedido?: string | null
          email_comprador?: string | null
          evento_sympla_id?: string | null
          id?: number | null
          nome_comprador?: string | null
          pedido_sympla_id?: string | null
          raw_data?: Json | null
          status_pedido?: string | null
          taxa_sympla?: number | null
          tipo_transacao?: string | null
          updated_at?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          dados_comprador?: Json | null
          dados_utm?: Json | null
          data_pedido?: string | null
          email_comprador?: string | null
          evento_sympla_id?: string | null
          id?: number | null
          nome_comprador?: string | null
          pedido_sympla_id?: string | null
          raw_data?: Json | null
          status_pedido?: string | null
          taxa_sympla?: number | null
          tipo_transacao?: string | null
          updated_at?: string | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sympla_pedidos_evento_sympla_id_fkey"
            columns: ["evento_sympla_id"]
            isOneToOne: false
            referencedRelation: "sympla_eventos"
            referencedColumns: ["evento_sympla_id"]
          },
          {
            foreignKeyName: "sympla_pedidos_evento_sympla_id_fkey"
            columns: ["evento_sympla_id"]
            isOneToOne: false
            referencedRelation: "sympla_resumo"
            referencedColumns: ["evento_sympla_id"]
          },
        ]
      }
      sympla_resumo: {
        Row: {
          checkins_realizados: number | null
          data_fim: string | null
          data_inicio: string | null
          evento_sympla_id: string | null
          nome_evento: string | null
          receita_total: number | null
          total_participantes: number | null
        }
        Relationships: []
      }
      tempo: {
        Row: {
          ano: number | null
          bar_id: number | null
          categoria: string | null
          created_at: string | null
          data: string | null
          dds: number | null
          dia: string | null
          diadasemana: string | null
          grp_desc: string | null
          hora: string | null
          id: number | null
          idempotency_key: string | null
          itm: string | null
          itm_qtd: number | null
          loc_desc: string | null
          mes: number | null
          prd: number | null
          prd_desc: string | null
          prd_idexterno: string | null
          prefixo: string | null
          t0_lancamento: string | null
          t0_t1: number | null
          t0_t2: number | null
          t0_t3: number | null
          t1_prodini: string | null
          t1_t2: number | null
          t1_t3: number | null
          t2_prodfim: string | null
          t2_t3: number | null
          t3_entrega: string | null
          tipovenda: string | null
          updated_at: string | null
          usr_abriu: string | null
          usr_entregou: string | null
          usr_lancou: string | null
          usr_produziu: string | null
          usr_transfcancelou: string | null
          vd_localizacao: string | null
          vd_mesadesc: string | null
        }
        Insert: {
          ano?: number | null
          bar_id?: number | null
          categoria?: string | null
          created_at?: string | null
          data?: string | null
          dds?: number | null
          dia?: string | null
          diadasemana?: string | null
          grp_desc?: string | null
          hora?: string | null
          id?: number | null
          idempotency_key?: string | null
          itm?: string | null
          itm_qtd?: number | null
          loc_desc?: string | null
          mes?: number | null
          prd?: number | null
          prd_desc?: string | null
          prd_idexterno?: string | null
          prefixo?: string | null
          t0_lancamento?: string | null
          t0_t1?: number | null
          t0_t2?: number | null
          t0_t3?: number | null
          t1_prodini?: string | null
          t1_t2?: number | null
          t1_t3?: number | null
          t2_prodfim?: string | null
          t2_t3?: number | null
          t3_entrega?: string | null
          tipovenda?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_entregou?: string | null
          usr_lancou?: string | null
          usr_produziu?: string | null
          usr_transfcancelou?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Update: {
          ano?: number | null
          bar_id?: number | null
          categoria?: string | null
          created_at?: string | null
          data?: string | null
          dds?: number | null
          dia?: string | null
          diadasemana?: string | null
          grp_desc?: string | null
          hora?: string | null
          id?: number | null
          idempotency_key?: string | null
          itm?: string | null
          itm_qtd?: number | null
          loc_desc?: string | null
          mes?: number | null
          prd?: number | null
          prd_desc?: string | null
          prd_idexterno?: string | null
          prefixo?: string | null
          t0_lancamento?: string | null
          t0_t1?: number | null
          t0_t2?: number | null
          t0_t3?: number | null
          t1_prodini?: string | null
          t1_t2?: number | null
          t1_t3?: number | null
          t2_prodfim?: string | null
          t2_t3?: number | null
          t3_entrega?: string | null
          tipovenda?: string | null
          updated_at?: string | null
          usr_abriu?: string | null
          usr_entregou?: string | null
          usr_lancou?: string | null
          usr_produziu?: string | null
          usr_transfcancelou?: string | null
          vd_localizacao?: string | null
          vd_mesadesc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_tempo_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      token_status: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          last_used: string | null
          status: string | null
          token_name: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          last_used?: string | null
          status?: never
          token_name?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          last_used?: string | null
          status?: never
          token_name?: string | null
        }
        Relationships: []
      }
      v_contagem_atual: {
        Row: {
          alerta_preenchimento: boolean | null
          alerta_variacao: boolean | null
          bar_id: number | null
          categoria: string | null
          created_at: string | null
          data_contagem: string | null
          descricao: string | null
          estoque_fechado: number | null
          estoque_flutuante: number | null
          estoque_total: number | null
          id: number | null
          observacoes: string | null
          preco: number | null
          produto_id: string | null
          updated_at: string | null
          usuario_id: number | null
          usuario_nome: string | null
          valor_total: number | null
          variacao_percentual: number | null
        }
        Relationships: []
      }
      v_contagem_com_historico: {
        Row: {
          alerta_preenchimento: boolean | null
          alerta_variacao: boolean | null
          bar_id: number | null
          categoria: string | null
          created_at: string | null
          data_anterior: string | null
          data_contagem: string | null
          descricao: string | null
          estoque_anterior: number | null
          estoque_fechado: number | null
          estoque_flutuante: number | null
          estoque_total: number | null
          id: number | null
          observacoes: string | null
          preco: number | null
          preco_anterior: number | null
          produto_id: string | null
          updated_at: string | null
          usuario_id: number | null
          usuario_nome: string | null
          valor_total: number | null
          variacao_percentual: number | null
        }
        Relationships: []
      }
      v_contagem_consolidada_por_area: {
        Row: {
          area_id: number | null
          area_nome: string | null
          area_tipo: string | null
          bar_id: number | null
          categoria: string | null
          created_at: string | null
          data_contagem: string | null
          descricao: string | null
          estoque_fechado: number | null
          estoque_flutuante: number | null
          estoque_total: number | null
          id: number | null
          preco: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      v_contagem_total_por_produto: {
        Row: {
          areas: string | null
          bar_id: number | null
          categoria: string | null
          data_contagem: string | null
          descricao: string | null
          estoque_fechado_total: number | null
          estoque_flutuante_total: number | null
          estoque_total: number | null
          preco: number | null
          total_areas: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      v_falae_nps_periodo: {
        Row: {
          bar_id: number | null
          detratores: number | null
          media_nps: number | null
          mes: string | null
          neutros: number | null
          nps_score: number | null
          promotores: number | null
          semana: string | null
          total_respostas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "falae_respostas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      v_resumo_por_area: {
        Row: {
          area_id: number | null
          area_nome: string | null
          area_tipo: string | null
          ativo: boolean | null
          data_contagem: string | null
          estoque_total: number | null
          primeira_contagem: string | null
          total_categorias: number | null
          total_itens: number | null
          ultima_contagem: string | null
          valor_total: number | null
        }
        Relationships: []
      }
      view_dre: {
        Row: {
          ano: number | null
          categoria_macro: string | null
          mes: number | null
          origem: string | null
          total_registros: number | null
          total_valor: number | null
        }
        Relationships: []
      }
      view_eventos: {
        Row: {
          artista: string | null
          atualizado_em: string | null
          bar_id: number | null
          c_art: number | null
          c_art_real: number | null
          c_prod: number | null
          casa_show: string | null
          cl_real: number | null
          cont_liquido: number | null
          criado_em: string | null
          custo_producao: number | null
          data_evento: string | null
          despesas_operacionais: number | null
          dia_semana: string | null
          fat_19h_percent: number | null
          id: number | null
          liquido_real: number | null
          lot_max: number | null
          lucro_bruto: number | null
          lucro_liquido: number | null
          margem_bruto: number | null
          margem_liquido: number | null
          nome: string | null
          observacoes: string | null
          percent_art_fat: number | null
          percent_b: number | null
          percent_c: number | null
          percent_d: number | null
          promoter: string | null
          publico_esperado: number | null
          real_r: number | null
          receita_bar: number | null
          receita_garantida: number | null
          receita_total: number | null
          status: string | null
          sympla_checkins: number | null
          sympla_liquido: number | null
          sympla_participantes: number | null
          sympla_total_pedidos: number | null
          t_bar: number | null
          t_coz: number | null
          tb_real: number | null
          te_real: number | null
          tipo_evento: string | null
        }
        Insert: {
          artista?: string | null
          atualizado_em?: string | null
          bar_id?: number | null
          c_art?: number | null
          c_art_real?: number | null
          c_prod?: number | null
          casa_show?: never
          cl_real?: number | null
          cont_liquido?: never
          criado_em?: string | null
          custo_producao?: never
          data_evento?: string | null
          despesas_operacionais?: never
          dia_semana?: string | null
          fat_19h_percent?: number | null
          id?: number | null
          liquido_real?: never
          lot_max?: number | null
          lucro_bruto?: never
          lucro_liquido?: never
          margem_bruto?: never
          margem_liquido?: never
          nome?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          promoter?: never
          publico_esperado?: number | null
          real_r?: number | null
          receita_bar?: never
          receita_garantida?: never
          receita_total?: never
          status?: never
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          sympla_participantes?: never
          sympla_total_pedidos?: never
          t_bar?: number | null
          t_coz?: number | null
          tb_real?: number | null
          te_real?: number | null
          tipo_evento?: never
        }
        Update: {
          artista?: string | null
          atualizado_em?: string | null
          bar_id?: number | null
          c_art?: number | null
          c_art_real?: number | null
          c_prod?: number | null
          casa_show?: never
          cl_real?: number | null
          cont_liquido?: never
          criado_em?: string | null
          custo_producao?: never
          data_evento?: string | null
          despesas_operacionais?: never
          dia_semana?: string | null
          fat_19h_percent?: number | null
          id?: number | null
          liquido_real?: never
          lot_max?: number | null
          lucro_bruto?: never
          lucro_liquido?: never
          margem_bruto?: never
          margem_liquido?: never
          nome?: string | null
          observacoes?: string | null
          percent_art_fat?: number | null
          percent_b?: number | null
          percent_c?: number | null
          percent_d?: number | null
          promoter?: never
          publico_esperado?: number | null
          real_r?: number | null
          receita_bar?: never
          receita_garantida?: never
          receita_total?: never
          status?: never
          sympla_checkins?: number | null
          sympla_liquido?: number | null
          sympla_participantes?: never
          sympla_total_pedidos?: never
          t_bar?: number | null
          t_coz?: number | null
          tb_real?: number | null
          te_real?: number | null
          tipo_evento?: never
        }
        Relationships: []
      }
      view_stockout_por_categoria: {
        Row: {
          categoria_grupo: string | null
          data_consulta: string | null
          ordem: number | null
          percentual_stockout: number | null
          produtos_stockout: number | null
          total_produtos_ativos: number | null
        }
        Relationships: []
      }
      view_top_produtos: {
        Row: {
          bar_id: number | null
          custo_total: number | null
          grupo: string | null
          margem_lucro_percentual: number | null
          primeira_venda: string | null
          produto: string | null
          quantidade_total: number | null
          total_vendas: number | null
          ultima_venda: string | null
          valor_total: number | null
          vendas_por_dia: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contahub_analitico_bar_id"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      view_visao_geral_anual: {
        Row: {
          ano: number | null
          bar_id: number | null
          faturamento_contahub: number | null
          faturamento_sympla: number | null
          faturamento_total: number | null
          faturamento_yuzer: number | null
          pessoas_contahub: number | null
          pessoas_sympla: number | null
          pessoas_total: number | null
          pessoas_yuzer: number | null
          reputacao_media: number | null
        }
        Relationships: []
      }
      view_visao_geral_trimestral: {
        Row: {
          ano: number | null
          atingimento_meta_pct: number | null
          bar_id: number | null
          custo_artistico_total: number | null
          custo_producao_total: number | null
          eventos_ativos: number | null
          eventos_domingo: number | null
          eventos_sabado: number | null
          eventos_sexta: number | null
          faturamento_domingo: number | null
          faturamento_medio: number | null
          faturamento_sabado: number | null
          faturamento_sexta: number | null
          faturamento_total: number | null
          fim_trimestre: string | null
          inicio_trimestre: string | null
          maior_faturamento: number | null
          maior_publico: number | null
          menor_faturamento: number | null
          meta_total: number | null
          percent_artistico_medio: number | null
          publico_medio: number | null
          publico_total: number | null
          refreshed_at: string | null
          sympla_checkins_total: number | null
          sympla_total: number | null
          ticket_bar_medio: number | null
          ticket_entrada_medio: number | null
          ticket_total_medio: number | null
          total_eventos: number | null
          trimestre: number | null
        }
        Relationships: []
      }
      vw_chamados_resumo: {
        Row: {
          alta_prioridade: number | null
          bar_id: number | null
          criticos: number | null
          sla_violados: number | null
          status: Database["public"]["Enums"]["status_chamado"] | null
          tempo_medio_primeira_resposta_horas: number | null
          tempo_medio_resolucao_horas: number | null
          total: number | null
        }
        Relationships: []
      }
      vw_cmo_mensal: {
        Row: {
          ano: number | null
          bar_id: number | null
          bar_nome: string | null
          mes: number | null
          qtd_funcionarios: number | null
          total_custo_empresa: number | null
          total_dias_trabalhados: number | null
          total_encargos: number | null
          total_salario_liquido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_cmo_por_area: {
        Row: {
          ano: number | null
          area_id: number | null
          area_nome: string | null
          bar_id: number | null
          media_custo_funcionario: number | null
          mes: number | null
          qtd_funcionarios: number | null
          total_custo_empresa: number | null
          total_salario_liquido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_diagnostico_anos: {
        Row: {
          ano_data_inicio: number | null
          ano_registro: number | null
          ano_sistema: number | null
          bar_id: number | null
          bar_nome: string | null
          data_fim: string | null
          data_inicio: string | null
          id: number | null
          numero_semana: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "desempenho_semanal_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_log_tables_status: {
        Row: {
          registros: number | null
          retencao: string | null
          tabela: unknown
          tamanho: string | null
        }
        Relationships: []
      }
      vw_monitoramento_faturamento: {
        Row: {
          data_referencia: string | null
          dias_com_erro: number | null
          dias_corretos: number | null
          diferenca_total: number | null
          status_geral: string | null
        }
        Relationships: []
      }
      vw_provisoes_acumuladas: {
        Row: {
          bar_id: number | null
          dias_ferias_vencidos: number | null
          funcionario_id: number | null
          funcionario_nome: string | null
          meses_trabalhados: number | null
          primeiro_mes: number | null
          total_decimo_terceiro: number | null
          total_ferias: number | null
          total_fgts: number | null
          total_multa_fgts: number | null
          total_provisao_certa: number | null
          total_provisao_eventual: number | null
          total_terco_ferias: number | null
          ultimo_mes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provisoes_trabalhistas_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisoes_trabalhistas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      yuzer_analitico: {
        Row: {
          bar_id: number | null
          created_at: string | null
          data_evento: string | null
          evento_id: number | null
          faturamento: number | null
          hora: number | null
          hora_formatada: string | null
          id: number | null
          raw_data: Json | null
          updated_at: string | null
          vendas: number | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          data_evento?: string | null
          evento_id?: number | null
          faturamento?: number | null
          hora?: number | null
          hora_formatada?: string | null
          id?: number | null
          raw_data?: Json | null
          updated_at?: string | null
          vendas?: number | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          data_evento?: string | null
          evento_id?: number | null
          faturamento?: number | null
          hora?: number | null
          hora_formatada?: string | null
          id?: number | null
          raw_data?: Json | null
          updated_at?: string | null
          vendas?: number | null
        }
        Relationships: []
      }
      yuzer_produtos_categorizado: {
        Row: {
          bar_id: number | null
          categoria_auto: string | null
          created_at: string | null
          data_evento: string | null
          eh_ingresso: boolean | null
          evento_id: number | null
          id: number | null
          percentual: number | null
          produto_id: number | null
          produto_nome: string | null
          quantidade: number | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          bar_id?: number | null
          categoria_auto?: never
          created_at?: string | null
          data_evento?: string | null
          eh_ingresso?: boolean | null
          evento_id?: number | null
          id?: number | null
          percentual?: number | null
          produto_id?: number | null
          produto_nome?: string | null
          quantidade?: number | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          bar_id?: number | null
          categoria_auto?: never
          created_at?: string | null
          data_evento?: string | null
          eh_ingresso?: boolean | null
          evento_id?: number | null
          id?: number | null
          percentual?: number | null
          produto_id?: number | null
          produto_nome?: string | null
          quantidade?: number | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      yuzer_resumo_por_categoria: {
        Row: {
          bar_id: number | null
          bilheteria: number | null
          cerveja: number | null
          comida: number | null
          data_evento: string | null
          drinks: number | null
          evento_id: number | null
          nao_alcoolico: number | null
          outros: number | null
          total_bebidas: number | null
          total_bruto: number | null
          total_consumo: number | null
        }
        Relationships: []
      }
      yuzer_resumo2: {
        Row: {
          data_evento: string | null
          evento_id: number | null
          faturamento_bruto: number | null
          nome_evento: string | null
          quantidade_pedidos: number | null
          status_evento: string | null
          valor_liquido: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_get_api_credentials:
        | {
            Args: { p_bar_id: number }
            Returns: {
              access_token: string
              ambiente: string
              ativo: boolean
              atualizado_em: string
              authorization_code: string
              bar_id: number
              base_url: string
              client_id: string
              client_secret: string
              criado_em: string
              empresa_cnpj: string
              empresa_id: string
              empresa_nome: string
              expires_at: string
              id: number
              last_token_refresh: string
              oauth_state: string
              redirect_uri: string
              refresh_token: string
              scopes: string
              sistema: string
              token_refresh_count: number
              token_type: string
            }[]
          }
        | {
            Args: { p_ambiente: string; p_bar_id: number; p_sistema: string }
            Returns: {
              access_token: string
              ambiente: string
              ativo: boolean
              atualizado_em: string
              authorization_code: string
              bar_id: number
              base_url: string
              client_id: string
              client_secret: string
              criado_em: string
              empresa_cnpj: string
              empresa_id: string
              empresa_nome: string
              expires_at: string
              id: number
              last_token_refresh: string
              oauth_state: string
              redirect_uri: string
              refresh_token: string
              scopes: string
              sistema: string
              token_refresh_count: number
              token_type: string
            }[]
          }
      admin_get_credentials_by_bar:
        | {
            Args: { p_bar_id: number }
            Returns: {
              access_token: string
              ativo: boolean
              auth_url: string
              bar_id: number
              client_id: string
              client_secret: string
              created_at: string
              expires_at: string
              id: number
              nome: string
              redirect_uri: string
              refresh_token: string
              scope: string
              token_url: string
              updated_at: string
            }[]
          }
        | {
            Args: { p_ambiente: string; p_bar_id: number; p_sistema: string }
            Returns: {
              access_token: string
              ambiente: string
              ativo: boolean
              atualizado_em: string
              authorization_code: string
              bar_id: number
              base_url: string
              client_id: string
              client_secret: string
              criado_em: string
              empresa_cnpj: string
              empresa_id: string
              empresa_nome: string
              expires_at: string
              id: number
              last_token_refresh: string
              oauth_state: string
              redirect_uri: string
              refresh_token: string
              scopes: string
              sistema: string
              token_refresh_count: number
              token_type: string
            }[]
          }
      admin_get_credentials_by_state: {
        Args: {
          p_ambiente: string
          p_bar_id: number
          p_oauth_state: string
          p_sistema: string
        }
        Returns: {
          access_token: string
          ambiente: string
          bar_id: number
          client_id: string
          client_secret: string
          id: number
          oauth_state: string
          redirect_uri: string
          refresh_token: string
          sistema: string
        }[]
      }
      admin_save_tokens: {
        Args: {
          p_access_token: string
          p_authorization_code: string
          p_credential_id: number
          p_expires_at: string
          p_refresh_token: string
          p_token_type: string
        }
        Returns: undefined
      }
      admin_upsert_api_credentials: {
        Args: {
          p_ambiente: string
          p_ativo: boolean
          p_bar_id: number
          p_base_url: string
          p_client_id: string
          p_client_secret: string
          p_oauth_state?: string
          p_redirect_uri: string
          p_scopes: string
          p_sistema: string
        }
        Returns: number
      }
      advanced_system_health: { Args: never; Returns: Json }
      agendar_reprocessamento_automatico: {
        Args: { data_evento: string }
        Returns: string
      }
      agora_brasil: { Args: never; Returns: string }
      aplicar_desconto_qr: {
        Args: {
          p_bar_id?: number
          p_funcionario_id?: string
          p_qr_token: string
          p_valor_desconto: number
        }
        Returns: Json
      }
      atualizar_itens_desempenho_semanal: { Args: never; Returns: undefined }
      auditoria_mensal_retroativa: {
        Args: { p_ano?: number; p_bar_id?: number; p_mes?: number }
        Returns: {
          data_evento: string
          eventos_alterados: number
          mudancas_cl_real: number
          mudancas_real_r: number
          total_eventos: number
          total_mudancas: number
          valor_total_diferenca: number
        }[]
      }
      auditoria_semanal_retroativa: {
        Args: { p_bar_id?: number }
        Returns: {
          data_evento: string
          eventos_alterados: number
          mudancas_cl_real: number
          mudancas_real_r: number
          total_eventos: number
          total_mudancas: number
          valor_total_diferenca: number
        }[]
      }
      auto_recalculo_eventos_pendentes:
        | {
            Args: never
            Returns: {
              detalhes: Json
              tempo_execucao_segundos: number
              total_erros: number
              total_processados: number
              total_sucesso: number
            }[]
          }
        | {
            Args: { p_tipo_execucao?: string }
            Returns: {
              detalhes: Json
              log_id: number
              tempo_execucao_segundos: number
              total_erros: number
              total_processados: number
              total_sucesso: number
            }[]
          }
      auto_recalculo_eventos_pendentes_v2: {
        Args: { p_limite?: number }
        Returns: {
          detalhes: Json
          tempo_execucao_segundos: number
          total_erros: number
          total_processados: number
          total_sucesso: number
        }[]
      }
      auto_update_tempo_dia_date: { Args: never; Returns: string }
      bloquear_dados_antigos: { Args: { p_bar_id?: number }; Returns: string }
      bloquear_dados_historicos:
        | { Args: { p_bar_id: number; p_dias_atras?: number }; Returns: string }
        | { Args: { p_dias_atras?: number }; Returns: string }
      buscar_retry_pendentes: {
        Args: never
        Returns: {
          data_evento: string
          detalhes: Json
          id: number
          max_tentativas: number
          proxima_tentativa: string
          tentativa_atual: number
          tipo_sync: string
          ultimo_erro: string
        }[]
      }
      calcular_atrasos_periodo: {
        Args: { p_bar_id?: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          atrasos_bar: number
          atrasos_cozinha: number
        }[]
      }
      calcular_clientes_ativos_dias: {
        Args: { p_bar_id: number; p_data_fim: string; p_dias?: number }
        Returns: number
      }
      calcular_clientes_ativos_faixa: {
        Args: {
          p_bar_id: number
          p_data_fim: string
          p_dias_fim: number
          p_dias_inicio: number
        }
        Returns: number
      }
      calcular_clientes_ativos_periodo: {
        Args: {
          p_bar_id: number
          p_data_90_dias_atras: string
          p_data_fim_periodo: string
          p_data_inicio_periodo: string
        }
        Returns: number
      }
      calcular_metricas_clientes: {
        Args: {
          p_bar_id: number
          p_data_fim_anterior: string
          p_data_fim_atual: string
          p_data_inicio_anterior: string
          p_data_inicio_atual: string
        }
        Returns: {
          novos_anterior: number
          novos_atual: number
          retornantes_anterior: number
          retornantes_atual: number
          total_anterior: number
          total_atual: number
        }[]
      }
      calcular_proxima_execucao: {
        Args: {
          configuracao_frequencia: Json
          frequencia: string
          hora_execucao: string
          ultima_execucao?: string
        }
        Returns: string
      }
      calcular_totais_contaazul: {
        Args: {
          bar_id_param: number
          data_fim_param: string
          data_inicio_param: string
        }
        Returns: {
          qtd_despesas: number
          qtd_receitas: number
          saldo_liquido: number
          total_despesas: number
          total_receitas: number
          total_registros: number
        }[]
      }
      calcular_visao_geral_anual: {
        Args: { p_ano?: number; p_bar_id: number }
        Returns: {
          faturamento_contahub: number
          faturamento_sympla: number
          faturamento_total: number
          faturamento_yuzer: number
          pessoas_contahub: number
          pessoas_sympla: number
          pessoas_total: number
          pessoas_yuzer: number
          reputacao_media: number
        }[]
      }
      calcular_visao_geral_trimestral: {
        Args: { p_ano?: number; p_bar_id: number; p_trimestre?: number }
        Returns: {
          artistica_percentual: number
          artistica_percentual_anterior: number
          artistica_total: number
          artistica_total_anterior: number
          clientes_ativos: number
          clientes_ativos_anterior: number
          clientes_totais: number
          clientes_totais_anterior: number
          cmo_percentual: number
          cmo_percentual_anterior: number
          cmo_total: number
          cmo_total_anterior: number
          faturamento_anterior: number
          faturamento_trimestre: number
          variacao_artistica: number
          variacao_clientes_ativos: number
          variacao_clientes_totais: number
          variacao_cmo: number
        }[]
      }
      calculate_evento_metrics: {
        Args: { evento_id: number }
        Returns: undefined
      }
      calculate_rolling_stddev: {
        Args: {
          p_bar_id: number
          p_metric_name: string
          p_window_days?: number
        }
        Returns: number
      }
      check_automation_health: { Args: never; Returns: Json }
      check_eventos_cache_status: {
        Args: never
        Returns: {
          registros_cache: number
          status: string
          tabela: string
          ultima_atualizacao: string
        }[]
      }
      cleanup_contahub_duplicates: { Args: never; Returns: Json }
      cleanup_expired_cache: { Args: never; Returns: string }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_backups: {
        Args: { retention_days?: number }
        Returns: {
          deleted_backups: number
          deleted_files: number
        }[]
      }
      cleanup_old_logs: {
        Args: never
        Returns: {
          registros_removidos: number
          tabela: string
        }[]
      }
      compress_old_raw_data: { Args: never; Returns: string }
      consolidar_faturamento_diario: {
        Args: { p_bar_id?: number; p_data: string }
        Returns: {
          atualizado: boolean
          bar_id: number
          contahub: number
          data: string
          sympla: number
          total: number
          yuzer: number
        }[]
      }
      consolidar_faturamento_mes: {
        Args: { p_ano: number; p_bar_id?: number; p_mes: number }
        Returns: {
          erros: string[]
          faturamento_total: number
          total_dias: number
          total_eventos: number
        }[]
      }
      consultar_auditoria_evento: {
        Args: { p_evento_id: number }
        Returns: {
          campo_alterado: string
          data_alteracao: string
          data_evento: string
          funcao_origem: string
          id: number
          nome: string
          valor_anterior: string
          valor_novo: string
        }[]
      }
      consultar_auditoria_por_data: {
        Args: { p_data_evento: string }
        Returns: {
          campo_alterado: string
          data_alteracao: string
          diferenca: number
          evento_id: number
          funcao_origem: string
          nome: string
          valor_anterior: string
          valor_novo: string
        }[]
      }
      consultar_qr_fidelidade: {
        Args: {
          p_bar_id?: number
          p_funcionario_id?: string
          p_ip_origem?: unknown
          p_qr_token: string
        }
        Returns: Json
      }
      contahub_historical_sync: {
        Args: { p_bar_id?: number; p_data_date: string }
        Returns: number
      }
      contahub_weekly_correction: { Args: never; Returns: Json }
      contahub_weekly_correction_with_api: { Args: never; Returns: Json }
      creditar_mensalidade_automatica: { Args: never; Returns: undefined }
      detect_trend: {
        Args: { p_bar_id: number; p_days?: number; p_metric_name: string }
        Returns: string
      }
      detectar_anomalias_contagem: {
        Args: { p_bar_id?: number; p_data_fim?: string; p_data_inicio?: string }
        Returns: {
          por_tipo: Json
          total_anomalias: number
          total_processados: number
        }[]
      }
      detectar_anomalias_dia: {
        Args: { p_bar_id?: number; p_data: string }
        Returns: {
          descricao: string
          severidade: string
          tipo_anomalia: string
          valor: number
        }[]
      }
      eh_domingo: { Args: never; Returns: boolean }
      eh_ultimo_dia_mes: { Args: { p_data?: string }; Returns: boolean }
      enviar_alerta_discord: {
        Args: {
          p_bar_id: number
          p_categoria: string
          p_dados?: Json
          p_mensagem: string
          p_tipo: string
          p_titulo: string
        }
        Returns: boolean
      }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      executar_auditoria_automatica: { Args: never; Returns: string }
      executar_coleta_contaazul_v3_com_discord: { Args: never; Returns: string }
      executar_coleta_contaazul_v4_com_discord: { Args: never; Returns: string }
      executar_importacao_retroativa: { Args: never; Returns: Json }
      executar_reprocessamento_diario: {
        Args: never
        Returns: {
          eventos_processados: string[]
          tempo_execucao: unknown
          total_marcados: number
          total_processados: number
        }[]
      }
      executar_sync_prodporhora_diario: { Args: never; Returns: Json }
      executar_validacao_completa: { Args: never; Returns: string }
      executar_validacao_diaria: {
        Args: { p_bar_id?: number; p_data?: string }
        Returns: Json
      }
      executar_verificacao_diaria: {
        Args: { p_bar_id?: number }
        Returns: string
      }
      execute_raw_sql: { Args: { query_text: string }; Returns: Json }
      execute_security_monitoring: { Args: never; Returns: Json }
      fix_cron_jobs_admin: { Args: never; Returns: Json }
      formatar_data_brasil: { Args: { data: string }; Returns: string }
      generate_permanent_service_token: { Args: never; Returns: string }
      generate_security_report: {
        Args: never
        Returns: {
          details: string
          issue_type: string
          status: string
        }[]
      }
      gerar_relatorio_matinal: { Args: { p_bar_id?: number }; Returns: Json }
      gerar_versao_historico: { Args: never; Returns: string }
      get_analise_couvert_stats: {
        Args: {
          p_bar_id: number
          p_data_entrada_quarta?: string
          p_data_entrada_sexta?: string
          p_data_inicio?: string
        }
        Returns: Json
      }
      get_ano_atual: { Args: never; Returns: number }
      get_clientes_ativos_periodo: {
        Args: {
          p_bar_id: number
          p_data_fim_periodo: string
          p_data_inicio_periodo: string
        }
        Returns: number
      }
      get_count_base_ativa: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: number
      }
      get_count_clientes_unicos_periodo: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: number
      }
      get_current_service_token: { Args: never; Returns: string }
      get_dia_semana: { Args: { d: string }; Returns: string }
      get_dre_consolidada: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          atividade: string
          categoria_dre: string
          origem: string
          valor_automatico: number
          valor_manual: number
          valor_total: number
        }[]
      }
      get_dre_detalhada: {
        Args: { p_ano: number; p_mes?: number }
        Returns: {
          categoria_macro: string
          categoria_nome: string
          origem: string
          registros: number
          valor: number
        }[]
      }
      get_horario_pico_stats: {
        Args: {
          p_bar_id: number
          p_data: string
          p_datas_comparacao?: string[]
        }
        Returns: Json
      }
      get_insights_adicionais: { Args: { p_bar_id?: number }; Returns: Json }
      get_insights_extras: { Args: { p_bar_id: number }; Returns: Json }
      get_insights_oportunidades: { Args: { p_bar_id?: number }; Returns: Json }
      get_iso_weeks_in_year: { Args: { p_ano: number }; Returns: number }
      get_ltv_engajamento_stats: { Args: { p_bar_id: number }; Returns: Json }
      get_mega_insights_360: { Args: { p_bar_id?: number }; Returns: Json }
      get_padroes_comportamento_stats: {
        Args: { p_bar_id: number }
        Returns: Json
      }
      get_resumo_semanal_produtos: {
        Args: {
          p_bar_id?: number
          p_data_final: string
          p_data_inicial: string
        }
        Returns: {
          data_exemplo: string
          dia_semana: string
          faturamento_total: number
          grupo_produto: string
          horario_pico: number
          produto_mais_vendido: string
          produtos_unicos: number
          quantidade_pico: number
          total_produtos_vendidos: number
        }[]
      }
      get_retrospectiva_2025: { Args: { p_bar_id?: number }; Returns: Json }
      get_retrospectiva_clientes_mes: {
        Args: { p_bar_id?: number }
        Returns: Json
      }
      get_retrospectiva_completa: { Args: { p_bar_id?: number }; Returns: Json }
      get_retrospectiva_evolucao_mensal: {
        Args: { p_bar_id?: number }
        Returns: Json
      }
      get_retrospectiva_insights: { Args: { p_bar_id?: number }; Returns: Json }
      get_retrospectiva_top_produtos: {
        Args: { p_bar_id?: number; p_limit?: number }
        Returns: Json
      }
      get_retrospectiva_vendas_categoria: {
        Args: { p_bar_id?: number }
        Returns: Json
      }
      get_semana_atual: {
        Args: never
        Returns: {
          ano: number
          data_fim: string
          data_inicio: string
          numero_semana: number
        }[]
      }
      get_service_role_key: { Args: never; Returns: string }
      get_set_clientes_historico: {
        Args: { p_bar_id: number; p_data_limite: string }
        Returns: {
          cli_fone_normalizado: string
        }[]
      }
      get_set_clientes_periodo: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          cli_fone_normalizado: string
        }[]
      }
      get_tempo_estadia_stats: { Args: { p_bar_id: number }; Returns: Json }
      get_ultra_insights: { Args: { p_bar_id: number }; Returns: Json }
      get_user_bar_id: { Args: never; Returns: number }
      get_user_cpf: { Args: never; Returns: string }
      historico_recalculo_automatico: {
        Args: { p_dias?: number }
        Returns: {
          data: string
          execucoes: number
          tempo_medio_segundos: number
          tipos_execucao: string[]
          total_erros: number
          total_eventos_processados: number
          total_sucessos: number
        }[]
      }
      importar_contagem_direto: { Args: { p_data: string }; Returns: Json }
      importar_lote_historico: {
        Args: { p_data_fim: string; p_data_inicio: string }
        Returns: Json
      }
      importar_mes_retroativo: {
        Args: { p_ano: number; p_mes: number }
        Returns: Json
      }
      importar_proximo_dia_novembro: { Args: never; Returns: Json }
      insert_raw_data_without_trigger: {
        Args: {
          p_bar_id: number
          p_data_date: string
          p_data_type: string
          p_processed?: boolean
          p_raw_json?: Json
        }
        Returns: number
      }
      install_extension_safely: {
        Args: { extension_name: string }
        Returns: undefined
      }
      is_user_admin: { Args: never; Returns: boolean }
      limpar_auditoria_antiga: {
        Args: { dias_manter?: number }
        Returns: string
      }
      limpar_logs_antigos: { Args: never; Returns: undefined }
      limpar_retry_antigos: { Args: never; Returns: number }
      limpar_valor_monetario: { Args: { valor_texto: string }; Returns: number }
      log_audit_event: {
        Args: {
          p_bar_id: number
          p_category?: string
          p_changes?: Json
          p_description?: string
          p_endpoint?: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_method?: string
          p_new_values?: Json
          p_old_values?: Json
          p_operation: string
          p_record_id?: string
          p_request_id?: string
          p_session_id?: string
          p_severity?: string
          p_table_name?: string
          p_user_agent?: string
          p_user_email?: string
          p_user_id?: string
          p_user_role?: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          event_description: string
          event_type: string
          metadata?: Json
          user_id?: string
        }
        Returns: undefined
      }
      manutencao_semanal_banco: { Args: never; Returns: string }
      marcar_eventos_para_reprocessamento_diario: {
        Args: never
        Returns: string
      }
      mark_security_config_completed: {
        Args: { completion_notes?: string; config_id: number }
        Returns: undefined
      }
      normalizar_telefone: { Args: { telefone: string }; Returns: string }
      process_analitico_data: {
        Args: { p_bar_id: number; p_data_array: Json; p_data_date: string }
        Returns: number
      }
      process_fatporhora_data: {
        Args: { p_bar_id: number; p_data_array: Json; p_data_date: string }
        Returns: number
      }
      process_pagamentos_data: {
        Args: { p_bar_id: number; p_data_array: Json; p_data_date: string }
        Returns: number
      }
      process_periodo_data: {
        Args: { p_bar_id: number; p_data_array: Json; p_data_date: string }
        Returns: number
      }
      process_tempo_data: {
        Args: { p_bar_id: number; p_data_array: Json; p_data_date: string }
        Returns: number
      }
      processar_eventos_diario_cron: { Args: never; Returns: string }
      processar_eventos_pendentes: {
        Args: { limite?: number }
        Returns: {
          evento_id: number
          processados: number
        }[]
      }
      processar_pagamento_aprovado: {
        Args: {
          p_credito_mensal?: number
          p_membro_id: string
          p_valor_pagamento: number
        }
        Returns: Json
      }
      processar_transacao_fidelidade: {
        Args: {
          p_aprovado_por?: string
          p_bar_id?: number
          p_descricao?: string
          p_membro_id: string
          p_origem?: string
          p_tipo: string
          p_valor: number
        }
        Returns: Json
      }
      recalcular_e_auditar_dia: {
        Args: { p_bar_id?: number; p_data: string }
        Returns: {
          campo: string
          diferenca: number
          evento_id: number
          mudou: boolean
          nome_evento: string
          valor_anterior: number
          valor_novo: number
        }[]
      }
      recalcular_eventos_pendentes: { Args: never; Returns: number }
      refresh_eventos_cache: {
        Args: { p_bar_id?: number; p_data_fim?: string; p_data_inicio?: string }
        Returns: number
      }
      refresh_eventos_cache_mes: {
        Args: { p_ano: number; p_mes: number }
        Returns: number
      }
      registrar_falha_sync: {
        Args: {
          data_evento: string
          detalhes_json?: Json
          erro_descricao: string
          tipo_sync: string
        }
        Returns: undefined
      }
      registrar_sucesso_sync: {
        Args: { data_evento: string; detalhes_json?: Json; tipo_sync: string }
        Returns: undefined
      }
      registrar_validacao_automatica: {
        Args: { p_data_evento: string; p_valor_esperado: number }
        Returns: undefined
      }
      run_security_checks: {
        Args: never
        Returns: {
          check_name: string
          message: string
          status: string
        }[]
      }
      safe_int: { Args: { text_val: string }; Returns: number }
      safe_numeric: { Args: { text_val: string }; Returns: number }
      status_calculos_eventos: {
        Args: never
        Returns: {
          eventos_calculados: number
          eventos_pendentes: number
          total_eventos: number
          ultima_atualizacao: string
          versao_calculo_atual: number
        }[]
      }
      status_recalculo_automatico: {
        Args: never
        Returns: {
          eventos_pendentes: number
          eventos_processados_hoje: number
          jobs_ativos: number
          proxima_execucao_continuo: string
          proxima_execucao_pos_contahub: string
          tipo_ultima_execucao: string
          ultima_execucao: string
        }[]
      }
      sync_cliente_estatisticas_job: { Args: never; Returns: undefined }
      sync_contahub_daily: { Args: never; Returns: undefined }
      sync_contahub_prodporhora_daily: { Args: never; Returns: undefined }
      sync_eventos_after_contahub: {
        Args: { p_bar_id?: number; p_data_evento: string }
        Returns: Json
      }
      sync_getin_continuous: { Args: never; Returns: Json }
      sync_nibo_continuous: { Args: never; Returns: Json }
      sync_nibo_monthly_validation: { Args: never; Returns: Json }
      sync_nibo_monthly_validation_conditional: { Args: never; Returns: Json }
      trigger_nibo_orchestrator: { Args: { p_batch_id: string }; Returns: Json }
      trigger_sync_contagem_sheets: { Args: never; Returns: Json }
      trigger_sync_contagem_via_api: {
        Args: never
        Returns: {
          message: string
          success: boolean
        }[]
      }
      update_daily_security_metrics: { Args: never; Returns: undefined }
      update_eventos_base_with_sympla_yuzer: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          mensagem: string
          total_atualizados: number
        }[]
      }
      update_service_token: { Args: { new_token: string }; Returns: boolean }
      upsert_getin_reserva:
        | {
            Args: {
              p_bar_id: number
              p_cliente_email: string
              p_cliente_nome: string
              p_cliente_telefone: string
              p_data_reserva: string
              p_hora_reserva: string
              p_id_externo: string
              p_mesa_numero: string
              p_numero_pessoas: number
              p_observacoes: string
              p_raw_data: Json
              p_status: string
              p_unit_id: string
              p_unit_name: string
              p_valor_consumacao: number
              p_valor_entrada: number
            }
            Returns: number
          }
        | {
            Args: {
              p_dados_brutos?: Json
              p_data_reserva: string
              p_email?: string
              p_external_id?: string
              p_horario: string
              p_mesa?: string
              p_nome_cliente: string
              p_observacoes?: string
              p_origem?: string
              p_pessoas: number
              p_status: string
              p_telefone?: string
            }
            Returns: {
              inserted: boolean
              reserva_id: number
            }[]
          }
      user_has_bar_access: { Args: { check_bar_id: number }; Returns: boolean }
      validar_contahub_dia: {
        Args: { p_bar_id?: number; p_data: string }
        Returns: Json
      }
      validar_dados_contahub: {
        Args: { p_bar_id?: number; p_data: string }
        Returns: {
          data_ref: string
          diferenca: number
          soma_pagamentos: number
          soma_periodo: number
          status: string
        }[]
      }
      validar_e_corrigir_eventos: {
        Args: never
        Returns: {
          eventos_corrigidos_cl_real: number
          eventos_corrigidos_real_r: number
          status: string
          total_eventos: number
        }[]
      }
      validar_faturamento_diario: {
        Args: { p_data_fim: string; p_data_inicio: string }
        Returns: {
          bar_id: number
          data: string
          detalhes: string
          diferenca: number
          status: string
        }[]
      }
      validar_integridade_contahub: {
        Args: { data_inicio?: string }
        Returns: {
          data_evento: string
          diferenca_registros: number
          diferenca_valor: number
          precisa_correcao: boolean
          registros_coletados: number
          registros_processados: number
          status_integridade: string
          valor_atual: number
          valor_esperado: number
        }[]
      }
      validar_semana_contahub: {
        Args: { p_bar_id?: number }
        Returns: {
          data_ref: string
          diferenca: number
          soma_pagamentos: number
          soma_periodo: number
          status: string
        }[]
      }
      validar_valores_contahub: {
        Args: { data_evento: string; valor_esperado: number }
        Returns: {
          data_validacao: string
          diferenca: number
          percentual_diferenca: number
          requer_correcao: boolean
          status_validacao: string
          valor_banco: number
          valor_sistema: number
        }[]
      }
      validate_views_security: {
        Args: never
        Returns: {
          is_secure: boolean
          security_status: string
          view_name: string
        }[]
      }
      verificacao_diaria_confiabilidade: { Args: never; Returns: string }
      verificar_execucoes_pendentes: {
        Args: never
        Returns: {
          data_execucao: string
          execucao_id: number
          resultado_execucao: Json
          status_execucao: string
        }[]
      }
      verificar_sla_chamados: { Args: never; Returns: undefined }
      verify_security_status: {
        Args: never
        Returns: {
          category: string
          secure_items: number
          status: string
          total_items: number
        }[]
      }
    }
    Enums: {
      categoria_chamado: "bug" | "melhoria" | "duvida" | "sugestao" | "urgente"
      frequencia_enum:
        | "diaria"
        | "semanal"
        | "quinzenal"
        | "mensal"
        | "bimestral"
        | "trimestral"
        | "conforme_necessario"
      nivel_acesso_enum: "admin" | "gerente" | "supervisor" | "funcionario"
      prioridade_chamado: "baixa" | "media" | "alta" | "critica"
      prioridade_enum: "baixa" | "media" | "alta" | "critica"
      status_agendamento_enum:
        | "agendado"
        | "executando"
        | "concluido"
        | "atrasado"
        | "cancelado"
      status_chamado:
        | "aberto"
        | "em_andamento"
        | "aguardando_cliente"
        | "aguardando_suporte"
        | "resolvido"
        | "fechado"
        | "cancelado"
      status_checklist_enum: "ativo" | "inativo" | "rascunho" | "arquivado"
      status_execucao_enum:
        | "iniciado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "com_problemas"
      status_notificacao_enum: "pendente" | "enviada" | "lida" | "erro"
      status_usuario_enum: "ativo" | "inativo" | "suspenso"
      tipo_acao_enum:
        | "criar"
        | "editar"
        | "excluir"
        | "executar"
        | "cancelar"
        | "aprovar"
        | "rejeitar"
      tipo_campo_enum:
        | "texto"
        | "numero"
        | "sim_nao"
        | "data"
        | "assinatura"
        | "foto_camera"
        | "foto_upload"
        | "avaliacao"
        | "multipla_escolha"
        | "checkbox_list"
      tipo_checklist_enum:
        | "abertura"
        | "fechamento"
        | "manutencao"
        | "qualidade"
        | "seguranca"
        | "limpeza"
        | "auditoria"
      tipo_mensagem_chamado: "resposta" | "nota_interna" | "sistema" | "anexo"
      tipo_notificacao_enum:
        | "lembrete"
        | "atraso"
        | "problema"
        | "conclusao"
        | "sistema"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      categoria_chamado: ["bug", "melhoria", "duvida", "sugestao", "urgente"],
      frequencia_enum: [
        "diaria",
        "semanal",
        "quinzenal",
        "mensal",
        "bimestral",
        "trimestral",
        "conforme_necessario",
      ],
      nivel_acesso_enum: ["admin", "gerente", "supervisor", "funcionario"],
      prioridade_chamado: ["baixa", "media", "alta", "critica"],
      prioridade_enum: ["baixa", "media", "alta", "critica"],
      status_agendamento_enum: [
        "agendado",
        "executando",
        "concluido",
        "atrasado",
        "cancelado",
      ],
      status_chamado: [
        "aberto",
        "em_andamento",
        "aguardando_cliente",
        "aguardando_suporte",
        "resolvido",
        "fechado",
        "cancelado",
      ],
      status_checklist_enum: ["ativo", "inativo", "rascunho", "arquivado"],
      status_execucao_enum: [
        "iniciado",
        "em_andamento",
        "concluido",
        "cancelado",
        "com_problemas",
      ],
      status_notificacao_enum: ["pendente", "enviada", "lida", "erro"],
      status_usuario_enum: ["ativo", "inativo", "suspenso"],
      tipo_acao_enum: [
        "criar",
        "editar",
        "excluir",
        "executar",
        "cancelar",
        "aprovar",
        "rejeitar",
      ],
      tipo_campo_enum: [
        "texto",
        "numero",
        "sim_nao",
        "data",
        "assinatura",
        "foto_camera",
        "foto_upload",
        "avaliacao",
        "multipla_escolha",
        "checkbox_list",
      ],
      tipo_checklist_enum: [
        "abertura",
        "fechamento",
        "manutencao",
        "qualidade",
        "seguranca",
        "limpeza",
        "auditoria",
      ],
      tipo_mensagem_chamado: ["resposta", "nota_interna", "sistema", "anexo"],
      tipo_notificacao_enum: [
        "lembrete",
        "atraso",
        "problema",
        "conclusao",
        "sistema",
      ],
    },
  },
} as const

