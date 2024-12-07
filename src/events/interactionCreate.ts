import { Events, Interaction } from 'discord.js';
import { CustomClient } from '../index';
import { handlePlayerListButton } from '../interactions/buttons/playerList';
import { handlePlayerHistoryButton } from '../interactions/buttons/playerHistory';

export = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (interaction.isChatInputCommand()) {
            const client = interaction.client as CustomClient;
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ 
                        content: 'There was an error executing this command!', 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: 'There was an error executing this command!', 
                        ephemeral: true 
                    });
                }
            }
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('playerlist|')) {
                await handlePlayerListButton(interaction);
            }
            if (interaction.customId.startsWith('history|')) {
                await handlePlayerHistoryButton(interaction);
                return;
            }
        }
    }
}; 
