import { createRoom } from './support/topology.js';
import { installPagerInput } from './support/pager-input.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_CLOSED, D_NODOOR, FOUNTAIN, HWALL, MM_NOGRP, MON_OFFMAP, NO_MINVENT, ROOM, TREE } from '../js/const.js';
import { watchDigging } from '../js/digging_watch.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { startHeroDigging } from '../js/hero_digging.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { grantIntrinsicProperty, removeIntrinsicProperty } from '../js/properties.js';
import { createMonsterAt } from './support/monsters.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function town() {
    freshObjectRoom({ left: 6, right: 19, flags: { verbose: true } });
    requireFixtureGame(game);
    game.level.flags.has_town = true;
    const input = resetInputState();
    const messages: string[] = [];
    let reads = 0;
    installPagerInput(input, { expected: /dig|wall|door|tree|fountain|damage|watch|arrest|Halt|stop/i, limit: 120 });
    input.beforeRead = () => {
        if (++reads > 50) throw new Error(`Unexpected watch input: ${game._pending_message}`);
        if (game._pending_message) messages.push(game._pending_message);

    };
    return { input, messages };
}

async function guard(species = 'watchman', x = 12, y = 10) {
    const monster = await createMonsterAt(species, x, y, MM_NOGRP | NO_MINVENT);
    monster.mpeaceful = 1;
    monster.msleeping = 0;
    return monster;
}

for (const terrain of [HWALL, TREE, FOUNTAIN, DOOR] as const) {
    void test(`magical digging of town terrain ${terrain} immediately angers the watch`, async () => {
        town();
        requireFixtureGame(game);
        const witness = await guard();
        const captain = await guard('watch captain', 16, 10);
        captain.msleeping = 1;
        const target = game.level.requireAt(11, 10);
        target.typ = terrain;
        target.doormask = D_CLOSED;

        const responded = await watchDigging(11, 10);

        assert.equal(responded, true);
        assert.equal(witness.mpeaceful, 0);
        assert.equal(captain.mpeaceful, 0);
        assert.equal(captain.msleeping, 0);
    });
}

void test('a first tool warning stops digging, and resuming the same target leads to arrest', async () => {
    const { messages } = town();
    requireFixtureGame(game);
    const witness = await guard();
    game.level.requireAt(11, 10).typ = HWALL;
    const pick = await knownObject(PICK_AXE);
    await startHeroDigging(pick, 11, 10);

    await watchDigging(11, 10, { magic: false });
    assert.equal(game._occupation, null);
    assert.equal(witness.mpeaceful, 1);
    await flushPendingTopline();
    await startHeroDigging(pick, 11, 10);
    await watchDigging(11, 10, { magic: false });
    await flushPendingTopline();

    assert.equal(witness.mpeaceful, 0);
    assert.equal(game._occupation, null);
    assert.match(messages.join(' '), /stop damaging that wall.*under arrest/s);
});

void test('open doorways and ordinary ground are not town vandalism', async () => {
    town();
    requireFixtureGame(game);
    const witness = await guard();
    game.level.requireAt(11, 10).typ = ROOM;
    const door = game.level.requireAt(10, 11);
    door.typ = DOOR;
    door.doormask = D_NODOOR;

    assert.equal(await watchDigging(11, 10), false);
    assert.equal(await watchDigging(10, 11), false);
    assert.equal(witness.mpeaceful, 1);
});

void test('watchmen must see the hero and be alive, peaceful, and on the map to witness digging', async () => {
    town();
    requireFixtureGame(game);
    const witness = await guard();
    game.level.requireAt(11, 10).typ = HWALL;
    witness.mcansee = 0;
    assert.equal(await watchDigging(11, 10), false);
    witness.mcansee = 1;
    witness.mstate = MON_OFFMAP;
    assert.equal(await watchDigging(11, 10), false);
    witness.mstate = 0;
    grantIntrinsicProperty('invisible', 'outside');
    assert.equal(await watchDigging(11, 10), false);
    removeIntrinsicProperty('invisible');
    witness.mhp = 0;
    assert.equal(await watchDigging(11, 10), false);
    witness.mhp = 20;
    witness.mpeaceful = 0;
    assert.equal(await watchDigging(11, 10), false);
    witness.mpeaceful = 1;
    assert.equal(await watchDigging(11, 10), true);
});

void test('the town boundary applies to the damaged feature rather than the hero', async () => {
    town();
    requireFixtureGame(game);
    const witness = await guard();
    game.level.rooms = [createRoom({ lx: 8, hx: 11, ly: 8, hy: 12, nsubrooms: 1 })];
    game.level.requireAt(15, 10).typ = HWALL;

    assert.equal(await watchDigging(15, 10), false);
    assert.equal(witness.mpeaceful, 1);
});

void test('an arrest waits for its real message boundary before angering guards', async () => {
    town();
    requireFixtureGame(game);
    const witness = await guard();
    game.level.requireAt(11, 10).typ = HWALL;
    const input = resetInputState();
    await plineWithContinuation('The noise of your work echoes through the busy streets around you.');
    const arrest = watchDigging(11, 10);
    await input.waitUntilBlocked();
    try {
        assert.equal(witness.mpeaceful, 1);
    } finally {
        input.feed(' '.repeat(20));
        await arrest;
    }
    assert.equal(witness.mpeaceful, 0);
});
