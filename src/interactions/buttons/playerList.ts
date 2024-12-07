import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { GameDig } from 'gamedig';
import { GameDigResponse } from '../../types/gamedig';

const GAMES_WITHOUT_PLAYERLIST = [
    'protocol-v2',
    'teamspeak2',
    'teamspeak3',
    'minecraft'
];

function formatPlayerList(players: { name: string }[]): string {
    const sortedPlayers = players
        .filter(player => player.name)
        .map(player => player.name)
        .sort();

    if (sortedPlayers.length === 0) return '';

    const maxNameLength = Math.min(16, Math.max(12, 
        ...sortedPlayers.map(name => name.length)
    ));
    const columnWidth = maxNameLength + 2;

    const maxColumns = Math.floor(50 / columnWidth);
    const columns = Math.min(maxColumns, 4);

    const maxRows = Math.floor(1200 / (columnWidth * columns));
    const maxPlayersToShow = maxRows * columns;
    const willTruncate = sortedPlayers.length > maxPlayersToShow;
    
    const playersToShow = willTruncate 
        ? sortedPlayers.slice(0, maxPlayersToShow)
        : sortedPlayers;

    const rows = Math.ceil(playersToShow.length / columns);
    const grid: string[][] = Array(rows).fill(0)
        .map(() => Array(columns).fill(''));
    
    playersToShow.forEach((name, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const truncatedName = name.length > maxNameLength 
            ? name.slice(0, maxNameLength - 1) + '…'
            : name;
        grid[row][col] = truncatedName.padEnd(columnWidth);
    });

    let output = grid
        .map(row => row.join('').trimEnd())
        .join('\n');

    if (willTruncate) {
        const remaining = sortedPlayers.length - maxPlayersToShow;
        output += `\n\n... and ${remaining} more players`;
    }

    return output;
}

export async function handlePlayerListButton(interaction: ButtonInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const [_, host, port, gameType] = interaction.customId.split('|');

        if (GAMES_WITHOUT_PLAYERLIST.includes(gameType)) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Player List Unavailable')
                .setDescription(`This game type (\`${gameType}\`) does not support player lists.`)
                .setTimestamp();
            return await interaction.editReply({ embeds: [embed] });
        }

        const serverState = await GameDig.query({
            type: gameType,
            host: host,
            port: parseInt(port),
            maxRetries: 1,
            socketTimeout: 2000,
            attemptTimeout: 5000,
            givenPortOnly: true
        }) as GameDigResponse;

        if (!serverState.players || !Array.isArray(serverState.players)) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Player List Unavailable')
                .setDescription('This server does not provide player list information.')
                .setTimestamp();
            return await interaction.editReply({ embeds: [embed] });
        }

        if (serverState.players.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('👥 Player List')
                .setDescription('No players currently online or player list is not available.')
                .setFooter({ text: `Server: ${host}:${port}` })
                .setTimestamp();
            return await interaction.editReply({ embeds: [embed] });
        }

        const totalPlayers = serverState.players.length;
        const formattedList = formatPlayerList(serverState.players);

        if (!formattedList) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Player List Error')
                .setDescription('Player list is available but names are hidden or empty.')
                .setFooter({ text: `Server: ${host}:${port}` })
                .setTimestamp();
            return await interaction.editReply({ embeds: [embed] });
        }

        if (formattedList.length > 1024) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Player List Too Long')
                .setDescription(`Too many players to display (${totalPlayers} online). Please check the server directly.`)
                .setFooter({ text: `Server: ${host}:${port}` })
                .setTimestamp();
            return await interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)  // do you know this color? 
            .setTitle(`👥 Online Players (${totalPlayers})`)
            .addFields({
                name: '📋 Player List',
                value: `\`\`\`\n${formattedList}\`\`\``
            })
            .setFooter({ 
                text: `Server: ${host}:${port} • Click 🔄 to refresh` 
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Player list error:', error);
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Error Fetching Player List')
            .setDescription('Failed to fetch player list. Server might be offline or not responding.')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
} 