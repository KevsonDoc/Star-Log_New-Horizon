import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene.js';
import { GAME_SETTINGS } from './settings.js';

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    parent: 'game-container',
    width: GAME_SETTINGS.width,
    height: GAME_SETTINGS.height,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [GameScene],
};
