import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    CacheType,
    EmbedBuilder
} from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Get information about the bot and its features'),

    async execute(interaction: ChatInputCommandInteraction<CacheType>) {
        try {
            const infoEmbed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setTitle('warden.gg monitor')
                .setDescription('A powerful Discord bot for monitoring your game servers in real-time.')
                .addFields([
                    {
                        name: '📋 Main Features',
                        value: [
                            '• Real-time server monitoring',
                            '• Support for multiple game servers',
                            '• Player count tracking',
                            '• Auto-updating status messages',
                            '• Interactive player lists',
                            '• Player count history graphs'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🎮 Supported Games',
                        value: [
                            '• Minecraft (Java & Bedrock)',
                            '• Counter-Strike 2',
                            '• Team Fortress 2',
                            '• Garry\'s Mod',
                            '• And many more!'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '⚡ Commands',
                        value: [
                            '`/setupserver` - Setup a new server monitor',
                            '`/info` - Show this information',
                            '• Click buttons below status messages to:',
                            '  - View detailed player lists',
                            '  - See player count history graphs'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '🔄 Update Frequency',
                        value: 'Server status updates every 5 minutes',
                        inline: false
                    }
                ])
                .setFooter({ text: 'Made with ❤️ by Your Bot Team' })
                .setTimestamp();

            await interaction.reply({ embeds: [infoEmbed], ephemeral: true });

        } catch (error) {
            console.error('Error in info command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching bot information.')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
};
