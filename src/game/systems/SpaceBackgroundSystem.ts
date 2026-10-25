import Phaser from 'phaser';
import { SPACE_PALETTE } from '../config/palette.js';
import { drawBlackHoleSheet, drawGalaxy, drawPlanet, drawTwinkleSheet, HOLE_FRAME } from './SpacePixelArt.js';

const TEXTURES = {
    galaxy: 'sl-galaxy-composition', hole: 'sl-accretion-sheet',
    planet: 'sl-ice-planet', star: 'sl-distant-star', twinkle: 'sl-twinkle-sheet',
    dust: 'sl-cosmic-dust', comet: 'sl-shooting-star',
} as const;
const ANIMS = { hole: 'sl-accretion', twinkle: 'sl-twinkle' } as const;
const MARGIN = 16;

interface StarField {
    group: Phaser.GameObjects.Group;
    speed: number;
    accumulator: number;
}

/** Scenic art stays in one background layer; all motion uses the Scene clock. */
export class SpaceBackgroundSystem {
    private readonly layer: Phaser.GameObjects.Layer;
    private readonly bounds = new Phaser.Geom.Rectangle();
    private readonly galaxyTexture: Phaser.Textures.CanvasTexture;
    private readonly galaxy: Phaser.GameObjects.Image;
    private readonly celestial: Phaser.GameObjects.Container;
    private readonly hole: Phaser.GameObjects.Sprite;
    private readonly planet: Phaser.GameObjects.Image;
    private readonly fields: StarField[] = [];
    private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
    private readonly comet: Phaser.GameObjects.Image;
    private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
    private readonly cometPoint = new Phaser.Math.Vector2();
    private cometPath!: Phaser.Curves.Path;
    private pixelScale = 2;
    private elapsed = 0;
    private cometElapsed = 0;
    private cometWait = 5;
    private destroyed = false;

    constructor(private readonly scene: Phaser.Scene, width: number, height: number) {
        this.bounds.setTo(0, 0, width, height);
        this.createTextures();
        this.createAnimations();
        this.layer = scene.add.layer().setDepth(0);
        this.galaxyTexture = this.canvas(TEXTURES.galaxy, 1, 1);
        this.galaxy = scene.add.image(0, 0, TEXTURES.galaxy).setOrigin(0);
        this.layer.add(this.galaxy);
        // Distant bodies share a very slow parallax drift through a container.
        this.celestial = scene.add.container(0, 0);
        this.hole = scene.add.sprite(0, 0, TEXTURES.hole, 0).play(ANIMS.hole);
        this.planet = scene.add.image(0, 0, TEXTURES.planet);
        this.celestial.add([this.hole, this.planet]);
        this.layer.add(this.celestial);
        this.createStarField(125, 3, false);
        this.createStarField(46, 9, false);
        this.createStarField(12, 17, true);
        this.dust = scene.add.particles(0, 0, TEXTURES.dust, {
            emitZone: { type: 'random', source: {
                getRandomPoint: (point) => {
                    point.x = Phaser.Math.FloatBetween(0, this.bounds.width);
                    point.y = Phaser.Math.FloatBetween(0, this.bounds.height);
                },
            } },
            lifespan: 6500, speedX: -2, speedY: { min: 12, max: 21 },
            alpha: { start: 0.35, end: 0 }, scale: 2,
            frequency: 240, quantity: 1, advance: 4000,
            maxParticles: 32, reserve: 32,
        });
        this.layer.add(this.dust);
        this.comet = scene.add.image(0, 0, TEXTURES.comet).setVisible(false);
        this.trail = scene.add.particles(0, 0, TEXTURES.dust, {
            follow: this.comet, trackVisible: true, emitting: false,
            lifespan: 650, speedX: -24, speedY: -12,
            alpha: { start: 0.65, end: 0 }, scale: 2,
            frequency: 35, quantity: 1, maxParticles: 24, reserve: 24,
        });
        this.layer.add([this.trail, this.comet]);
        this.layer.bringToTop(this.celestial);
        this.resize(width, height);
    }

    update(delta: number): void {
        if (this.destroyed) return;
        const dt = delta / 1000;
        this.elapsed += dt;
        const grid = this.pixelScale;
        // Bounded drift never reveals edges or repeating seams.
        const dx = Math.floor(Math.sin(this.elapsed * 0.025) * 5) * grid;
        const dy = Math.floor(Math.sin(this.elapsed * 0.018) * 6) * grid;
        this.galaxy.setPosition(-MARGIN * grid + dx, -MARGIN * grid + dy);
        this.celestial.setPosition(-dx, -dy);
        for (const field of this.fields) {
            field.accumulator += field.speed * dt;
            const step = Math.floor(field.accumulator / grid) * grid;
            if (step === 0) continue;
            field.accumulator -= step;
            const stars = field.group.getChildren();
            Phaser.Actions.IncY(stars, step);
            Phaser.Actions.WrapInRectangle(stars, this.bounds, grid * 4);
        }
        this.updateComet(dt);
    }

    resize(width: number, height: number): void {
        if (this.destroyed) return;
        this.pixelScale = Math.max(1, Math.min(3, Math.floor(width / 520)));
        const grid = this.pixelScale;
        this.bounds.setTo(0, 0, width, height);
        const w = Math.ceil(width / grid) + MARGIN * 2;
        const h = Math.ceil(height / grid) + MARGIN * 2;
        this.galaxyTexture.setSize(w, h);
        drawGalaxy(this.galaxyTexture.getContext(), w, h);
        this.galaxyTexture.refresh();
        this.galaxy.setTexture(TEXTURES.galaxy).setScale(grid)
            .setPosition(-MARGIN * grid, -MARGIN * grid);
        this.hole.setScale(grid).setPosition(this.snap(width * 0.78), this.snap(height * 0.30));
        this.planet.setScale(grid).setPosition(this.snap(width * 0.13), this.snap(height * 0.70));
        const random = new Phaser.Math.RandomDataGenerator(['star-log-deep-field']);
        for (const field of this.fields) {
            const stars = field.group.getChildren() as Phaser.GameObjects.Image[];
            Phaser.Actions.SetScale(stars, grid, grid);
            for (const star of stars) {
                star.setPosition(this.snap(random.frac() * width), this.snap(random.frac() * height));
            }
        }
        this.dust.setParticleScale(grid);
        this.trail.setParticleScale(grid);
        this.comet.setScale(grid).setVisible(false);
        this.trail.stop(true);
        this.cometElapsed = 0;
        this.cometWait = 5;
        // Rebuild on resize so shooting stars never follow stale bounds.
        this.cometPath?.destroy();
        this.cometPath = new Phaser.Curves.Path(-60, height * 0.12);
        this.cometPath.cubicBezierTo(width + 80, height * 0.58,
            width * 0.28, height * 0.20, width * 0.68, height * 0.32);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        // Groups do not own display objects; Layer destroys its children once.
        for (const field of this.fields) field.group.destroy();
        this.fields.length = 0;
        this.cometPath.destroy();
        this.layer.destroy();
        this.scene.textures.remove(TEXTURES.galaxy);
    }

    private snap(value: number): number {
        return Math.floor(value / this.pixelScale) * this.pixelScale;
    }

    private createStarField(count: number, speed: number, animated: boolean): void {
        const group = this.scene.add.group();
        for (let i = 0; i < count; i++) {
            const star = animated
                ? this.scene.add.sprite(0, 0, TEXTURES.twinkle, i % 4)
                : this.scene.add.image(0, 0, TEXTURES.star);
            star.setOrigin(0);
            group.add(star);
            this.layer.add(star);
        }
        const stars = group.getChildren();
        Phaser.Actions.Spread(stars, 'alpha', animated ? 0.5 : 0.2, animated ? 0.95 : 0.6);
        if (animated) {
            this.scene.anims.staggerPlay(ANIMS.twinkle, stars as Phaser.GameObjects.Sprite[], 730);
        }
        this.fields.push({ group, speed, accumulator: 0 });
    }

    private updateComet(dt: number): void {
        this.cometElapsed += dt;
        if (this.cometElapsed < this.cometWait) return;
        const progress = (this.cometElapsed - this.cometWait) / 3.6;
        if (progress >= 1) {
            this.comet.setVisible(false);
            this.trail.stop();
            this.cometElapsed = 0;
            this.cometWait = 13;
            return;
        }
        this.cometPath.getPoint(progress, this.cometPoint);
        this.comet.setPosition(this.snap(this.cometPoint.x), this.snap(this.cometPoint.y))
            .setVisible(true).setAlpha(Math.min(1, progress * 8, (1 - progress) * 8));
        if (!this.trail.emitting) this.trail.start();
    }

    private canvas(key: string, width: number, height: number): Phaser.Textures.CanvasTexture {
        const texture = this.scene.textures.createCanvas(key, width, height);
        if (!texture) throw new Error('Could not create space texture: ' + key);
        texture.getContext().imageSmoothingEnabled = false;
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        return texture;
    }

    private createTextures(): void {
        if (!this.scene.textures.exists(TEXTURES.hole)) {
            const { width, height, count } = HOLE_FRAME;
            const texture = this.canvas(TEXTURES.hole, width * count, height);
            drawBlackHoleSheet(texture.getContext());
            for (let frame = 0; frame < count; frame++) {
                texture.add(frame, 0, frame * width, 0, width, height);
            }
            texture.refresh();
        }
        if (!this.scene.textures.exists(TEXTURES.planet)) {
            const texture = this.canvas(TEXTURES.planet, 40, 40);
            drawPlanet(texture.getContext());
            texture.refresh();
        }
        if (!this.scene.textures.exists(TEXTURES.twinkle)) {
            const texture = this.canvas(TEXTURES.twinkle, 28, 7);
            drawTwinkleSheet(texture.getContext());
            for (let i = 0; i < 4; i++) texture.add(i, 0, i * 7, 0, 7, 7);
            texture.refresh();
        }
        for (const [key, color] of [[TEXTURES.star, SPACE_PALETTE.starCool],
            [TEXTURES.dust, SPACE_PALETTE.starDim]] as const) {
            if (this.scene.textures.exists(key)) continue;
            const texture = this.canvas(key, 1, 1);
            const ctx = texture.getContext();
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            texture.refresh();
        }
        if (!this.scene.textures.exists(TEXTURES.comet)) {
            const texture = this.canvas(TEXTURES.comet, 11, 5);
            const ctx = texture.getContext();
            ctx.fillStyle = SPACE_PALETTE.starDim;
            ctx.fillRect(0, 0, 4, 1);
            ctx.fillRect(3, 1, 4, 1);
            ctx.fillStyle = SPACE_PALETTE.starCool;
            ctx.fillRect(6, 2, 3, 1);
            ctx.fillStyle = SPACE_PALETTE.starBright;
            ctx.fillRect(9, 3, 2, 1);
            texture.refresh();
        }
    }

    private createAnimations(): void {
        if (!this.scene.anims.exists(ANIMS.hole)) {
            this.scene.anims.create({
                key: ANIMS.hole,
                frames: this.scene.anims.generateFrameNumbers(TEXTURES.hole, { start: 0, end: 15 }),
                frameRate: 8, repeat: -1,
            });
        }
        if (!this.scene.anims.exists(ANIMS.twinkle)) {
            this.scene.anims.create({
                key: ANIMS.twinkle,
                frames: this.scene.anims.generateFrameNumbers(TEXTURES.twinkle, { start: 0, end: 3 }),
                frameRate: 3, repeat: -1, repeatDelay: 2400,
            });
        }
    }
}
