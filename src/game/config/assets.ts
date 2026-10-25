export const TEXTURES = {
    background: 'background',
    laser: 'laser',
    ship: 'ship',
    asteroid: 'asteroid',
    explosion: 'explosion',
} as const;

const imagesRoot = '/assets/images/';
export const IMAGES = [
    { key: TEXTURES.background, url: imagesRoot + 'galaxia1.png' },
    { key: TEXTURES.laser, url: imagesRoot + 'phaser.png' },
];
export const SPRITE_SHEETS = [
    { key: TEXTURES.ship, url: imagesRoot + 'USSamazonia.png', frameWidth: 60, frameHeight: 60 },
    { key: TEXTURES.asteroid, url: imagesRoot + 'elemento_1.png', frameWidth: 90, frameHeight: 100 },
    { key: TEXTURES.explosion, url: imagesRoot + 'Explosion.png', frameWidth: 96, frameHeight: 96 },
];
