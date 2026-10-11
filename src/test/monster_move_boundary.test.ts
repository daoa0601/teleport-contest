import test from 'node:test';
import assert from 'node:assert/strict';
import { moveMonsterForHeroAttack } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import {
    D_CLOSED, D_ISOPEN, DOOR, DUST, MMOVE_DIED, MMOVE_DONE, MMOVE_MOVED,
    MMOVE_NOTHING, NO_MINVENT, PIT, SQKY_BOARD,
} from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function corridor(species = 'leprechaun') {
    const level = freshObjectRoom({
        left: 10, right: 14, top: 10, bottom: 10,
        flags: { verbose: true },
    });
    const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
    monster.msleeping = 0;
    monster.mcanmove = 1;
    monster.mpeaceful = 0;
    monster.mflee = 1;
    monster.mfleetim = 20;
    monster.mhp = monster.mhpmax = 100;
    const input = resetInputState();
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(screen, /--More--/, `Unexpected movement input:\n${screen}`);
        input.feed(' ');
    };
    return { level, monster, input };
}

async function topline() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('a direct monster move preserves its movement ration and the engraving it leaves', async () => {
    const { monster: leprechaun, level } = await corridor();
    leprechaun.movement = 7;
    makeEngravingAt(11, 10, 'a map of the passage', null, 0, DUST);
    const result = await moveMonsterForHeroAttack(leprechaun);

    assert.equal(result.status, MMOVE_MOVED);
    assert.equal(result.heroDied, false);
    assert.equal(leprechaun.mx, 12);
    assert.equal(leprechaun.movement, 7);
    assert.equal(engravingAt(11, 10, level)?.text, 'a map of the passage');
});

void test('a monster still eating spends its direct move on its meal', async () => {
    const { monster: leprechaun } = await corridor();
    leprechaun.meating = 3;
    const result = await moveMonsterForHeroAttack(leprechaun);

    assert.equal(result.status, MMOVE_DONE);
    assert.equal(leprechaun.meating, 2);
    assert.equal(leprechaun.mx, 11);
});

void test('a direct move toward the adjacent hero does not append a monster attack', async () => {
    const { monster: leprechaun } = await corridor();
    leprechaun.mflee = 0;
    leprechaun.mfleetim = 0;
    const health = game.u.uhp;
    const result = await moveMonsterForHeroAttack(leprechaun);

    assert.equal(result.status, MMOVE_NOTHING);
    assert.equal(leprechaun.mx, 11);
    assert.equal(game.u.uhp, health);
    assert.equal(await topline(), '');
});

void test('a direct move finishes visible gold pickup before returning', async () => {
    const { monster: leprechaun, level } = await corridor();
    const coins = await floorObject(GOLD_PIECE, 12, 10, { quan: 30 });
    const result = await moveMonsterForHeroAttack(leprechaun);

    assert.equal(result.status, MMOVE_DONE);
    assert.equal(leprechaun.mx, 12);
    assert.ok(leprechaun.minvent?.includes(coins));
    assert.ok(!floorObjectsAt(level, 12, 10).includes(coins));
    assert.match(await topline(), /leprechaun picks up 30 gold pieces/);
});

void test('a goblin opens its destination door before a direct move completes', async () => {
    const { monster: goblin, level } = await corridor('goblin');
    const door = level.at(12, 10);
    assert.ok(door);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    vision_recalc(0);
    const result = await moveMonsterForHeroAttack(goblin);

    assert.equal(result.status, MMOVE_MOVED);
    assert.equal(goblin.mx, 12);
    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(await topline(), 'The goblin opens a door.');
});

void test('a leprechaun is too small to open a door while dodging', async () => {
    const { monster: leprechaun, level } = await corridor();
    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    vision_recalc(0);
    const result = await moveMonsterForHeroAttack(leprechaun);

    assert.equal(result.status, MMOVE_NOTHING);
    assert.equal(leprechaun.mx, 11);
    assert.equal(door.doormask, D_CLOSED);
});

void test('a trap encountered during a direct move resumes after the previous message is acknowledged', async () => {
    const { monster: leprechaun, level, input } = await corridor();
    const trap = addTrap(level, SQKY_BOARD, 12, 10, { tnote: 0 });
    const sleeper = await createMonsterAt('jackal', 14, 10, NO_MINVENT);
    sleeper.msleeping = 1;
    let acknowledged = false;
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(screen, /--More--/, `Unexpected trap input:\n${screen}`);
        assert.equal(leprechaun.mx, 12);
        assert.equal(sleeper.msleeping, 1, 'the board wakes nearby monsters after its message');
        acknowledged = true;
        input.feed(' ');
    };
    await plineWithContinuation('The corridor stretches beyond the flickering torchlight at the far doorway.');
    const result = await moveMonsterForHeroAttack(leprechaun);

    assert.equal(acknowledged, true);
    assert.equal(result.status, MMOVE_MOVED);
    assert.equal(trap.tseen, true);
    assert.equal(sleeper.msleeping, 0);
    assert.match(await topline(), /board beneath the leprechaun squeaks a C note/);
});

void test('a fatal movement trap completes death before returning the native result', async () => {
    const { monster: leprechaun, level } = await corridor();
    leprechaun.mhp = 1;
    addTrap(level, PIT, 12, 10);
    const result = await moveMonsterForHeroAttack(leprechaun);

    assert.equal(result.status, MMOVE_DIED);
    assert.equal(result.heroDied, false);
    assert.ok(leprechaun.mhp <= 0);
    assert.ok(!level.monsters.includes(leprechaun));
});

void test('an ordinary movement command follows a leprechaun into its vacated square after a dodge', async () => {
    let dodged = false;
    for (let seed = 0; seed < 64 && !dodged; seed++) {
        const { monster: leprechaun } = await corridor();
        requirePlayingGame(game);
        game.u.uhitinc = -100;
        const health = game.u.uhp;
        initRng(BigInt(seed));
        await rhack('l'.charCodeAt(0));
        if (game.u.ux === 10) continue;

        assert.equal(game.u.ux, 11, `Hero position after the dodge at seed ${seed}`);
        assert.equal(leprechaun.mx, 12);
        assert.equal(leprechaun.mhp, 100);
        assert.equal(game.u.uhp, health);
        assert.match(await topline(), /miss wildly and stumble forwards/);
        dodged = true;
    }
    assert.ok(dodged, 'No leprechaun dodge occurred across 64 fresh attack seeds');
});
