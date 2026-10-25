import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { SPACE_PALETTE } from '../src/game/config/palette.ts';
import { Match } from '../src/game/domain/Match.ts';

test('a match starts with the legacy health values', () => {
    const match = new Match();
    assert.equal(match.status, 'playing');
    assert.equal(match.asteroidHealth, 3000);
    assert.equal(match.playerHealth, 200);
});

test('asteroid damage clamps health and wins exactly once', () => {
    const match = new Match({ asteroidHealth: 7, playerHealth: 200, laserDamage: 5, bombDamage: 200 });
    match.hitAsteroid();
    assert.equal(match.asteroidHealth, 2);
    assert.equal(match.status, 'playing');
    match.hitAsteroid();
    assert.equal(match.asteroidHealth, 0);
    assert.equal(match.status, 'won');
    match.hitPlayer();
    match.hitAsteroid();
    assert.equal(match.playerHealth, 200);
    assert.equal(match.asteroidHealth, 0);
    assert.equal(match.status, 'won');
});

test('a lethal bomb ends the match and later hits do not change it', () => {
    const match = new Match();
    match.hitPlayer();
    assert.equal(match.playerHealth, 0);
    assert.equal(match.status, 'lost');
    match.hitAsteroid();
    assert.equal(match.asteroidHealth, 3000);
    assert.equal(match.status, 'lost');
});

test('procedural laser, muzzle flash, impact, and spark pixel sheets render every frame with palette colors', async () => {
    const raw = await readFile(new URL('../src/game/systems/SpacePixelArt.ts', import.meta.url), 'utf8');
    const source = stripTypeScriptTypes(raw.replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm, ''))
        .replaceAll('export const ', 'const ')
        .replaceAll('export function ', 'function ');
    const exportsObj = runInNewContext(
        `${source}\n({ LASER_FRAME, MUZZLE_FRAME, IMPACT_FRAME, SPARK_FRAME, drawLaserSheet, drawMuzzleFlashSheet, drawImpactSheet, drawSparkSheet })`,
        { P: SPACE_PALETTE, Math, Number },
    ) as {
        LASER_FRAME: { width: number; height: number; count: number };
        MUZZLE_FRAME: { width: number; height: number; count: number };
        IMPACT_FRAME: { width: number; height: number; count: number };
        SPARK_FRAME: { width: number; height: number; count: number };
        drawLaserSheet: (ctx: unknown) => void;
        drawMuzzleFlashSheet: (ctx: unknown) => void;
        drawImpactSheet: (ctx: unknown) => void;
        drawSparkSheet: (ctx: unknown) => void;
    };

    const validColors = new Set<string>(Object.values(SPACE_PALETTE));
    const checkSheet = (draw: (ctx: unknown) => void, frameWidth: number, frameCount: number) => {
        const frameCounts = new Array<number>(frameCount).fill(0);
        const mockCtx = {
            imageSmoothingEnabled: true,
            fillStyle: '',
            fillRect(x: number, _y: number, w: number, h: number) {
                assert.equal(validColors.has(this.fillStyle), true, `invalid palette color ${this.fillStyle}`);
                assert.equal(Number.isInteger(x) && w >= 1 && h >= 1, true);
                const frameIndex = Math.floor(x / frameWidth);
                if (frameIndex >= 0 && frameIndex < frameCount) {
                    frameCounts[frameIndex]! += w * h;
                }
            },
        };
        draw(mockCtx);
        assert.equal(mockCtx.imageSmoothingEnabled, false);
        for (let i = 0; i < frameCount; i++) {
            assert.equal(frameCounts[i]! > 0, true, `frame ${i} should not be empty`);
        }
    };

    checkSheet(exportsObj.drawLaserSheet, exportsObj.LASER_FRAME.width, exportsObj.LASER_FRAME.count);
    checkSheet(exportsObj.drawMuzzleFlashSheet, exportsObj.MUZZLE_FRAME.width, exportsObj.MUZZLE_FRAME.count);
    checkSheet(exportsObj.drawImpactSheet, exportsObj.IMPACT_FRAME.width, exportsObj.IMPACT_FRAME.count);
    checkSheet(exportsObj.drawSparkSheet, exportsObj.SPARK_FRAME.width, exportsObj.SPARK_FRAME.count);
});
