import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import {
    AIR, D_CLOSED, DOOR, FOUNTAIN, MM_NOGRP, MM_NOWAIT, NO_MINVENT,
    POOL, SCORR, SDOOR, STONE, Upolyd,
} from '../js/const.js';
import { glyphAt, map_invisible, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { BOULDER, PICK_AXE, STATUE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

function emptyArena(form?: string) {
    freshObjectRoom({
        left: 1, right: 20, top: 0, bottom: 20,
        flags: { verbose: true, disclose: '-i -a -v -c -o' },
        hero: { uhp: 200, uhpmax: 200 },
    });
    requirePlayingGame(game);
    if (form) installPolymorphedHero(form, { hitPoints: 200 });
    return game;
}

async function command(keys: string, expected: RegExp, seed = 71n): Promise<string> {
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 20 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey(): Promise<number> {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    pushKeys(keys);
    initRng(seed);
    await rhack(0);
    messages.push(game._pending_message);
    return messages.join('\n');
}

void test('an empty flaming-sphere attack kills a bystander with hero credit and spends the form', async () => {
    const state = emptyArena('flaming sphere');
    const bystander = await createMonsterAt('newt', 10, 11, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    bystander.mhp = 1;
    bystander.mpeaceful = false;
    const hunger = state.u.uhunger;
    const health = state.u.uhp;

    const messages = await command('Fl', /explode|explosion|newt|return to human/);

    assert.match(messages, /You explode at thin air\./);
    assert.equal(state.level.monsters.includes(bystander), false);
    assert.equal(state.u.uconduct.killer, 1);
    assert.equal(Upolyd(state.u), false);
    assert.equal(state.u.uhunger, hunger);
    assert.equal(state.u.uhp, health);
    assert.equal(state.context.move, 1);
    assert.equal(state.u.ux, 10);
});

void test('an empty light explosion wakes nearby monsters without applying a targeted flash', async () => {
    const state = emptyArena('yellow light');
    const near = await createMonsterAt('orc', 16, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    const boundary = await createMonsterAt('orc', 17, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    near.msleeping = boundary.msleeping = 1;

    await command('Fl', /explode|return to human|can see again/);

    assert.equal(near.msleeping, 0);
    assert.equal(boundary.msleeping, 1);
    assert.equal(near.mblinded ?? 0, 0);
    assert.equal(near.mconf ?? 0, 0);
    assert.equal(Upolyd(state.u), false);
});

void test('a gas-spore death explosion cannot be invoked by force fighting empty air', async () => {
    const state = emptyArena('gas spore');

    const messages = await command('Fl', /attack thin air/);

    assert.equal(messages, 'You attack thin air.');
    assert.equal(Upolyd(state.u), true);
    assert.equal(state.u.mh, 200);
});

for (const offEdge of [false, true]) {
    void test(`an explosive form is spent on ${offEdge ? 'the edge of the map' : 'a stone obstacle'}`, async () => {
        const state = emptyArena('black light');
        if (offEdge) state.u.ux = 1;
        else {
            state.level.requireAt(11, 10).typ = STONE;
            newsym(11, 10);
        }

        const messages = await command(offEdge ? 'Fh' : 'Fl', /explode|return to human|can see again/);

        assert.match(messages, offEdge
            ? /You futilely explode at an unknown obstacle\./
            : /You futilely explode at the stone\./);
        assert.equal(Upolyd(state.u), false);
        assert.equal(state.context.move, 1);
    });
}

for (const [terrain, name] of [[FOUNTAIN, 'fountain'], [DOOR, 'closed door'], [POOL, 'water']] as const) {
    void test(`an empty attack names the ${name} without entering it`, async () => {
        const state = emptyArena();
        const location = state.level.requireAt(11, 10);
        location.typ = terrain;
        if (terrain === DOOR) location.doormask = D_CLOSED;
        newsym(11, 10);

        const messages = await command('Fl', /harmlessly attack/);

        assert.equal(messages, `You harmlessly attack the ${name}.`);
        assert.equal(state.u.ux, 10);
    });
}

void test('blind attacks cannot identify an unseen piece of furniture', async () => {
    const state = emptyArena();
    await makeBlinded(20, { state, talk: false });
    const location = state.level.requireAt(11, 10);
    location.typ = FOUNTAIN;
    location.seenv = 0;
    location.remembered_glyph = null;
    newsym(11, 10);

    const messages = await command('Fl', /harmlessly attack/);

    assert.equal(messages, 'You harmlessly attack an unknown obstacle.');
    assert.equal(location.seenv, 0);
});

for (const terrain of [STONE, SCORR, SDOOR]) {
    void test(`arboreal terrain ${terrain} is displayed and named as a tree`, async () => {
        const state = emptyArena();
        state.level.flags.arboreal = true;
        const location = state.level.requireAt(11, 10);
        location.typ = terrain;
        if (terrain === SDOOR) location.arboreal_sdoor = true;
        newsym(11, 10);

        const messages = await command('Fl', /harmlessly attack/);

        assert.equal(messages, 'You harmlessly attack the tree.');
        const glyph = glyphAt(11, 10);
        assert.equal(glyph?.kind, 'terrain');
        if (glyph?.kind === 'terrain') assert.equal(glyph.terrainName, 'tree');
    });
}

for (const hallucinating of [false, true]) {
    void test(`a ${hallucinating ? 'hallucinated' : 'visible'} statue receives an empty attack`, async () => {
        emptyArena();
        await floorObject(STATUE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('orc') });
        if (hallucinating) await makeHallucinated(20, { talk: false });
        newsym(11, 10);

        const messages = await command('Fl', /harmlessly attack/);

        assert.equal(messages, 'You harmlessly attack a statue.');
    });
}

void test('a remembered invisible monster consumes one search-by-attack and then permits movement', async () => {
    const state = emptyArena();
    map_invisible(11, 10);

    const messages = await command('l', /attack thin air/);

    assert.equal(messages, 'You attack thin air.');
    assert.equal(state.u.ux, 10);
    assert.notEqual(glyphAt(11, 10)?.kind, 'invisible');
    await rhack('l'.charCodeAt(0));
    assert.equal(state.u.ux, 11);
});

void test('move-without-pickup bypasses an empty invisible marker', async () => {
    const state = emptyArena();
    map_invisible(11, 10);

    const messages = await command('ml', /./);

    assert.equal(state.u.ux, 11);
    assert.doesNotMatch(messages, /attack/);
});

for (const waterPlane of [false, true]) {
    void test(`an underwater attack at ${waterPlane ? 'an air bubble' : 'dry land'} describes what the hero can reach`, async () => {
        const state = emptyArena();
        state.u.uinwater = true;
        state.underwater = true;
        state.level.requireAt(10, 10).typ = POOL;
        if (waterPlane) {
            state.water_level = { ...state.u.uz, flags: { town: false }, alignment: null };
            state.level.requireAt(11, 10).typ = AIR;
        }
        newsym(11, 10);

        // Keep this attack aimed at the chosen terrain; turbulence has its
        // own movement tests and can otherwise consume this attempt.
        const messages = await command('Fl', /You attack/, 2n);

        assert.equal(messages, `You attack ${waterPlane ? 'an air bubble' : 'nothing'}.`);
        assert.equal(state.u.ux, 10);
    });
}

for (const obstacle of ['wall', 'boulder', 'statue'] as const) {
    void test(`force fighting a ${obstacle} with a pick starts the real digging occupation`, async () => {
        const state = emptyArena();
        const pick = await addInventoryObject(PICK_AXE);
        await setPrimaryWeapon(pick);
        if (obstacle === 'wall') state.level.requireAt(11, 10).typ = STONE;
        else await floorObject(obstacle === 'boulder' ? BOULDER : STATUE, 11, 10);
        newsym(11, 10);

        const messages = await command('Fl', /start (?:digging|hitting|chipping)/);

        assert.match(messages, /start (?:digging|hitting|chipping)/);
        assert.equal(state._occupation?.key, 'dig');
        assert.equal(state.context.digging?.pos.x, 11);
        assert.equal(state.u.ux, 10);
    });
}

void test('an invisible marker prevents force fighting with a pick from starting a dig', async () => {
    const state = emptyArena();
    await setPrimaryWeapon(await addInventoryObject(PICK_AXE));
    state.level.requireAt(11, 10).typ = STONE;
    map_invisible(11, 10);

    const messages = await command('Fl', /harmlessly attack/);

    assert.match(messages, /You harmlessly attack the stone\./);
    assert.equal(state._occupation ?? null, null);
    assert.notEqual(glyphAt(11, 10)?.kind, 'invisible');
});
