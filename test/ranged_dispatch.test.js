import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { P_BOW, P_DAGGER, P_EXPERT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { chooseHeroVolleyCount } from '../js/hero_multishot.js';
import { resetInputState } from '../js/input.js';
import { ARROW, BOW, CLUB, CROSSBOW_BOLT, DAGGER, DART, ELVEN_ARROW, GOLD_PIECE, OBJECT_NAMES, ROCK, SMALL_SHIELD, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPropertyTimeout } from '../js/properties.js';
import { ensureQuestStatus } from '../js/quest.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('throw rejects an object count above one before asking for direction', async () => {
    freshObjectRoom({ role: 'wizard' });
    const darts = await addInventoryObject(DART, { quan: 10 });
    const input = resetInputState();
    await answerPrompts(rhack('t'.charCodeAt(0)), input, [
        { prompt: /What do you want to throw\?/, keys: `3${darts.invlet}` },
        { prompt: /You can only throw one at a time\.--More--/, keys: ' ' },
        { prompt: /What do you want to throw\?/, keys: darts.invlet },
        { prompt: /In what direction\?/, keys: '>' },
    ]);
    assert.equal(game.inventory.length, 1);
    assert.equal(game.inventory[0], darts);
    assert.equal(darts.quan, 9);
    assert.equal(game.context.move, 1);
});
void test('only the hero\'s own quest launcher adds a volley bonus', async () => {
    for (const role of ['knight', 'ranger']) {
        freshObjectRoom({ role });
        installHeroWeaponSkills({ [P_BOW]: P_EXPERT });
        const diana = artifactByName('The Longbow of Diana');
        assert.ok(diana);
        ensureQuestStatus().touched_artifact = true;
        const bow = await addInventoryObject(BOW, { oartifact: diana.id });
        await setPrimaryWeapon(bow);
        const arrows = await addInventoryObject(ARROW, { quan: 10 });
        const maximum = chooseHeroVolleyCount(arrows, { random: range => range });
        assert.equal(maximum, role === 'ranger' ? 5 : 3, `${role} volley with Diana's bow`);
    }
});
void test('a swallowed hero throws the whole selected volley at the engulfer', async () => {
    freshObjectRoom({ role: 'rogue', recalculateVision: false });
    installHeroWeaponSkills({ [P_DAGGER]: P_EXPERT });
    const worm = await createMonsterAt('purple worm', 11, 10);
    worm.mx = game.u.ux;
    worm.my = game.u.uy;
    worm.mhp = worm.mhpmax = 1000;
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    const daggers = await addInventoryObject(DAGGER, { quan: 10 });
    await setQuiverObject(daggers);
    initRng(2n);
    game._commandCount = 2;
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /In what direction\?/, keys: 'l' },
    ]);
    assert.equal(daggers.quan, 8);
    assert.equal(game.u.uswallow, 1);
    assert.equal(worm.minvent.reduce((count, object) => count + object.quan, 0), 2);
    assert.equal(game.uquiver, daggers);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /You throw 2 daggers\./);
    assert.match(game._pending_message, /The 2nd dagger hits/);
});
void test('a volley continues outside after its first dagger kills the engulfer', async () => {
    freshObjectRoom({ role: 'rogue', recalculateVision: false });
    installHeroWeaponSkills({ [P_DAGGER]: P_EXPERT });
    const worm = await createMonsterAt('purple worm', 11, 10);
    worm.mx = game.u.ux;
    worm.my = game.u.uy;
    worm.mhp = 1;
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    const daggers = await addInventoryObject(DAGGER, { quan: 3 });
    await setQuiverObject(daggers);
    initRng(2n);
    game._commandCount = 2;
    const input = resetInputState();
    installPagerInput(input, { expected: /throw|dagger|purple worm|kill|expel|welcome/i, limit: 12 });
    input.feed('l');
    await rhack('f'.charCodeAt(0));
    assert.equal(daggers.quan, 1, 'the remaining missile must leave inventory after expulsion');
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.uquiver, daggers);
});
void test('repeating fire with an emptied quiver asks for ammunition again', async () => {
    freshObjectRoom({ flags: { autoquiver: false, fireassist: false } });
    const dart = await addInventoryObject(DART);
    const rock = await addInventoryObject(ROCK, { invlet: 'l' });
    await setQuiverObject(dart);
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /In what direction\?/, keys: 'l' },
    ]);
    assert.equal(game.uquiver, null);
    await answerPrompts(rhack(1), input, [
        { prompt: /You have no ammunition readied\.--More--/, keys: ' ' },
        { prompt: /What do you want to fire\?/, keys: '\x1b' },
    ]);
    assert.equal(game.uquiver, null);
    assert.ok(game.inventory.includes(rock));
    assert.equal(game.context.move, 0);
});
void test('a fire count announces the single quivered coin it throws', async () => {
    freshObjectRoom();
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 20 });
    await setQuiverObject(gold);
    game._commandCount = 2;
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /In what direction\?/, keys: '>' },
    ]);
    assert.equal(gold.quan, 19);
    assert.equal(game.uquiver, gold);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /You throw 1 gold piece\./);
});
for (const refusal of ['welded weapon', 'shield']) {
    void test(`fireassist abandons its retry when swapping fails because of a ${refusal}`, async () => {
        freshObjectRoom({ flags: { fireassist: true } });
        const club = await addInventoryObject(CLUB, { cursed: refusal === 'welded weapon' });
        const bow = await addInventoryObject(refusal === 'shield' ? OBJECT_NAMES.indexOf('halberd') : BOW);
        const arrows = await addInventoryObject(ARROW, { quan: 3 });
        await setPrimaryWeapon(club);
        await setSecondaryWeapon(bow);
        if (refusal === 'welded weapon')
            await setQuiverObject(arrows);
        if (refusal === 'shield') {
            const shield = await addInventoryObject(SMALL_SHIELD);
            game.uarms = game.u.uarms = shield;
        }
        const input = resetInputState();
        await rhack('f'.charCodeAt(0));
        await rhack(0); // The launcher swap is the next queued command.
        input.feed('.');
        await rhack(0);
        assert.equal(game.context.move, 1, 'the next physical command must execute after the failed swap');
        assert.equal(game.uwep, club);
        assert.equal(game.uswapwep, bow);
        assert.equal(arrows.quan, 3);
    });
}
void test('fireassist abandons its retry when wielding a launcher fails', async () => {
    freshObjectRoom({ flags: { fireassist: true, pushweapon: true } });
    const club = await addInventoryObject(CLUB, { cursed: true });
    await addInventoryObject(BOW);
    const arrows = await addInventoryObject(ARROW, { quan: 3 });
    await setPrimaryWeapon(club);
    await setQuiverObject(arrows);
    const input = resetInputState();
    await rhack('f'.charCodeAt(0));
    await rhack(0);
    input.feed('.');
    await rhack(0);
    assert.equal(game.context.move, 1, 'a failed wield must return control to physical input');
    assert.equal(game.uwep, club);
    assert.equal(arrows.quan, 3);
});
void test('recoil ends a levitating hero volley after the first arrow', async () => {
    freshObjectRoom({ role: 'ranger', left: 3, right: 25 });
    installHeroWeaponSkills({ [P_BOW]: P_EXPERT });
    const bow = await addInventoryObject(BOW);
    const arrows = await addInventoryObject(ARROW, { quan: 10 });
    await setPrimaryWeapon(bow);
    await setQuiverObject(arrows);
    setPropertyTimeout('levitation', 50);
    initRng(2n);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /shoot|opposite direction|stop firing/, limit: 8 });
    input.feed('l');
    const startX = game.u.ux;
    await rhack('f'.charCodeAt(0));
    assert.equal(arrows.quan, 9, 'recoil interrupts the remaining arrows');
    assert.ok(game.u.ux < startX, 'the shot pushes the hero away from its direction');
    assert.ok([...messages, game._pending_message].some(message => /You stop firing after the 1st shot\./.test(message)));
});
void test('an anchored levitating hero finishes the volley without recoiling', async () => {
    freshObjectRoom({ role: 'ranger', hero: { utrap: 2, utraptype: TT_PIT } });
    installHeroWeaponSkills({ [P_BOW]: P_EXPERT });
    const bow = await addInventoryObject(BOW);
    const arrows = await addInventoryObject(ARROW, { quan: 10 });
    await setPrimaryWeapon(bow);
    await setQuiverObject(arrows);
    setPropertyTimeout('levitation', 50);
    initRng(2n);
    const input = resetInputState();
    installPagerInput(input, { expected: /shoot|anchored/, limit: 8 });
    input.feed('l');
    const startX = game.u.ux;
    await rhack('f'.charCodeAt(0));
    assert.equal(arrows.quan, 8);
    assert.equal(game.u.ux, startX);
});
for (const [type, launcher, missile] of [
    [ELVEN_ARROW, 'bow', 'arrow'], [CROSSBOW_BOLT, 'crossbow', 'bolt'],
]) {
    void test(`hand-thrown ${missile} feedback describes the missing ${launcher}`, async () => {
        freshObjectRoom({ flags: { fireassist: false } });
        const ammunition = await addInventoryObject(type);
        await setQuiverObject(ammunition);
        const input = resetInputState();
        await answerPrompts(rhack('f'.charCodeAt(0)), input, [
            { prompt: /In what direction\?/, keys: 'l' },
        ]);
        assert.equal(game._pending_message, `You aren't wielding a ${launcher}, so you throw your ${missile} by hand.`);
        assert.equal(ammunition.where, 'floor');
        assert.equal(game.uquiver, null);
    });
}
void test('a downward arrow does not announce a missing bow', async () => {
    freshObjectRoom({ flags: { fireassist: false } });
    const arrow = await addInventoryObject(ARROW);
    await setQuiverObject(arrow);
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /In what direction\?/, keys: '>' },
    ]);
    assert.match(game._pending_message, /arrow hits the floor\./);
    assert.doesNotMatch(game._pending_message, /aren't wielding/);
});
void test('cancelling a quiver choice clears the command available for recall', async () => {
    freshObjectRoom();
    const dart = await addInventoryObject(DART);
    const input = resetInputState();
    await answerPrompts(rhack('Q'.charCodeAt(0)), input, [
        { prompt: /What do you want to ready\?/, keys: '\x1b' },
    ]);
    await answerPrompts(rhack(1), input, []);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.ok(game.inventory.includes(dart));
    assert.equal(game.uquiver, null);
    assert.equal(game.context.move, 0);
});
void test('fire with an explicitly empty quiver clears recall without spending time', async () => {
    freshObjectRoom({ flags: { autoquiver: false } });
    const dart = await addInventoryObject(DART);
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /You have no ammunition readied\.--More--/, keys: ' ' },
        { prompt: /What do you want to fire\?/, keys: '-' },
    ]);
    assert.equal(game.context.move, 0);
    await answerPrompts(rhack(1), input, []);
    assert.equal(game._pending_message, 'There is no command available to repeat.');
    assert.ok(game.inventory.includes(dart));
    assert.equal(game.uquiver, null);
});
//# sourceMappingURL=ranged_dispatch.test.js.map