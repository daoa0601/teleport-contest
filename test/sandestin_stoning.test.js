import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { decideMonsterShapeChange, prepareMonsterPetrification } from '../js/mon.js';
import { setMonsterGivenName } from '../js/do_name.js';
import { STATUE } from '../js/object_data.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
const SANDestin = MONSTER_NAME.indexOf('sandestin');
const BLACK_DRAGON = MONSTER_NAME.indexOf('black dragon');
// C mon.c:vamp_stone() (mon.c:3817-3827): a shapechanger whose base form
// resists stoning reverts to that shape instead of leaving a statue, and
// cham is not cleared, so the once-per-turn decision in m_calcdistress()
// (mon.c:1196) keeps rolling; on a zero the mspec_used cooldown is set
// (mon.c:4881-4883).
void test('a shape-changed sandestin reverts when stoned and keeps shapechanging', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const dragon = await createMonsterAt('black dragon', ux + 1, uy, NO_MINVENT);
    dragon.cham = SANDestin;
    await vision_recalc(0);
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const result = await prepareMonsterPetrification(dragon, { publish });
    assert.equal(result.survived, true);
    assert.equal(dragon.mnum, SANDestin);
    assert.ok(!(game.level.objects[ux + 1]?.[uy] ?? []).some(object => object.otyp === STATUE));
    // newcham(NC_SHOW_MSG) describes the revert with the new form's article
    // (mon.c:5472-5474, noname_monnam(mtmp, ARTICLE_A)).
    assert.deepEqual(messages, ['The black dragon turns into a sandestin!']);
    const change = await decideMonsterShapeChange(dragon, game, () => 0, { publish });
    assert.equal(dragon.mspec_used, 3);
    assert.ok(change, 'the reverted sandestin still changes form');
});
// C mon.c:5310-5314: the pre-change name uses x_monnam(..., ARTICLE_YOUR)
// for a tame monster, capitalized for the transformation message; a monster
// with an assigned name is named by it instead of its species, with the
// article dropped (do_name.c:956-983, 1000-1004).
void test('stoning revert names a tame monster as yours and a named one by its name', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const pet = await createMonsterAt('black dragon', ux + 1, uy, NO_MINVENT);
    pet.cham = SANDestin;
    pet.mtame = 1;
    const named = await createMonsterAt('black dragon', ux + 2, uy, NO_MINVENT);
    named.cham = SANDestin;
    setMonsterGivenName(named, 'Rex');
    await vision_recalc(0);
    const messages = [];
    await prepareMonsterPetrification(pet, {
        publish: async (message) => { messages.push(message); },
    });
    await prepareMonsterPetrification(named, {
        publish: async (message) => { messages.push(message); },
    });
    assert.deepEqual(messages, [
        'Your black dragon turns into a sandestin!',
        'Rex turns into a sandestin!',
    ]);
});
// C mon.c:5466-5470: when the old shape could not be spotted but the innate
// shape can be, newcham() reports the arrival with an indefinite article.
// A hidden lurker above (mundetected) is unspotable; the reverted sandestin
// cannot hide, and hideunder() clears the flag (mon.c:5409-5410), so it
// appears.
void test('an unseen sandestin revert announces the appearing innate shape', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const lurker = await createMonsterAt('lurker above', ux + 1, uy, NO_MINVENT);
    lurker.cham = SANDestin;
    lurker.mundetected = true;
    await vision_recalc(0);
    const messages = [];
    const result = await prepareMonsterPetrification(lurker, {
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(result.survived, true);
    assert.equal(lurker.mnum, SANDestin);
    assert.ok(!lurker.mundetected);
    assert.deepEqual(messages, ['A sandestin appears!']);
});
// C mon.c:3817-3827 heals and survives even when newcham() refuses the
// change: the base shape is already current (mon.c:5342-5343) or genocided
// (mon.c:5339-5340). No statue and no message either way; cham is kept, so
// the survivor remains a shapechanger.
void test('a sandestin escapes petrifying even when the revert is refused', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    const dragon = await createMonsterAt('black dragon', ux + 1, uy, NO_MINVENT);
    dragon.cham = SANDestin;
    await vision_recalc(0);
    const first = await prepareMonsterPetrification(dragon, { publish });
    assert.equal(first.survived, true);
    assert.equal(dragon.mnum, SANDestin);
    assert.deepEqual(messages, ['The black dragon turns into a sandestin!']);
    dragon.mhp = 1;
    const again = await prepareMonsterPetrification(dragon, { publish });
    assert.equal(again.survived, true);
    assert.equal(dragon.mnum, SANDestin);
    assert.equal(dragon.cham, SANDestin);
    assert.equal(dragon.mhp, dragon.mhpmax);
    assert.deepEqual(messages, ['The black dragon turns into a sandestin!']);
    assert.ok(!(game.level.objects[ux + 1]?.[uy] ?? []).some(object => object.otyp === STATUE));
    const shifted = await createMonsterAt('black dragon', ux + 2, uy, NO_MINVENT);
    shifted.cham = SANDestin;
    requireMonsterVital(SANDestin).mvflags |= G_GENOD;
    const genocided = await prepareMonsterPetrification(shifted, { publish });
    assert.equal(genocided.survived, true);
    assert.equal(shifted.mnum, BLACK_DRAGON);
    assert.equal(shifted.cham, SANDestin);
    assert.equal(shifted.mhp, shifted.mhpmax);
    assert.ok(!(game.level.objects[ux + 2]?.[uy] ?? []).some(object => object.otyp === STATUE));
});
//# sourceMappingURL=sandestin_stoning.test.js.map