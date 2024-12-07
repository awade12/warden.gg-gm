import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { pool } from './database';

const width = 800;
const height = 400;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height,
    backgroundColour: '#2B2D31'
});

interface PlayerHistoryPoint {
    timestamp: Date;
    playerCount: number;
    maxPlayers: number;
}

export async function generatePlayerHistoryChart(
    serverMonitorId: number,
    hours: number = 24
): Promise<Buffer> {
    try {
        const result = await pool.query(`
            SELECT 
                timestamp,
                player_count,
                max_players
            FROM server_player_history
            WHERE 
                server_monitor_id = $1
                AND timestamp > NOW() - INTERVAL '${hours} hours'
            ORDER BY timestamp ASC
        `, [serverMonitorId]);

        const data: PlayerHistoryPoint[] = result.rows.map(row => ({
            timestamp: new Date(row.timestamp),
            playerCount: row.player_count,
            maxPlayers: row.max_players
        }));

        const configuration = {
            type: 'line' as const,
            data: {
                labels: data.map(point => 
                    point.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                ),
                datasets: [
                    {
                        label: 'Players',
                        data: data.map(point => point.playerCount),
                        borderColor: '#5865F2', // Discord blue
                        backgroundColor: '#5865F240',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Max Players',
                        data: data.map(point => point.maxPlayers),
                        borderColor: '#ED4245', // Discord red
                        backgroundColor: '#ED424520',
                        borderDash: [5, 5],
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Player History',
                        color: '#FFFFFF'
                    },
                    legend: {
                        labels: {
                            color: '#FFFFFF'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#FFFFFF20'
                        },
                        ticks: {
                            color: '#FFFFFF'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#FFFFFF20'
                        },
                        ticks: {
                            color: '#FFFFFF'
                        }
                    }
                }
            }
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    } catch (error) {
        console.error('Error generating player history chart:', error);
        throw error;
    }
} 