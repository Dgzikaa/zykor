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
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean | null
          auth_id: string | null
          bio: string | null
          cep: string | null
          cidade: string | null
          conta_verificada: boolean | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string
          endereco: string | null
          estado: string | null
          foto_perfil: string | null
          id: string
          modulos_permitidos: Json | null
          nome: string
          preferencias: Json | null
          role: string | null
          senha_redefinida: boolean | null
          setor: string | null
          telefone: string | null
          ultima_atividade: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          auth_id?: string | null
          bio?: string | null
          cep?: string | null
          cidade?: string | null
          conta_verificada?: boolean | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email: string
          endereco?: string | null
          estado?: string | null
          foto_perfil?: string | null
          id?: string
          modulos_permitidos?: Json | null
          nome: string
          preferencias?: Json | null
          role?: string | null
          senha_redefinida?: boolean | null
          setor?: string | null
          telefone?: string | null
          ultima_atividade?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          auth_id?: string | null
          bio?: string | null
          cep?: string | null
          cidade?: string | null
          conta_verificada?: boolean | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string
          endereco?: string | null
          estado?: string | null
          foto_perfil?: string | null
          id?: string
          modulos_permitidos?: Json | null
          nome?: string
          preferencias?: Json | null
          role?: string | null
          senha_redefinida?: boolean | null
          setor?: string | null
          telefone?: string | null
          ultima_atividade?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      usuarios_bares: {
        Row: {
          bar_id: number
          criado_em: string | null
          id: number
          usuario_id: string
        }
        Insert: {
          bar_id: number
          criado_em?: string | null
          id?: number
          usuario_id: string
        }
        Update: {
          bar_id?: number
          criado_em?: string | null
          id?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_bares_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["auth_id"]
          },
        ]
      }
      view_top_produtos_legacy_snapshot: {
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
        Insert: {
          bar_id?: number | null
          custo_total?: number | null
          grupo?: string | null
          margem_lucro_percentual?: number | null
          primeira_venda?: string | null
          produto?: string | null
          quantidade_total?: number | null
          total_vendas?: number | null
          ultima_venda?: string | null
          valor_total?: number | null
          vendas_por_dia?: Json | null
        }
        Update: {
          bar_id?: number | null
          custo_total?: number | null
          grupo?: string | null
          margem_lucro_percentual?: number | null
          primeira_venda?: string | null
          produto?: string | null
          quantidade_total?: number | null
          total_vendas?: number | null
          ultima_venda?: string | null
          valor_total?: number | null
          vendas_por_dia?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      cliente_estatisticas: {
        Row: {
          bar_id: number | null
          dias_desde_ultima_visita: number | null
          eh_vip: boolean | null
          email: string | null
          id: number | null
          nome: string | null
          perfil: string | null
          primeira_visita: string | null
          status: string | null
          telefone: string | null
          tem_whatsapp: boolean | null
          ticket_medio: number | null
          total_gasto: number | null
          total_reservas_getin: number | null
          total_visitas: number | null
          ultima_visita: string | null
        }
        Insert: {
          bar_id?: number | null
          dias_desde_ultima_visita?: number | null
          eh_vip?: boolean | null
          email?: string | null
          id?: number | null
          nome?: string | null
          perfil?: string | null
          primeira_visita?: string | null
          status?: string | null
          telefone?: string | null
          tem_whatsapp?: boolean | null
          ticket_medio?: number | null
          total_gasto?: number | null
          total_reservas_getin?: number | null
          total_visitas?: number | null
          ultima_visita?: string | null
        }
        Update: {
          bar_id?: number | null
          dias_desde_ultima_visita?: number | null
          eh_vip?: boolean | null
          email?: string | null
          id?: number | null
          nome?: string | null
          perfil?: string | null
          primeira_visita?: string | null
          status?: string | null
          telefone?: string | null
          tem_whatsapp?: boolean | null
          ticket_medio?: number | null
          total_gasto?: number | null
          total_reservas_getin?: number | null
          total_visitas?: number | null
          ultima_visita?: string | null
        }
        Relationships: []
      }
      pessoas_diario_corrigido: {
        Row: {
          bar_id: number | null
          dt_gerencial: string | null
          total_pessoas_bruto: number | null
        }
        Insert: {
          bar_id?: number | null
          dt_gerencial?: string | null
          total_pessoas_bruto?: number | null
        }
        Update: {
          bar_id?: number | null
          dt_gerencial?: string | null
          total_pessoas_bruto?: number | null
        }
        Relationships: []
      }
      silver_yuzer_eventos: {
        Row: {
          bar_id: number | null
          company_document: string | null
          company_name: string | null
          created_at: string | null
          data_evento: string | null
          data_fim: string | null
          data_inicio: string | null
          earnings: number | null
          evento_id: number | null
          gross: number | null
          hours_left: number | null
          hours_total: number | null
          nome_evento: string | null
          raw_data: Json | null
          returned_products: number | null
          status: string | null
          synced_at: string | null
          total: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      silver_yuzer_fatporhora: {
        Row: {
          bar_id: number | null
          created_at: string | null
          data_evento: string | null
          data_hora: string | null
          evento_id: number | null
          faturamento: number | null
          hora: number | null
          hora_formatada: string | null
          raw_data: Json | null
          synced_at: string | null
          updated_at: string | null
          vendas: number | null
        }
        Insert: {
          bar_id?: number | null
          created_at?: string | null
          data_evento?: string | null
          data_hora?: string | null
          evento_id?: number | null
          faturamento?: number | null
          hora?: number | null
          hora_formatada?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          updated_at?: string | null
          vendas?: number | null
        }
        Update: {
          bar_id?: number | null
          created_at?: string | null
          data_evento?: string | null
          data_hora?: string | null
          evento_id?: number | null
          faturamento?: number | null
          hora?: number | null
          hora_formatada?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          updated_at?: string | null
          vendas?: number | null
        }
        Relationships: []
      }
      v_progresso_bronze_contahub: {
        Row: {
          bar3_a_processar: number | null
          bar3_dias_incompletos: number | null
          bar3_total_dias: number | null
          bar4_a_processar: number | null
          bar4_dias_incompletos: number | null
          bar4_total_dias: number | null
          fila_pendente: number | null
          job_ativo: boolean | null
          tentativas_bar3: number | null
          tentativas_bar4: number | null
        }
        Relationships: []
      }
      view_top_produtos: {
        Row: {
          bar_id: number | null
          categoria: string | null
          custo_total: number | null
          dias_desde_ultima_venda: number | null
          grupo: string | null
          id: number | null
          margem_lucro_percentual: number | null
          primeira_venda: string | null
          produto: string | null
          quantidade_30d: number | null
          quantidade_total: number | null
          status_produto: string | null
          total_vendas: number | null
          ultima_venda: string | null
          valor_30d: number | null
          valor_60d: number | null
          valor_90d: number | null
          valor_total: number | null
          vendas_30d: number | null
          vendas_por_dia: Json | null
        }
        Insert: {
          bar_id?: number | null
          categoria?: string | null
          custo_total?: number | null
          dias_desde_ultima_venda?: number | null
          grupo?: string | null
          id?: number | null
          margem_lucro_percentual?: number | null
          primeira_venda?: string | null
          produto?: string | null
          quantidade_30d?: number | null
          quantidade_total?: number | null
          status_produto?: string | null
          total_vendas?: number | null
          ultima_venda?: string | null
          valor_30d?: number | null
          valor_60d?: number | null
          valor_90d?: number | null
          valor_total?: number | null
          vendas_30d?: number | null
          vendas_por_dia?: Json | null
        }
        Update: {
          bar_id?: number | null
          categoria?: string | null
          custo_total?: number | null
          dias_desde_ultima_venda?: number | null
          grupo?: string | null
          id?: number | null
          margem_lucro_percentual?: number | null
          primeira_venda?: string | null
          produto?: string | null
          quantidade_30d?: number | null
          quantidade_total?: number | null
          status_produto?: string | null
          total_vendas?: number | null
          ultima_venda?: string | null
          valor_30d?: number | null
          valor_60d?: number | null
          valor_90d?: number | null
          valor_total?: number | null
          vendas_30d?: number | null
          vendas_por_dia?: Json | null
        }
        Relationships: []
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
      visitas: {
        Row: {
          bar_id: number | null
          cliente_dtnasc: string | null
          cliente_email: string | null
          cliente_fone: string | null
          cliente_fone_norm: string | null
          cliente_nome: string | null
          data_visita: string | null
          hora_abertura: string | null
          id: number | null
          localizacao: string | null
          mesa_desc: string | null
          motivo_desconto: string | null
          pessoas: number | null
          tempo_estadia_minutos: number | null
          tipo_venda: string | null
          valor_consumo: number | null
          valor_couvert: number | null
          valor_desconto: number | null
          valor_pagamentos: number | null
          valor_produtos: number | null
          valor_repique: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _ensure_daily_perfil_batch: { Args: never; Returns: undefined }
      _process_next_perfil_chunk: { Args: never; Returns: Json }
      acquire_job_lock: {
        Args: { job_name: string; p_bar_id?: number; timeout_minutes?: number }
        Returns: boolean
      }
      adapter_contahub_to_faturamento_hora: {
        Args: { p_bar_id: number; p_data: string }
        Returns: number
      }
      adapter_contahub_to_faturamento_pagamentos: {
        Args: { p_bar_id: number; p_data: string }
        Returns: number
      }
      adapter_contahub_to_tempos_producao: {
        Args: { p_bar_id: number; p_data: string }
        Returns: number
      }
      adapter_contahub_to_vendas_item: {
        Args: { p_bar_id: number; p_data: string }
        Returns: number
      }
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
      admin_get_credentials_by_bar: {
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
      agora_brasil: { Args: never; Returns: string }
      alertar_problemas_contahub: { Args: never; Returns: string }
      aplicar_desconto_qr: {
        Args: {
          p_bar_id?: number
          p_funcionario_id?: string
          p_qr_token: string
          p_valor_desconto: number
        }
        Returns: Json
      }
      auto_recalculo_eventos_pendentes: {
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
      bronze_sync_integrations_to_bronze: {
        Args: never
        Returns: {
          atualizados: number
          duracao_segundos: number
          inseridos: number
          tabela: string
        }[]
      }
      brt_to_utc_cron: {
        Args: { hora_brt: number; minuto_brt?: number }
        Returns: string
      }
      calcular_atrasos_tempo: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          atrasos_bar: number
          atrasos_cozinha: number
          qtde_itens_bar: number
          qtde_itens_cozinha: number
        }[]
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
      calcular_clientes_ativos_periodo_v1_backup: {
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
      calcular_mix_vendas: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          perc_bebidas: number
          perc_comidas: number
          perc_drinks: number
          perc_happy_hour: number
          total_vendas: number
        }[]
      }
      calcular_nps_por_pesquisa: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          detratores: number
          neutros: number
          nps_score: number
          promotores: number
          search_name: string
          total_respostas: number
        }[]
      }
      calcular_nps_semanal_por_pesquisa: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          detratores: number
          neutros: number
          nps_media: number
          nps_score: number
          promotores: number
          search_name: string
          total_respostas: number
        }[]
      }
      calcular_stockout_semanal: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          categoria: string
          percentual_stockout: number
          produtos_stockout: number
          total_produtos: number
        }[]
      }
      calcular_tempo_saida: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          tempo_bar_minutos: number
          tempo_cozinha_minutos: number
        }[]
      }
      calcular_visao_geral_anual: {
        Args: { p_ano: number; p_bar_id: number }
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
        Args: { p_ano: number; p_bar_id: number; p_trimestre: number }
        Returns: {
          artistica_percentual: number
          clientes_ativos: number
          clientes_totais: number
          cmo_percentual: number
          cmo_total: number
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
      cleanup_old_logs: {
        Args: never
        Returns: {
          registros_removidos: number
          tabela: string
        }[]
      }
      cleanup_stale_heartbeats: {
        Args: never
        Returns: {
          cleaned_count: number
          cleaned_jobs: string[]
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
      contaazul_get_parcela_detalhe: {
        Args: { p_bar_id: number; p_parcela_id: string }
        Returns: Json
      }
      contaazul_get_valid_token: { Args: { p_bar_id: number }; Returns: string }
      count_distinct_clientes_periodo: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: number
      }
      creditar_mensalidade_automatica: { Args: never; Returns: undefined }
      daily_perfil_consumo_worker: { Args: never; Returns: Json }
      eh_domingo: { Args: never; Returns: boolean }
      eh_ultimo_dia_mes: { Args: { p_data?: string }; Returns: boolean }
      enviar_alerta_discord_sistema: {
        Args: {
          p_bar_id?: number
          p_cor?: number
          p_mensagem: string
          p_titulo: string
        }
        Returns: number
      }
      enviar_alerta_discord_sistema_dedup: {
        Args: {
          p_bar_id: number
          p_categoria: string
          p_cor?: number
          p_dedupe_key?: string
          p_mensagem: string
          p_tipo: string
          p_titulo: string
        }
        Returns: string
      }
      etl_gold_clientes_diario_all_bars: {
        Args: { p_dias_atras?: number }
        Returns: {
          bar_id: number
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
        }[]
      }
      etl_gold_clientes_diario_full: {
        Args: { p_bar_id: number; p_data_fim?: string; p_data_inicio?: string }
        Returns: {
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
        }[]
      }
      etl_gold_cmv_all_bars: {
        Args: never
        Returns: {
          bares_processados: number
          duracao_total_ms: number
          semanas_totais: number
        }[]
      }
      etl_gold_cmv_full: {
        Args: {
          p_ano?: number
          p_bar_id: number
          p_semana_fim?: number
          p_semana_inicio?: number
        }
        Returns: {
          duracao_ms: number
          semanas_processadas: number
        }[]
      }
      etl_gold_desempenho_all_bars: {
        Args: { p_dias_atras?: number }
        Returns: {
          bar_id: number
          duracao_ms: number
          granularidade: string
          linhas_processadas: number
        }[]
      }
      etl_gold_desempenho_mensal: {
        Args: { p_ano: number; p_bar_id: number; p_mes: number }
        Returns: {
          bar_processado: number
          duracao_ms: number
          linhas_inseridas: number
          periodo_processado: string
        }[]
      }
      etl_gold_desempenho_mensal_range: {
        Args: {
          p_ano_fim: number
          p_ano_inicio: number
          p_bar_id: number
          p_mes_fim: number
          p_mes_inicio: number
        }
        Returns: {
          duracao_ms: number
          erros: string[]
          meses_com_erro: number
          meses_processados: number
        }[]
      }
      etl_gold_desempenho_semanal: {
        Args: { p_ano: number; p_bar_id: number; p_semana: number }
        Returns: {
          bar_processado: number
          duracao_ms: number
          linhas_inseridas: number
          periodo_processado: string
        }[]
      }
      etl_gold_desempenho_semanal_range: {
        Args: {
          p_ano_fim: number
          p_ano_inicio: number
          p_bar_id: number
          p_semana_fim: number
          p_semana_inicio: number
        }
        Returns: {
          duracao_ms: number
          erros: string[]
          semanas_com_erro: number
          semanas_processadas: number
        }[]
      }
      etl_gold_planejamento_all_bars: {
        Args: never
        Returns: {
          bares_processados: number
          dias_totais: number
          duracao_total_ms: number
        }[]
      }
      etl_gold_planejamento_full: {
        Args: { p_bar_id: number; p_data_fim?: string; p_data_inicio?: string }
        Returns: {
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
        }[]
      }
      etl_silver_cliente_estatisticas_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          clientes_atualizados: number
          clientes_com_nps: number
          clientes_com_reservas_getin: number
          clientes_com_whatsapp: number
          clientes_inseridos: number
          clientes_processados: number
          clientes_vip: number
          duracao_ms: number
        }[]
      }
      etl_silver_cliente_estatisticas_full: {
        Args: { p_bar_id: number }
        Returns: {
          clientes_atualizados: number
          clientes_com_nps: number
          clientes_com_reservas_getin: number
          clientes_com_whatsapp: number
          clientes_inseridos: number
          clientes_processados: number
          clientes_vip: number
          duracao_ms: number
        }[]
      }
      etl_silver_cliente_visitas_all_bars: {
        Args: { p_dias_janela?: number }
        Returns: {
          bar_id: number
          detalhes: string
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          dias_sem_dados: number
          duracao_ms: number
          erros: number
          linhas_total: number
        }[]
      }
      etl_silver_cliente_visitas_dia: {
        Args: { p_bar_id: number; p_data: string }
        Returns: {
          duracao_ms: number
          linhas_atualizadas: number
          linhas_inseridas: number
          linhas_processadas: number
        }[]
      }
      etl_silver_cliente_visitas_dia_v1_backup: {
        Args: { p_bar_id: number; p_data: string }
        Returns: {
          duracao_ms: number
          linhas_atualizadas: number
          linhas_inseridas: number
          linhas_processadas: number
        }[]
      }
      etl_silver_cliente_visitas_intervalo: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          detalhes: string
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          dias_sem_dados: number
          duracao_total_ms: number
          erros: number
          linhas_total: number
        }[]
      }
      etl_silver_contaazul_lancamentos_diarios_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          combos_atualizados: number
          combos_inseridos: number
          combos_processados: number
          duracao_ms: number
          lancamentos_total: number
        }[]
      }
      etl_silver_contaazul_lancamentos_diarios_full: {
        Args: { p_bar_id: number }
        Returns: {
          combos_atualizados: number
          combos_inseridos: number
          combos_processados: number
          duracao_ms: number
          lancamentos_total: number
        }[]
      }
      etl_silver_getin_reservas_diarias_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          reservas_total: number
        }[]
      }
      etl_silver_getin_reservas_diarias_full: {
        Args: { p_bar_id: number }
        Returns: {
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          reservas_total: number
        }[]
      }
      etl_silver_google_reviews_diario_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          reviews_total: number
        }[]
      }
      etl_silver_google_reviews_diario_full: {
        Args: { p_bar_id: number }
        Returns: {
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          reviews_total: number
        }[]
      }
      etl_silver_nps_diario_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          respostas_total: number
        }[]
      }
      etl_silver_nps_diario_full: {
        Args: { p_bar_id: number }
        Returns: {
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          respostas_total: number
        }[]
      }
      etl_silver_produtos_top_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          duracao_ms: number
          produtos_ativos: number
          produtos_atualizados: number
          produtos_declinando: number
          produtos_fora_de_linha: number
          produtos_inseridos: number
          produtos_processados: number
        }[]
      }
      etl_silver_produtos_top_full: {
        Args: { p_bar_id: number }
        Returns: {
          duracao_ms: number
          produtos_ativos: number
          produtos_atualizados: number
          produtos_declinando: number
          produtos_fora_de_linha: number
          produtos_inseridos: number
          produtos_processados: number
        }[]
      }
      etl_silver_reservantes_perfil_full: {
        Args: { p_bar_id: number }
        Returns: {
          clientes_atualizados: number
          clientes_inseridos: number
          clientes_processados: number
          duracao_ms: number
        }[]
      }
      etl_silver_sympla_bilheteria_diaria_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          pedidos_total: number
        }[]
      }
      etl_silver_sympla_bilheteria_diaria_full: {
        Args: { p_bar_id: number }
        Returns: {
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          duracao_ms: number
          pedidos_total: number
        }[]
      }
      etl_silver_vendas_diarias_all_bars: {
        Args: { p_dias_janela?: number }
        Returns: {
          bar_id: number
          detalhes: string
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          dias_sem_dados: number
          erros: number
        }[]
      }
      etl_silver_vendas_diarias_dia: {
        Args: { p_bar_id: number; p_dt_gerencial: string }
        Returns: {
          acao: string
          divergencia_r: number
          faturamento_bruto_r: number
        }[]
      }
      etl_silver_vendas_diarias_intervalo: {
        Args: { p_bar_id: number; p_dt_fim: string; p_dt_inicio: string }
        Returns: {
          detalhes: string
          dias_atualizados: number
          dias_inseridos: number
          dias_processados: number
          dias_sem_dados: number
          erros: number
        }[]
      }
      etl_silver_yuzer_all_bars: {
        Args: never
        Returns: {
          bar_id: number
          duracao_ms: number
          pag_atualizados: number
          pag_inseridos: number
          pag_processados: number
          prod_atualizados: number
          prod_inseridos: number
          prod_processados: number
        }[]
      }
      etl_silver_yuzer_pagamentos_full: {
        Args: { p_bar_id: number }
        Returns: {
          duracao_ms: number
          eventos_atualizados: number
          eventos_inseridos: number
          eventos_processados: number
        }[]
      }
      etl_silver_yuzer_produtos_full: {
        Args: { p_bar_id: number }
        Returns: {
          duracao_ms: number
          produtos_atualizados: number
          produtos_inseridos: number
          produtos_processados: number
        }[]
      }
      executar_recalculo_desempenho_v2: { Args: never; Returns: undefined }
      formatar_data_brasil: { Args: { data: string }; Returns: string }
      get_ano_atual: { Args: never; Returns: number }
      get_ano_inicio_operacao: { Args: { p_bar_id: number }; Returns: number }
      get_categorias_custo: {
        Args: { p_bar_id: number; p_tipo?: string }
        Returns: {
          nome_categoria: string
        }[]
      }
      get_cliente_stats_agregado: {
        Args: { p_bar_id: number }
        Returns: {
          clientes_com_telefone: number
          clientes_vip: number
          ticket_medio_consumo: number
          ticket_medio_entrada: number
          ticket_medio_geral: number
          total_clientes_unicos: number
          total_visitas_geral: number
          valor_total_consumo: number
          valor_total_entrada: number
          valor_total_geral: number
        }[]
      }
      get_clientes_fieis_ano: {
        Args: { p_ano?: number; p_bar_id?: number; p_limit?: number }
        Returns: {
          horasmedia: number
          nome: string
          totalgasto: number
          visitas: number
        }[]
      }
      get_cmv_fator_consumo: { Args: { p_bar_id: number }; Returns: number }
      get_consumos_classificados_semana: {
        Args: {
          input_bar_id: number
          input_data_fim: string
          input_data_inicio: string
        }
        Returns: {
          categoria: string
          total: number
        }[]
      }
      get_count_base_ativa: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: number
      }
      get_count_base_ativa_v1_backup: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: number
      }
      get_cron_stats_24h: {
        Args: never
        Returns: {
          error_count: number
          jobs_unicos: number
          partial_count: number
          running_count: number
          success_count: number
          total_execucoes_24h: number
        }[]
      }
      get_dia_semana: { Args: { d: string }; Returns: string }
      get_google_reviews_by_date: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          published_at_date: string
          reviewer_name: string
          stars: number
          text: string
        }[]
      }
      get_google_reviews_stars_by_date: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          published_at_date: string
          stars: number
        }[]
      }
      get_iso_weeks_in_year: { Args: { p_ano: number }; Returns: number }
      get_locais_por_categoria: {
        Args: { p_bar_id: number; p_categoria: string }
        Returns: string[]
      }
      get_metas_dia: {
        Args: { p_bar_id: number; p_dia_semana: number }
        Returns: {
          meta_m1: number
          tb_plan: number
          te_plan: number
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
      get_supabase_url: { Args: never; Returns: string }
      get_user_bar_id: { Args: never; Returns: number }
      get_user_cpf: { Args: never; Returns: string }
      health_cron_stats_24h: {
        Args: never
        Returns: {
          failed_24h: number
          successful_24h: number
        }[]
      }
      health_metrics_snapshot: {
        Args: never
        Returns: {
          alertas_abertos: number
          db_size_mb: number
          eventos_7_dias: number
          total_eventos: number
          ultima_sync_contaazul: string
          ultima_sync_contahub: string
        }[]
      }
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
      is_user_admin: { Args: never; Returns: boolean }
      limpar_auditoria_antiga: {
        Args: { dias_manter?: number }
        Returns: string
      }
      limpar_heartbeats_antigos: {
        Args: { dias_manter?: number }
        Returns: number
      }
      limpar_valor_monetario: { Args: { valor_texto: string }; Returns: number }
      map_categoria_mix: {
        Args: { p_bar_id: number; p_loc_desc: string }
        Returns: string
      }
      map_categoria_mix_by_group: {
        Args: { p_bar_id: number; p_grp_desc: string }
        Returns: string
      }
      map_categoria_mix_by_local: {
        Args: { p_bar_id: number; p_loc_desc: string }
        Returns: string
      }
      normalizar_telefone: { Args: { telefone: string }; Returns: string }
      normalizar_telefone_11d: { Args: { fone: string }; Returns: string }
      normalizar_telefone_br: { Args: { fone: string }; Returns: string }
      process_analitico_data: {
        Args: { p_bar_id: number; p_data_array: Json; p_data_date: string }
        Returns: number
      }
      process_cancelamentos_data: {
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
      processar_eventos_mes: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: undefined
      }
      processar_pagamento_aprovado: {
        Args: {
          p_credito_mensal?: number
          p_membro_id: string
          p_valor_pagamento: number
        }
        Returns: Json
      }
      processar_proximo_dia_incompleto_bronze: { Args: never; Returns: Json }
      processar_raw_data_backfill: {
        Args: { p_limit?: number }
        Returns: string
      }
      processar_raw_data_intervalo: {
        Args: { p_bar_id?: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          detalhes: string
          dias_processados: number
          erros: number
          registros_processados: number
        }[]
      }
      processar_raw_data_pendente: { Args: never; Returns: string }
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
      purgar_staging_antigo: { Args: never; Returns: undefined }
      recalcular_eventos_recentes: {
        Args: { dias_atras?: number }
        Returns: {
          eventos_recalculados: number
        }[]
      }
      recalcular_nps_diario_pesquisa: {
        Args: { p_bar_id: number; p_data_fim?: string; p_data_inicio?: string }
        Returns: number
      }
      release_job_lock: { Args: { job_name: string }; Returns: undefined }
      retry_contahub_sync_dia_anterior: { Args: never; Returns: undefined }
      revalidar_contahub_semana_anterior_ambos_bares: {
        Args: never
        Returns: {
          bar_id: number
          data_evento: string
          eventos_recalculados: number
          process_status: number
          sync_status: number
        }[]
      }
      revalidar_stockout_dia_anterior_ambos_bares: {
        Args: never
        Returns: {
          bar_id: number
          data_ref: string
          error_msg: string
          request_id: number
          status_code: number
          timed_out: boolean
        }[]
      }
      revalidar_stockout_dia_anterior_ambos_bares_v2: {
        Args: never
        Returns: {
          bar_id: number
          coleta_executada: boolean
          data_ref: string
          error_msg: string
          processamento_executado: boolean
          produtos_coletados: number
          produtos_processados: number
          request_id_coleta: number
          request_id_processamento: number
          status_code_coleta: number
          status_code_processamento: number
          tinha_dados: boolean
        }[]
      }
      rodar_adapters_diarios: { Args: { p_data?: string }; Returns: string }
      safe_int: { Args: { text_val: string }; Returns: number }
      safe_numeric: { Args: { text_val: string }; Returns: number }
      sympla_cron_processar_proximo_evento: { Args: never; Returns: string }
      sympla_get_orders_evento: {
        Args: { p_bar_id: number; p_event_id: string }
        Returns: Json
      }
      sympla_get_participantes_evento: {
        Args: { p_bar_id: number; p_event_id: string }
        Returns: Json
      }
      sympla_sync_participantes_evento: {
        Args: { p_bar_id: number; p_event_id: number }
        Returns: {
          atualizados: number
          duracao: number
          inseridos: number
          total_api: number
        }[]
      }
      sympla_sync_pedidos_evento: {
        Args: { p_bar_id: number; p_event_id: number }
        Returns: {
          atualizados: number
          duracao: number
          inseridos: number
          total_api: number
        }[]
      }
      sync_cliente_perfil_consumo: {
        Args: {
          p_bar_id: number
          p_chunk_count?: number
          p_chunk_index?: number
        }
        Returns: {
          out_bar_id: number
          out_chunk_count: number
          out_chunk_index: number
          out_clientes_inseridos: number
          out_tempo_ms: number
        }[]
      }
      sync_contaazul_daily: { Args: never; Returns: undefined }
      sync_contahub_ambos_bares: { Args: never; Returns: undefined }
      umbler_derivar_direcao: {
        Args: { p_tipo_remetente: string }
        Returns: string
      }
      update_eventos_ambos_bares: { Args: never; Returns: undefined }
      update_eventos_base_from_contahub_batch: {
        Args: { p_bar_id?: number; p_data_evento: string }
        Returns: string
      }
      update_eventos_base_with_sympla_yuzer: {
        Args: { p_bar_id: number; p_data_fim: string; p_data_inicio: string }
        Returns: {
          mensagem: string
          total_atualizados: number
        }[]
      }
      user_has_access_to_bar: { Args: { p_bar_id: number }; Returns: boolean }
      user_has_access_to_empresa: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      user_has_bar_access: { Args: { check_bar_id: number }; Returns: boolean }
      validar_dados_contahub_diario: {
        Args: never
        Returns: {
          bar_id: number
          data_validacao: string
          detalhes: Json
          problema: string
          severidade: string
        }[]
      }
      verificar_contahub_sync_diario: { Args: never; Returns: undefined }
      verificar_saude_crons: {
        Args: {
          p_error_hours?: number
          p_stale_minutes?: number
          p_stuck_minutes?: number
        }
        Returns: {
          bar_id: number
          detalhes: Json
          error_message: string
          job_name: string
          status: string
          tempo_sem_execucao_minutos: number
          tipo_problema: string
          ultima_execucao: string
        }[]
      }
      verificar_saude_desempenho_auto_alerta_discord: {
        Args: never
        Returns: string
      }
      verificar_saude_desempenho_v2_alerta_discord: {
        Args: never
        Returns: string
      }
      verificar_saude_pipeline_d1_alerta_discord: {
        Args: never
        Returns: string
      }
      yuzer_cron_descobrir_eventos: { Args: never; Returns: string }
      yuzer_cron_processar_proximo_evento: { Args: never; Returns: string }
      yuzer_sync_estatisticas_evento: {
        Args: { p_bar_id: number; p_evento_id: number }
        Returns: {
          atualizados: number
          duracao_segundos: number
          inseridos: number
          total_api: number
        }[]
      }
      yuzer_sync_eventos: {
        Args: { p_bar_id: number; p_from: string; p_to: string }
        Returns: {
          atualizados: number
          duracao_segundos: number
          inseridos: number
          total_api: number
        }[]
      }
      yuzer_sync_fatporhora_evento: {
        Args: { p_bar_id: number; p_evento_id: number }
        Returns: {
          atualizados: number
          duracao_segundos: number
          inseridos: number
          total_api: number
        }[]
      }
      yuzer_sync_pagamentos_evento: {
        Args: { p_bar_id: number; p_evento_id: number }
        Returns: {
          atualizados: number
          duracao_segundos: number
          inseridos: number
          total_api: number
        }[]
      }
      yuzer_sync_produtos_evento: {
        Args: { p_bar_id: number; p_evento_id: number }
        Returns: {
          atualizados: number
          duracao_segundos: number
          inseridos: number
          total_api: number
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

