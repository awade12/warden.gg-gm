import { ActivityType, Client, Events } from 'discord.js';
import { startServerMonitoring } from '../utils/serverMonitor';
import { initializeDatabase, cleanupOldHistory } from '../utils/database';
import chalk from 'chalk';

export = {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client) {
        try {
            await initializeDatabase();
            
            const serverCount = client.guilds.cache.size;
            const userCount = client.users.cache.size;
            
            client.user?.setActivity('with translations', { type: ActivityType.Playing });
            
            await startServerMonitoring(client);
            
            setInterval(() => {
                cleanupOldHistory(30).catch(console.error);
            }, 24 * 60 * 60 * 1000);
            
            console.log(chalk.cyan('╔════════════════════════════════════╗'));
            console.log(chalk.cyan('║           BOT IS ONLINE!           ║'));
            console.log(chalk.cyan('╚════════════════════════════════════╝'));
            console.log(chalk.green(`✓ Logged in as: ${chalk.yellow(client.user?.tag)}`));
            console.log(chalk.green(`✓ Servers: ${chalk.yellow(serverCount)}`));
            console.log(chalk.green(`✓ Users: ${chalk.yellow(userCount)}`));
            console.log(chalk.green(`✓ Started at: ${chalk.yellow(new Date().toLocaleString())}`));
            console.log(chalk.cyan('╔════════════════════════════════════╗'));
            console.log(chalk.cyan('║         R E A D Y WARDEN.GG        ║'));
            console.log(chalk.cyan('╚════════════════════════════════════╝'));
        } catch (error) {
            console.error('Failed to initialize bot:', error);
            process.exit(1);
        }
    }
}; 