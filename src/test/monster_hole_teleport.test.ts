import assert from 'node:assert/strict';
import test from 'node:test';
import { HOLE, TRAPDOOR } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { LEASH } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

for (const [cursed, force, falls] of [[false, false, true], [true, false, false], [true, true, true]] as const) {
    void test(`a ${cursed ? 'cursed' : 'loose'} leash ${falls ? 'releases' : 'holds'} a pet at a ${force ? 'forced' : 'normal'} hole`, async () => {
        const { source } = freshConnectedLevels();
        requirePlayingGame(game);
        const dog = await createMonsterAt('little dog', 11, 10);
        initializePet(dog);
        const leash = await addInventoryObject(LEASH, { leashmon: dog.m_id, cursed });
        dog.mleashed = 1;
        const tameness = dog.mtame;
        addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
        pushKeys(' '.repeat(20));

        await triggerImmediateMonsterTrap(dog, game, { force, random: () => 0 });

        assert.equal(source.monsters.includes(dog), !falls);
        assert.equal(leash.leashmon, falls ? 0 : dog.m_id);
        assert.equal(!!dog.mleashed, !falls);
        assert.equal(dog.mtame, tameness, 'releasing the leash before migration preserves tameness');
    });
}

void test('a hole cannot carry away a monster that is holding the hero', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    const owlbear = await createMonsterAt('owlbear', 11, 10);
    game.u.ustuck = owlbear;
    addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 2 } });

    await triggerImmediateMonsterTrap(owlbear, game, { random: () => 0 });

    assert.ok(source.monsters.includes(owlbear));
    assert.equal(game.u.ustuck, owlbear);
});

void test('a Castle trapdoor sends a monster to the Valley instead of its ordinary hole destination', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.stronghold_level = createSpecialLevel({ ...game.u.uz });
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.dungeons.push(createDungeon({ dname: 'Gehennom', num_dunlevs: 3, depth_start: 3 }));
    const orc = await createMonsterAt('hill orc', 11, 10);
    addTrap(source, TRAPDOOR, 11, 10, { dst: { dnum: 0, dlevel: 2 } });

    await triggerImmediateMonsterTrap(orc, game, { random: () => 0 });

    assert.deepEqual(orc.migrationDestination, { dnum: 1, dlevel: 1 });
});

void test('a monster falling in Gehennom cannot pass the invocation level before the ritual', async () => {
    const { source } = freshConnectedLevels({ destinationDepth: 3 });
    requirePlayingGame(game);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.flags.hellish = true;
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    const orc = await createMonsterAt('hill orc', 11, 10);
    addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 3 } });

    await triggerImmediateMonsterTrap(orc, game, { random: () => 0 });

    assert.deepEqual(orc.migrationDestination, { dnum: 0, dlevel: 2 });
});

void test('Sokoban pulls even a giant through a pre-existing hole', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.sokoban_dnum = 0;
    source.flags.sokoban_rules = true;
    const giant = await createMonsterAt('stone giant', 11, 10);
    addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
    pushKeys(' '.repeat(20));

    await triggerImmediateMonsterTrap(giant, game, { random: () => 0 });

    assert.equal(source.monsters.includes(giant), false);
    assert.deepEqual(giant.migrationDestination, { dnum: 0, dlevel: 2 });
});

for (const species of ['bat', 'floating eye', 'rock piercer']) {
    void test(`forcing a hole under a ${species} reveals it without making the monster fall`, async () => {
        const { source } = freshConnectedLevels();
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10);
        const trap = addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
        const messages: string[] = [];

        await triggerImmediateMonsterTrap(monster, game, {
            force: true, publish: async message => { messages.push(message); },
        });

        assert.ok(source.monsters.includes(monster));
        assert.equal(trap.tseen, true);
        assert.ok(messages.some(message => message.includes("doesn't fall through the hole.")));
    });
}
