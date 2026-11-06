// C fountain.c:44 (dowatersnakes) and fountain.c:101 (dowaternymph) guard
// the naming line with !Blind: a blind hero only hears the actor ("You
// hear something hissing!", "You hear a seductive voice.") and the
// monster's (hallucinated) name is never drawn, so the display-RNG stream
// must advance only by the monsters the summon creates. Each test matches
// the next hallucinated identity against a control that creates the same
// monsters through the same primitives (makemonNear + newsym) without any
// announcement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomDisplayMonsterName } from '../js/do_name.js';
import { newsym } from '../js/display.js';
import { summonFountainNymph, summonFountainSnakes } from '../js/fountain.js';
import { game } from '../js/gstate.js';
import { makeBlinded, makeHallucinated } from '../js/potion.js';
import { makemonNear } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { heroIsBlind, heroIsHallucinating } from '../js/senses.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { MM_NOMSG } from '../js/const.js';
import { freshObjectRoom } from './support/object-room.js';
const SEED = 424242;
const WATER_NYMPH = MONSTER_NAME.indexOf('water nymph');
const WATER_MOCCASIN = MONSTER_NAME.indexOf('water moccasin');
async function blindHallucinatingHero() {
    await freshObjectRoom({
        left: 8, right: 14, top: 9, bottom: 12, gameplaySeed: SEED,
    });
    // The real transitions, so blindness and hallucination are synchronized
    // (game.blind, vision recalculation, the monster redraw) rather than
    // half-set raw fields.
    await makeBlinded(100, { talk: false });
    await makeHallucinated(100, { talk: false });
    // A blind hero still names a monster through telepathy (C canspotmon()
    // accepts sense_mon()), which is the state where fountain.c:101's
    // a_monnam() would draw a hallucinated identity.
    grantIntrinsicProperty('telepathy', 'outside');
    assert.ok(heroIsBlind(game) && heroIsHallucinating(game), 'the hero must be blind and hallucinating');
}
async function nextNameAfterCreating(count, mnum) {
    for (let index = 0; index < count; index++) {
        const monster = await makemonNear(mnum, game.u.ux, game.u.uy, MM_NOMSG);
        if (monster)
            await newsym(monster.mx, monster.my);
    }
    return randomDisplayMonsterName();
}
void test('a blind hallucinating hero hears the water nymph without drawing her name', async () => {
    await blindHallucinatingHero();
    await summonFountainNymph();
    const afterNymph = randomDisplayMonsterName();
    await blindHallucinatingHero();
    const afterCreation = await nextNameAfterCreating(1, WATER_NYMPH);
    // fountain.c:101 draws a_monnam() only for a sighted hero; the blind
    // path must leave the hallucinated-naming stream where the monster's
    // creation alone leaves it.
    assert.equal(afterNymph, afterCreation);
});
void test('a blind hallucinating hero hears the fountain snakes without drawing their name', async () => {
    await blindHallucinatingHero();
    await summonFountainSnakes();
    const created = (game.level?.monsters ?? []).filter(monster => monster.mnum === WATER_MOCCASIN).length;
    const afterSnakes = randomDisplayMonsterName();
    await blindHallucinatingHero();
    const afterCreation = await nextNameAfterCreating(created, WATER_MOCCASIN);
    assert.ok(created > 0, 'the snake summon must create its monsters');
    // fountain.c:44 names the endless stream only for a sighted hero.
    assert.equal(afterSnakes, afterCreation);
});
//# sourceMappingURL=fountain_blind_hallucinated_naming.test.js.map