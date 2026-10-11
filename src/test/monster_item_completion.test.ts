import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOWAIT, NO_MINVENT, POLY_TRAP, TELEP_TRAP } from '../js/const.js';
import { flush_screen, pline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { finishDeferredMonsterMiscItem, takeMonsterTurn } from '../js/monmove.js';
import { POT_FULL_HEALING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { monsterKnowsTrap } from '../js/trap_knowledge.js';
import { knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('the Wizard spends its healing turn without adding an insult', async () => {
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const wizard = await createMonsterAt('Wizard of Yendor', 10, 10, MM_ANGRY | MM_NOWAIT | NO_MINVENT);
        wizard.mhp = 1;
        wizard.mhpmax = 40;
        wizard.movement = 12;
        const potion = await addObjectToMonsterInventory(wizard, await knownObject(POT_FULL_HEALING), game);
        assert.ok(potion);
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        installPagerInput(input, { expected: /drinks|looks completely healed/, limit: 4 });

        await finishAtCommandInput(input, moveloop_core, /looks completely healed/);

        assert.equal(potion.where, 'gone');
        assert.equal(wizard.mhp, wizard.mhpmax);
        assert.equal(wizard.mx, 10);
        assert.equal(wizard.my, 10);
        assert.equal(game.u.uhp, 40);
    }
});

void test('voluntary teleport entry teaches the traveler and sighted witnesses', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10, context: { mon_moving: true } });
    requirePlayingGame(game);
    const traveler = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    const witness = await createMonsterAt('orc', 9, 11, NO_MINVENT);
    const blindWitness = await createMonsterAt('orc', 8, 10, NO_MINVENT);
    blindWitness.mcansee = 0;
    const trap = addTrap(level, TELEP_TRAP, 9, 10);
    trap.teledest = { x: 12, y: 10 };

    await useMonsterDefensiveItem(traveler, { kind: 'trap', trap }, { state: game, publish: () => {} });

    assert.equal(traveler.mx, 12);
    assert.equal(traveler.my, 10);
    assert.equal(monsterKnowsTrap(traveler, trap), true);
    assert.equal(monsterKnowsTrap(witness, trap), true);
    assert.equal(monsterKnowsTrap(blindWitness, trap), false);
});

void test('a monster recognizes the hero as the maker of a voluntarily entered teleport trap', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10, context: { mon_moving: true } });
    requirePlayingGame(game);
    const traveler = await createMonsterAt('orc', 10, 10, NO_MINVENT);
    traveler.mpeaceful = 1;
    const trap = addTrap(level, TELEP_TRAP, 9, 10);
    trap.madeby_u = true;
    trap.teledest = { x: 12, y: 10 };
    initRng(2n);
    installPagerInput(resetInputState(), { expected: /gets angry/, limit: 2 });

    await useMonsterDefensiveItem(traveler, { kind: 'trap', trap }, { state: game, publish: () => {} });

    assert.equal(traveler.mpeaceful, 0);
    assert.equal(game.u.ualign.record, -1);
    assert.equal(traveler.mx, 12);
});

void test('a hallucinated monster keeps the appearance shown during its polymorph announcement', async () => {
    for (let seed = 1; seed <= 8; seed++) {
        const level = freshObjectRoom({ heroX: 14, heroY: 10, hero: { hallucinationTurns: 20 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        const originalSpecies = monster.mnum;
        addTrap(level, POLY_TRAP, 9, 10);
        const turn = await takeMonsterTurn(monster, game, limit => limit - 1);
        assert.ok(turn.movement?.usedMisc?.kind === 'polymorph-trap');
        let announcedGlyph: string | undefined;
        const input = resetInputState();
        input.beforeRead = () => {
            if (monster.mnum !== originalSpecies)
                announcedGlyph = requireGameDisplay(game).grid[monster.my + 1]?.[monster.mx - 1]?.ch;
        };
        installPagerInput(input, { expected: /earlier message|deliberately|turns into/, limit: 8 });
        await pline('An earlier message fills the line before the monster enters its polymorph trap.');
        initRng(BigInt(seed));

        await finishDeferredMonsterMiscItem({ monster, ...turn, movement: turn.movement }, game);
        await flush_screen(0);

        assert.notEqual(monster.mnum, originalSpecies);
        assert.ok(announcedGlyph, 'The transformation announcement must pause with its new glyph visible');
        assert.equal(requireGameDisplay(game).grid[monster.my + 1]?.[monster.mx - 1]?.ch, announcedGlyph,
            'Finishing the transformation must not replace the appearance already shown to the hero');
    }
});
