import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { LEVEL_TELEP, MM_ANGRY, MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { lootMonsterContainer } from '../js/monster_container_loot.js';
import { useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { takeMonsterTurn, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { addObjectToContainer } from '../js/object_container.js';
import { AMULET_OF_YENDOR, BUGLE, BULLWHIP, DAGGER, LOADSTONE, POT_HEALING, SACK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
for (const name of ['The Orb of Detection', 'The Heart of Ahriman', 'Excalibur']) {
    void test(`a carrier of ${name} ${name === 'Excalibur' ? 'can' : 'cannot'} escape from the dungeon entrance`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10, hero: { uz: { dnum: 0, dlevel: 1 } } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        const artifact = await addObjectToMonsterInventory(monster, await artifactObject(name), game);
        assert.ok(artifact);
        const messages = [];
        await useMonsterDefensiveItem(monster, { kind: 'stairs', stair: {
                sx: 10, sy: 10, up: true, isladder: false,
                tolev: { dnum: 0, dlevel: 0 }, next: null, u_traversed: false,
            } }, { state: game, publish: message => { messages.push(message); } });
        const escapes = name === 'Excalibur';
        assert.equal(level.monsters.includes(monster), !escapes);
        assert.equal(messages.some(message => message.includes('escapes the dungeon')), escapes);
        if (!escapes)
            assert.equal(artifact.ocarry, monster);
    });
}
void test('a bullwhip cannot release a wielded cursed loadstone and reveals its curse', async () => {
    freshObjectRoom({ heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    await equipMonsterObject(monster, await knownObject(BULLWHIP), W_WEP);
    const stone = await addInventoryObject(LOADSTONE, { cursed: true, bknown: false, corpsenm: 2 });
    await setPrimaryWeapon(stone);
    const turn = await takeMonsterTurn(monster, game, () => 0, () => 1, () => 1);
    assert.notEqual(turn.movement.usedMisc?.kind, 'bullwhip-disarm');
    assert.equal(game.uwep, stone);
    assert.equal(stone.where, 'inventory');
    assert.equal(stone.bknown, true);
    assert.equal(stone.corpsenm, 0);
});
for (const madeByHero of [true, false]) {
    void test(`a level teleport trap ${madeByHero ? 'made by the hero angers' : 'found in the dungeon does not anger'} its victim`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
        const monster = await createMonsterAt('orc', 10, 10, NO_MINVENT);
        monster.mpeaceful = 1;
        const trap = addTrap(level, LEVEL_TELEP, 10, 10);
        trap.madeby_u = madeByHero;
        initRng(2n);
        installPagerInput(resetInputState(), { expected: /gets angry|disappears/, limit: 4 });
        await triggerImmediateMonsterTrap(monster, game, { random: limit => limit === 5 ? 2 : 10 });
        assert.equal(monster.mpeaceful, madeByHero ? 0 : 1);
        assert.equal(game.u.ualign.record, madeByHero ? -1 : 0);
        assert.equal(level.monsters.includes(monster), false);
    });
}
for (const adjacent of [true, false]) {
    void test(`container looting ${adjacent ? 'shows an adjacent item appearance' : 'keeps an unshown item appearance unknown'}`, async () => {
        freshObjectRoom({ heroX: 10, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', adjacent ? 11 : 14, 10, NO_MINVENT);
        const bag = await addObjectToMonsterInventory(monster, await knownObject(SACK, { contents: [] }), game);
        assert.ok(bag);
        const potion = await knownObject(POT_HEALING, { typeKnown: false, known: false, dknown: false, bknown: false });
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[POT_HEALING] = 'pink';
        await addObjectToContainer(bag, potion, game);
        const messages = [];
        await lootMonsterContainer(monster, bag, { state: game,
            random: limit => limit - 1, publish: message => { messages.push(message); } });
        assert.equal(potion.dknown, adjacent);
        assert.equal(potion.ocarry, monster);
        assert.match(messages[0] ?? '', adjacent ? /removes a pink potion from/ : /rummages through/);
    });
}
void test('watching a soldier play a bugle observes the instrument', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 10, 10, NO_MINVENT | MM_NOGRP);
    const bugle = await addObjectToMonsterInventory(monster, await knownObject(BUGLE, { dknown: false }), game);
    assert.ok(bugle);
    const messages = [];
    await useMonsterDefensiveItem(monster, { kind: 'bugle', object: bugle }, {
        state: game, publish: message => { messages.push(message); },
    });
    assert.equal(bugle.dknown, true);
    assert.match(messages[0] ?? '', /plays .*bugle!/);
});
void test('the mysterious force surrounding a nonhumanoid Amulet carrier refers to it', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Gehennom', num_dunlevs: 20, flags: { hellish: true } })];
    const monster = await createMonsterAt('red naga', 10, 10, NO_MINVENT);
    await addObjectToMonsterInventory(monster, await knownObject(AMULET_OF_YENDOR), game);
    const messages = [];
    await useMonsterDefensiveItem(monster, { kind: 'stairs', stair: {
            sx: 10, sy: 10, up: true, isladder: false,
            tolev: { dnum: 0, dlevel: 7 }, next: null, u_traversed: false,
        } }, { state: game, random: () => 0, publish: message => { messages.push(message); } });
    assert.match(messages[0] ?? '', /momentarily surrounds it\.\.\.$/);
    assert.equal(monster.migrationDestination?.dlevel, 9);
});
void test('hallucination varies the pronoun used for the mysterious force', async () => {
    const pronouns = new Set();
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom({ heroX: 14, heroY: 10, hero: { hallucinationTurns: 20 } });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'Gehennom', num_dunlevs: 20, flags: { hellish: true } })];
        const monster = await createMonsterAt('orc', 10, 10, NO_MINVENT);
        await addObjectToMonsterInventory(monster, await knownObject(AMULET_OF_YENDOR), game);
        initRng(BigInt(seed));
        const messages = [];
        await useMonsterDefensiveItem(monster, { kind: 'stairs', stair: {
                sx: 10, sy: 10, up: true, isladder: false,
                tolev: { dnum: 0, dlevel: 7 }, next: null, u_traversed: false,
            } }, { state: game, random: limit => limit === 4 ? 0 : limit - 1,
            publish: message => { messages.push(message); } });
        const pronoun = messages[0]?.match(/surrounds (him|her|it|them)\.\.\.$/)?.[1];
        assert.ok(pronoun, messages.join('\n'));
        pronouns.add(pronoun);
    }
    assert.ok(pronouns.size > 1, 'Hallucination should vary the perceived gender across games');
});
void test('the Wizard ends a successful looting turn without insulting the hero', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    level.flags.noteleport = true;
    const wizard = await createMonsterAt('Wizard of Yendor', 10, 10, MM_ANGRY | MM_NOWAIT | NO_MINVENT);
    wizard.movement = 12;
    wizard.mspec_used = 20;
    const bag = await addObjectToMonsterInventory(wizard, await knownObject(SACK, { contents: [] }), game);
    assert.ok(bag);
    const dagger = await knownObject(DAGGER);
    await addObjectToContainer(bag, dagger, game);
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.u.umovement = 12;
    initRng(8n);
    const input = resetInputState();
    installPagerInput(input, { expected: /rummages/, limit: 2 });
    await finishAtCommandInput(input, moveloop_core, /rummages/);
    assert.equal(bag.contents?.length, 0);
    assert.equal(dagger.ocarry, wizard);
    assert.equal(game.u.uhp, 40);
});
//# sourceMappingURL=monster_item_turn_rules.test.js.map