import { GameDig } from 'gamedig';
import { pool, initializeDatabase, recordPlayerHistory } from './database';
import { Client, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { GameDigResponse } from '../types/gamedig';

const DONATION_LINK = process.env.DONATION_LINK || '';

function getPlayerCount(serverState: GameDigResponse, gameType: string): { current: number, max: number } {
    if (gameType === 'minecraft') {
        return {
            current: serverState.raw?.vanilla?.raw?.players?.online ?? 0,
            max: serverState.raw?.vanilla?.raw?.players?.max ?? 0
        };
    }

    return {
        current: serverState.raw?.numplayers ?? serverState.players?.length ?? 0,
        max: serverState.raw?.maxplayers ?? serverState.maxplayers ?? 0
    };
}

function getNextUpdateTime(): string {
    const now = new Date();
    const nextUpdate = new Date(Math.ceil(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
    const diffMinutes = Math.ceil((nextUpdate.getTime() - now.getTime()) / (60 * 1000));
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
}

function cleanServerAddress(address: string): string {
    return address.replace(/[`🔗\s]/g, '').toLowerCase();
}

async function updateMessageId(monitor: { id: number }, messageId: string) {
    await pool.query(
        'UPDATE server_monitors SET message_id = $1 WHERE id = $2',
        [messageId, monitor.id]
    );
}

export async function startServerMonitoring(client: Client) {
    await initializeDatabase();
    let isRunning = false;  // we add a lock here

    const monitorServers = async () => {
        if (isRunning) {
            console.log('Previous monitoring run still in progress, skipping...');
            return;
        }

        isRunning = true;
        console.log(`Starting monitor update at ${new Date().toLocaleTimeString()}`);

        try {
            const result = await pool.query('SELECT * FROM server_monitors ORDER BY created_at ASC');
            
            const channelMonitors = new Map<string, typeof result.rows>();
            
            for (const monitor of result.rows) {
                const existing = channelMonitors.get(monitor.channel_id) || [];
                existing.push(monitor);
                channelMonitors.set(monitor.channel_id, existing);
            }

            for (const [channelId, monitors] of channelMonitors) {
                try {
                    const channel = await client.channels.fetch(channelId) as TextChannel;
                    if (!channel) continue;

                    const messages = await channel.messages.fetch({ limit: 50 });
                    const botMessages = messages.filter(msg => msg.author.id === client.user?.id);

                    for (const monitor of monitors) {
                        let existingMessage = null;  // Declare at the top of the loop
                        
                        try {
                            if (monitor.message_id) {
                                try {
                                    existingMessage = await channel.messages.fetch(monitor.message_id);
                                } catch (error) {
                                    console.log(`Could not fetch message ${monitor.message_id}, will create new one`);
                                }
                            }

                            console.log(`Checking server ${monitor.server_host}:${monitor.server_port}`);
                            
                            const serverState = await Promise.race([
                                GameDig.query({
                                    type: monitor.game_type,
                                    host: monitor.server_host,
                                    port: monitor.server_port,
                                    maxRetries: 1,
                                    socketTimeout: 2000,
                                    attemptTimeout: 5000,
                                    givenPortOnly: true
                                }) as Promise<GameDigResponse>,
                                new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('Query timed out')), 5000)
                                )
                            ]) as GameDigResponse;

                            const { current, max } = getPlayerCount(serverState, monitor.game_type);

                            await recordPlayerHistory(
                                monitor.id,
                                current,
                                max,
                                serverState.map,
                                serverState.name,
                                Math.round(serverState.ping)
                            );

                            const statusEmbed = new EmbedBuilder()
                                .setColor(0x2B2D31)
                                .setTitle(`${serverState.name || 'Game Server'}`)
                                .addFields([
                                    { name: 'Status', value: '🟢 Online', inline: true },
                                    { name: 'Players', value: `👥 ${current}/${max}`, inline: true },
                                    { name: 'Map', value: `🗺️ ${serverState.map || 'Unknown'}`, inline: true },
                                    { name: 'Connect', value: `🔗 \`${monitor.server_host}:${monitor.server_port}\``, inline: false },
                                    { name: 'Next Update', value: `🔄 in ${getNextUpdateTime()}`, inline: false }
                                ])
                                .setFooter({ text: 'Last updated' })
                                .setTimestamp();

                            const playerListButton = new ButtonBuilder()
                                .setCustomId(`playerlist|${monitor.server_host}|${monitor.server_port}|${monitor.game_type}`)
                                .setLabel('Show Players')
                                .setEmoji('👥')
                                .setStyle(ButtonStyle.Primary);

                            const historyButton = new ButtonBuilder()
                                .setCustomId(`history|${monitor.id}`)
                                .setLabel('Player History')
                                .setEmoji('📊')
                                .setStyle(ButtonStyle.Secondary);

                            const donateButton = new ButtonBuilder()
                                .setLabel('Support Us')
                                .setEmoji('❤️')
                                .setStyle(ButtonStyle.Link)
                                .setURL(DONATION_LINK);

                            const row = new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(playerListButton, historyButton, donateButton);

                            if (existingMessage) {
                                await existingMessage.edit({
                                    embeds: [statusEmbed],
                                    components: [row]
                                });
                                console.log(`Updated status for ${monitor.server_host}:${monitor.server_port}`);
                            } else {
                                const newMessage = await channel.send({
                                    embeds: [statusEmbed],
                                    components: [row]
                                });
                                await updateMessageId(monitor, newMessage.id);
                                console.log(`Created new status for ${monitor.server_host}:${monitor.server_port}`);
                            }

                        } catch (err: unknown) {
                            const error = err as Error;
                            console.log(`Error checking ${monitor.server_host}:${monitor.server_port}:`, error?.message || 'Unknown error');
                            
                            const offlineEmbed = new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('Server Status')
                                .addFields([
                                    { name: 'Status', value: '🔴 Offline', inline: true },
                                    { name: 'Server', value: `🔗 \`${monitor.server_host}:${monitor.server_port}\``, inline: true },
                                    { name: 'Next Update', value: `🔄 in ${getNextUpdateTime()}`, inline: false }
                                ])
                                .setFooter({ text: 'Last updated' })
                                .setTimestamp();

                            if (existingMessage) {
                                await existingMessage.edit({ 
                                    embeds: [offlineEmbed],
                                    components: [] 
                                });
                            } else {
                                const newMessage = await channel.send({ 
                                    embeds: [offlineEmbed]
                                });
                                await updateMessageId(monitor, newMessage.id);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing channel ${channelId}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in server monitoring:', error);
        } finally {
            isRunning = false;
            console.log(`Completed monitor update at ${new Date().toLocaleTimeString()}`);
        }
    };

    await monitorServers().catch(console.error);

    const runMonitor = () => {
        const now = new Date();
        const delay = 5 * 60 * 1000 - (now.getTime() % (5 * 60 * 1000));
        
        setTimeout(() => {
            monitorServers().catch(console.error);
            runMonitor();  // run the monitor again
        }, delay);
    };

    runMonitor();

    const interval = setInterval(monitorServers, 5 * 60 * 1000);
    interval.unref();

    return interval;
} 