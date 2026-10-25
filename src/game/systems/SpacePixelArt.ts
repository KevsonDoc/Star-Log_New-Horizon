import { SPACE_PALETTE as P } from '../config/palette.js';

// One palette, one pixel grid, one restrained ordered-dither pattern.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const GALAXY = [P.voidDeep, P.voidDark, P.voidMid, P.nebulaShadow,
    P.nebulaDark, P.nebulaMid, P.nebulaLight, P.nebulaMist, P.nebulaIce];
const EMBERS = [P.emberShadow, P.emberDark, P.emberMid,
    P.emberLight, P.emberBright, P.starBright];
export const HOLE_FRAME = { width: 160, height: 104, count: 16 } as const;
export const LASER_FRAME = { width: 28, height: 32, count: 4 } as const;
export const MUZZLE_FRAME = { width: 32, height: 18, count: 4 } as const;
export const IMPACT_FRAME = { width: 36, height: 36, count: 6 } as const;
export const SPARK_FRAME = { width: 5, height: 5, count: 6 } as const;

function hash(x: number, y: number): number {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const top = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx;
    const bottom = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
    return top * (1 - fy) + bottom * fy;
}

function cloud(x: number, y: number): number {
    return noise(x, y) * 0.55 + noise(x * 2.03 + 17, y * 2.03) * 0.27
        + noise(x * 4.09, y * 4.09 + 23) * 0.13
        + noise(x * 8.13 + 31, y * 8.13) * 0.05;
}

function dither(x: number, y: number): number {
    return (BAYER[(y & 3) * 4 + (x & 3)]! / 16 - 0.5) * 0.42;
}

function rgb(hex: string): readonly number[] {
    const value = Number.parseInt(hex.slice(1), 16);
    return [value >>> 16, (value >>> 8) & 255, value & 255];
}

/** A full composition generated once on resize, without repeating nebula tiles. */
export function drawGalaxy(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.imageSmoothingEnabled = false;
    const image = ctx.createImageData(width, height);
    const ramp = GALAXY.map(rgb);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const u = x / width, v = y / height;
            const warp = cloud(x / 95, y / 95);
            const center = 0.14 + u * 0.66 + Math.sin(u * 6.4 + 0.7) * 0.055;
            const distance = v - center + (warp - 0.5) * 0.23;
            const body = Math.exp(-Math.pow(distance / 0.105, 2));
            const halo = Math.exp(-Math.pow(distance / 0.24, 2));
            const detail = cloud(x / 37 + 18, y / 27 + 9);
            const laneOffset = (noise(x / 36, 19) - 0.5) * 0.09;
            const lane = Math.exp(-Math.pow((distance - laneOffset) / 0.023, 2));
            const wisps = noise(x / 16 + 37, y / 8) * 0.18;
            // A dark dust lane cuts through the brighter galactic clouds.
            let light = halo * 0.15 + body * (0.32 + detail * 0.63 + wisps);
            light *= 1 - lane * 0.82;
            light *= 0.68 + noise(x / 65, y / 55) * 0.42;
            // Negative space around the HUD and the lower flight corridor.
            light *= 1 - Math.max(0, v - 0.66) * 1.05;
            const shade = Math.max(0, Math.min(8, Math.floor(light * 8 + dither(x, y))));
            const color = ramp[shade]!;
            const index = (y * width + x) * 4;
            image.data[index] = color[0]!;
            image.data[index + 1] = color[1]!;
            image.data[index + 2] = color[2]!;
            image.data[index + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);
    const count = Math.min(450, Math.floor(width * height / 330));
    for (let i = 0; i < count; i++) {
        const x = Math.floor(hash(i, 83) * width);
        const y = Math.floor(hash(i, 97) * height);
        ctx.fillStyle = i % 13 === 0 ? P.starWarm : i % 5 === 0 ? P.starDim : P.voidLight;
        ctx.fillRect(x, y, 1, 1);
    }
    // A denser star nursery follows the band rather than a uniform scatter.
    for (let i = 0; i < count; i++) {
        const u = hash(i, 112);
        const center = 0.14 + u * 0.66 + Math.sin(u * 6.4 + 0.7) * 0.055;
        const spread = (hash(i, 113) + hash(i, 114) - 1) * 0.15;
        const x = Math.floor(u * width), y = Math.floor((center + spread) * height);
        ctx.fillStyle = i % 9 === 0 ? P.nebulaMist : P.nebulaLight;
        ctx.fillRect(x, y, 1, 1);
    }
}

/** Draw each disk frame on the grid; never rotate a finished pixel sprite. */
export function drawBlackHoleSheet(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    const { width, height, count } = HOLE_FRAME;
    for (let frame = 0; frame < count; frame++) {
        const phase = frame / count * Math.PI * 2;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - 80, dy = y - 50;
                const r = Math.hypot(dx, dy + 6);
                const u = dx * 0.988 + dy * 0.155;
                const v = dy * 0.988 - dx * 0.155;
                const diskR = Math.hypot(u, v * 4.1);
                const theta = Math.atan2(v * 4.1, u);
                let color: string | undefined;
                const halo = Math.exp(-Math.pow((r - 26) / 13, 2));
                if (halo > 0.24 + hash(x, y) * 0.65) color = P.nebulaShadow;
                if (r > 22 && r < 25) color = r < 23 ? P.emberDark : P.emberShadow;
                // Lensed light over the top of the event horizon.
                const lens = Math.hypot(dx, (dy + 6) * 0.92);
                if (dy < -6 && lens > 22 && lens < 28) {
                    const brightness = 1 - (lens - 22) / 6;
                    const strand = Math.sin(lens * 2.4 + theta * 2 - phase) * 0.35;
                    color = EMBERS[Math.max(0, Math.min(4, Math.floor(brightness * 4 + strand)))]!;
                }
                const inDisk = diskR > 25 && diskR < 70;
                if (inDisk && (v < 0 || r > 21)) {
                    const falloff = Math.pow(1 - (diskR - 25) / 45, 0.7);
                    const streak = Math.sin(diskR * 1.65 + theta * 3 - phase * 2) * 0.38
                        + Math.sin(theta * 7 + phase + diskR * 0.22) * 0.22;
                    const shade = Math.max(0, Math.min(5, Math.floor(falloff * 3.7 + streak
                        + (u > 0 ? 0.7 : -0.2) + dither(x, y))));
                    if (falloff > 0.13 + hash(x, y) * 0.12) color = EMBERS[shade]!;
                }
                // Opaque horizon hides background stars and the far disk.
                if (r < 21.5) color = P.horizon;
                if (r >= 21.5 && r < 22.5) color = dy < -6 ? P.emberLight : P.emberDark;
                // Near side crosses in front, with a fine bright rim.
                if (inDisk && v >= 0) {
                    const strand = Math.sin(diskR * 1.8 + theta * 4 - phase * 2) * 0.5;
                    const shade = Math.max(0, Math.min(5, Math.floor(3.7 - (diskR - 25) / 21
                        + strand + (u > 0 ? 0.9 : 0))));
                    color = EMBERS[shade]!;
                }
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(frame * width + x, y, 1, 1);
                }
            }
        }
    }
}

export function drawPlanet(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    const ramp = [P.planetShadow, P.planetDark, P.planetMid, P.planetLight, P.planetHighlight];
    for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
            const nx = (x - 20) / 14, ny = (y - 20) / 14;
            const radius = nx * nx + ny * ny;
            if (radius > 1.18) continue;
            if (radius > 1) {
                if (radius < 1.12 && nx + ny < -0.2) {
                    ctx.fillStyle = P.gasLight;
                    ctx.fillRect(x, y, 1, 1);
                }
                continue;
            }
            const light = Math.max(0, -nx * 0.55 - ny * 0.35 + Math.sqrt(1 - radius) * 0.6);
            const terrain = noise(x / 3.5, y / 2.7) * 0.75;
            const shade = Math.max(0, Math.min(4, Math.floor(light * 4 + terrain - 0.4 + dither(x, y))));
            ctx.fillStyle = ramp[shade]!;
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

export function drawTwinkleSheet(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    const cores = [P.starDim, P.starCool, P.starBright, P.starCool];
    const arms = [P.voidLight, P.starDim, P.starCool, P.starDim];
    for (let i = 0; i < 4; i++) {
        const x = i * 7 + 3;
        ctx.fillStyle = arms[i]!;
        ctx.fillRect(x - 2, 3, 5, 1);
        ctx.fillRect(x, 1, 1, 5);
        ctx.fillStyle = cores[i]!;
        ctx.fillRect(x, 3, 1, 1);
    }
}


/**
 * 4-frame triple-beam phaser volley with subpixel color-shifted energy nodes
 * and hue-shifted plasma ramps (cool shadow -> warm ember -> cyan/white core).
 */
export function drawLaserSheet(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    const { width, height, count } = LASER_FRAME;
    for (let frame = 0; frame < count; frame++) {
        const ox = frame * width;
        // Center main phaser lance (x = 12..15, y = 1..29)
        for (let y = 1; y < 30; y++) {
            const pulse = (y + frame * 2) % 6;
            if (y <= 3) {
                ctx.fillStyle = y === 1 ? P.starCyan : P.starBright;
                ctx.fillRect(ox + 13, y, 2, 1);
                if (y >= 2) {
                    ctx.fillStyle = P.emberBright;
                    ctx.fillRect(ox + 12, y, 1, 1);
                    ctx.fillRect(ox + 15, y, 1, 1);
                }
                continue;
            }
            if (y >= 25) {
                const tailShade = Math.max(0, Math.min(3, Math.floor((30 - y) * 0.8 + dither(13 + frame, y))));
                if (tailShade > 0) {
                    ctx.fillStyle = EMBERS[tailShade]!;
                    ctx.fillRect(ox + 13, y, 2, 1);
                }
                if ((y + frame) % 2 === 0 && y < 28) {
                    ctx.fillStyle = P.emberShadow;
                    ctx.fillRect(ox + 12, y, 1, 1);
                    ctx.fillRect(ox + 15, y, 1, 1);
                }
                continue;
            }
            // Subpixel energy nodes travel up the core via color shifting
            const coreColor = pulse === 0 ? P.starBright : pulse === 1 ? P.starCyan : P.emberBright;
            const sheathColor = pulse < 2 ? P.emberLight : pulse < 4 ? P.emberMid : P.emberDark;
            ctx.fillStyle = sheathColor;
            ctx.fillRect(ox + 12, y, 1, 1);
            ctx.fillRect(ox + 15, y, 1, 1);
            ctx.fillStyle = coreColor;
            ctx.fillRect(ox + 13, y, 2, 1);
            // Periodic side fins for silhouette readability at 1x zoom
            if (pulse === 1 && y > 5 && y < 22) {
                ctx.fillStyle = P.emberShadow;
                ctx.fillRect(ox + 11, y, 1, 1);
                ctx.fillRect(ox + 16, y, 1, 1);
            }
        }

        // Twin wing-cannon bolts (left: x = 4..5, right: x = 22..23, y = 8..27)
        for (const bx of [4, 22]) {
            for (let y = 8; y < 28; y++) {
                const pulse = (y + frame * 2 + 3) % 5;
                if (y <= 10) {
                    ctx.fillStyle = y === 8 ? P.starCyan : P.starBright;
                    ctx.fillRect(ox + bx, y, 2, 1);
                    continue;
                }
                if (y >= 24) {
                    if ((y + frame) % 2 === 0) {
                        ctx.fillStyle = y === 24 ? P.emberMid : P.emberDark;
                        ctx.fillRect(ox + bx, y, 2, 1);
                    }
                    continue;
                }
                ctx.fillStyle = pulse === 0 ? P.starBright : pulse < 3 ? P.emberBright : P.emberLight;
                ctx.fillRect(ox + bx, y, 2, 1);
                ctx.fillStyle = pulse < 2 ? P.emberMid : P.emberDark;
                ctx.fillRect(ox + bx - 1, y, 1, 1);
                ctx.fillRect(ox + bx + 2, y, 1, 1);
            }
        }

        // Subtle plasma arc chevron linking wing bolts to central lance
        const arcY = 12 + (frame % 3) * 2;
        ctx.fillStyle = frame % 2 === 0 ? P.starCyan : P.emberLight;
        ctx.fillRect(ox + 7, arcY + 2, 2, 1);
        ctx.fillRect(ox + 9, arcY + 1, 2, 1);
        ctx.fillRect(ox + 19, arcY + 2, 2, 1);
        ctx.fillRect(ox + 17, arcY + 1, 2, 1);
    }
    void height;
}

/** 4-frame snappy muzzle flash for the central nose and twin wing cannons. */
export function drawMuzzleFlashSheet(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    const { width } = MUZZLE_FRAME;
    for (let frame = 0; frame < MUZZLE_FRAME.count; frame++) {
        const ox = frame * width;
        if (frame === 0) {
            // Frame 0: Ignition star-cross burst
            ctx.fillStyle = P.emberBright;
            ctx.fillRect(ox + 12, 5, 8, 6);
            ctx.fillRect(ox + 14, 2, 4, 12);
            ctx.fillRect(ox + 8, 7, 16, 2);
            ctx.fillStyle = P.starCyan;
            ctx.fillRect(ox + 13, 6, 6, 4);
            ctx.fillRect(ox + 15, 0, 2, 15);
            ctx.fillStyle = P.starBright;
            ctx.fillRect(ox + 14, 6, 4, 4);
            // Wing cannon flashes
            for (const wx of [5, 25]) {
                ctx.fillStyle = P.emberLight;
                ctx.fillRect(ox + wx - 2, 11, 6, 4);
                ctx.fillStyle = P.starBright;
                ctx.fillRect(ox + wx - 1, 10, 4, 4);
            }
        } else if (frame === 1) {
            // Frame 1: Expanding V-chevron plasma wave
            ctx.fillStyle = P.emberMid;
            ctx.fillRect(ox + 10, 3, 12, 8);
            ctx.fillStyle = P.emberBright;
            ctx.fillRect(ox + 11, 4, 10, 4);
            ctx.fillRect(ox + 6, 6, 20, 2);
            ctx.fillStyle = P.starBright;
            ctx.fillRect(ox + 14, 3, 4, 4);
            for (const wx of [5, 25]) {
                ctx.fillStyle = P.emberBright;
                ctx.fillRect(ox + wx - 2, 10, 5, 3);
                ctx.fillStyle = P.starCyan;
                ctx.fillRect(ox + wx, 9, 2, 3);
            }
        } else if (frame === 2) {
            // Frame 2: Separating plasma crescents & ejecta
            ctx.fillStyle = P.emberLight;
            ctx.fillRect(ox + 9, 3, 4, 3);
            ctx.fillRect(ox + 19, 3, 4, 3);
            ctx.fillRect(ox + 14, 1, 4, 2);
            ctx.fillStyle = P.emberMid;
            ctx.fillRect(ox + 7, 5, 3, 2);
            ctx.fillRect(ox + 22, 5, 3, 2);
            for (const wx of [4, 26]) {
                ctx.fillStyle = P.emberMid;
                ctx.fillRect(ox + wx, 9, 3, 2);
            }
        } else {
            // Frame 3: Residual cooling embers
            ctx.fillStyle = P.emberDark;
            ctx.fillRect(ox + 8, 2, 2, 2);
            ctx.fillRect(ox + 22, 2, 2, 2);
            ctx.fillRect(ox + 15, 0, 2, 2);
            ctx.fillStyle = P.emberShadow;
            ctx.fillRect(ox + 4, 8, 2, 2);
            ctx.fillRect(ox + 26, 8, 2, 2);
        }
    }
}

/** 6-frame asteroid impact blast & dithered shockwave ring on the pixel grid. */
export function drawImpactSheet(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    const { width, height, count } = IMPACT_FRAME;
    const cx = width / 2, cy = height / 2;
    for (let frame = 0; frame < count; frame++) {
        const ox = frame * width;
        const innerR = frame === 0 ? 0 : (frame - 1) * 2.6;
        const outerR = 6 + frame * 2.1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - cx + 0.5, dy = y - cy + 0.5;
                const r = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx);
                const ray = Math.cos(angle * 4 + frame * 0.7) * 1.4;
                let color: string | undefined;

                if (frame === 0) {
                    if (r < 4.2) color = P.starBright;
                    else if (r < 6.5 + ray) color = r < 5.2 ? P.starCyan : P.emberBright;
                    else if ((Math.abs(dx) < 1.2 && Math.abs(dy) < 12) || (Math.abs(dy) < 1.2 && Math.abs(dx) < 12)) {
                        color = P.emberBright;
                    }
                } else if (frame === 1) {
                    if (r < 3.5) color = P.starBright;
                    else if (r < 6.2) color = P.emberBright;
                    else if (r < 9.5 + ray) color = P.emberLight;
                    else if (r < 11.2 + ray && dither(x, y) > -0.1) color = P.emberMid;
                } else {
                    const band = r - innerR + ray * 0.6;
                    const span = Math.max(2, outerR - innerR);
                    if (r >= innerR - 0.8 && r <= outerR + ray * 0.8) {
                        const norm = 1 - Math.max(0, Math.min(1, band / span));
                        const shadeIdx = Math.floor(norm * (6 - frame * 0.65) + dither(x + frame, y));
                        if (shadeIdx >= 0) {
                            if (frame === 2 && shadeIdx >= 4) color = P.starCyan;
                            else color = EMBERS[Math.min(5, shadeIdx)];
                        }
                    }
                    // Ionized outer rim pixels on frames 2-3
                    if ((frame === 2 || frame === 3) && Math.abs(r - outerR) < 0.9 && (x + y + frame) % 3 === 0) {
                        color = P.nebulaLight;
                    }
                }

                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(ox + x, y, 1, 1);
                }
            }
        }
    }
}

/** 6-frame 5x5 pixel-art spark, plasma, and rock debris sheet for ParticleEmitter. */
export function drawSparkSheet(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    const { width } = SPARK_FRAME;
    // Frame 0: White-cyan star spark
    ctx.fillStyle = P.starCyan;
    ctx.fillRect(2, 0, 1, 5);
    ctx.fillRect(0, 2, 5, 1);
    ctx.fillStyle = P.starBright;
    ctx.fillRect(2, 2, 1, 1);

    // Frame 1: Cyan ion diamond
    const f1 = width;
    ctx.fillStyle = P.starCool;
    ctx.fillRect(f1 + 1, 2, 3, 1);
    ctx.fillRect(f1 + 2, 1, 1, 3);
    ctx.fillStyle = P.starCyan;
    ctx.fillRect(f1 + 2, 2, 1, 1);

    // Frame 2: Solar gold plasma spark
    const f2 = width * 2;
    ctx.fillStyle = P.emberLight;
    ctx.fillRect(f2 + 1, 2, 3, 1);
    ctx.fillRect(f2 + 2, 1, 1, 3);
    ctx.fillStyle = P.emberBright;
    ctx.fillRect(f2 + 2, 2, 1, 1);

    // Frame 3: Molten slag chunk (top-left lit)
    const f3 = width * 3;
    ctx.fillStyle = P.emberDark;
    ctx.fillRect(f3 + 1, 1, 3, 3);
    ctx.fillStyle = P.emberLight;
    ctx.fillRect(f3 + 1, 1, 2, 2);
    ctx.fillStyle = P.emberBright;
    ctx.fillRect(f3 + 1, 1, 1, 1);

    // Frame 4: Cooling crimson ember
    const f4 = width * 4;
    ctx.fillStyle = P.emberShadow;
    ctx.fillRect(f4 + 1, 1, 3, 3);
    ctx.fillStyle = P.emberMid;
    ctx.fillRect(f4 + 1, 1, 2, 2);

    // Frame 5: Asteroid rock fragment (top-left light source, selout shadow)
    const f5 = width * 5;
    ctx.fillStyle = P.planetShadow;
    ctx.fillRect(f5 + 1, 1, 3, 3);
    ctx.fillStyle = P.planetMid;
    ctx.fillRect(f5 + 1, 1, 2, 2);
    ctx.fillStyle = P.planetHighlight;
    ctx.fillRect(f5 + 1, 1, 1, 1);
}
