import Phaser from 'phaser';
import { TEXTURES } from '../config/assets.js';
import { SPACE_PALETTE } from '../config/palette.js';
import { GAME_SETTINGS } from '../config/settings.js';
import {
    drawImpactSheet,
    drawLaserSheet,
    drawMuzzleFlashSheet,
    drawSparkSheet,
    IMPACT_FRAME,
    LASER_FRAME,
    MUZZLE_FRAME,
    SPARK_FRAME,
} from './SpacePixelArt.js';

const FX_TEXTURES = {
    laser: 'sl-laser-sheet',
    muzzle: 'sl-muzzle-sheet',
    impact: 'sl-impact-sheet',
    spark: 'sl-spark-sheet',
} as const;

const FX_ANIMS = {
    laser: 'sl-laser-pulse',
    muzzle: 'sl-muzzle-flash',
    impact: 'sl-laser-impact',
} as const;

const PIXEL_GRID = 2;
const HULL_RADIUS = 38;
const COLORS = {
    bright: Phaser.Display.Color.HexStringToColor(SPACE_PALETTE.starBright).color,
    cyan: Phaser.Display.Color.HexStringToColor(SPACE_PALETTE.starCyan).color,
    emberBright: Phaser.Display.Color.HexStringToColor(SPACE_PALETTE.emberBright).color,
    emberLight: Phaser.Display.Color.HexStringToColor(SPACE_PALETTE.emberLight).color,
    emberMid: Phaser.Display.Color.HexStringToColor(SPACE_PALETTE.emberMid).color,
} as const;

interface ImpactWave {
    x: number;
    y: number;
    normal: number;
    elapsed: number;
    duration: number;
    radiusScale: number;
}

export type AsteroidHitHandler = (hitX: number, hitY: number, normalAngle: number) => void;

export class ProjectileSystem {
    private readonly group: Phaser.Physics.Arcade.Group;
    private readonly impactGroup: Phaser.GameObjects.Group;
    private readonly overlap: Phaser.Physics.Arcade.Collider;
    private readonly bounds: Phaser.Geom.Rectangle;
    private readonly muzzleFlash: Phaser.GameObjects.Sprite;
    private readonly fxGraphics: Phaser.GameObjects.Graphics;
    private readonly trailEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private readonly impactEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private readonly hullCircle = new Phaser.Geom.Circle(0, 0, HULL_RADIUS);
    private readonly impactCircle = new Phaser.Geom.Circle(0, 0, 5);
    private readonly rayLine = new Phaser.Geom.Line();
    private readonly hitPoints: Phaser.Math.Vector2[] = [];
    private readonly leftArc = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(),
        new Phaser.Math.Vector2(),
        new Phaser.Math.Vector2(),
    );
    private readonly rightArc = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(),
        new Phaser.Math.Vector2(),
        new Phaser.Math.Vector2(),
    );
    private readonly shockEllipse = new Phaser.Curves.Ellipse(0, 0, 8, 4);
    private readonly rimEllipse = new Phaser.Curves.Ellipse(0, 0, HULL_RADIUS, HULL_RADIUS, 20, 160);
    private readonly impactWaves: ImpactWave[] = [];
    private muzzleX = 0;
    private muzzleY = 0;
    private muzzleArcTimer = 0;
    private trailAccumulator = 0;
    private hitCounter = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly target: Phaser.Physics.Arcade.Sprite,
        onHit: AsteroidHitHandler,
    ) {
        this.bounds = scene.physics.world.bounds;
        this.createTextures();
        this.createAnimations();

        this.group = scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            maxSize: GAME_SETTINGS.maxProjectiles,
        });

        this.impactGroup = scene.add.group({
            classType: Phaser.GameObjects.Sprite,
            maxSize: 16,
        });

        this.muzzleFlash = scene.add.sprite(0, 0, FX_TEXTURES.muzzle, 0)
            .setDepth(3)
            .setScale(PIXEL_GRID)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setVisible(false);

        this.fxGraphics = scene.add.graphics()
            .setDepth(3)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.trailEmitter = scene.add.particles(0, 0, FX_TEXTURES.spark, {
            frame: [1, 2, 4],
            emitting: false,
            lifespan: { min: 130, max: 240 },
            speedX: { min: -26, max: 26 },
            speedY: { min: 45, max: 115 },
            scale: { start: PIXEL_GRID, end: 1 },
            alpha: { start: 0.85, end: 0 },
            maxParticles: 64,
            reserve: 64,
        }).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);

        this.impactEmitter = scene.add.particles(0, 0, FX_TEXTURES.spark, {
            frame: { frames: [0, 1, 2, 3, 4, 5], cycle: true, quantity: 2 },
            emitting: false,
            emitZone: {
                type: 'random',
                source: {
                    getRandomPoint: (point) => {
                        this.impactCircle.getRandomPoint(point as Phaser.Math.Vector2);
                    },
                },
            },
            lifespan: { min: 200, max: 440 },
            speed: { min: 60, max: 200 },
            gravityY: 135,
            scale: { start: PIXEL_GRID, end: 1 },
            alpha: { start: 1, end: 0, ease: 'Quad.easeIn' },
            maxParticles: 96,
            reserve: 96,
        }).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);

        this.overlap = scene.physics.add.overlap(target, this.group, (_target, projectile) => {
            if (!(projectile instanceof Phaser.Physics.Arcade.Sprite) || !projectile.active) return;
            const { hitX, hitY, normalAngle } = this.computeImpactPoint(projectile);
            projectile.disableBody(true, true);
            this.spawnImpactEffect(hitX, hitY, normalAngle);
            onHit(hitX, hitY, normalAngle);
        });
    }

    fire(x: number, y: number): void {
        const snapX = Phaser.Math.Snap.Floor(x, PIXEL_GRID);
        const snapY = Phaser.Math.Snap.Floor(y, PIXEL_GRID);
        const textureKey = this.scene.textures.exists(FX_TEXTURES.laser) ? FX_TEXTURES.laser : TEXTURES.laser;
        const projectile: unknown = this.group.get(snapX, snapY, textureKey);
        if (!(projectile instanceof Phaser.Physics.Arcade.Sprite)) return;

        projectile.enableBody(true, snapX, snapY, true, true);
        projectile.setTexture(textureKey, 0);
        projectile.setDepth(2)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setScale(PIXEL_GRID)
            .setAlpha(1)
            .setVelocity(0, GAME_SETTINGS.laserSpeed);
        if (projectile.body instanceof Phaser.Physics.Arcade.Body) {
            projectile.body.setSize(22, 28, true);
        }
        if (this.scene.anims.exists(FX_ANIMS.laser)) {
            projectile.play(FX_ANIMS.laser, true);
        }

        // Trigger muzzle flash & wing-cannon convergence arcs
        this.muzzleX = snapX;
        this.muzzleY = snapY;
        this.muzzleArcTimer = 95;
        this.muzzleFlash.setPosition(snapX, snapY - 4).setVisible(true);
        if (this.scene.anims.exists(FX_ANIMS.muzzle)) {
            this.muzzleFlash.play(FX_ANIMS.muzzle);
        }
        this.trailEmitter.emitParticleAt(snapX, snapY - 4, 2);
        this.trailEmitter.emitParticleAt(snapX - 18, snapY + 12, 1);
        this.trailEmitter.emitParticleAt(snapX + 18, snapY + 12, 1);
    }

    triggerFinalBlast(x: number, y: number): void {
        const snapX = Phaser.Math.Snap.Floor(x, PIXEL_GRID);
        const snapY = Phaser.Math.Snap.Floor(y, PIXEL_GRID);
        this.impactEmitter.setEmitterAngle({ min: 0, max: 360 });
        this.impactEmitter.explode(36, snapX, snapY);
        this.pushImpactWave(snapX, snapY, Math.PI * 0.5, 340, 2.1);
    }

    update(delta = 16.67, shipX?: number, shipY?: number): void {
        if (shipX !== undefined && shipY !== undefined) {
            this.muzzleX = Phaser.Math.Snap.Floor(shipX, PIXEL_GRID);
            this.muzzleY = Phaser.Math.Snap.Floor(shipY, PIXEL_GRID);
            if (this.muzzleFlash.visible) {
                this.muzzleFlash.setPosition(this.muzzleX, this.muzzleY - 4);
            }
        }

        this.trailAccumulator += delta;
        const emitTrail = this.trailAccumulator >= 28;
        if (emitTrail) this.trailAccumulator = 0;

        for (const projectile of this.group.getChildren()) {
            if (!(projectile instanceof Phaser.Physics.Arcade.Sprite) || !projectile.active) continue;
            if (projectile.y + projectile.displayHeight < this.bounds.top) {
                projectile.disableBody(true, true);
                continue;
            }
            if (emitTrail) {
                const tailY = Phaser.Math.Snap.Floor(projectile.y + 18, PIXEL_GRID);
                this.trailEmitter.emitParticleAt(projectile.x, tailY, 1);
            }
        }

        this.updateEffectsGraphics(delta);
    }

    destroy(): void {
        if (this.overlap.active) this.overlap.destroy();
        this.group.destroy(true);
        this.impactGroup.destroy(true);
        this.muzzleFlash.destroy();
        this.fxGraphics.destroy();
        this.trailEmitter.destroy();
        this.impactEmitter.destroy();
        this.impactWaves.length = 0;
    }

    private computeImpactPoint(projectile: Phaser.Physics.Arcade.Sprite): {
        hitX: number;
        hitY: number;
        normalAngle: number;
    } {
        const tx = this.target.x;
        const ty = this.target.y;
        this.hullCircle.setTo(tx, ty, HULL_RADIUS);
        this.rayLine.setTo(projectile.x, projectile.y + 28, projectile.x, projectile.y - 36);
        this.hitPoints.length = 0;
        Phaser.Geom.Intersects.GetLineToCircle(this.rayLine, this.hullCircle, this.hitPoints);

        let rawX = projectile.x;
        let rawY = projectile.y - 14;
        if (this.hitPoints.length > 0) {
            // Choose the lowest (front-most) surface intersection point
            let best = this.hitPoints[0]!;
            for (let i = 1; i < this.hitPoints.length; i++) {
                const candidate = this.hitPoints[i]!;
                if (candidate.y > best.y) best = candidate;
            }
            rawX = best.x;
            rawY = best.y;
        } else {
            const angle = Phaser.Math.Angle.Between(tx, ty, rawX, Math.max(ty + 6, rawY));
            const dist = Phaser.Math.Clamp(Phaser.Math.Distance.Between(tx, ty, rawX, rawY), 14, HULL_RADIUS);
            rawX = tx + Math.cos(angle) * dist;
            rawY = ty + Math.sin(angle) * dist;
        }

        const hitX = Phaser.Math.Snap.Floor(rawX, PIXEL_GRID);
        const hitY = Phaser.Math.Snap.Floor(rawY, PIXEL_GRID);
        const normalAngle = Phaser.Math.Angle.Between(tx, ty, hitX, Math.max(ty + 4, hitY));
        return { hitX, hitY, normalAngle };
    }

    private spawnImpactEffect(hitX: number, hitY: number, normalAngle: number): void {
        this.hitCounter += 1;

        // 1. Pooled pixel-art impact blast sprite
        const impactSprite: unknown = this.impactGroup.get(hitX, hitY, FX_TEXTURES.impact, 0);
        if (impactSprite instanceof Phaser.GameObjects.Sprite) {
            impactSprite.setActive(true)
                .setVisible(true)
                .setPosition(hitX, hitY)
                .setDepth(3)
                .setScale(PIXEL_GRID)
                .setAngle((this.hitCounter & 3) * 90)
                .setBlendMode(Phaser.BlendModes.ADD);
            if (!impactSprite.listenerCount(`animationcomplete-${FX_ANIMS.impact}`)) {
                impactSprite.on(`animationcomplete-${FX_ANIMS.impact}`, () => {
                    impactSprite.setActive(false).setVisible(false);
                });
            }
            if (this.scene.anims.exists(FX_ANIMS.impact)) {
                impactSprite.play(FX_ANIMS.impact);
            }
        }

        // 2. Directional debris, molten slag & cyan sparks along the surface normal
        const normalDeg = Phaser.Math.RadToDeg(normalAngle);
        this.impactEmitter.setEmitterAngle({ min: normalDeg - 65, max: normalDeg + 65 });
        this.impactEmitter.explode(10, hitX, hitY);

        // 3. Curved elliptical shockwave & ionized hull arc
        this.pushImpactWave(hitX, hitY, normalAngle, 175, 1);
    }

    private pushImpactWave(x: number, y: number, normal: number, duration: number, radiusScale: number): void {
        if (this.impactWaves.length >= 8) this.impactWaves.shift();
        this.impactWaves.push({ x, y, normal, elapsed: 0, duration, radiusScale });
    }

    private updateEffectsGraphics(delta: number): void {
        this.fxGraphics.clear();

        // Draw curved wing-cannon energy convergence on muzzle fire
        if (this.muzzleArcTimer > 0) {
            this.muzzleArcTimer = Math.max(0, this.muzzleArcTimer - delta);
            const t = 1 - this.muzzleArcTimer / 95;
            const mx = this.muzzleX;
            const my = this.muzzleY;

            this.leftArc.p0.set(mx - 18, my + 12);
            this.leftArc.p1.set(mx - 12, my - 4 - t * 6);
            this.leftArc.p2.set(mx - 2, my - 6);

            this.rightArc.p0.set(mx + 18, my + 12);
            this.rightArc.p1.set(mx + 12, my - 4 - t * 6);
            this.rightArc.p2.set(mx + 2, my - 6);

            const arcColor = t < 0.45 ? COLORS.cyan : t < 0.75 ? COLORS.emberBright : COLORS.emberLight;
            this.fxGraphics.fillStyle(arcColor, 1 - t * 0.45);
            for (const curve of [this.leftArc, this.rightArc]) {
                const points = curve.getSpacedPoints(6);
                for (const pt of points) {
                    this.fxGraphics.fillRect(
                        Phaser.Math.Snap.Floor(pt.x, PIXEL_GRID),
                        Phaser.Math.Snap.Floor(pt.y, PIXEL_GRID),
                        PIXEL_GRID,
                        PIXEL_GRID,
                    );
                }
            }
        }

        // Draw active asteroid impact shockwave ellipses & thermal hull arcs
        for (let i = this.impactWaves.length - 1; i >= 0; i--) {
            const wave = this.impactWaves[i]!;
            wave.elapsed += delta;
            if (wave.elapsed >= wave.duration) {
                this.impactWaves.splice(i, 1);
                continue;
            }
            const progress = wave.elapsed / wave.duration;
            const eased = Phaser.Math.Easing.Cubic.Out(progress);
            const rx = (5 + eased * 18) * wave.radiusScale;
            const ry = (3 + eased * 10) * wave.radiusScale;

            this.shockEllipse.x = wave.x;
            this.shockEllipse.y = wave.y;
            this.shockEllipse.xRadius = rx;
            this.shockEllipse.yRadius = ry;
            this.shockEllipse.rotation = wave.normal - Math.PI * 0.5;

            const ringColor = progress < 0.28 ? COLORS.bright
                : progress < 0.55 ? COLORS.cyan
                : progress < 0.80 ? COLORS.emberLight
                : COLORS.emberMid;
            this.fxGraphics.fillStyle(ringColor, 1 - progress * 0.6);
            const ringPoints = this.shockEllipse.getSpacedPoints(10);
            for (let p = 0; p < ringPoints.length; p++) {
                if (progress > 0.65 && (p + i) % 2 === 0) continue;
                const pt = ringPoints[p]!;
                this.fxGraphics.fillRect(
                    Phaser.Math.Snap.Floor(pt.x, PIXEL_GRID),
                    Phaser.Math.Snap.Floor(pt.y, PIXEL_GRID),
                    PIXEL_GRID,
                    PIXEL_GRID,
                );
            }

            // Thermal hull rim crackle hugging the asteroid's lower contour
            if (progress < 0.65 && this.target.active) {
                const centerDeg = Phaser.Math.RadToDeg(wave.normal);
                const spread = 18 + eased * 28;
                this.rimEllipse.x = this.target.x;
                this.rimEllipse.y = this.target.y;
                this.rimEllipse.xRadius = HULL_RADIUS - 2;
                this.rimEllipse.yRadius = HULL_RADIUS - 2;
                this.rimEllipse.startAngle = centerDeg - spread;
                this.rimEllipse.endAngle = centerDeg + spread;

                this.fxGraphics.fillStyle(progress < 0.3 ? COLORS.emberBright : COLORS.emberMid, 0.9 - progress);
                const rimPoints = this.rimEllipse.getSpacedPoints(7);
                for (const pt of rimPoints) {
                    this.fxGraphics.fillRect(
                        Phaser.Math.Snap.Floor(pt.x, PIXEL_GRID),
                        Phaser.Math.Snap.Floor(pt.y, PIXEL_GRID),
                        PIXEL_GRID,
                        PIXEL_GRID,
                    );
                }
            }
        }
    }

    private canvas(key: string, width: number, height: number): Phaser.Textures.CanvasTexture {
        const texture = this.scene.textures.createCanvas(key, width, height);
        if (!texture) throw new Error('Could not create projectile texture: ' + key);
        texture.getContext().imageSmoothingEnabled = false;
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        return texture;
    }

    private createTextures(): void {
        if (!this.scene.textures.exists(FX_TEXTURES.laser)) {
            const { width, height, count } = LASER_FRAME;
            const texture = this.canvas(FX_TEXTURES.laser, width * count, height);
            drawLaserSheet(texture.getContext());
            for (let i = 0; i < count; i++) {
                texture.add(i, 0, i * width, 0, width, height);
            }
            texture.refresh();
        }
        if (!this.scene.textures.exists(FX_TEXTURES.muzzle)) {
            const { width, height, count } = MUZZLE_FRAME;
            const texture = this.canvas(FX_TEXTURES.muzzle, width * count, height);
            drawMuzzleFlashSheet(texture.getContext());
            for (let i = 0; i < count; i++) {
                texture.add(i, 0, i * width, 0, width, height);
            }
            texture.refresh();
        }
        if (!this.scene.textures.exists(FX_TEXTURES.impact)) {
            const { width, height, count } = IMPACT_FRAME;
            const texture = this.canvas(FX_TEXTURES.impact, width * count, height);
            drawImpactSheet(texture.getContext());
            for (let i = 0; i < count; i++) {
                texture.add(i, 0, i * width, 0, width, height);
            }
            texture.refresh();
        }
        if (!this.scene.textures.exists(FX_TEXTURES.spark)) {
            const { width, height, count } = SPARK_FRAME;
            const texture = this.canvas(FX_TEXTURES.spark, width * count, height);
            drawSparkSheet(texture.getContext());
            for (let i = 0; i < count; i++) {
                texture.add(i, 0, i * width, 0, width, height);
            }
            texture.refresh();
        }
    }

    private createAnimations(): void {
        if (!this.scene.anims.exists(FX_ANIMS.laser)) {
            this.scene.anims.create({
                key: FX_ANIMS.laser,
                frames: this.scene.anims.generateFrameNumbers(FX_TEXTURES.laser, { start: 0, end: LASER_FRAME.count - 1 }),
                frameRate: 20,
                repeat: -1,
            });
        }
        if (!this.scene.anims.exists(FX_ANIMS.muzzle)) {
            this.scene.anims.create({
                key: FX_ANIMS.muzzle,
                frames: this.scene.anims.generateFrameNumbers(FX_TEXTURES.muzzle, { start: 0, end: MUZZLE_FRAME.count - 1 }),
                frameRate: 28,
                repeat: 0,
                showOnStart: true,
                hideOnComplete: true,
            });
        }
        if (!this.scene.anims.exists(FX_ANIMS.impact)) {
            this.scene.anims.create({
                key: FX_ANIMS.impact,
                frames: this.scene.anims.generateFrameNumbers(FX_TEXTURES.impact, { start: 0, end: IMPACT_FRAME.count - 1 }),
                frameRate: 22,
                repeat: 0,
                showOnStart: true,
                hideOnComplete: true,
            });
        }
    }
}
