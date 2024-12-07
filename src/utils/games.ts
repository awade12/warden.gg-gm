interface GameType {
    id: string;      // e.g., 'gs1', 'gs2', etc.
    name: string;    // Display name
    value: string;   // GameDig query type
    defaultPort?: number;
    category?: string;
}

export const GAME_LIST: GameType[] = [
    { id: 'gs1', name: 'Minecraft', value: 'minecraft', defaultPort: 25565, category: 'Popular' },
    { id: 'gs2', name: 'Counter-Strike 2', value: 'csgo', defaultPort: 27015, category: 'FPS' },
    { id: 'gs3', name: 'Team Fortress 2', value: 'tf2', defaultPort: 27015, category: 'FPS' },
    { id: 'gs4', name: 'Rust', value: 'rust', defaultPort: 28015, category: 'Survival' }, // rust is not giving the right data 
    // ... more games
];

export const getGameById = (id: string): GameType | undefined => {
    return GAME_LIST.find(game => game.id === id);
};

export const getGameChoices = () => {
    return GAME_LIST.map(game => ({
        name: `${game.name} (${game.id})`,
        value: game.id
    }));
};
