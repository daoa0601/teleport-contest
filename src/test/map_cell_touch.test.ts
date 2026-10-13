import assert from 'node:assert/strict';
import test from 'node:test';

import { D_CLOSED, D_ISOPEN, D_NODOOR, DOOR, ENGRAVE, ROOM, VWALL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { feel_location } from '../js/display.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';

for (const obstacle of ['wall', 'closed door'] as const) {
    void test(`a blind movement attempt remembers an unseen ${obstacle}`, async () => {
        const level = freshObjectRoom({
            recalculateVision: false,
            flags: { autoopen: false, mention_walls: false },
        });
        requirePlayingGame(game);
        const destination = level.requireAt(11, 10);
        destination.typ = obstacle === 'wall' ? VWALL : DOOR;
        destination.doormask = D_CLOSED;
        destination.seenv = 0;
        destination.wall_info = 2;
        setHeroBlindnessTurns(10);
        vision_reset();
        vision_recalc(0);

        await rhack('l'.charCodeAt(0));

        assert.equal(game.u.ux, 10);
        assert.equal(destination.disp_ch, obstacle === 'wall' ? '|' : '+');
        assert.notEqual(destination.seenv, 0);
    });
}

void test('touching an engraved floor reveals its engraving while blind', () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    setHeroBlindnessTurns(10);
    const engraving = makeEngravingAt(11, 10, 'A warning', null, 0, ENGRAVE);
    assert.ok(engraving);
    level.requireAt(11, 10).typ = ROOM;

    feel_location(11, 10);

    assert.equal(engraving.erevealed, true);
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'engraving');
});

void test('a rejected blind diagonal exit does not feel the doorless destination', async () => {
    const level = freshObjectRoom({ recalculateVision: false, flags: { mention_walls: false } });
    requirePlayingGame(game);
    const current = level.requireAt(10, 10);
    current.typ = DOOR;
    current.doormask = D_ISOPEN;
    const destination = level.requireAt(11, 9);
    destination.typ = DOOR;
    destination.doormask = D_NODOOR;
    destination.seenv = 0;
    setHeroBlindnessTurns(10);
    vision_reset();
    vision_recalc(0);

    await rhack('u'.charCodeAt(0));

    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(destination.seenv, 0);
    assert.equal(destination.remembered_glyph, undefined);
});
