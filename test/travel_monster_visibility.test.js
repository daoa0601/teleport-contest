import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun, rhack } from '../js/cmd.js';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
for (const dark of [false, true]) {
    void test(`travel stops beside a hostile worm tail ${dark ? 'even when the whole worm is in darkness' : 'with its head farther away'}`, async () => {
        const input = freshTurnRoom({
            flags: { tips: false, mention_walls: true }, hero: { nv_range: 0 },
        });
        input.feed('_llllll.');
        await rhack(0);
        const worm = await createMonsterAt('long worm', 14, 11, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
        worm.wormSegments = [{ x: 13, y: 11 }, { x: 12, y: 11 }];
        if (dark) {
            assert.ok(game.level);
            for (const x of [12, 13, 14]) {
                const location = game.level.requireAt(x, 11);
                location.lit = false;
                location.waslit = false;
            }
        }
        vision_recalc(0);
        assert.equal(cansee(12, 11), !dark);
        assert.equal((await continueRun()).tookTime, false);
        assert.equal(game.u.ux, 11);
        assert.equal(game.context.run, 0);
        await flush_screen(1);
        assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /blocks your path\./);
    });
}
void test('travel stops for an ordinary hostile in darkness', async () => {
    const input = freshTurnRoom({
        flags: { tips: false, mention_walls: true }, hero: { nv_range: 0 },
    });
    input.feed('_llllll.');
    await rhack(0);
    await createMonsterAt('goblin', 12, 11, MM_ANGRY | NO_MINVENT);
    assert.ok(game.level);
    const location = game.level.requireAt(12, 11);
    location.lit = false;
    location.waslit = false;
    vision_recalc(0);
    assert.equal(cansee(12, 11), false);
    assert.equal((await continueRun()).tookTime, false);
    assert.equal(game.u.ux, 11);
    assert.equal(game.context.run, 0);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /blocks your path\./);
});
for (const concealment of ['invisible', 'undetected']) {
    void test(`travel continues beside an ${concealment} hostile`, async () => {
        const input = freshTurnRoom({ flags: { tips: false, mention_walls: true } });
        input.feed('_llllll.');
        await rhack(0);
        const monster = await createMonsterAt('goblin', 12, 11, MM_ANGRY | NO_MINVENT);
        monster.minvis = concealment === 'invisible' ? 1 : 0;
        monster.mundetected = concealment === 'undetected';
        assert.equal((await continueRun()).tookTime, true);
        assert.equal(game.u.ux, 12);
        await flush_screen(1);
        assert.doesNotMatch(requireScreenRow(0).map(cell => cell.ch).join(''), /blocks your path/);
    });
}
// display.h:_is_safemon() protects a peaceful monster only when the hero can
// spot it; an unseen peaceful neighbor stops travel like a hostile one.
void test('travel stops for a peaceful monster the hero cannot spot in darkness', async () => {
    const input = freshTurnRoom({
        flags: { tips: false, mention_walls: true }, hero: { nv_range: 0 },
    });
    input.feed('_llllll.');
    await rhack(0);
    const monster = await createMonsterAt('goblin', 12, 11, NO_MINVENT);
    monster.mpeaceful = true;
    assert.ok(game.level);
    const location = game.level.requireAt(12, 11);
    location.lit = false;
    location.waslit = false;
    vision_recalc(0);
    assert.equal(cansee(12, 11), false);
    assert.equal((await continueRun()).tookTime, false);
    assert.equal(game.u.ux, 11);
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /blocks your path\./);
});
//# sourceMappingURL=travel_monster_visibility.test.js.map