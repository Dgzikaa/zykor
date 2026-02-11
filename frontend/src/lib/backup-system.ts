// Sistema de backup automático para dados críticos
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';

export interface BackupConfig {
  tables: string[];
  schedule: 'daily' | 'weekly' | 'monthly';
  retention_days: number;
  compression: boolean;
  encryption: boolean;
  notification_webhook?: string;
  storage_bucket?: string;
}

export interface BackupResult {
  id: string;
  timestamp: string;
  tables_backed_up: string[];
  total_records: number;
  file_size_mb: number;
  duration_seconds: number;
  success: boolean;
  error?: string;
}

interface BackupData {
  metadata: {
    version: string;
    timestamp: string;
    tables: string[];
    total_records: number;
    bar_id?: number;
  };
  data: Record<string, any[]>;
}

interface BackupRecord {
  id: string;
  bar_id?: number;
  created_at: string;
  updated_at?: string;
  [key: string]: any;
}

const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  tables: [
    'usuarios_bar',
    'checklist_agendamentos',
    'checklist_auto_executions',
    'bars',
    'receitas',
    'producoes',
    'api_credentials',
    'security_events',
    'windsor_analytics_data',
    'nibo_contabil_data',
  ],
  schedule: 'daily',
  retention_days: 30,
  compression: true,
  encryption: true,
  notification_webhook:
    'https://discord.com/api/webhooks/1393646423748116602/3zUhIrSKFHmq0zNRLf5AzrkSZNzTj7oYk6f45Tpj2LZWChtmGTKKTHxhfaNZigyLXN4y',
  storage_bucket: 'sgb-backups',
};

export class BackupSystem {
  private config: BackupConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = { ...DEFAULT_BACKUP_CONFIG, ...config };
  }

  async createBackup(barId?: number): Promise<BackupResult> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const backupId = this.generateBackupId();

    try {
      console.log(`🔄 Iniciando backup ${backupId}...`);

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

      let totalRecords = 0;
      const backupData: BackupData = {
        metadata: {
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          tables: [],
          total_records: 0,
          bar_id: barId,
        },
        data: {},
      };

      // Backup de cada tabela
      for (const table of this.config.tables) {
        try {
          let query = supabase.from(table).select('*');

          // Filtrar por bar_id se especificado e se a tabela tem essa coluna
          if (barId && (await this.tableHasBarId(table))) {
            query = query.eq('bar_id', barId);
          }

          const { data, error } = await query;

          if (error) {
            console.error(`❌ Erro no backup da tabela ${table}:`, error);
            continue;
          }

          if (data) {
            backupData.data[table] = data;
            totalRecords += data.length;
            backupData.metadata.tables.push(table);
            console.log(`✅ ${table}: ${data.length} registros`);
          }
        } catch (tableError) {
          console.error(`❌ Erro ao processar tabela ${table}:`, tableError);
        }
      }

      // Adicionar metadados do backup
      backupData.metadata.total_records = totalRecords;

      // Verificar se o backup tem dados
      if (backupData.metadata.version !== '2.0.0') {
        throw new Error('Versão de backup incompatível');
      }

      // Salvar backup
      const { fileSizeMb, storagePath } = await this.saveBackup(backupId, backupData);

      const result: BackupResult = {
        id: backupId,
        timestamp: new Date().toISOString(),
        tables_backed_up: backupData.metadata.tables,
        total_records: totalRecords,
        file_size_mb: fileSizeMb,
        duration_seconds: (Date.now() - startTime) / 1000,
        success: true,
      };

      // Registrar backup
      await this.registerBackup(result, storagePath);

      // Limpar backups antigos
      await this.cleanupOldBackups();

      // Notificar sucesso
      await this.notifyBackupComplete(result);

      console.log(`✅ Backup ${backupId} concluído com sucesso!`);
      return result;
    } catch (error) {
      const result: BackupResult = {
        id: backupId,
        timestamp: new Date().toISOString(),
        tables_backed_up: [],
        total_records: 0,
        file_size_mb: 0,
        duration_seconds: (Date.now() - startTime) / 1000,
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };

      await this.notifyBackupError(result);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async restoreBackup(backupId: string, barId?: number): Promise<boolean> {
    try {
      console.log(`🔄 Restaurando backup ${backupId}...`);

      const backupData = await this.loadBackup(backupId) as BackupData;
      const supabase = await getAdminClient();

      // Verificar versão
      if (backupData.metadata.version !== '2.0.0') {
        throw new Error('Versão de backup incompatível');
      }

      // Restaurar cada tabela
      for (const [table, records] of Object.entries(backupData.data)) {
        try {
          // Filtrar registros por bar_id se especificado
          const filteredRecords = barId
            ? records.filter((record: BackupRecord) => record.bar_id === barId)
            : records;

          if (filteredRecords.length === 0) continue;

          // Limpar tabela existente (apenas registros do bar_id se especificado)
          if (barId) {
            await supabase.from(table).delete().eq('bar_id', barId);
          } else {
            await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          }

          // Inserir registros do backup
          const { error } = await supabase.from(table).insert(filteredRecords);

          if (error) {
            console.error(`❌ Erro ao restaurar tabela ${table}:`, error);
            continue;
          }

          console.log(`✅ ${table}: ${filteredRecords.length} registros restaurados`);
        } catch (tableError) {
          console.error(`❌ Erro ao processar tabela ${table}:`, tableError);
        }
      }

      console.log(`✅ Backup ${backupId} restaurado com sucesso!`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao restaurar backup ${backupId}:`, error);
      return false;
    }
  }

  async listBackups(barId?: number): Promise<BackupResult[]> {
    try {
      const supabase = await getAdminClient();

      let query = supabase
        .from('backup_registry')
        .select('*')
        .order('timestamp', { ascending: false });

      if (barId) {
        query = query.eq('bar_id', barId);
      }

      const { data: backups, error } = await query;

      if (error) {
        console.error('❌ Erro ao listar backups:', error);
        return [];
      }

      return (backups || []).map((backup: any) => ({
        id: backup.backup_id,
        timestamp: backup.timestamp,
        tables_backed_up: backup.tables_backed_up || [],
        total_records: backup.total_records || 0,
        file_size_mb: backup.file_size_mb || 0,
        duration_seconds: backup.duration_seconds || 0,
        success: backup.success || false,
        error: backup.error,
      }));
    } catch (error) {
      console.error('❌ Erro ao listar backups:', error);
      return [];
    }
  }

  // Métodos privados
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    return `backup_${timestamp}_${random}`;
  }

  private async tableHasBarId(table: string): Promise<boolean> {
    // Lista de tabelas que têm coluna bar_id
    const barIdTables = [
      'usuarios_bar',
      'checklists',
      'checklist_execucoes',
      'receitas',
      'producoes',
      'api_credentials',
      'windsor_analytics_data',
      'nibo_contabil_data',
    ];
    return barIdTables.includes(table);
  }

  private async saveBackup(
    backupId: string,
    data: BackupData
  ): Promise<{ fileSizeMb: number; storagePath: string }> {
    try {
      const supabase = await getAdminClient();

      // Converter dados para JSON
      const jsonString = JSON.stringify(data);
      let finalData = new TextEncoder().encode(jsonString);

      // Aplicar compressão se habilitado
      if (this.config.compression) {
        finalData = await this.compressData(finalData) as any;
        console.log(
          `🗜️ Dados comprimidos de ${jsonString.length} para ${finalData.length} bytes`
        );
      }

      // Aplicar criptografia se habilitado
      if (this.config.encryption) {
        finalData = await this.encryptData(finalData) as any;
        console.log(`🔒 Dados criptografados`);
      }

      // Calcular tamanho em MB
      const fileSizeMb =
        Math.round((finalData.length / 1024 / 1024) * 100) / 100;

      // Gerar nome do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${backupId}_${timestamp}.backup`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(this.config.storage_bucket || 'sgb-backups')
        .upload(fileName, finalData, {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Erro no upload do backup:', uploadError);
        throw new Error(`Falha no upload: ${uploadError.message}`);
      }

      console.log(`✅ Backup ${fileName} salvo com sucesso (${fileSizeMb}MB)`);
      return {
        fileSizeMb,
        storagePath: fileName,
      };
    } catch (error) {
      console.error('❌ Erro ao salvar backup:', error);
      throw error;
    }
  }

  private async loadBackup(backupId: string): Promise<BackupData | null> {
    try {
      const supabase = await getAdminClient();

      // Buscar backup do storage
      const { data, error } = await supabase.storage
        .from(this.config.storage_bucket || 'sgb-backups')
        .download(`${backupId}.backup`);

      if (error || !data) {
        console.error('❌ Backup não encontrado:', backupId);
        return null;
      }

      // Converter para array de bytes
      const bytes = new Uint8Array(await data.arrayBuffer());

      // Descomprimir se necessário
      let decompressedData = bytes;
      if (this.config.compression) {
        decompressedData = await this.decompressData(bytes) as any;
      }

      // Descriptografar se necessário
      let decryptedData = decompressedData;
      if (this.config.encryption) {
        decryptedData = await this.decryptData(decompressedData) as any;
      }

      // Converter de volta para objeto
      const jsonString = new TextDecoder().decode(decryptedData);
      const backupData: BackupData = JSON.parse(jsonString);

      return backupData;
    } catch (error) {
      console.error('❌ Erro ao carregar backup:', error);
      return null;
    }
  }

  // Métodos de criptografia e compressão
  private async encryptData(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Gerar chave de criptografia a partir de uma senha mestra
      const password =
        process.env.BACKUP_ENCRYPTION_KEY || 'sgb-backup-key-2024-secure';
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(password);

      // Gerar salt aleatório
      const salt = crypto.getRandomValues(new Uint8Array(16));

      // Derivar chave usando PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      // Gerar IV aleatório
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Criptografar dados
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data as any
      );

      // Combinar salt + iv + dados criptografados
      const result = new Uint8Array(
        salt.length + iv.length + encryptedData.byteLength
      );
      result.set(salt, 0);
      result.set(iv, salt.length);
      result.set(new Uint8Array(encryptedData), salt.length + iv.length);

      return result;
    } catch (error) {
      console.error('❌ Erro na criptografia:', error);
      throw error;
    }
  }

  private async decryptData(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Extrair salt, iv e dados criptografados
      const salt = data.slice(0, 16);
      const iv = data.slice(16, 28);
      const encryptedData = data.slice(28);

      // Derivar chave usando a mesma senha
      const password =
        process.env.BACKUP_ENCRYPTION_KEY || 'sgb-backup-key-2024-secure';
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(password);

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Descriptografar dados
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedData
      );

      return new Uint8Array(decryptedData);
    } catch (error) {
      console.error('❌ Erro na descriptografia:', error);
      throw error;
    }
  }

  private async compressData(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Usar CompressionStream se disponível (browser moderno)
      if (typeof CompressionStream !== 'undefined') {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(data as any);
        writer.close();

        const chunks: Uint8Array[] = [];
        let result = await reader.read();

        while (!result.done) {
          chunks.push(result.value);
          result = await reader.read();
        }

        // Combinar todos os chunks
        const totalLength = chunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0
        );
        const compressed = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }

        return compressed;
      } else {
        // Fallback: retornar dados sem compressão
        console.warn('⚠️ CompressionStream não disponível, pulando compressão');
        return data;
      }
    } catch (error) {
      console.error('❌ Erro na compressão:', error);
      return data; // Retornar dados originais em caso de erro
    }
  }

  private async decompressData(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Usar DecompressionStream se disponível
      if (typeof DecompressionStream !== 'undefined') {
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(data as any);
        writer.close();

        const chunks: Uint8Array[] = [];
        let result = await reader.read();

        while (!result.done) {
          chunks.push(result.value);
          result = await reader.read();
        }

        // Combinar todos os chunks
        const totalLength = chunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0
        );
        const decompressed = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }

        return decompressed;
      } else {
        // Fallback: retornar dados como estão
        console.warn(
          '⚠️ DecompressionStream não disponível, pulando descompressão'
        );
        return data;
      }
    } catch (error) {
      console.error('❌ Erro na descompressão:', error);
      return data; // Retornar dados como estão em caso de erro
    }
  }

  private async registerBackup(
    result: BackupResult,
    storagePath?: string
  ): Promise<void> {
    try {
      const supabase = await getAdminClient();

      await supabase.from('backup_registry').insert({
        backup_id: result.id,
        timestamp: result.timestamp,
        tables_backed_up: result.tables_backed_up,
        total_records: result.total_records,
        file_size_mb: result.file_size_mb,
        duration_seconds: result.duration_seconds,
        success: result.success,
        error_message: result.error,
        storage_path: storagePath,
        storage_bucket: this.config.storage_bucket || 'sgb-backups',
        is_encrypted: this.config.encryption,
        is_compressed: this.config.compression,
        config: this.config,
      });
    } catch (error) {
      console.error('❌ Erro ao registrar backup:', error);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retention_days);

      const supabase = await getAdminClient();

      // Buscar registros antigos no banco
      const { data: oldBackups } = await supabase
        .from('backup_registry')
        .select('backup_id')
        .lt('timestamp', cutoffDate.toISOString());

      if (!oldBackups || oldBackups.length === 0) {
        console.log('✅ Nenhum backup antigo para limpar');
        return;
      }

      // Remover arquivos do storage
      const filesToDelete = oldBackups.map((backup: any) => `${backup.backup_id}.backup`);

      const { error: storageError } = await supabase.storage
        .from(this.config.storage_bucket || 'sgb-backups')
        .remove(filesToDelete);

      if (storageError) {
        console.error('❌ Erro ao remover arquivos antigos:', storageError);
      } else {
        console.log(`✅ Removidos ${filesToDelete.length} arquivos antigos do storage`);
      }

      // Remover registros antigos do banco
      const { error: dbDeleteError } = await supabase
        .from('backup_registry')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (dbDeleteError) {
        console.error('❌ Erro ao remover registros antigos:', dbDeleteError);
      } else {
        console.log(`✅ Removidos ${oldBackups.length} registros antigos do banco`);
      }
    } catch (error) {
      console.error('❌ Erro na limpeza de backups antigos:', error);
    }
  }

  private async notifyBackupComplete(result: BackupResult): Promise<void> {
    if (!this.config.notification_webhook) return;

    try {
      const message = {
        embeds: [
          {
            title: '✅ Backup Concluído com Sucesso',
            description: `Backup ID: ${result.id}`,
            color: 0x00ff00,
            fields: [
              {
                name: 'Tabelas',
                value: result.tables_backed_up.join(', '),
                inline: false,
              },
              {
                name: 'Total de Registros',
                value: result.total_records.toString(),
                inline: true,
              },
              {
                name: 'Tamanho do Arquivo',
                value: `${result.file_size_mb} MB`,
                inline: true,
              },
              {
                name: 'Duração',
                value: `${result.duration_seconds}s`,
                inline: true,
              },
            ],
            timestamp: result.timestamp,
          },
        ],
      };

      await fetch(this.config.notification_webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Erro ao enviar notificação de backup:', error);
    }
  }

  private async notifyBackupError(result: BackupResult): Promise<void> {
    if (!this.config.notification_webhook) return;

    try {
      const message = {
        embeds: [
          {
            title: '❌ Falha no Backup',
            description: `Backup ID: ${result.id}`,
            color: 0xff0000,
            fields: [
              {
                name: 'Erro',
                value: result.error || 'Erro desconhecido',
                inline: false,
              },
              {
                name: 'Duração',
                value: `${result.duration_seconds}s`,
                inline: true,
              },
            ],
            timestamp: result.timestamp,
          },
        ],
      };

      await fetch(this.config.notification_webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Erro ao enviar notificação de erro de backup:', error);
    }
  }
}

// Sistema de agendamento de backups
export class BackupScheduler {
  private backupSystem: BackupSystem;
  private interval?: NodeJS.Timeout;

  constructor(config?: Partial<BackupConfig>) {
    this.backupSystem = new BackupSystem(config);
  }

  start(): void {
    if (this.interval) {
      console.warn('Backup scheduler já está rodando');
      return;
    }

    // Executar backup diário às 2:00 AM
    const scheduleBackup = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(2, 0, 0, 0);

      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      const msUntilBackup = target.getTime() - now.getTime();

      setTimeout(async () => {
        try {
          await this.backupSystem.createBackup();
          scheduleBackup(); // Agendar próximo backup
        } catch (error) {
          console.error('Erro no backup agendado:', error);
          scheduleBackup(); // Reagendar mesmo com erro
        }
      }, msUntilBackup);
    };

    scheduleBackup();
    console.log('📅 Backup scheduler iniciado - próximo backup às 2:00 AM');
  }

  stop(): void {
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = undefined;
      console.log('📅 Backup scheduler parado');
    }
  }

  async runNow(barId?: number): Promise<BackupResult> {
    return this.backupSystem.createBackup(barId);
  }
}

// Export instances
export const backupSystem = new BackupSystem();
export const backupScheduler = new BackupScheduler();
