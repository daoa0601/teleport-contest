import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVEL_TELEP, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MM_ANGRY, NO_MINVENT, PIT, STAIRS } from '../js/const.js';
import { canSeeMonster, canSpotMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { resumeDeferredMovementSpell, takeMonsterTurn, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { findMonsterDefensiveItem, useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { lootMonsterContainer } from '../js/monster_container_loot.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { prepareMonsterItemUse } from '../js/monster_item_use.js';
import { addObjectToContainer } from '../js/object_container.js';
import { AMULET_OF_YENDOR, BUGLE, DAGGER, LEASH, POT_HEALING, SACK, WAN_DIGGING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
for (const condition of ['sleeping', 'paralyzed']) {
    void test(`a bugler stops selecting reveille for a killed ${condition} soldier`, async () => {
        freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const bugler = await createMonsterAt('soldier', 10, 10, MM_ANGRY | NO_MINVENT);
        bugler.mhp = 1;
        bugler.mhpmax = 40;
        bugler.mux = game.u.ux;
        bugler.muy = game.u.uy;
        await addObjectToMonsterInventory(bugler, await knownObject(BUGLE), game);
        const soldier = await createMonsterAt('soldier', 12, 10, MM_ANGRY | NO_MINVENT);
        soldier.msleeping = condition === 'sleeping' ? 1 : 0;
        soldier.mcanmove = condition === 'paralyzed' ? 0 : 1;
        assert.equal(findMonsterDefensiveItem(bugler, game)?.kind, 'bugle');
        await finishEnvironmentalMonsterDeath(soldier, game, { noCorpse: true });
        assert.equal(findMonsterDefensiveItem(bugler, game)?.kind, undefined, 'A dead soldier must not make the bugler waste its action');
    });
}
for (const branch of [true, false]) {
    void test(`an Amulet carrier escapes ${branch ? 'branch' : 'ordinary'} stairs to their destination`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        game.dungeons = [
            createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 }),
            createDungeon({ dname: 'Gehennom', num_dunlevs: 20, depth_start: 27, flags: { hellish: true } }),
        ];
        game.u.uz = { dnum: 1, dlevel: branch ? 1 : 2 };
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        monster.mhp = 1;
        monster.mhpmax = 40;
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        await addObjectToMonsterInventory(monster, await knownObject(AMULET_OF_YENDOR), game);
        level.requireAt(10, 10).typ = STAIRS;
        const destination = branch ? { dnum: 0, dlevel: 26 } : { dnum: 1, dlevel: 1 };
        game.stairs = { sx: 10, sy: 10, up: true, isladder: false,
            tolev: destination, u_traversed: false, next: null };
        const choice = findMonsterDefensiveItem(monster, game);
        assert.equal(choice?.kind, 'stairs');
        assert.ok(choice);
        const messages = [];
        await useMonsterDefensiveItem(monster, choice, { state: game,
            random: () => branch ? 0 : 1, publish: message => { messages.push(message); } });
        assert.deepEqual(monster.migrationDestination, destination);
        assert.equal(monster.migrationArrival, branch ? MIGR_SSTAIRS : MIGR_STAIRS_DOWN);
        assert.ok(messages.includes('The orc escapes upstairs!'), messages.join('\n'));
        assert.equal(level.monsters.includes(monster), false);
    });
}
for (const visible of [true, false]) {
    void test(`a monster's new pit is ${visible ? 'revealed in sight' : 'unknown out of sight'}`, async () => {
        const level = freshObjectRoom({ right: 25, heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        level.flags.hardfloor = true;
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        monster.mhp = monster.mhpmax = 100;
        const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_DIGGING, { spe: 3 }), game);
        assert.ok(wand);
        if (!visible) {
            await makeBlinded(10, { state: game, talk: false });
            vision_recalc(0);
        }
        const messages = [];
        await useMonsterDefensiveItem(monster, { kind: 'digging', object: wand }, {
            state: game, publish: message => { messages.push(message); }, rollOne: () => 1,
        });
        const pit = level.traps.find(trap => trap.tx === 10 && trap.ty === 10);
        assert.ok(pit);
        assert.equal(pit.ttyp, PIT);
        assert.equal(pit.tseen, visible);
        assert.equal(!!monster.mtrapped, true);
        assert.equal(messages.some(message => message.includes('has made a pit')), visible);
    });
}
for (const force of [true, false]) {
    void test(`a cursed leash ${force ? 'releases for forced' : 'blocks ordinary'} level teleport`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
        game.u.uz = { dnum: 0, dlevel: 25 };
        const pet = await createMonsterAt('little dog', 10, 10, NO_MINVENT);
        pet.mleashed = 1;
        const leash = await addInventoryObject(LEASH, { cursed: true, leashmon: pet.m_id });
        addTrap(level, LEVEL_TELEP, 10, 10);
        installPagerInput(resetInputState(), { expected: /leash|disappears/, limit: 4 });
        await triggerImmediateMonsterTrap(pet, game, { force, random: limit => limit === 5 ? 2 : 10 });
        assert.equal(level.monsters.includes(pet), !force);
        assert.equal(!!pet.mleashed, !force);
        assert.equal(leash.leashmon, force ? 0 : pet.m_id);
        if (force)
            assert.deepEqual(pet.migrationDestination, { dnum: 0, dlevel: 11 });
    });
}
for (const [distance, alreadyKnown] of [[1, false], [10, false], [10, true]]) {
    void test(`rummaging ${distance === 1 ? 'nearby' : 'at a distance'} preserves ${alreadyKnown ? 'known' : 'unknown'} bag appearance correctly`, async () => {
        freshObjectRoom({ right: 30, heroX: 10, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 10 + distance, 10, NO_MINVENT);
        const bag = await addObjectToMonsterInventory(monster, await knownObject(SACK, {
            typeKnown: false, dknown: alreadyKnown, cknown: true,
        }), game);
        assert.ok(bag);
        const item = await knownObject(DAGGER);
        await addObjectToContainer(bag, item, game);
        const messages = [];
        const removed = await lootMonsterContainer(monster, bag, { state: game,
            random: limit => limit - 1, publish: message => { messages.push(message); } });
        assert.equal(removed, true);
        assert.equal(item.ocarry, monster);
        assert.equal(bag.cknown, false);
        assert.equal(bag.dknown, distance === 1 || alreadyKnown);
        assert.match(messages[0] ?? '', distance === 1 ? /removes/ : /rummages/);
    });
}
void test('hallucination changes the perceived bottle occupant while the actual ghost frightens the drinker', async () => {
    const descriptions = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        freshObjectRoom({ heroX: 14, heroY: 10, hero: { hallucinationTurns: 20 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 10, 10, NO_MINVENT);
        const potion = await addObjectToMonsterInventory(monster, await knownObject(POT_HEALING), game);
        assert.ok(potion);
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[POT_HEALING] = 'milky';
        initRng(BigInt(seed));
        const messages = [];
        const result = await prepareMonsterItemUse(monster, potion, {
            state: game, random: () => 0, publish: message => { messages.push(message); },
        });
        assert.equal(result?.nativeResult, 2);
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 3);
        assert.ok(game.level.monsters.some(candidate => candidate.mnum === 287));
        assert.equal(potion.where, 'gone');
        const description = messages.find(message => message.includes('an enormous'));
        assert.ok(description, messages.join('\n'));
        descriptions.add(description.split('an enormous ')[1] ?? '');
    }
    assert.ok(descriptions.size > 1, 'Hallucinating heroes should perceive different occupant species across games');
});
for (const condition of ['blind deaf', 'blind telepath deaf', 'invisible caster deaf', 'invisible caster hearing']) {
    void test(`insect summoning feedback respects a hero who is ${condition}`, async () => {
        freshObjectRoom({ right: 25, heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('aligned cleric', 10, 10, MM_ANGRY | NO_MINVENT);
        monster.m_lev = 10;
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        if (condition.startsWith('blind')) {
            await makeBlinded(10, { state: game, talk: false });
            vision_recalc(0);
        }
        else
            monster.minvis = true;
        game.u.telepathy = condition === 'blind telepath deaf';
        game.u.deafTurns = condition.endsWith('deaf') ? 10 : 0;
        installPagerInput(resetInputState(), { expected: /cleric|summon|casts|misses/, limit: 8 });
        const random = (limit) => limit === 10 ? 8 : limit - 1;
        const turn = await takeMonsterTurn(monster, game, random);
        assert.ok(turn.movement);
        assert.equal(turn.movement.spellCast?.spell, 'insects');
        assert.equal(canSeeMonster(monster), false);
        const messages = [];
        const effect = await resumeDeferredMovementSpell({ monster, ...turn, movement: turn.movement }, game, random, undefined, undefined, message => { messages.push(message); });
        assert.ok(effect?.created.length);
        if (condition === 'blind deaf')
            assert.equal(messages.length, 0);
        else if (condition === 'blind telepath deaf')
            assert.match(messages[0] ?? '', /^The .+ summons insects!$/);
        else {
            assert.ok(effect.created.some(canSpotMonster));
            assert.equal(messages[0], condition.endsWith('deaf') ? 'Insects appear.'
                : 'You hear someone summoning something, and insects appear.');
        }
    });
}
//# sourceMappingURL=monster_item_review.test.js.map