import { SPACE_PALETTE as P } from '../config/palette.js';

// One palette, one pixel grid, one restrained ordered-dither pattern.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const GALAXY = [P.voidDeep, P.voidDark, P.voidMid, P.nebulaShadow,
    P.nebulaDark, P.nebulaMid, P.nebulaLight, P.nebulaMist, P.nebulaIce];
const EMBERS = [P.emberShadow, P.emberDark, P.emberMid,
    P.emberLight, P.emberBright, P.starBright];
export const HOLE_FRAME = { width: 160, height: 104, count: 16 } as const;

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
