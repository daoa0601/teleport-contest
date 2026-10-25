import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantMonsterCorpseIntrinsic } from '../js/monster_corpse_intrinsic.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setMonsterPermanentInvisibility } from '../js/monster_invisibility.js';
import { makeMonsterInvisible } from '../js/monster_invisibility_magic.js';
import { monsterName } from '../js/monster_name.js';
import { initializeMonsterWormBody } from '../js/monster_worm.js';
import { POT_INVISIBILITY } from '../js/object_data.js';
import { hitMonsterWithSupportedPotion } from '../js/potion_hit.js';
import { initRng, rn2Display } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { assertWormBody } from './support/worms.js';
async function visibleWorm() {
    freshObjectRoom({ right: 25 });
    const worm = await createMonsterAt('long worm', 16, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    initializeMonsterWormBody(worm, { segmentCount: 3, random: () => 0 });
    assertWormBody(worm);
    assert.equal(worm.wormSegments.length, 3);
    worm.msleeping = 0;
    installPagerInput(resetInputState(), { expected: /worm|shards|evaporates|appears|transparent/, limit: 8 });
    for (const segment of worm.wormSegments) {
        newsym(segment.x, segment.y);
        assert.equal(glyphAt(segment.x, segment.y)?.kind, 'monster');
    }
    return worm;
}
function assertPerceivedSpecies(point, species, part) {
    const glyph = glyphAt(point.x, point.y);
    assert.ok(glyph?.kind === 'monster', `The ${part} at ${point.x},${point.y} must remain visible.`);
    assert.equal(glyph.mnum, species, `The ${part} at ${point.x},${point.y} must receive its native hallucinated appearance.`);
}
for (const effect of ['a wand', 'stalker flesh']) {
    void test(`${effect} redraws a hallucinated worm's head, then its tail from tip to head`, async () => {
        const worm = await visibleWorm();
        const nearHead = worm.wormSegments[0];
        const middle = worm.wormSegments[1];
        const tip = worm.wormSegments[2];
        assert.ok(nearHead && middle && tip);
        game.u.seeInvisible = true;
        game.u.hallucinationTurns = 20;
        initRng(7n);
        // Both C callers format Monnam first. mon_set_minvis() redraws the
        // head, then see_wsegs() walks from wtails toward wheads. Each visible
        // cell gets one random_monster(newsym_rn2), or rn2(NUMMONS), appearance.
        monsterName(worm, { capitalized: true });
        const headSpecies = rn2Display(MONSTER_NAME.length);
        const tipSpecies = rn2Display(MONSTER_NAME.length);
        const middleSpecies = rn2Display(MONSTER_NAME.length);
        const nearHeadSpecies = rn2Display(MONSTER_NAME.length);
        initRng(7n);
        if (effect === 'a wand')
            await makeMonsterInvisible(worm);
        else
            await grantMonsterCorpseIntrinsic(worm, MONSTER_NAME.indexOf('stalker'));
        assertPerceivedSpecies({ x: worm.mx, y: worm.my }, headSpecies, 'head');
        assertPerceivedSpecies(tip, tipSpecies, 'tail tip');
        assertPerceivedSpecies(middle, middleSpecies, 'middle segment');
        assertPerceivedSpecies(nearHead, nearHeadSpecies, 'segment nearest the head');
    });
}
void test('a make-invisible wand erases every visible long-worm tail segment immediately', async () => {
    const worm = await visibleWorm();
    await makeMonsterInvisible(worm);
    assert.equal(worm.minvis, 1);
    for (const segment of worm.wormSegments)
        assert.notEqual(glyphAt(segment.x, segment.y)?.kind, 'monster', `The invisible tail at ${segment.x},${segment.y} must disappear with its head.`);
});
for (const cursed of [false, true]) {
    void test(`an invisibility potion immediately ${cursed ? 'reveals' : 'hides'} the whole worm`, async () => {
        const worm = await visibleWorm();
        if (cursed) {
            setMonsterPermanentInvisibility(worm);
            for (const segment of worm.wormSegments) {
                newsym(segment.x, segment.y);
                assert.notEqual(glyphAt(segment.x, segment.y)?.kind, 'monster');
            }
        }
        const potion = await knownObject(POT_INVISIBILITY, { cursed });
        await hitMonsterWithSupportedPotion({ monster: worm, potion });
        assert.equal(!!worm.minvis, !cursed);
        for (const segment of worm.wormSegments)
            assert.equal(glyphAt(segment.x, segment.y)?.kind === 'monster', cursed, `The tail at ${segment.x},${segment.y} must share the head's visibility.`);
    });
}
//# sourceMappingURL=monster_worm_invisibility.test.js.map