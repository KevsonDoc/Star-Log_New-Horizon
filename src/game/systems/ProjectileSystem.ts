import Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/settings.js';
import { TEXTURES } from '../config/assets.js';

export class ProjectileSystem {
    private readonly group: Phaser.Physics.Arcade.Group;
    private readonly overlap: Phaser.Physics.Arcade.Collider;
    private readonly bounds: Phaser.Geom.Rectangle;

    constructor(scene: Phaser.Scene, target: Phaser.Physics.Arcade.Sprite, onHit: () => void) {
        this.bounds = scene.physics.world.bounds;
        this.group = scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            maxSize: GAME_SETTINGS.maxProjectiles,
        });
        this.overlap = scene.physics.add.overlap(target, this.group, (_target, projectile) => {
            if (projectile instanceof Phaser.Physics.Arcade.Sprite && projectile.active) {
                projectile.disableBody(true, true);
                onHit();
            }
        });
    }

    fire(x: number, y: number): void {
        const projectile: unknown = this.group.get(x, y, TEXTURES.laser);
        if (!(projectile instanceof Phaser.Physics.Arcade.Sprite)) return;
        projectile.enableBody(true, x, y, true, true);
        projectile.setVelocity(0, GAME_SETTINGS.laserSpeed);
    }

    update(): void {
        for (const projectile of this.group.getChildren()) {
            if (!(projectile instanceof Phaser.Physics.Arcade.Sprite) || !projectile.active) continue;
            if (projectile.y + projectile.displayHeight < this.bounds.top) {
                projectile.disableBody(true, true);
            }
        }
    }

    destroy(): void {
        if (this.overlap.active) this.overlap.destroy();
        this.group.destroy(true);
    }
}
