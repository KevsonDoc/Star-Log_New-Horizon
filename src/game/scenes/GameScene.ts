import Phaser from 'phaser';
import { Match } from '../domain/Match.js';
import { IMAGES, SPRITE_SHEETS, TEXTURES } from '../config/assets.js';
import { GAME_SETTINGS } from '../config/settings.js';
import { KeyboardControls } from '../input/KeyboardControls.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';

export class GameScene extends Phaser.Scene {
    private match!: Match;
    private player!: Phaser.Physics.Arcade.Sprite;
    private asteroid!: Phaser.Physics.Arcade.Sprite;
    private healthLabel!: Phaser.GameObjects.Text;
    private controls!: KeyboardControls;
    private projectiles!: ProjectileSystem;
    private firing = false;
    private ready = false;
    private loadFailed = false;

    constructor() { super('game'); }

    preload(): void {
        this.loadFailed = false;
        this.load.on('progress', (value: number) => this.game.events.emit('mission-progress', value));
        this.load.once('loaderror', () => {
            this.loadFailed = true;
            this.game.events.emit('mission-load-error');
        });
        for (const image of IMAGES) this.load.image(image.key, image.url);
        for (const sheet of SPRITE_SHEETS) {
            this.load.spritesheet(sheet.key, sheet.url, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
        }
    }

    create(): void {
        if (this.loadFailed) return;
        this.match = new Match();
        this.firing = false;
        this.ready = false;
        this.add.image(400, 300, TEXTURES.background);
        this.createPlayer();
        this.createAsteroid();
        this.createExplosion();
        this.createHealthLabel();

        const bombs = this.createBombs();
        this.physics.add.collider(this.player, bombs, () => this.hitPlayer());
        this.projectiles = new ProjectileSystem(this, this.asteroid, () => this.hitAsteroid());
        this.controls = new KeyboardControls(this.input.keyboard);
        this.input.on('pointerdown', this.fireLaser, this);
        this.input.on('pointerup', this.releaseTrigger, this);
        this.input.on('pointerupoutside', this.releaseTrigger, this);
        this.input.keyboard?.on('keydown-SPACE', this.fireLaser, this);
        this.input.keyboard?.on('keyup-SPACE', this.releaseTrigger, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        this.physics.pause();
        this.game.events.once('mission-start', () => {
            this.ready = true;
            this.physics.resume();
        });
        this.game.events.emit('mission-ready');
    }

    update(): void {
        if (!this.ready || !this.match.isRunning) return;
        const velocity = this.controls.getVelocity(GAME_SETTINGS.playerSpeed);
        this.player.setVelocity(velocity.x, velocity.y);
        this.projectiles.update();
    }

    private createPlayer(): void {
        this.player = this.physics.add.sprite(100, 450, TEXTURES.ship);
        this.player.setCollideWorldBounds(true);
    }

    private createAsteroid(): void {
        this.asteroid = this.physics.add.sprite(100, 100, TEXTURES.asteroid);
        this.asteroid.setImmovable(true).setCollideWorldBounds(true);
        this.asteroid.setVelocityX(GAME_SETTINGS.asteroidSpeed).setBounce(1);
    }

    private createBombs(): Phaser.Physics.Arcade.Group {
        const bombs = this.physics.add.group();
        for (let index = 0; index < GAME_SETTINGS.bombCount; index += 1) {
            const bomb: unknown = bombs.create(Phaser.Math.Between(150, 550), Phaser.Math.Between(150, 550), TEXTURES.bomb);
            if (!(bomb instanceof Phaser.Physics.Arcade.Sprite)) continue;
            bomb.setCollideWorldBounds(true).setBounce(Phaser.Math.FloatBetween(0.6, 0.9));
            bomb.setVelocity(Phaser.Math.Between(-500, 800), Phaser.Math.Between(-400, 750));
        }
        return bombs;
    }

    private createExplosion(): void {
        if (this.anims.exists('explosion')) return;
        this.anims.create({
            key: 'explosion',
            frames: this.anims.generateFrameNumbers(TEXTURES.explosion),
            frameRate: 10,
        });
    }

    private createHealthLabel(): void {
        this.healthLabel = this.add.text(16, 16, 'VIDA ASTEROID: ' + this.match.asteroidHealth, {
            fontSize: '32px', color: '#8B0000',
        });
    }

    private fireLaser(): void {
        if (!this.ready || this.firing || !this.match.isRunning) return;
        this.firing = true;
        this.projectiles.fire(this.player.x, this.player.y);
    }

    private releaseTrigger(): void { this.firing = false; }

    private hitAsteroid(): void {
        if (!this.match.isRunning) return;
        this.match.hitAsteroid();
        this.healthLabel.setText('VIDA ASTEROID: ' + this.match.asteroidHealth);
        if (this.match.status === 'won') {
            this.asteroid.play('explosion');
            this.finishMatch('VITÓRIA', '#00008B');
        }
    }

    private hitPlayer(): void {
        if (!this.match.isRunning) return;
        this.match.hitPlayer();
        this.player.play('explosion', true);
        if (this.match.status === 'lost') this.finishMatch('Game Over', '#8B0000');
    }

    private finishMatch(message: string, color: string): void {
        this.add.text(150, 250, message, { fontSize: '90px', color });
        this.physics.pause();
        this.game.events.emit('mission-ended', this.match.status === 'won');
    }

    private shutdown(): void {
        this.input.off('pointerdown', this.fireLaser, this);
        this.input.off('pointerup', this.releaseTrigger, this);
        this.input.off('pointerupoutside', this.releaseTrigger, this);
        this.input.keyboard?.off('keydown-SPACE', this.fireLaser, this);
        this.input.keyboard?.off('keyup-SPACE', this.releaseTrigger, this);
        this.projectiles.destroy();
    }
}
