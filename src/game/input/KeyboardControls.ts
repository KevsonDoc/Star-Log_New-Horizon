import type Phaser from 'phaser';

interface MovementKeys {
    up: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
}

export class KeyboardControls {
    private readonly keys: MovementKeys | null;

    constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null) {
        this.keys = keyboard ? {
            up: keyboard.addKey('W'),
            left: keyboard.addKey('A'),
            down: keyboard.addKey('S'),
            right: keyboard.addKey('D'),
        } : null;
    }

    getVelocity(speed: number): { x: number; y: number } {
        if (!this.keys) return { x: 0, y: 0 };
        return {
            x: (Number(this.keys.right.isDown) - Number(this.keys.left.isDown)) * speed,
            y: (Number(this.keys.down.isDown) - Number(this.keys.up.isDown)) * speed,
        };
    }
}
