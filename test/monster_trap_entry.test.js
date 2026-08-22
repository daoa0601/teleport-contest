import test from 'node:test';
import assert from 'node:assert/strict';

import { BEAR_TRAP, WEB } from '../js/const.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';

function trapState(monster, trap = null) {
    return {
        level: {
            monsters: [monster],
            traps: trap ? [trap] : [],
            at: () => ({ typ: 25, lit: false }),
        },
        u: { ux: 10, uy: 10 },
    };
}

test('immediate mintrap entry is a zero-work boundary without a trap', () => {
    const monster = { mnum: 16, mx: 11, my: 10, mhp: 8 };
    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster),
    );

    assert.equal(result.event, null);
    assert.equal(result.movement.trap, undefined);
    assert.deepEqual(result.calls, []);
    assert.equal(result.movement.immediateTrap, true);
});

test('immediate mintrap entry delegates web state to the existing engine', () => {
    const monster = { mnum: 16, mx: 11, my: 10, mhp: 8 };
    const trap = { tx: 11, ty: 10, ttyp: WEB, tseen: false };
    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'web-trap');
    assert.equal(result.movement.trap, result.event);
    assert.equal(monster.mtrapped, 1);
    assert.equal(trap.tseen, true);
    assert.deepEqual(result.calls, []);
});

test('known-trap avoidance retains the injected RNG boundary', () => {
    const monster = {
        mnum: 16, mx: 11, my: 10, mhp: 8,
        mtrapseen: 1 << (WEB - 1),
    };
    const trap = { tx: 11, ty: 10, ttyp: WEB, tseen: true };
    const ranges = [];
    const result = triggerImmediateMonsterTrap(
        monster,
        trapState(monster, trap),
        range => { ranges.push(range); return 3; },
    );

    assert.equal(result.event.kind, 'known-trap-avoided');
    assert.equal(monster.mtrapped ?? 0, 0);
    assert.deepEqual(ranges, [4]);
    assert.deepEqual(result.calls, [4]);
});

test('visible bear trap returns the existing deferred-damage handoff', () => {
    const monster = { mnum: 100, mx: 11, my: 10, mhp: 20 };
    const trap = { tx: 11, ty: 10, ttyp: BEAR_TRAP, tseen: false };
    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'bear-trap');
    assert.equal(result.event.deferredDamage, true);
    assert.equal(result.movement.deferredAfterBearTrapMessage, true);
    assert.equal(monster.mtrapped, 1);
    assert.equal(monster.mhp, 20);
    assert.deepEqual(result.calls, []);
});
