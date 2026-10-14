import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, STRAT_WAITFORU, W_ARMH } from '../js/const.js';
import { docrt, map_invisible } from '../js/display.js';
import { game } from '../js/gstate.js';
import { HELMET } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

async function wornHelmet({ cursed = false, bknown = true } = {}) {
    freshPlayableRoom();
    const helmet = await addInventoryObject(HELMET, {
        invlet: 'a', worn: true, owornmask: W_ARMH, cursed, bknown,
    });
    game.uarmh = game.u.uarmh = helmet;
    return helmet;
}

for (const known of [false, true]) {
    void test(`tipping a ${known ? 'known' : 'newly discovered'} cursed helmet spends only the discovery turn`, async () => {
        const helmet = await wornHelmet({ cursed: true, bknown: known });

        await runExtendedCommand('tip', 'a');

        assert.equal(helmet.bknown, true);
        assert.equal(game.context.move, known ? 0 : 1);
        assert.equal(game._pending_message, "You can't.  It is cursed.");
        assert.equal(game.uarmh, helmet);
    });

    void test(`cancelling a helmet direction ${known ? 'does not spend' : 'spends'} a turn when its curse status is ${known ? 'known' : 'unknown'}`, async () => {
        const helmet = await wornHelmet({ bknown: known });

        await runExtendedCommand('tip', 'a\x1b');

        assert.equal(game.context.move, known ? 0 : 1);
        assert.equal(game.uarmh, helmet);
        assert.doesNotMatch(game._lastPlineMessage, /Nothing happens|briefly doff/);
    });
}

void test('tipping a helmet at oneself briefly doffs it and spends a turn', async () => {
    const helmet = await wornHelmet();

    await runExtendedCommand('tip', 'a.    ');

    assert.match(game._lastPlineMessage, /The lout here doesn't acknowledge you/);
    assert.equal(game.uarmh, helmet);
    assert.equal(helmet.owornmask, W_ARMH);
    assert.equal(game.context.move, 1);
});

void test('a peaceful humanoid answers a helmet tip with a wave and stops waiting', async () => {
    await wornHelmet();
    const dwarf = await createMonsterAt('dwarf', 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    dwarf.mpeaceful = true;
    dwarf.mstrategy = STRAT_WAITFORU;
    await docrt();

    await runExtendedCommand('tip', 'al    ');

    assert.equal(game._lastPlineMessage, 'The dwarf waves.');
    assert.equal(dwarf.mstrategy, 0);
    assert.equal(game.context.move, 1);
});

void test('a responding humanoid discovers that its own helmet is cursed', async () => {
    await wornHelmet();
    const dwarf = await createMonsterAt('dwarf', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    dwarf.mpeaceful = true;
    const helmet = await knownObject(HELMET, { cursed: true, bknown: false });
    await equipMonsterObject(dwarf, helmet, W_ARMH);
    await docrt();

    await runExtendedCommand('tip', 'al    ');

    assert.match(game._lastPlineMessage, /^The dwarf grasps his helm but can't remove it\.$/);
    assert.equal(helmet.bknown, true);
    assert.equal(game.context.move, 1);
});

void test('a sleeping visible monster cannot acknowledge a helmet tip', async () => {
    await wornHelmet();
    const dwarf = await createMonsterAt('dwarf', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    dwarf.msleeping = 1;
    dwarf.mstrategy = STRAT_WAITFORU;
    await docrt();

    await runExtendedCommand('tip', 'al    ');

    assert.equal(game._lastPlineMessage, 'The dwarf seems not to notice you.');
    assert.equal(dwarf.mstrategy, STRAT_WAITFORU);
    assert.equal(game.context.move, 1);
});

void test('a peaceful humanoid tips its own removable helmet in response', async () => {
    await wornHelmet();
    const dwarf = await createMonsterAt('dwarf', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    dwarf.mpeaceful = true;
    await equipMonsterObject(dwarf, await knownObject(HELMET, { cursed: false }), W_ARMH);
    await docrt();

    await runExtendedCommand('tip', 'al    ');

    assert.equal(game._lastPlineMessage, 'The dwarf tips his helm in response.');
    assert.equal(game.context.move, 1);
});

void test('a hostile humanoid answers a helmet tip with an insult or rude gesture', async () => {
    await wornHelmet();
    const dwarf = await createMonsterAt('dwarf', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    dwarf.mpeaceful = false;
    await docrt();

    await runExtendedCommand('tip', 'al    ');

    assert.match(game._lastPlineMessage,
        /^The dwarf (?:curses|gestures rudely|gestures offensively)(?: and gestures (?:rudely|offensively))? at you\.\.\.$/);
    assert.equal(game.context.move, 1);
});

void test('an unseen creature marker blocks a helmet tip to monsters farther away', async () => {
    await wornHelmet();
    const dwarf = await createMonsterAt('dwarf', 12, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    dwarf.mpeaceful = true;
    dwarf.mstrategy = STRAT_WAITFORU;
    await docrt();
    map_invisible(11, 10);

    await runExtendedCommand('tip', 'al    ');

    assert.equal(game._lastPlineMessage, 'That unseen creature is ignoring you!');
    assert.equal(dwarf.mstrategy, STRAT_WAITFORU);
});

void test('tipping a helmet upward spends a turn even without a recipient', async () => {
    await wornHelmet();

    await runExtendedCommand('tip', 'a<    ');

    assert.equal(game._lastPlineMessage, "There's no one up there.");
    assert.equal(game.context.move, 1);
});
