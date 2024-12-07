export interface GameDigResponse {
    name: string;
    map: string;
    password: boolean;
    maxplayers: number;
    numplayers: number;
    players: Array<{
        name: string;
        raw: Record<string, any>;
    }>;
    bots: Array<{
        name: string;
        raw: Record<string, any>;
    }>;
    connect: string;
    ping: number;
    raw?: {
        vanilla?: {
            raw?: {
                players?: {
                    online?: number;
                    max?: number;
                }
            }
        }
        numplayers?: number;
        maxplayers?: number;
    };
} 