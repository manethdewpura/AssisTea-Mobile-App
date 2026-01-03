import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

class DatabaseService {
    private db: SQLite.SQLiteDatabase | null = null;
    private readonly DATABASE_NAME = 'assistea.db';
    private readonly DATABASE_VERSION = 1;

    /**
     * Initialize database and create tables
     */
    async initialize(): Promise<void> {
        try {
            console.log('📱 Opening SQLite database...');
            this.db = await SQLite.openDatabase({
                name: this.DATABASE_NAME,
                location: 'default',
            });

            console.log('✅ Database opened successfully');
            await this.createTables();
        } catch (error) {
            console.error('❌ Error initializing database:', error);
            throw error;
        }
    }

    /**
     * Create all tables
     */
    private async createTables(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            console.log('📋 Creating tables...');

            // Fields table
            await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS fields (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slope REAL NOT NULL,
          maxWorkers INTEGER NOT NULL,
          location TEXT,
          plantationId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          syncStatus TEXT DEFAULT 'pending'
        );
      `);

            // Saved schedules table
            await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS saved_schedules (
          id TEXT PRIMARY KEY,
          plantationId TEXT NOT NULL,
          date TEXT NOT NULL,
          totalWorkers INTEGER NOT NULL,
          totalFields INTEGER NOT NULL,
          averageEfficiency REAL NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          syncStatus TEXT DEFAULT 'pending'
        );
      `);

            // Schedule assignments table
            await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS schedule_assignments (
          id TEXT PRIMARY KEY,
          scheduleId TEXT NOT NULL,
          workerId TEXT NOT NULL,
          workerName TEXT NOT NULL,
          fieldId TEXT NOT NULL,
          fieldName TEXT NOT NULL,
          predictedEfficiency REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (scheduleId) REFERENCES saved_schedules(id) ON DELETE CASCADE
        );
      `);

            // Sync queue table
            await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entityType TEXT NOT NULL,
          entityId TEXT NOT NULL,
          operation TEXT NOT NULL,
          data TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          syncedAt TEXT,
          status TEXT DEFAULT 'pending',
          error TEXT
        );
      `);

            // Workers table
            await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS workers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          workerId TEXT NOT NULL,
          birthDate TEXT NOT NULL,
          age INTEGER NOT NULL,
          experience TEXT NOT NULL,
          gender TEXT NOT NULL,
          plantationId TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          syncStatus TEXT DEFAULT 'pending'
        );
      `);

            // Activity logs table
            await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY,
          timestamp TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          zone_id INTEGER,
          status TEXT NOT NULL,
          duration REAL,
          pressure REAL,
          flow_rate REAL,
          water_volume REAL,
          fertilizer_volume REAL,
          start_moisture REAL,
          end_moisture REAL,
          notes TEXT,
          syncStatus TEXT DEFAULT 'pending',
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
      `);

            // Create index on timestamp for faster queries
            await this.db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp 
        ON activity_logs(timestamp DESC);
      `);

            // Create index on syncStatus for sync queries
            await this.db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_activity_logs_sync 
        ON activity_logs(syncStatus);
      `);

            console.log('✅ All tables created successfully');
        } catch (error) {
            console.error('❌ Error creating tables:', error);
            throw error;
        }
    }

    /**
     * Execute a SQL query
     */
    async executeSql(
        query: string,
        params: any[] = []
    ): Promise<SQLite.ResultSet> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            const [result] = await this.db.executeSql(query, params);
            return result;
        } catch (error) {
            console.error('❌ SQL Error:', error);
            console.error('Query:', query);
            console.error('Params:', params);
            throw error;
        }
    }

    /**
     * Execute multiple SQL statements in a transaction
     */
    async executeTransaction(
        queries: Array<{ query: string; params?: any[] }>
    ): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            await this.db.transaction(async (tx) => {
                for (const { query, params = [] } of queries) {
                    await tx.executeSql(query, params);
                }
            });
        } catch (error) {
            console.error('❌ Transaction Error:', error);
            throw error;
        }
    }

    /**
     * Drop all tables (use with caution!)
     */
    async dropTables(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            await this.db.executeSql('DROP TABLE IF EXISTS sync_queue');
            await this.db.executeSql('DROP TABLE IF EXISTS schedule_assignments');
            await this.db.executeSql('DROP TABLE IF EXISTS saved_schedules');
            await this.db.executeSql('DROP TABLE IF EXISTS fields');
            console.log('✅ All tables dropped');
        } catch (error) {
            console.error('❌ Error dropping tables:', error);
            throw error;
        }
    }

    /**
     * Clear all data from tables
     */
    async clearAll(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            await this.db.executeSql('DELETE FROM sync_queue');
            await this.db.executeSql('DELETE FROM schedule_assignments');
            await this.db.executeSql('DELETE FROM saved_schedules');
            await this.db.executeSql('DELETE FROM fields');
            console.log('✅ All data cleared');
        } catch (error) {
            console.error('❌ Error clearing data:', error);
            throw error;
        }
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('✅ Database closed');
        }
    }

    /**
     * Get database instance
     */
    getDatabase(): SQLite.SQLiteDatabase {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }
}

export const databaseService = new DatabaseService();
