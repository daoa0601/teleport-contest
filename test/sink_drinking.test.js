import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, F_LOOTED, G_GENOD, M_SEEN_FIRE, SINK, S_LRING } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { requireScreenRow } from './support/screen.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING, POT_FRUIT_JUICE, POT_HEALING, POT_OIL } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { createPoisonGasCloud } from '../js/regions.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { drinkSink } from '../js/sink_drinking.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function sink(room = {}) {
    const level = freshObjectRoom(room);
    requirePlayingGame(game);
    const location = level.requireAt(game.u.ux, game.u.uy);
    location.typ = SINK;
    level.flags.nsinks = 1;
    level.flags.nfountains = 0;
    return location;
}
async function sip(seed) {
    initRng(BigInt(seed));
    const input = resetInputState();
    // One sink event, one potion effect, and at most one six-message life save.
    installPagerInput(input, {
        expected: new RegExp([
            /amulet of (?:life saving|unchanging).*being worn/.source,
            /sip of .* water|quite tasty|You die|But wait|medallion|feel much better/.source,
            /find a ring in the sink|dirty water backs up|moves as though of its own will/.source,
            /tastes awful|Welcome.*experience level|Ew, what a stench/.source,
            /Some .* liquid flows from the faucet|That was smooth|feel better/.source,
        ].join('|')),
        limit: 2 + 3 + 6,
    });
    return drinkSink();
}
for (const [seed, temperature] of [[26, 'very cold'], [9, 'very warm'], [44, 'hot']]) {
    void test(`ordinary ${temperature} tap water does not alter nutrition or health`, async () => {
        sink();
        requirePlayingGame(game);
        const hunger = game.u.uhunger;
        const result = await sip(seed);
        assert.equal(result.spentTime, true);
        assert.equal(result.heroDied, false);
        assert.equal(game.u.uhunger, hunger);
        assert.equal(game.u.uhp, 40);
        assert.match(game._pending_message, new RegExp(`sip of ${temperature} water`));
    });
}
void test('levitation prevents drinking from the sink', async () => {
    sink();
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    await sip(1);
    assert.equal(game.level.objects[10]?.[10]?.length ?? 0, 0);
    assert.match(game._pending_message, /floating high above the sink/);
});
void test('scalding water damages the current body and teaches visible monsters that fire hurts', async () => {
    sink();
    requirePlayingGame(game);
    const observer = await createMonsterAt('dog', 12, 10);
    observer.seen_resistance = M_SEEN_FIRE;
    await sip(117);
    assert.ok(game.u.uhp >= 34 && game.u.uhp <= 39);
    assert.equal(observer.seen_resistance & M_SEEN_FIRE, 0);
});
void test('scalding water leaves the human body untouched while hurting a polymorphed body', async () => {
    sink();
    requirePlayingGame(game);
    installPolymorphedHero('dog');
    await sip(117);
    assert.equal(game.u.uhp, 40);
    assert.ok(game.u.mh >= 34 && game.u.mh <= 39);
});
void test('fire resistance prevents scalding damage and is observed by a real nearby monster', async () => {
    sink();
    requirePlayingGame(game);
    grantIntrinsicProperty('fireResistance', 'outside');
    const observer = await createMonsterAt('dog', 12, 10);
    await sip(117);
    assert.equal(game.u.uhp, 40);
    assert.ok(observer.seen_resistance !== undefined && observer.seen_resistance !== null, 'Expected observer.seen_resistance to be initialized');
    assert.equal(observer.seen_resistance & M_SEEN_FIRE, M_SEEN_FIRE);
    assert.match(game._pending_message, /quite tasty/);
});
void test('life saving recovers from fatal scalding water through the ordinary death owner', async () => {
    sink({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const result = await sip(117);
    assert.equal(result.heroDied, false);
    assert.ok(game.u.uhp > 0);
    assert.equal(game.inventory.includes(amulet), false);
});
void test('the sink releases a real nearby sewer rat', async () => {
    sink();
    requirePlayingGame(game);
    await sip(17);
    const rat = game.level.monsters.find(monster => monster.mnum === MONSTER_NAME.indexOf('sewer rat'));
    assert.ok(rat);
    assert.ok(rat.mx !== game.u.ux || rat.my !== game.u.uy);
    assert.match(game._pending_message, /sewer rat in the sink/);
});
void test('a blind hero notices something squirmy when a sewer rat emerges', async () => {
    sink();
    requirePlayingGame(game);
    setHeroBlindnessTurns(20);
    await sip(17);
    assert.ok(game.level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('sewer rat')));
    assert.match(game._pending_message, /something squirmy/);
});
void test('genocided sewer rats leave a dirty sink without creating a replacement species', async () => {
    sink();
    requirePlayingGame(game);
    assert.ok(game.mvitals !== undefined && game.mvitals !== null, 'Expected game.mvitals to be initialized');
    game.mvitals[MONSTER_NAME.indexOf('sewer rat')] = { born: 0, died: 0, mvflags: G_GENOD };
    await sip(17);
    assert.equal(game.level.monsters.length, 0);
    assert.match(game._pending_message, /sink seems quite dirty/);
});
void test('a sink ring becomes a real floor object and can only be found once', async () => {
    const location = sink();
    requirePlayingGame(game);
    await sip(1);
    assert.ok(game.level.objects[10] !== undefined && game.level.objects[10] !== null);
    const rings = game.level.objects[10][10];
    assert.ok(rings !== undefined && rings !== null, 'Expected rings to be initialized');
    assert.equal(rings.length, 1);
    assert.ok(rings[0] !== undefined && rings[0] !== null);
    assert.equal(rings[0].oclass, 4);
    assert.equal(rings[0].where, 'floor');
    assert.ok(location.looted !== undefined && location.looted !== null, 'Expected location.looted to be initialized');
    assert.equal(location.looted & S_LRING, S_LRING);
    await sip(1);
    assert.ok(game.level.objects[10]?.[10] !== undefined && game.level.objects[10]?.[10] !== null);
    assert.equal(game.level.objects[10][10].length, 1);
    assert.match(game._pending_message, /dirty water backs up/);
});
void test('breaking a sink changes both feature counts and makes a looted ordinary fountain', async () => {
    const location = sink();
    requirePlayingGame(game);
    location.looted = S_LRING;
    await sip(27);
    assert.equal(location.typ, FOUNTAIN);
    assert.equal(location.looted, F_LOOTED);
    assert.equal(location.blessedftn, 0);
    assert.equal(game.level.flags.nsinks, 0);
    assert.equal(game.level.flags.nfountains, 1);
});
void test('animated sink water creates a real water elemental', async () => {
    sink();
    requirePlayingGame(game);
    await sip(47);
    assert.ok(game.level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('water elemental')));
    assert.match(game._pending_message, /moves as though of its own will/);
});
void test('genocided water elementals let animated sink water quiet down', async () => {
    sink();
    requirePlayingGame(game);
    assert.ok(game.mvitals !== undefined && game.mvitals !== null, 'Expected game.mvitals to be initialized');
    game.mvitals[MONSTER_NAME.indexOf('water elemental')] = { born: 0, died: 0, mvflags: G_GENOD };
    await sip(47);
    assert.equal(game.level.monsters.length, 0);
    assert.match(game._pending_message, /quiets down/);
});
void test('awful tap water awards experience and can raise a level', async () => {
    sink({ hero: { ulevel: 1, ulevelmax: 1, uexp: 19 } });
    requirePlayingGame(game);
    await sip(16);
    assert.equal(game.u.ulevel, 2);
    assert.equal(game.u.uexp, 20);
});
void test('sewage drains nutrition and causes a real vomiting delay', async () => {
    sink();
    requirePlayingGame(game);
    const hunger = game.u.uhunger;
    await sip(6);
    assert.ok(game.u.uhunger <= hunger - 11 && game.u.uhunger >= hunger - 28);
    assert.equal(game._helplessTurns, 2);
    assert.match(game._pending_message, /sewage/);
});
void test('toxic tap water uses actual controlled polymorph input and form state', async () => {
    sink();
    requirePlayingGame(game);
    grantIntrinsicProperty('polymorphControl', 'outside');
    initRng(11n);
    const input = resetInputState();
    await answerPrompts(drinkSink(), input, [
        { prompt: /contains toxic wastes!/, keys: ' ' },
        { prompt: /undergo a freakish metamorphosis!/, keys: ' ' },
        { prompt: /Become what kind of monster\?/, keys: 'newt\n' },
    ]);
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('newt'));
    assert.ok(game.u.mh > 0);
    assert.equal(game.u.uconduct.polyselfs, 1);
});
void test('an unchanging amulet blocks the sink metamorphosis', async () => {
    sink();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_UNCHANGING);
    await wearHeroAccessory(amulet, 'uamul');
    const form = game.u.umonnum;
    await sip(11);
    assert.equal(game.u.umonnum, form);
    assert.equal(game.u.uconduct.polyselfs ?? 0, 0);
    assert.match(game._pending_message, /toxic wastes/);
});
for (const [seed, sound] of [[3, 'clanking'], [14, 'snatches of song']]) {
    void test(`sink ${sound} follows hearing and acoustics settings`, async () => {
        sink();
        requirePlayingGame(game);
        await sip(seed);
        assert.match(game._pending_message, new RegExp(`You hear ${sound}`));
        sink({ hero: { deafTurns: 20 } });
        requirePlayingGame(game);
        await sip(seed);
        assert.equal(game._pending_message || '', '');
        sink({ flags: { acoustics: false } });
        requirePlayingGame(game);
        await sip(seed);
        assert.equal(game._pending_message || '', '');
    });
}
void test('underwater sink sounds are barely heard', async () => {
    sink({ hero: { uinwater: true } });
    requirePlayingGame(game);
    await sip(3);
    assert.match(game._pending_message, /You barely hear clanking/);
});
void test('an unaware deaf hero dreams of sink sounds', async () => {
    sink({ hero: { deafTurns: 20 } });
    requirePlayingGame(game);
    putHeroToSleep(5);
    await sip(3);
    assert.match(game._pending_message, /You dream that you hear clanking/);
});
void test('sink stench creates a damaging gas cloud with native enclosure feedback', async () => {
    sink();
    requirePlayingGame(game);
    await sip(2);
    const cloud = game.level.regions[0];
    assert.ok(cloud !== undefined && cloud !== null, 'Expected cloud to be initialized');
    assert.equal(cloud.damage, 4);
    assert.ok(cloud.ttl >= 4 && cloud.ttl <= 6);
    assert.ok(cloud.cells.some(cell => cell.x === 10 && cell.y === 10));
    assert.match(game._pending_message, /enveloped in a cloud of noxious gas/);
});
void test('a breathless body gets a real sink cloud without another enclosure notice', async () => {
    sink();
    requirePlayingGame(game);
    installPolymorphedHero('iron golem');
    await sip(2);
    assert.equal(game.level.regions.length, 1);
    assert.equal(game._pending_message, 'Ew, what a stench!');
});
void test('an overlapping sink cloud does not announce enclosure again', async () => {
    sink();
    requirePlayingGame(game);
    await createPoisonGasCloud(game, 10, 10, 1, 4);
    resetInputState().feed(' ');
    await flushPendingTopline();
    await sip(2);
    assert.equal(game.level.regions.length, 2);
    assert.equal(game._pending_message, 'Ew, what a stench!');
});
void test('a hallucinated drain hand replaces the ordinary sip', async () => {
    sink({ hero: { hallucinationTurns: 30 } });
    requirePlayingGame(game);
    await sip(116);
    assert.match(game._pending_message, /a hand reaches up/);
});
void test('faucet oil uses the ordinary potion effect without creating inventory or floor leftovers', async () => {
    sink();
    requirePlayingGame(game);
    await sip(5);
    assert.match(game._pending_message, /That was smooth!/);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(POT_OIL), true);
    assert.equal(game.inventory.length, 0);
    assert.equal(game.level.objects[10]?.[10]?.length ?? 0, 0);
});
void test('observable faucet healing identifies the real potion and restores health', async () => {
    sink({ hero: { uhp: 1 } });
    requirePlayingGame(game);
    await sip(18);
    assert.ok(game.u.uhp > 1);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(POT_HEALING), true);
    assert.equal(game.inventory.length, 0);
});
void test('blind faucet healing works without identifying the unseen fluid', async () => {
    sink({ hero: { uhp: 1, blindTurns: 20 } });
    requirePlayingGame(game);
    await sip(18);
    assert.ok(game.u.uhp > 1);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(POT_HEALING), false);
    assert.equal(game._objectCallNames?.[POT_HEALING], undefined);
});
void test('hallucinated faucet healing works without identifying its uncertain appearance', async () => {
    sink({ hero: { uhp: 1, hallucinationTurns: 20 } });
    requirePlayingGame(game);
    await sip(18);
    assert.ok(game.u.uhp > 1);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(POT_HEALING), false);
    assert.equal(game._objectCallNames?.[POT_HEALING], undefined);
});
void test('ambiguous faucet juice resumes through the native stream naming prompt', async () => {
    sink();
    requirePlayingGame(game);
    initRng(38n);
    const input = resetInputState();
    const action = drinkSink();
    let named = false;
    for (let replies = 0;; replies++) {
        const blocked = await Promise.race([action.then(() => false), input.waitUntilBlocked().then(() => true)]);
        if (!blocked)
            break;
        assert.ok(replies < 3, 'One stream announcement, taste, and naming question bound this effect');
        if (game._pending_message.startsWith('Call ')) {
            assert.match(game._pending_message, /^Call a stream of .* fluid:/);
            assert.equal(game.inventory.length, 0);
            input.feed('juice from the tap\n');
            named = true;
        }
        else {
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /--More--/);
            assert.match(game._pending_message, /Some .* liquid flows from the faucet|This tastes like .*juice/);
            input.feed(' ');
        }
    }
    assert.equal(named, true);
    assert.ok(game._objectCallNames !== undefined && game._objectCallNames !== null, 'Expected game._objectCallNames to be initialized');
    assert.equal(game._objectCallNames[POT_FRUIT_JUICE], 'juice from the tap');
    assert.equal(game.inventory.length, 0);
});
void test('water from the random faucet selection is rejected before a real juice effect', async () => {
    sink();
    requirePlayingGame(game);
    const hunger = game.u.uhunger;
    initRng(298n);
    const input = resetInputState();
    await answerPrompts(drinkSink(), input, [
        { prompt: /Some .* liquid flows from the faucet/, keys: ' ' },
        { prompt: /This tastes like .*juice\./, keys: ' ' },
        { prompt: /Call a stream of .* fluid:/, keys: '\n' },
    ]);
    assert.equal(game.u.uhunger, hunger + 20);
    assert.ok(game._encounteredObjectTypes !== undefined && game._encounteredObjectTypes !== null, 'Expected game._encounteredObjectTypes to be initialized');
    assert.equal(game._encounteredObjectTypes.has(POT_FRUIT_JUICE), true);
    assert.equal(game.inventory.length, 0);
});
void test('quaffing from a sink consumes a turn through the ordinary command', async () => {
    sink();
    requirePlayingGame(game);
    initRng(26n);
    resetInputState().feed('y');
    await rhack('q'.charCodeAt(0));
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /very cold water/);
});
void test('the quaff command reaches the real sink monster branch', async () => {
    sink();
    requirePlayingGame(game);
    initRng(47n);
    const input = resetInputState();
    await answerPrompts(rhack('q'.charCodeAt(0)), input, [
        { prompt: /Drink from the sink\?/, keys: 'y' },
    ]);
    assert.equal(game.context.move, 1);
    assert.ok(game.level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('water elemental')));
});
//# sourceMappingURL=sink_drinking.test.js.map