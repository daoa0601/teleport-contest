import test from 'node:test';
import assert from 'node:assert/strict';
import { LAVAPOOL, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const helpKey of ['?', '!']) {
    void test(`#wiztelekinesis shows the verbose targeting hint for help key ${helpKey}`, async () => {
        freshObjectRoom({ flags: { debug: true, tips: false, verbose: true } });
        game.commandBindings.bindSpecialKey(helpKey.charCodeAt(0), 'getpos.help');
        const prompts = [];
        resetInputState().beforeRead = () => { prompts.push(game._pending_message); };
        await runExtendedCommand('wiztelekinesis', '\x1b');
        const prompt = prompts.at(-1);
        assert.ok(prompt, 'The command must reach position input before cancellation');
        assert.ok(prompt.includes(`(For instructions type a '${helpKey}')`), `The initial targeting prompt must advertise ${helpKey}: ${prompt}`);
        assert.ok(prompt.startsWith('Pick a monster to hurtle.')
            && prompt.indexOf('Pick a monster to hurtle.') < prompt.indexOf('(For instructions'), 'The targeting hint must follow the telekinesis instruction');
        assert.equal(game.context.move, 0);
    });
}
void test('#wiztelekinesis hurtles a selected monster six squares without taking time', async () => {
    freshObjectRoom({ right: 25, flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('lichen', 11, 10);
    await runExtendedCommand('wiztelekinesis', 'l.l\x1b');
    assert.equal(monster.mx, 17);
    assert.equal(monster.my, 10);
    assert.equal(monster.mstun, 1);
    assert.equal(monster.movement, 0);
    assert.equal(game.context.move, 0);
});
void test('#wiztelekinesis can hurtle the hero without leaving a recovery delay after cancellation', async () => {
    freshObjectRoom({ right: 25, flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    await runExtendedCommand('wiztelekinesis', '.l\x1b');
    assert.equal(game.u.ux, 16);
    assert.equal(game.u.uy, 10);
    assert.equal(game.multi, 0);
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.equal(game.context.move, 0);
});
for (const [terrain, death] of [[POOL, 'drowning'], [LAVAPOOL, 'burning']]) {
    void test(`#wiztelekinesis credits the hero for a goblin's ${death}`, async () => {
        const level = freshObjectRoom({ right: 25, flags: { debug: true, tips: false, verbose: false } });
        requirePlayingGame(game);
        level.requireAt(17, 10).typ = terrain;
        const goblin = await createMonsterAt('goblin', 11, 10);
        const experience = game.u.uexp;
        await runExtendedCommand('wiztelekinesis', 'l.l\x1b');
        assert.equal(goblin.dead, true);
        assert.equal(game.u.uconduct.killer, 1, 'A telekinesis liquid kill breaks pacifist conduct');
        assert.ok(game.u.uexp > experience, 'The hero earns experience for the liquid kill');
        assert.equal(game.context.move, 0);
    });
}
void test('#wiztelekinesis gives no kill credit for a fire-resistant monster surrendering to lava', async () => {
    const level = freshObjectRoom({ right: 25, flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    level.requireAt(17, 10).typ = LAVAPOOL;
    const ant = await createMonsterAt('fire ant', 11, 10);
    ant.mhp = 1;
    const experience = game.u.uexp;
    await runExtendedCommand('wiztelekinesis', 'l.l\x1b');
    assert.equal(ant.dead, true);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.equal(game.u.uexp, experience);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizard_telekinesis.test.js.map