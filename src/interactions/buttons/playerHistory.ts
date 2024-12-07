import { ButtonInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { generatePlayerHistoryChart } from '../../utils/charts';
import { pool } from '../../utils/database';

export async function handlePlayerHistoryButton(interaction: ButtonInteraction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const [_, serverId] = interaction.customId.split('|');
        
        // Get server info
        const serverResult = await pool.query(
            'SELECT * FROM server_monitors WHERE id = $1',
            [serverId]
        );

        if (serverResult.rows.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('Server not found')
                .setTimestamp();
            return await interaction.editReply({ embeds: [embed] });
        }

        const server = serverResult.rows[0];

        // Generate chart
        const chartBuffer = await generatePlayerHistoryChart(server.id);
        
        const attachment = new AttachmentBuilder(chartBuffer, { 
            name: 'player-history.png',
            description: 'Player count history chart'
        });

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('📊 Player History')
            .setDescription(`Player history for ${server.server_host}:${server.server_port}`)
            .setImage('attachment://player-history.png')
            .setFooter({ text: 'Last 24 hours • Updates every 5 minutes' })
            .setTimestamp();

        await interaction.editReply({ 
            embeds: [embed],
            files: [attachment]
        });

    } catch (error) {
        console.error('Error handling player history:', error);
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Error')
            .setDescription('Failed to generate player history')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
} 