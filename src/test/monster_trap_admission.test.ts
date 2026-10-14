import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRE_TRAP, PIT, SPIKED_PIT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { openFallingTrap } from '../js/trap_magic.js';
import { vision_recalc } from '../js/vision.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { requireScreenCell } from './support/screen.js';

void test('a peaceful monster blames the hero for an unknown hero-made fire trap', async () => {
    const { monster } = await freshMonsterTrapRoom(FIRE_TRAP, {
        monster: { species: 'gnome', mpeaceful: 1, hitPoints: 40 },
        trap: { madeby_u: true },
    });
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(2n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await finishImmediateMonsterTrap(action, game);

    assert.equal(monster.mpeaceful, 0);
    assert.ok(monster.mhp < 40);
});

void test('Sokoban drags a flyer into a familiar pit', async () => {
    const { monster, level } = await freshMonsterTrapRoom(PIT, {
        monster: { species: 'red dragon', mtrapseen: 1 << (PIT - 1), hitPoints: 80 },
    });
    requirePlayingGame(game);
    level.flags.sokoban_rules = true;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(3n);

    const action = await triggerImmediateMonsterTrap(monster, game);
    await finishImmediateMonsterTrap(action, game);

    assert.equal(monster.mtrapped, 1);
    assert.ok(monster.mhp < 80);
    assert.match(game._last_message || '', /is dragged into a pit!/);
});

void test('magically opening a pit under a flyer reveals it without pulling the flyer down', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(PIT, {
        monster: { species: 'red dragon', hitPoints: 80 },
    });
    requirePlayingGame(game);

    const action = await triggerImmediateMonsterTrap(monster, game, { force: true });
    await finishImmediateMonsterTrap(action, game);

    assert.equal(monster.mtrapped ?? 0, 0);
    assert.equal(monster.mhp, 80);
    assert.equal(trap.tseen, true);
    assert.match(game._last_message || '', /doesn't fall into the pit\./);
});

for (const type of [PIT, SPIKED_PIT]) {
    void test(`a magically opened ${type === PIT ? 'pit' : 'spiked pit'} stays remembered after its flyer leaves unseen`, async () => {
        const { monster } = await freshMonsterTrapRoom(type, {
            monster: { species: 'red dragon', hitPoints: 80 },
        });
        requirePlayingGame(game);
        newsym(11, 10);

        await openFallingTrap(monster);
        setHeroBlindnessTurns(10);
        vision_recalc(0);
        placeMonsterAt(monster, 12, 10);
        newsym(11, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(10, 11).ch, '^',
            'the newly revealed pit must replace remembered floor beneath the flyer');
    });
}
