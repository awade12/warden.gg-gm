import { Client, Collection, GatewayIntentBits, SlashCommandBuilder, ChatInputCommandInteraction, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { join } from 'path';
import { readdirSync } from 'fs';

config();

export type Command = {
    data: SlashCommandBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export class CustomClient extends Client {
    commands: Collection<string, Command>;
    constructor() {
        super({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
        this.commands = new Collection<string, Command>();
    }
}

const client = new CustomClient();

const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = require(filePath) as Command;
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing required properties.`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

rest.put(
    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
    { body: commands },
)
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);

const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}


client.login(process.env.DISCORD_BOT_TOKEN); 