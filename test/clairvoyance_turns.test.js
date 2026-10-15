import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { CORR, SCORR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AMULET_OF_YENDOR } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const source of ['intrinsic', 'timeout', 'amulet']) {
    void test(`${source} clairvoyance maps nearby passages after a search turn, even while blind`, async () => {
        const input = freshTurnRoom({ hero: { blindTurns: 100 }, flags: { safe_wait: false } });
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;
        const passage = game.level.requireAt(18, 10);
        passage.typ = SCORR;
        if (source === 'intrinsic')
            grantIntrinsicProperty('clairvoyant', 'outside');
        else if (source === 'timeout')
            game.u.clairvoyanceTurns = 100;
        else {
            await addInventoryObject(AMULET_OF_YENDOR, { initialize: false });
            game.u.uevent = { amulet_wish: 1 };
        }
        game.seer_turn = game.moves + 1;
        const turn = game.moves;
        input.feed('s\x1b');
        await moveloop_core();
        await moveloop_core();
        assert.equal(game.moves, turn + 1);
        assert.equal(passage.typ, CORR);
        assert.equal(passage.seenv, 255);
    });
}
for (const prevented of ['blocked', 'endgame', 'not due', 'no source']) {
    void test(`${prevented} clairvoyance leaves nearby secrets concealed`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;
        const passage = game.level.requireAt(18, 10);
        passage.typ = SCORR;
        if (prevented !== 'no source')
            grantIntrinsicProperty('clairvoyant', 'outside');
        if (prevented === 'blocked')
            game.u.clairvoyanceBlocked = true;
        if (prevented === 'endgame')
            game.astral_level = {
                ...game.u.uz, dlevel: 1, flags: { town: false }, alignment: 0,
            };
        game.seer_turn = game.moves + (prevented === 'not due' ? 2 : 1);
        input.feed('s\x1b');
        await moveloop_core();
        await moveloop_core();
        assert.equal(passage.typ, SCORR);
    });
}
//# sourceMappingURL=clairvoyance_turns.test.js.map