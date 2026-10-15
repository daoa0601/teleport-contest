import test from 'node:test';
import assert from 'node:assert/strict';
import { TT_BEARTRAP, TT_PIT, TT_WEB, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { pushKeys, queueCommandKeys } from '../js/input.js';
import { BOULDER, CLUB } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

for (const [form, message] of [
    ['snake', 'You have no legs to kick with.'],
    ['killer bee', 'You are too small to do any kicking.'],
    ['crocodile', 'Your legs cannot kick effectively.'],
] as const) {
    void test(`a hero in ${form} form cannot kick`, async () => {
        freshPlayableRoom();
        requirePlayingGame(game);
        game.u.mh = game.u.mhmax = 20;
        setHeroSpecies(MONSTER_NAME.indexOf(form));

        await kickDirection('l', ' '.repeat(5));

        assert.equal(game.context.move, 0);
        assert.equal(game._lastPlineMessage, message);
        assert.ok(!game._kickedLoc, 'A refused kick has no target square.');
    });
}

for (const [trap, message] of [
    [TT_PIT, "There's not enough room to kick down here."],
    [TT_WEB, "You can't move your leg!"],
    [TT_BEARTRAP, "You can't move your leg!"],
] as const) {
    void test(`a hero held by trap ${trap} cannot kick`, async () => {
        freshPlayableRoom({ hero: { utrap: 4, utraptype: trap } });

        await kickDirection('l', ' '.repeat(5));

        assert.equal(game.context.move, 0);
        assert.equal(game._lastPlineMessage, message);
    });
}

void test('a boulder around the hero prevents kicking', async () => {
    freshPlayableRoom();
    await floorObject(BOULDER, 10, 10, { initialize: false });

    await kickDirection('l', ' '.repeat(5));

    assert.equal(game.context.move, 0);
    assert.equal(game._lastPlineMessage, "There's not enough room to kick in here.");
});

void test('a wall-passing hero kicks the side of a pit instead of its neighbor', async () => {
    freshPlayableRoom({ hero: { utrap: 4, utraptype: TT_PIT, passesWalls: true } });

    await kickDirection('l');

    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You kick at the side of the pit.');
});

void test('levitation requires a surface behind the hero for bracing', async () => {
    const level = freshPlayableRoom({ hero: { levitating: true, uhp: 100, uhpmax: 100 } });
    level.requireAt(11, 10).typ = STONE;

    await kickDirection('l', ' '.repeat(5));

    assert.equal(game.context.move, 0);
    assert.equal(game.u.uhp, 100);
    assert.equal(game._lastPlineMessage, 'You have nothing to brace yourself against.');
});

for (const trapped of [false, true]) {
    void test(`a kick refused for ${trapped ? 'a bear trap' : 'wounded legs'} discards its queued direction`, async () => {
        freshPlayableRoom({ hero: trapped
            ? { utrap: 4, utraptype: TT_BEARTRAP }
            : { _woundedLegTurns: 4 } });
        requirePlayingGame(game);
        const westClub = await floorObject(CLUB, 9, 10, { initialize: false });
        const eastClub = await floorObject(CLUB, 11, 10, { initialize: false });
        queueCommandKeys('l');
        pushKeys(' ');

        await rhack(4);
        assert.equal(game.context.move, 0);
        game.u.utrap = 0;
        game.u._woundedLegTurns = 0;
        await kickDirection('h', ' '.repeat(10));

        assert.ok(westClub.ox < 9, 'The next westward kick moves the club west of the hero.');
        assert.equal(eastClub.ox, 11, 'The discarded eastward direction leaves the eastern club alone.');
    });
}
