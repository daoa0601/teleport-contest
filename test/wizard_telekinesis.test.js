import test from 'node:test';
import assert from 'node:assert/strict';
import { LANDMINE, LAVAPOOL, NO_MINVENT, PIT, POOL } from '../js/const.js';
import { setMonsterMalign } from '../js/monster_alignment.js';
import { initializePet } from '../js/dog.js';
import { STATUE } from '../js/object_data.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { addTrap } from './support/level-state.js';
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
for (const hurtleCockatrice of [false, true]) {
    void test(`#wiztelekinesis credits petrification of ${hurtleCockatrice ? 'the collision target' : 'the hurtled monster'}`, async () => {
        const level = freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', hurtleCockatrice ? 12 : 11, 10, NO_MINVENT);
        await createMonsterAt('cockatrice', hurtleCockatrice ? 11 : 12, 10, NO_MINVENT);
        initializePet(goblin, { state: game });
        setMonsterMalign(goblin, game);
        const experience = game.u.uexp;
        const alignment = game.u.ualign.record;
        const input = resetInputState();
        let reads = 0;
        input.display = {
            async readKey() {
                assert.ok(++reads <= 6, 'Telekinesis must finish collision messages and return to targeting');
                const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                if (screen.includes('--More--'))
                    return 32;
                return 27;
            },
        };
        await runExtendedCommand('wiztelekinesis', 'l.l');
        assert.equal(goblin.dead, true);
        assert.equal(game.u.uconduct.killer, 1, 'The petrification counts as one hero kill');
        assert.ok(game.u.uexp > experience, 'The hero earns experience for the petrification');
        assert.ok(game.u.ualign.record < alignment, 'Killing a pet penalizes alignment');
        assert.equal(level.objects[goblin.mx]?.[goblin.my]?.some(object => object.otyp === STATUE && object.corpsenm === goblin.mnum), true, 'Petrification leaves the victim in a statue');
        assert.equal(game.context.move, 0);
    });
}
for (const trapType of [PIT, LANDMINE]) {
    void test(`#wiztelekinesis gives no hero kill credit when the hurtled monster dies in a ${trapType === PIT ? 'pit' : 'land mine'}`, async () => {
        const level = freshObjectRoom({ right: 25, flags: { debug: true, tips: false, verbose: false } });
        requirePlayingGame(game);
        addTrap(level, trapType, 17, 10);
        const victim = await createMonsterAt(trapType === PIT ? 'goblin' : 'ogre', 11, 10, NO_MINVENT);
        victim.mhp = 1;
        const experience = game.u.uexp;
        let reads = 0;
        resetInputState().display = {
            async readKey() {
                assert.ok(++reads <= 6, 'The trap death must return to telekinesis targeting');
                const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                return screen.includes('--More--') ? 32 : 27;
            },
        };
        await runExtendedCommand('wiztelekinesis', 'l.l');
        assert.equal(victim.dead, true);
        assert.equal(game.u.uexp, experience, 'A trap uses monkilled(), even when the hero caused the hurtle');
        assert.equal(game.u.uconduct.killer ?? 0, 0);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=wizard_telekinesis.test.js.map