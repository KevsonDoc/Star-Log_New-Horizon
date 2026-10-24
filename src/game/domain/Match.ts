export type MatchStatus = 'playing' | 'won' | 'lost';

export interface MatchRules {
    asteroidHealth: number;
    playerHealth: number;
    laserDamage: number;
    bombDamage: number;
}

const DEFAULT_RULES: Readonly<MatchRules> = Object.freeze({
    asteroidHealth: 3000,
    playerHealth: 200,
    laserDamage: 5,
    bombDamage: 200,
});

export class Match {
    private readonly rules: Readonly<MatchRules>;
    private currentAsteroidHealth: number;
    private currentPlayerHealth: number;
    private currentStatus: MatchStatus = 'playing';

    constructor(rules: MatchRules = DEFAULT_RULES) {
        this.rules = Object.freeze({ ...rules });
        this.currentAsteroidHealth = rules.asteroidHealth;
        this.currentPlayerHealth = rules.playerHealth;
    }

    get asteroidHealth(): number { return this.currentAsteroidHealth; }
    get playerHealth(): number { return this.currentPlayerHealth; }
    get status(): MatchStatus { return this.currentStatus; }
    get isRunning(): boolean { return this.currentStatus === 'playing'; }

    hitAsteroid(): void {
        if (this.currentStatus !== 'playing') return;
        this.currentAsteroidHealth = Math.max(0, this.currentAsteroidHealth - this.rules.laserDamage);
        if (this.currentAsteroidHealth === 0) this.currentStatus = 'won';
    }

    hitPlayer(): void {
        if (this.currentStatus !== 'playing') return;
        this.currentPlayerHealth = Math.max(0, this.currentPlayerHealth - this.rules.bombDamage);
        if (this.currentPlayerHealth === 0) this.currentStatus = 'lost';
    }
}
