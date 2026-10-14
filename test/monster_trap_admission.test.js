import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRE_TRAP, PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
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
//# sourceMappingURL=monster_trap_admission.test.js.map