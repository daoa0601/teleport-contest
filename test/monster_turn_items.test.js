import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVEL_TELEP, D_CLOSED, DOOR, MFAST, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { heroEveryturnEffect, resumeDeferredMovementSpell, takeMonsterTurn } from '../js/monmove.js';
import { BAG_OF_HOLDING, DAGGER, POT_EXTRA_HEALING, SACK, POT_HEALING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { pline } from '../js/display.js';
import { lootMonsterContainer } from '../js/monster_container_loot.js';
import { findMonsterDefensiveItem, useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToContainer } from '../js/object_container.js';
import { teleportMonsterToRandomLevel } from '../js/teleport.js';
import { addTrap } from './support/level-state.js';
import { createDungeon } from './support/topology.js';
import { resetInputState } from '../js/input.js';
void test('an injured hostile monster drinks healing before approaching the hero', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mhp = 2;
    monster.mhpmax = 40;
    const potion = await addObjectToMonsterInventory(monster, await knownObject(POT_HEALING), game);
    assert.ok(potion);
    installPagerInput(resetInputState(), { expected: /drinks|looks better/, limit: 4 });
    await takeMonsterTurn(monster, game, limit => limit - 1, () => 12);
    assert.equal(monster.mhp, 14);
    assert.equal(monster.minvent?.includes(potion), false);
    assert.equal(monster.mx, 10);
});
for (const species of ['hezrou', 'steam vortex']) {
    void test(`${species} leaves gas on the square it departs`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
        await takeMonsterTurn(monster, game, limit => limit - 1);
        assert.notEqual(monster.mx, 10);
        const cloud = level.regions.find(region => region.cells.some(cell => cell.x === 10 && cell.y === 10));
        assert.ok(cloud, 'The departure square should contain gas');
        assert.equal(cloud.damage, species === 'hezrou' ? 8 : 0);
    });
}
void test('a cancelled steam vortex leaves no vapor', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('steam vortex', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mcan = 1;
    await takeMonsterTurn(monster, game, limit => limit - 1);
    assert.notEqual(monster.mx, 10);
    assert.equal(level.regions.length, 0);
});
void test('a polymorphed fog cloud flowing through a closed door does not leave gas', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.u.umonnum = 106;
    game.u.mtimedone = 20;
    const door = level.requireAt(game.u.ux, game.u.uy);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    await heroEveryturnEffect(game);
    assert.equal(level.regions.length, 0);
});
void test('temporary speed does not prevent a caster from making its speed permanent', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('kobold shaman', 10, 10, NO_MINVENT);
    monster.mpeaceful = 1;
    monster.m_lev = 4;
    monster.permspeed = 0;
    monster.mspeed = MFAST;
    const random = (limit) => limit === 4 ? 2 : limit - 1;
    const turn = await takeMonsterTurn(monster, game, random);
    assert.ok(turn.movement);
    await resumeDeferredMovementSpell({ monster, ...turn, movement: turn.movement }, game, random);
    assert.equal(monster.permspeed, MFAST);
    assert.equal(monster.mspec_used, 6);
});
void test('a blind peaceful monster uses cursed extra healing to restore its sight', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, NO_MINVENT);
    monster.mpeaceful = 1;
    monster.mcansee = 0;
    monster.mblinded = 10;
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    monster.mhp = monster.mhpmax = 40;
    const potion = await addObjectToMonsterInventory(monster, await knownObject(POT_EXTRA_HEALING, { cursed: true }), game);
    assert.ok(potion);
    const choice = findMonsterDefensiveItem(monster, game);
    assert.ok(choice);
    const messages = [];
    await useMonsterDefensiveItem(monster, choice, { state: game, rollDice: () => 16,
        random: limit => limit - 1, publish: message => { messages.push(message); } });
    assert.equal(monster.mcansee, 1);
    assert.equal(monster.mblinded, 0);
    assert.equal(monster.mhp, 42);
    assert.equal(monster.minvent?.includes(potion), false);
    assert.ok(messages.includes('The orc can see again.'));
});
void test('a confused ki-rin uses its own horn without a carried tool', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('ki-rin', 10, 10, NO_MINVENT);
    monster.mconf = 1;
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    const choice = findMonsterDefensiveItem(monster, game);
    assert.ok(choice);
    await useMonsterDefensiveItem(monster, choice, { state: game, publish: () => { } });
    assert.equal(monster.mconf, 0);
    assert.equal(monster.mstun, 0);
    assert.equal(monster.minvent?.length ?? 0, 0);
});
void test('a monster takes an item out of its carried bag and forgets its contents', async () => {
    freshObjectRoom({ heroX: 12, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 11, 10, MM_ANGRY | NO_MINVENT);
    const bag = await addObjectToMonsterInventory(monster, await knownObject(SACK, { cknown: true }), game);
    assert.ok(bag);
    const item = await knownObject(DAGGER);
    await addObjectToContainer(bag, item, game);
    const messages = [];
    const removed = await lootMonsterContainer(monster, bag, { state: game,
        random: limit => limit - 1, publish: message => { messages.push(message); } });
    assert.equal(removed, true);
    assert.equal(item.where, 'minvent');
    assert.equal(item.ocarry, monster);
    assert.equal(bag.contents?.length, 0);
    assert.equal(bag.cknown, false);
    assert.match(messages[0] ?? '', /^The orc removes .* from .* sack\.$/);
});
void test('a cursed bag of holding keeps its contents when a monster tries to loot it', async () => {
    freshObjectRoom({ heroX: 12, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 11, 10, MM_ANGRY | NO_MINVENT);
    const bag = await addObjectToMonsterInventory(monster, await knownObject(BAG_OF_HOLDING, { cursed: true }), game);
    assert.ok(bag);
    const item = await knownObject(DAGGER);
    await addObjectToContainer(bag, item, game);
    const removed = await lootMonsterContainer(monster, bag, { state: game, publish: () => { } });
    assert.equal(removed, false);
    assert.equal(item.where, 'contained');
    assert.equal(item.container, bag);
});
void test('a level teleport trap sends a monster into the legal dungeon range', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 30 })];
    game.u.uz = { dnum: 0, dlevel: 25 };
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    installPagerInput(resetInputState(), { expected: /disappears/, limit: 2 });
    const result = await teleportMonsterToRandomLevel(monster, trap, {
        state: game, random: limit => limit === 5 ? 2 : 10,
    });
    assert.deepEqual(result?.destination, { dnum: 0, dlevel: 11 });
    assert.equal(level.monsters.includes(monster), false);
    assert.equal(monster.mconf, 1);
    assert.equal(trap.tseen, true);
});
void test('the caster remains injured while its healing message waits for acknowledgement', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('kobold shaman', 10, 10, NO_MINVENT);
    monster.mpeaceful = 1;
    monster.m_lev = 4;
    monster.mhp = 5;
    monster.mhpmax = 30;
    const random = (limit) => limit === 4 ? 1 : limit - 1;
    const turn = await takeMonsterTurn(monster, game, random);
    assert.ok(turn.movement);
    const input = resetInputState();
    await pline('The corridor stretches away into the cold and silent darkness.');
    const healing = resumeDeferredMovementSpell({ monster, ...turn, movement: turn.movement }, game, random, undefined, () => 12);
    await input.waitUntilBlocked();
    try {
        assert.equal(monster.mhp, 5);
    }
    finally {
        installPagerInput(input, { expected: /looks better/, limit: 3 });
        input.feed(' ');
        await healing;
    }
    assert.equal(monster.mhp, 17);
});
void test('a confused caster loses its spell attempt but can still move', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('kobold shaman', 10, 10, NO_MINVENT);
    monster.mpeaceful = 1;
    monster.m_lev = 4;
    monster.mconf = 1;
    monster.permspeed = 0;
    const random = (limit) => limit === 4 ? 2 : limit - 1;
    installPagerInput(resetInputState(), { expected: /air crackles/, limit: 2 });
    await takeMonsterTurn(monster, game, random);
    assert.equal(monster.mspec_used, 6);
    assert.equal(monster.permspeed, 0);
    assert.ok(monster.mx !== 10 || monster.my !== 10);
});
//# sourceMappingURL=monster_turn_items.test.js.map