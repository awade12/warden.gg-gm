import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    CacheType,
    TextChannel,
    EmbedBuilder
} from 'discord.js';
import { GameDig } from 'gamedig';
import { pool } from '../utils/database';
import { getGameById } from '../utils/games';
import { GameDigResponse } from '../types/gamedig';

function isValidHostname(hostname: string): boolean {
    const hostnameRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    return hostnameRegex.test(hostname);
}

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupserver')
        .setDescription('Setup a game server to monitor')
        .addStringOption(option =>
            option
                .setName('game')
                .setDescription('The game ID (e.g., gs1 for Minecraft, gs2 for CS2)')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('host')
                .setDescription('The server IP or hostname')
                .setRequired(true))
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to send server status updates')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('port')
                .setDescription('The server port (optional)')
                .setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction<CacheType>) {
        try {
            await interaction.deferReply().catch(console.error);

            const gameId = interaction.options.getString('game', true);
            const gameInfo = getGameById(gameId);
            
            if (!gameInfo) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Invalid Game')
                    .setDescription(`Invalid game ID: \`${gameId}\``)
                    .setTimestamp();
                return await interaction.editReply({ embeds: [embed] }).catch(console.error);
            }

            const host = interaction.options.getString('host', true);
            
            if (!isValidHostname(host)) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Invalid Hostname')
                    .setDescription('Please provide a valid domain name or IP address.')
                    .setTimestamp();
                return await interaction.editReply({ embeds: [embed] }).catch(console.error);
            }

            const port = interaction.options.getInteger('port') ?? gameInfo.defaultPort;
            const channel = interaction.options.getChannel('channel', true) as TextChannel;

            // Test the server connection with a timeout and additional options
            const serverState = await Promise.race([
                GameDig.query({
                    type: gameInfo.value,
                    host: host,
                    port: port || undefined,
                    maxRetries: 2,
                    socketTimeout: 3000,
                    attemptTimeout: 10000,
                    givenPortOnly: true
                }) as Promise<GameDigResponse>,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timed out')), 10000)
                )
            ]) as GameDigResponse;

            const { current, max } = getPlayerCount(serverState, gameInfo.value);

            const statusEmbed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setTitle(`${serverState.name || gameInfo.name}`)
                .addFields([
                    { name: 'Status', value: '🟢 Online', inline: true },
                    { name: 'Players', value: `👥 ${current}/${max}`, inline: true },
                    { name: 'Map', value: `🗺️ ${serverState.map || 'Unknown'}`, inline: true },
                    { name: 'Connect', value: `🔗 \`${serverState.connect || `${host}:${port}`}\``, inline: false },
                    { name: 'Next Update', value: `🔄 in ${getNextUpdateTime()}`, inline: false }
                ])
                .setFooter({ text: 'Last updated' })
                .setTimestamp();

            const statusMessage = await channel.send({ embeds: [statusEmbed] }).catch(console.error);

            await pool.query(
                'INSERT INTO server_monitors (guild_id, channel_id, message_id, game_type, server_host, server_port) VALUES ($1, $2, $3, $4, $5, $6)',
                [interaction.guildId, channel.id, statusMessage?.id, gameInfo.value, host, port]
            );

            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Server Monitor Setup')
                .setDescription(`Successfully setup server monitoring in ${channel}!\nThe status will be updated every 5 minutes.`)
                .setTimestamp();

            return await interaction.editReply({ embeds: [successEmbed] }).catch(console.error);

        } catch (error) {
            console.error('Error setting up server:', error);
            let errorMessage = 'Unknown error occurred';
            
            if (error instanceof Error) {
                if (error.message.includes('Invalid domain')) {
                    errorMessage = 'Invalid domain name. Please check the server address and try again.';
                } else if (error.message.includes('ECONNREFUSED')) {
                    errorMessage = 'Connection refused. Please verify the server is running and the port is correct.';
                } else if (error.message.includes('timed out')) {
                    errorMessage = 'Connection timed out. The server might be offline or blocking queries.';
                } else if (error.message.includes('Failed all')) {
                    errorMessage = 'Failed to connect to the server. Please verify the server is online and accepting queries.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            try {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Setup Failed')
                    .setDescription(errorMessage)
                    .setTimestamp();
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (replyError) {
                console.error('Failed to reply to interaction:', replyError);
            }
        }
    }
};
