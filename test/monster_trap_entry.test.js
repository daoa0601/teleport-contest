import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ANTI_MAGIC, BEAR_TRAP, TELEP_TRAP, W_ARMF, W_ARMH, WEB,
} from '../js/const.js';
import {
    resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from '../js/monmove.js';
import { IRON_SHOES, ORCISH_HELM } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyMonsterRustTrap } from '../js/trap.js';
import { knownObject } from './support/game-objects.js';
import { trapAt } from './support/level-state.js';
import { liveMonster } from './support/monsters.js';

function monsterAtTrap(overrides = {}) {
    return liveMonster({
        species: 'little dog',
        x: 11,
        y: 10,
        hitPoints: 8,
        ...overrides,
    });
}

function trapState(monster, trap = null) {
    const visible = Array.from({ length: 21 }, () => []);
    visible[monster.my][monster.mx] = 0x2;
    return {
        level: {
            monsters: [monster],
            traps: trap ? [trap] : [],
            objects: Array.from({ length: 80 }, () => []),
            at: () => ({ typ: 25, lit: false }),
        },
        u: { ux: 10, uy: 10 },
        viz_array: visible,
    };
}

test('immediate mintrap entry is a zero-work boundary without a trap', () => {
    const monster = monsterAtTrap();
    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster),
    );

    assert.equal(result.event, null);
    assert.equal(result.movement.trap, undefined);
    assert.equal(result.movement.immediateTrap, true);
});

test('immediate mintrap entry delegates web state to the existing engine', () => {
    const monster = monsterAtTrap();
    const trap = trapAt(WEB, 11, 10, { tseen: false });
    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'web-trap');
    assert.equal(result.movement.trap, result.event);
    assert.equal(monster.mtrapped, 1);
    assert.equal(trap.tseen, true);
});

test('a monster which recognizes a web can avoid becoming trapped', () => {
    const monster = monsterAtTrap({
        mtrapseen: 1 << (WEB - 1),
    });
    const trap = trapAt(WEB, 11, 10, { tseen: true });
    initRng(3n); // first rn2(4) is 3, so source avoidance succeeds
    const result = triggerImmediateMonsterTrap(
        monster,
        trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'known-trap-avoided');
    assert.equal(monster.mtrapped ?? 0, 0);
    assert.equal(monster.mtrapseen, 1 << (WEB - 1));
});

test('a monster can avoid a familiar ordinary teleport trap', () => {
    const monster = monsterAtTrap({
        mtrapseen: 1 << (TELEP_TRAP - 1),
    });
    const trap = trapAt(TELEP_TRAP, 11, 10, { tseen: true });
    initRng(3n);

    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'known-trap-avoided');
    assert.deepEqual({ x: monster.mx, y: monster.my }, { x: 11, y: 10 });
});

test('a fixed teleport trap sends a monster to its free destination', () => {
    const monster = monsterAtTrap({
        mtrapseen: 1 << (TELEP_TRAP - 1),
        mtrack: [{ x: 9, y: 10 }],
    });
    const trap = trapAt(TELEP_TRAP, 11, 10, {
        tseen: true,
        teledest: { x: 15, y: 10 },
    });

    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'teleport-trap');
    assert.deepEqual({ x: monster.mx, y: monster.my }, trap.teledest);
    assert.deepEqual(monster.mtrack, []);
    assert.equal(result.movement.actionCompleted, true);
});

test('visible bear trap returns the existing deferred-damage handoff', () => {
    const monster = monsterAtTrap({ mnum: 100, hitPoints: 20 });
    const trap = trapAt(BEAR_TRAP, 11, 10, { tseen: false });
    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'bear-trap');
    assert.equal(result.event.deferredDamage, true);
    assert.equal(result.movement.deferredAfterBearTrapMessage, true);
    assert.equal(monster.mtrapped, 1);
    assert.equal(monster.mhp, 20);
});

test('rust-trap water rusts an iron helmet worn by a monster', () => {
    const helmet = {
        otyp: ORCISH_HELM, owornmask: W_ARMH, oeroded: 0,
    };
    const monster = monsterAtTrap({
        inventory: [helmet],
    });
    const event = applyMonsterRustTrap(monster, trapState(monster), {
        roll: range => range === 5 ? 0 : 1,
    });

    assert.equal(event.target, 'head');
    assert.equal(helmet.oeroded, 1);
    assert.equal(event.effects[0].kind, 'rusted');
});

test('enchanted iron shoes absorb an anti-magic trap', () => {
    const shoes = knownObject(IRON_SHOES, {
        spe: 1, enchantment: 1, owornmask: W_ARMF,
    });
    const monster = monsterAtTrap({ inventory: [shoes] });
    const trap = trapAt(ANTI_MAGIC, 11, 10);

    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'anti-magic-shoes');
    assert.equal(shoes.spe, 0);
    assert.equal(result.event.damage, 0);
});

test('an anti-magic trap drains a monster which casts spells', () => {
    const monster = monsterAtTrap({ species: 'gnomish wizard' });
    const trap = trapAt(ANTI_MAGIC, 11, 10);
    initRng(17n);

    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'anti-magic-drain');
    assert.ok(monster.mspec_used > 0);
    assert.equal(trap.tseen, true);
});

test('an anti-magic trap hurts a magic-resistant monster', () => {
    const monster = monsterAtTrap({
        species: 'baby gray dragon', hitPoints: 20,
    });
    const trap = trapAt(ANTI_MAGIC, 11, 10);
    initRng(19n);

    const result = triggerImmediateMonsterTrap(
        monster, trapState(monster, trap),
    );

    assert.equal(result.event.kind, 'anti-magic-damage');
    assert.ok(result.event.damage >= 1 && result.event.damage <= 4);
    assert.equal(monster.mhp, 20 - result.event.damage);
    assert.equal(result.movement.actorDied, undefined);
});

test('fatal anti-magic compression removes the monster', async () => {
    const monster = monsterAtTrap({
        species: 'baby gray dragon', hitPoints: 1,
    });
    const trap = trapAt(ANTI_MAGIC, 11, 10);
    const state = trapState(monster, trap);
    const messages = [];
    initRng(23n);

    const action = triggerImmediateMonsterTrap(monster, state);
    await resumeDeferredMonsterTrap(action, state, {
        random: () => 1,
        publish: async message => messages.push(message),
    });

    assert.equal(monster.dead, true);
    assert.deepEqual(state.level.monsters, []);
    assert.deepEqual(messages, [
        'The baby gray dragon is killed by the compression from an anti-magic field!',
    ]);
});
