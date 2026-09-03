import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, G_NOCORPSE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { nameToMonster, nameToMonsterClass } from '../js/mondata.js';
import { doClassGenocide, doGenocide } from '../js/genocide.js';
import { CLUB, EGG } from '../js/object_data.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer,
} from '../js/object_timers.js';
import { inventoryObject } from './support/game-objects.js';
import { addMonster } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('monster lookup accepts source names, plurals, and class descriptions', () => {
    assert.equal(nameToMonster('giant ants'), 0);
    assert.equal(nameToMonster('human werejackal'), 262);
    assert.equal(nameToMonsterClass('major demons'), 56);
    assert.equal(nameToMonsterClass('mummies'), 39);
});

test('genocide removes the species, drops its inventory, and sterilizes eggs', async () => {
    freshGameplayRoom();
    const carried = inventoryObject(CLUB, null, { where: 'monster' });
    const ant = addMonster({
        mnum: 0,
        m_id: 40,
        x: 12,
        y: 10,
        hitPoints: 4,
        inventory: [carried],
    });
    const egg = {
        otyp: EGG, oclass: 7, corpsenm: 0,
        quan: 1, quantity: 1, where: 'inventory',
        objectTimers: [], timed: 0,
    };
    game.inventory = [egg];
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, 200);
    pushKeys('giant ant\n');

    await doGenocide(1);

    const flags = game.mvitals[0].mvflags;
    const pile = game.level.objects[12][10];
    assert.equal(flags & (G_GENOD | G_NOCORPSE), G_GENOD | G_NOCORPSE);
    assert.equal(game.level.monsters.includes(ant), false);
    assert.equal(pile.includes(carried), true);
    assert.equal(egg.objectTimers.length, 0);
});

test('a cursed genocide scroll sends in the chosen monsters', async () => {
    freshGameplayRoom();
    pushKeys('giant ant\n');

    await doGenocide(0);

    const ants = game.level.monsters.filter(monster => monster.mnum === 0);
    assert.ok(ants.length >= 4);
    assert.equal(game.mvitals?.[0]?.mvflags & G_GENOD, 0);
});

test('blessed genocide applies to every permitted species in a class', async () => {
    freshGameplayRoom();
    pushKeys(`a\n${' '.repeat(40)}`);

    await doClassGenocide();

    for (let mnum = 0; mnum <= 5; mnum++)
        assert.ok(game.mvitals[mnum].mvflags & G_GENOD);
});
