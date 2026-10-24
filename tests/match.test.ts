import assert from 'node:assert/strict';
import test from 'node:test';
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
