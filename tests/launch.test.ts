import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Exercise the real entry-point handlers with a deterministic clock and loader.
const source = stripTypeScriptTypes(
    (await readFile(new URL('../src/game/index.ts', import.meta.url), 'utf8'))
        .replace(/^\uFEFF/, '')
        .replace(/^import .*;\r?\n/gm, ''),
);

class Element {
    disabled = false;
    hidden = false;
    textContent = '';
    innerHTML = '';
    value = 0;
    focused = false;
    attributes = new Map<string, string>();
    listeners = new Map<string, () => void>();
    heading?: Element;
    addEventListener(name: string, handler: () => void) { this.listeners.set(name, handler); }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    focus() { this.focused = true; }
    querySelector() { return this.heading; }
    click() { if (!this.disabled) this.listeners.get('click')?.(); }
}

function setup() {
    const nodes = new Map<string, Element>();
    for (const id of ['launch-mission', 'mission-gate', 'launch-status', 'load-progress',
        'game-container', 'flight-state', 'pause-mission', 'restart-mission']) {
        nodes.set('#' + id, new Element());
    }
    const element = (id: string) => nodes.get('#' + id)!;
    element('mission-gate').heading = new Element();
    element('pause-mission').disabled = true;
    element('restart-mission').disabled = true;
    const games: FakeGame[] = [];
    class FakeGame {
        events = new EventEmitter();
        destroyed = false;
        scenePaused = false;
        scene = {
            pause: () => { this.scenePaused = true; },
            resume: () => { this.scenePaused = false; },
        };
        constructor(config: { callbacks: { preBoot: (instance: FakeGame) => void } }) {
            games.push(this);
            config.callbacks.preBoot(this);
        }
        destroy() { this.destroyed = true; }
    }
    const timers = new Map<number, () => void>();
    let nextTimer = 0;
    const documentEvents = new Map<string, () => void>();
    const document = {
        hidden: false,
        querySelector: (selector: string) => nodes.get(selector),
        addEventListener: (name: string, handler: () => void) => documentEvents.set(name, handler),
    };
    runInNewContext(source, {
        Phaser: { Game: FakeGame }, gameConfig: {}, document,
        window: {
            setInterval: (callback: () => void) => { timers.set(++nextTimer, callback); return nextTimer; },
            clearInterval: (id: number) => timers.delete(id),
            addEventListener: () => {},
        },
    });
    return {
        element, games, document, documentEvents,
        tick: () => { for (const timer of [...timers.values()]) timer(); },
    };
}

test('a mission waits for user intent, asset readiness and three visible countdown ticks', () => {
    const ui = setup();
    assert.equal(ui.games.length, 0);
    ui.element('launch-mission').click();
    ui.element('launch-mission').click();
    assert.equal(ui.games.length, 1, 'double clicks cannot create duplicate games');
    const game = ui.games[0]!;
    let starts = 0;
    game.events.on('mission-start', () => { starts += 1; });
    ui.tick();
    assert.equal(starts, 0);
    game.events.emit('mission-progress', 0.5);
    assert.equal(ui.element('load-progress').value, 0.5);
    game.events.emit('mission-ready');
    ui.document.hidden = true;
    for (let tick = 0; tick < 4; tick += 1) ui.tick();
    assert.equal(starts, 0, 'a background tab cannot finish the countdown');
    ui.document.hidden = false;
    ui.tick();
    ui.tick();
    assert.equal(starts, 0);
    ui.tick();
    assert.equal(starts, 1);
    assert.equal(ui.element('mission-gate').hidden, true);
    assert.equal(ui.element('game-container').focused, true);
});

test('a failed asset load cannot start a match and can return to preparation', () => {
    const ui = setup();
    ui.element('launch-mission').click();
    const game = ui.games[0]!;
    let started = false;
    game.events.on('mission-start', () => { started = true; });
    game.events.emit('mission-load-error');
    game.events.emit('mission-ready');
    for (let tick = 0; tick < 4; tick += 1) ui.tick();
    assert.equal(started, false);
    assert.match(ui.element('launch-status').textContent, /Não foi possível/);
    ui.element('restart-mission').click();
    assert.equal(game.destroyed, true);
    assert.equal(ui.element('launch-mission').disabled, false);
    ui.element('launch-mission').click();
    assert.equal(ui.games.length, 2);
});

test('leaving the tab pauses the mission and the player can resume or retry after losing', () => {
    const ui = setup();
    ui.element('launch-mission').click();
    const game = ui.games[0]!;
    game.events.emit('mission-ready');
    ui.tick(); ui.tick(); ui.tick();
    ui.document.hidden = true;
    ui.documentEvents.get('visibilitychange')!();
    assert.equal(game.scenePaused, true);
    assert.equal(ui.element('pause-mission').textContent, 'Continuar');
    ui.document.hidden = false;
    ui.element('pause-mission').click();
    assert.equal(game.scenePaused, false);
    game.events.emit('mission-ended', false);
    assert.equal(ui.element('mission-gate').hidden, false);
    assert.equal(ui.element('launch-mission').disabled, false);
    assert.equal(game.destroyed, true);
    ui.element('launch-mission').click();
    assert.equal(ui.games.length, 2);
});
