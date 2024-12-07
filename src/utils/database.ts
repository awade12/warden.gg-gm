import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const createTableQuery = `
    CREATE TABLE IF NOT EXISTS server_monitors (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        game_type TEXT NOT NULL,
        server_host TEXT NOT NULL,
        server_port INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

const addMessageIdColumnQuery = `
    DO $$ 
    BEGIN 
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'server_monitors' 
            AND column_name = 'message_id'
        ) THEN 
            ALTER TABLE server_monitors 
            ADD COLUMN message_id TEXT;
        END IF;
    END $$;
`;

const createPlayerHistoryTableQuery = `
    CREATE TABLE IF NOT EXISTS server_player_history (
        id SERIAL PRIMARY KEY,
        server_monitor_id INTEGER REFERENCES server_monitors(id) ON DELETE CASCADE,
        player_count INTEGER NOT NULL,
        max_players INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        map_name TEXT,
        server_name TEXT,
        ping INTEGER
    );

    -- Index for faster queries on timestamp and server_monitor_id
    CREATE INDEX IF NOT EXISTS idx_player_history_timestamp 
        ON server_player_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_player_history_server 
        ON server_player_history(server_monitor_id);
`;

export async function recordPlayerHistory(
    serverMonitorId: number, 
    playerCount: number, 
    maxPlayers: number,
    mapName?: string,
    serverName?: string,
    ping?: number
) {
    try {
        await pool.query(
            `INSERT INTO server_player_history 
            (server_monitor_id, player_count, max_players, map_name, server_name, ping) 
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [serverMonitorId, playerCount, maxPlayers, mapName, serverName, ping]
        );
    } catch (error) {
        console.error('Error recording player history:', error);
    }
}

export async function initializeDatabase() {
    try {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            await client.query(createTableQuery);
            await client.query(addMessageIdColumnQuery);
            await client.query(createPlayerHistoryTableQuery);

            await client.query('COMMIT');
            
            console.log('Database initialized successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

export async function cleanupOldHistory(daysToKeep: number = 30) {
    try {
        await pool.query(
            `DELETE FROM server_player_history 
            WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'`
        );
    } catch (error) {
        console.error('Error cleaning up old history:', error);
    }
}

export { pool }; 