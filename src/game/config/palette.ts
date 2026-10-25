/**
 * 16-bit SNES-inspired space palette with hue-shifted ramps:
 * - Shadows shift cooler toward deep indigo/violet
 * - Highlights shift warmer toward cyan, champagne, and solar gold
 */
export const SPACE_PALETTE = Object.freeze({
    voidDeep: '#030510',
    voidDark: '#080d22',
    voidMid: '#111730',
    voidLight: '#1f294d',

    nebulaShadow: '#191335',
    nebulaDark: '#2e1c53',
    nebulaMid: '#543480',
    nebulaLight: '#8a5ab6',
    nebulaMist: '#bd88d9',
    nebulaIce: '#e6bdf3',
    gasShadow: '#162936',
    gasLight: '#2d4b5c',

    horizon: '#02030a',
    emberShadow: '#422034',
    emberDark: '#873b43',
    emberMid: '#ce624c',
    emberLight: '#f4a261',
    emberBright: '#ffe0a3',

    planetShadow: '#181429',
    planetDark: '#273859',
    planetMid: '#3e5c76',
    planetLight: '#6c91ad',
    planetHighlight: '#b8d4e3',

    starDim: '#4b6584',
    starCool: '#77a8cc',
    starCyan: '#a3e4f7',
    starWarm: '#d8c29d',
    starGold: '#f2d388',
    starBright: '#f3f5f8',
});
