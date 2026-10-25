import test from 'node:test';
import assert from 'node:assert/strict';
import { SINK, S_LDWASHER } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterName } from '../js/monster_name.js';
import { initRng } from '../js/rng.js';
import { syncDeafness } from '../js/senses.js';
import { kickDirection } from './support/commands.js';
import { freshPlayableRoom } from './support/playable-room.js';

const PM_AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');

async function kickSinkRoom(seed: bigint, { looted = 0, deaf = false, female = false } = {}) {
    const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 }, flags: { female } });
    requirePlayingGame(game);
    const sink = level.requireAt(11, 10);
    sink.typ = SINK;
    sink.looted = looted;
    if (deaf) {
        game.u.deafTurns = 20;
        syncDeafness();
    }
    initRng(seed);
    await kickDirection('l', ' '.repeat(10));
    return { level, sink };
}

// dokick.c kick() sink branch: the common klunk shakes the pipes for a
// hearing hero and drops the explanation for a deaf one.
void test('kicking the sink klunks noisily, briefly for a deaf hero', async () => {
    await kickSinkRoom(2n);
    assert.equal(game._pending_message, 'Klunk!  The pipes vibrate noisily.');

    await kickSinkRoom(2n, { deaf: true });
    assert.equal(game._pending_message, 'Klunk!');
    assert.equal(game.context.move, 1);
});

// dokick.c: the dish washer is the hero's opposite sex (poly_gender() 1 makes
// MM_MALE, so a female hero meets an incubus), and the visit is once per sink.
for (const female of [false, true]) {
    void test(`the dish washer returns as ${female ? 'an incubus' : 'a succubus'} once`, async () => {
        const { level, sink } = await kickSinkRoom(1n, { female });

        assert.match(game._pending_message, /The dish washer returns!/);
        const washer = level.monsters.find(monster => monster.mnum === PM_AMOROUS_DEMON);
        assert.ok(washer, 'The dish washer arrives with the kick');
        assert.equal(monsterName(washer, { article: 'a' }),
            female ? 'an incubus' : 'a succubus');
        // S_LDWASHER blocks a second dish washer visit; the sink survives.
        assert.equal(sink.looted, S_LDWASHER);
        assert.equal(sink.typ, SINK);
    });
}
