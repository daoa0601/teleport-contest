import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { LAVAPOOL, NO_MINVENT, PIT } from '../js/const.js';
import { flush_screen, map_invisible } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKillOutcome } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { dodiscovered } from '../js/o_init.js';
import { BOULDER, CORPSE, DWARVISH_CLOAK, IRON_SHOES, LEASH, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { addTrap, floorObjectQuantityAt, floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
for (const restored of [false, true]) {
    void test(`a killed monster's armor is discovered as it drops${restored ? ' after save and restore' : ''}`, async () => {
        freshObjectRoom();
        let monster = await createMonsterAt('goblin', 11, 10);
        await addObjectToMonsterInventory(monster, await mksobj(DWARVISH_CLOAK, false, false));
        await addObjectToMonsterInventory(monster, await mksobj(IRON_SHOES, false, false));
        if (restored) {
            const monsterId = monster.m_id;
            game.plname = 'Armor observer';
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            freshObjectRoom();
            assert.equal(restoreGame('Armor observer', storage), true);
            requirePlayingGame(game);
            const savedMonster = game.level.monsters.find(candidate => candidate.m_id === monsterId);
            assert.ok(savedMonster, 'The goblin must survive the save round trip');
            monster = savedMonster;
        }
        installPagerInput(resetInputState(), {
            expected: /goblin|experience level/, limit: 4,
        });
        await finishHeroMonsterKillOutcome(monster, 11, 10, { noCorpse: true });
        requirePlayingGame(game);
        assert.notEqual(monsterAtPosition(game.level, monster.mx, monster.my), monster);
        const pile = floorObjectsAt(game.level, 11, 10);
        assert.ok(pile.some(object => object.otyp === IRON_SHOES));
        assert.ok(pile.some(object => object.otyp === DWARVISH_CLOAK));
        const input = resetInputState();
        const showing = dodiscovered();
        await input.waitUntilBlocked();
        try {
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /pair of hard shoes/);
            assert.match(text, /hooded cloak/);
            assert.ok(text.indexOf('pair of hard shoes') < text.indexOf('hooded cloak'), `The shoes drop before the cloak and must be discovered first:\n${text}`);
        }
        finally {
            input.feed(' ');
            await showing;
        }
    });
}
for (const ending of ['ordinary', 'no corpse', 'petrification', 'level forbids remains']) {
    void test(`a swallowed hero ${ending === 'ordinary' ? 'lands in' : 'is released without landing in'} a pit after ${ending} death`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const engulfer = await createMonsterAt('trapper', 11, 10, NO_MINVENT);
        const trap = addTrap(level, PIT, 10, 10);
        await installSwallowedHero(engulfer);
        if (ending === 'level forbids remains')
            level.flags.deathdrops = false;
        const hp = game.u.uhp;
        installPagerInput(resetInputState(), {
            expected: /trapper|pit|statue|experience level/, limit: 8,
        });
        const death = await finishHeroMonsterKillOutcome(engulfer, 10, 10, {
            noCorpse: ending === 'no corpse',
            petrified: ending === 'petrification',
        });
        assert.equal(death.killed, true);
        assert.equal(death.heroDied, false);
        assert.equal(game.u.ustuck, null);
        assert.equal(game.u.uswallow, 0);
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        assert.notEqual(monsterAtPosition(level, engulfer.mx, engulfer.my), engulfer);
        assert.equal(!!game.u.utrap, ending === 'ordinary');
        assert.equal(!!trap.tseen, ending === 'ordinary');
        if (ending === 'ordinary')
            assert.ok(game.u.uhp < hp);
        else
            assert.equal(game.u.uhp, hp);
        if (ending === 'petrification')
            assert.equal(floorObjectQuantityAt(level, 10, 10, STATUE), 1);
    });
}
void test('fatal lava splashed by a dead monster inventory stops corpse creation and hero rewards', async () => {
    const level = freshObjectRoom({
        hero: { uhp: 1, uhpmax: 1 },
        flags: { disclose: '-i -a -v -c -o' },
    });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    const giant = await createMonsterAt('fire giant', 11, 10, NO_MINVENT);
    await equipMonsterObject(giant, await knownObject(BOULDER), 0);
    level.requireAt(11, 10).typ = LAVAPOOL;
    const alignment = game.u.ualign.record;
    installPagerInput(resetInputState(), {
        expected: /fire giant|boulder|splash|molten lava|You die|REST|PEACE|points/,
        limit: 12,
    });
    const death = await finishHeroMonsterKillOutcome(giant, 11, 10);
    assert.equal(death.killed, true);
    assert.equal(death.heroDied, true);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game._deathKiller, 'molten lava');
    assert.equal(game.u.uexp, 0);
    assert.equal(game.u.ualign.record, alignment);
    assert.equal(requireMonsterVital(giant.mnum).died, 1);
    assert.equal(floorObjectQuantityAt(level, 11, 10, CORPSE), 0);
});
for (const shifted of [false, true]) {
    void test(`killing ${shifted ? 'a shapechanger in' : ''} a luminous form darkens the room before the next command`, async () => {
        const level = freshObjectRoom({ right: 20 });
        requirePlayingGame(game);
        for (let x = 7; x <= 20; x++) {
            for (let y = 6; y <= 14; y++) {
                level.requireAt(x, y).lit = false;
                level.requireAt(x, y).waslit = false;
            }
        }
        const emitter = await createMonsterAt('fire elemental', 14, 10, NO_MINVENT);
        if (shifted)
            emitter.cham = MONSTER_NAME.indexOf('chameleon');
        vision_reset();
        vision_recalc(0);
        assert.equal(cansee(15, 10), true);
        const input = resetInputState();
        installPagerInput(input, { expected: /fire elemental|chameleon|experience level/, limit: 4 });
        await finishHeroMonsterKillOutcome(emitter, 14, 10, { noCorpse: true });
        game._moveloopStarted = true;
        game.context.move = 0;
        await finishAtCommandInput(input, moveloop_core, /fire elemental/);
        assert.equal(cansee(15, 10), false);
        assert.notEqual(monsterAtPosition(level, emitter.mx, emitter.my), emitter);
        if (shifted)
            assert.equal(emitter.mnum, MONSTER_NAME.indexOf('chameleon'));
    });
}
void test('an invisible monster marker is gone while its death-drop message waits for input', async () => {
    const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    level.flags.hero_memory = true;
    const giant = await createMonsterAt('fire giant', 11, 10, NO_MINVENT);
    giant.minvis = true;
    await equipMonsterObject(giant, await knownObject(BOULDER), 0);
    level.requireAt(11, 10).typ = LAVAPOOL;
    map_invisible(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenRow(11)[10]?.ch, 'I');
    const input = resetInputState();
    initRng(37n);
    const action = finishHeroMonsterKillOutcome(giant, 11, 10, { noCorpse: true });
    await input.waitUntilBlocked();
    try {
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /You kill it!.*--More--/);
        assert.notEqual(requireScreenRow(11)[10]?.ch, 'I');
    }
    finally {
        installPagerInput(input, {
            expected: /kill it|boulder|splash|molten lava|experience level/, limit: 8,
        });
        input.feed(' ');
        await action;
    }
});
void test('killing a leashed pet releases both ends of the leash', async () => {
    freshObjectRoom();
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(pet);
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    installPagerInput(resetInputState(), {
        expected: /little dog|thunder|experience level/, limit: 6,
    });
    await finishHeroMonsterKillOutcome(pet, 11, 10);
    assert.equal(pet.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(leash.where, 'inventory');
});
//# sourceMappingURL=hero_monster_detachment.test.js.map