import Phaser from 'phaser';
import { Match } from '../domain/Match.js';
import { IMAGES, SPRITE_SHEETS, TEXTURES } from '../config/assets.js';
import { GAME_SETTINGS } from '../config/settings.js';
import { KeyboardControls } from '../input/KeyboardControls.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';

export class GameScene extends Phaser.Scene {
    private match!: Match;
    private background!: Phaser.GameObjects.TileSprite;
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

        const width = this.scale.width || GAME_SETTINGS.width;
        const height = this.scale.height || GAME_SETTINGS.height;
        this.physics.world.setBounds(0, 0, width, height);
        this.background = this.add.tileSprite(0, 0, width, height, TEXTURES.background).setOrigin(0, 0);

        this.createPlayer(width, height);
        this.createAsteroid(width);
        this.createExplosion();
        this.createHealthLabel();

        this.projectiles = new ProjectileSystem(this, this.asteroid, () => this.hitAsteroid());
        this.controls = new KeyboardControls(this.input.keyboard);
        this.input.on('pointerdown', this.fireLaser, this);
        this.input.on('pointerup', this.releaseTrigger, this);
        this.input.on('pointerupoutside', this.releaseTrigger, this);
        this.input.keyboard?.on('keydown-SPACE', this.fireLaser, this);
        this.input.keyboard?.on('keyup-SPACE', this.releaseTrigger, this);
        this.scale.on('resize', this.handleResize, this);
        this.events.on(Phaser.Scenes.Events.PAUSE, this.handlePause, this);
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

    private createPlayer(width: number, height: number): void {
        this.player = this.physics.add.sprite(width / 2, Math.max(220, height - 100), TEXTURES.ship);
        this.player.setCollideWorldBounds(true);
    }

    private createAsteroid(width: number): void {
        this.asteroid = this.physics.add.sprite(width / 2, 120, TEXTURES.asteroid);
        this.asteroid.setImmovable(true).setCollideWorldBounds(true);
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
        this.healthLabel = this.add.text(24, 24, 'VIDA ASTEROID: ' + this.match.asteroidHealth, {
            fontSize: '32px', color: '#8B0000',
        });
    }

    private handleResize(gameSize: Phaser.Structs.Size): void {
        const width = gameSize.width || GAME_SETTINGS.width;
        const height = gameSize.height || GAME_SETTINGS.height;
        this.physics.world.setBounds(0, 0, width, height);
        this.background?.setSize(width, height);
        if (this.asteroid?.active) {
            this.asteroid.setPosition(width / 2, 120);
            this.asteroid.body?.updateFromGameObject();
        }
        if (this.player?.active) {
            this.player.setPosition(
                Phaser.Math.Clamp(this.player.x, 30, Math.max(30, width - 30)),
                Phaser.Math.Clamp(this.player.y, 30, Math.max(30, height - 30)),
            );
        }
    }

    private handlePause(): void {
        this.firing = false;
        this.player?.setVelocity(0, 0);
        this.input.keyboard?.resetKeys();
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

    private finishMatch(message: string, color: string): void {
        const width = this.scale.width || GAME_SETTINGS.width;
        const height = this.scale.height || GAME_SETTINGS.height;
        this.add.text(width / 2, height / 2, message, { fontSize: '90px', color }).setOrigin(0.5);
        this.physics.pause();
        this.game.events.emit('mission-ended', this.match.status === 'won');
    }

    private shutdown(): void {
        this.input.off('pointerdown', this.fireLaser, this);
        this.input.off('pointerup', this.releaseTrigger, this);
        this.input.off('pointerupoutside', this.releaseTrigger, this);
        this.input.keyboard?.off('keydown-SPACE', this.fireLaser, this);
        this.input.keyboard?.off('keyup-SPACE', this.releaseTrigger, this);
        this.scale.off('resize', this.handleResize, this);
        this.events.off(Phaser.Scenes.Events.PAUSE, this.handlePause, this);
        this.projectiles.destroy();
    }
}
