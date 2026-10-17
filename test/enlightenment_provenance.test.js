import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { game, requireGameDisplay, requireInitializedGame } from '../js/gstate.js';
import { showEnlightenment, showFinalAttributes } from '../js/insight.js';
import { resetInputState } from '../js/input.js';
import { finishOrdinaryQuit } from '../js/end.js';
import { memoryStorage } from './support/memory-storage.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { adjustLevelAbilities } from '../js/exper.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BLINDFOLD, DUNCE_CAP, CORNUTHAUM, MUMMY_WRAPPING, RIN_INVISIBILITY, OBJECT_NAMES, SPEED_BOOTS, TOWEL } from '../js/object_data.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_INT, A_STR, W_TOOL } from '../js/const.js';
import { races } from '../js/roles.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { createSaddledSteed } from './support/monsters.js';
async function enlightenmentText(basic = false, final = false, magic = true) {
    const input = resetInputState();
    const report = final ? showFinalAttributes() : showEnlightenment({ basic, magic });
    const lines = [];
    try {
        let pages = 0;
        for (;;) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), report.then(() => false),
            ]);
            if (!blocked)
                break;
            assert.ok(++pages <= 12, 'enlightenment did not finish after twelve pages');
            lines.push(...requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim()));
            input.feed(' ');
        }
    }
    finally {
        input.feed('\x1b');
        await report;
    }
    return lines;
}
void test('timed very-fast speed takes precedence over experience and identified speed boots', async () => {
    freshGameplayRoom({ role: 'valkyrie', flags: { debug: true } });
    game.u.ulevel = 7;
    await adjustLevelAbilities(1, 7, () => { });
    await wearHeroArmor(await addInventoryObject(SPEED_BOOTS));
    (game._knownObjectTypes ??= new Set()).add(SPEED_BOOTS);
    setPropertyTimeout('fast', 30);
    assert.ok((await enlightenmentText()).includes('You are very fast because of a potion or spell.'));
});
void test('speed boots are named only when their appearance and type are known', async () => {
    for (const known of [false, true]) {
        freshGameplayRoom({ flags: { debug: true } });
        const boots = await addInventoryObject(SPEED_BOOTS, { dknown: known, observed: known });
        await wearHeroArmor(boots);
        if (known)
            (game._knownObjectTypes ??= new Set()).add(SPEED_BOOTS);
        else
            game._knownObjectTypes?.delete(SPEED_BOOTS);
        assert.ok((await enlightenmentText()).includes(known
            ? 'You are very fast because of your speed boots.'
            : 'You are very fast because of worn equipment.'));
    }
});
void test('a permanent outside resistance is reported as intrinsic', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    grantIntrinsicProperty('fireResistance', 'outside');
    assert.ok((await enlightenmentText()).includes('You are fire resistant intrinsically.'));
});
void test('enlightenment hides provenance outside wizard mode', async () => {
    freshGameplayRoom({ role: 'samurai', flags: { debug: false } });
    grantIntrinsicProperty('fast', 'experience');
    setPropertyTimeout('fast', 30);
    const lines = await enlightenmentText();
    assert.ok(lines.includes('You are very fast.'));
    assert.ok(!lines.some(line => line.includes('because of') || line.includes('innately')));
});
void test('level-one role abilities take precedence over outside sources', async () => {
    freshGameplayRoom({ role: 'archeologist', flags: { debug: true } });
    grantIntrinsicProperty('searching', 'role');
    grantIntrinsicProperty('searching', 'outside');
    assert.ok((await enlightenmentText()).includes('You have automatic searching innately.'));
});
void test('racial abilities acquired after level one are still innate', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    const elf = races.find(race => race.name === 'elf');
    if (!elf)
        throw new Error('The test needs the elven race');
    game.urace = elf;
    game.u.ulevel = 4;
    await adjustLevelAbilities(1, 4, () => { });
    assert.ok((await enlightenmentText()).includes('You are sleep resistant innately.'));
});
void test('creature-form resistance has its own source', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    setHeroSpecies(MONSTER_NAME.indexOf('red dragon'));
    assert.ok((await enlightenmentText()).includes('You are fire resistant from your creature form.'));
});
void test('enlightenment reports cold resistance before sleep resistance', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    grantIntrinsicProperty('coldResistance', 'outside');
    grantIntrinsicProperty('sleepResistance', 'outside');
    const lines = await enlightenmentText();
    const cold = lines.indexOf('You are cold resistant intrinsically.');
    assert.ok(cold >= 0);
    assert.ok(lines.indexOf('You are sleep resistant intrinsically.') > cold);
});
void test('worn resistance names respect object knowledge and omit enchantment', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('cold resistance'), { dknown: false, observed: false, spe: 4 });
    await wearHeroAccessory(ring, 'uleft');
    ring.dknown = false;
    assert.ok((await enlightenmentText()).includes('You are cold resistant because of your ring.'));
});
void test('carried artifacts are attributed by their bare names', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    await addInventoryItem(await artifactObject('The Orb of Detection'));
    const lines = await enlightenmentText();
    assert.ok(lines.includes('You are magic-protected because of the Orb of Detection.'));
    assert.ok(lines.includes('You take half spell damage because of the Orb of Detection.'));
});
void test('wielded artifacts explain their resistance by artifact name', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    const sword = await addInventoryItem(await artifactObject('Grayswandir'));
    await setPrimaryWeapon(sword);
    assert.ok((await enlightenmentText()).includes('You resist hallucinations because of Grayswandir.'));
});
void test('birth blindness and deafness retain their roleplay provenance', async () => {
    freshGameplayRoom({ flags: { debug: true }, hero: { permaBlind: true } });
    requireInitializedGame().u.uroleplay.blind = true;
    requireInitializedGame().u.uroleplay.deaf = true;
    const lines = await enlightenmentText();
    assert.ok(lines.includes('You are permanently blind from birth.'));
    assert.ok(lines.includes('You are deaf from birth.'));
});
void test('a blindfold explains deliberate blindness without an innate source', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    const blindfold = await addInventoryObject(BLINDFOLD, { owornmask: W_TOOL });
    game.ublindf = blindfold;
    game.u.ublindf = blindfold;
    assert.ok((await enlightenmentText()).includes('You are deliberately blind because of your blindfold.'));
});
void test('a mummy wrapping explains blocked invisibility', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    await wearHeroAccessory(await addInventoryObject(RIN_INVISIBILITY), 'uleft');
    await wearHeroArmor(await addInventoryObject(MUMMY_WRAPPING));
    assert.ok((await enlightenmentText()).includes('You are visible because of your mummy wrapping.'));
});
void test('lycanthropy explains level-drain resistance ahead of creature form', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    game.u.ulycn = MONSTER_NAME.indexOf('werewolf');
    setHeroSpecies(requireInitializedGame().u.umonnum);
    assert.ok((await enlightenmentText()).includes('You are level-drain resistant due to your lycanthropy.'));
});
void test('polymorphed background uses creature health and conceals innate characteristics', async () => {
    freshGameplayRoom({ flags: { debug: true }, hero: { mh: 7, mhmax: 25 } });
    setHeroSpecies(MONSTER_NAME.indexOf('red dragon'));
    const lines = await enlightenmentText(true);
    assert.ok(lines.includes('You have 7 out of 25 hit points.'));
    assert.ok(!lines.some(line => line.includes('experience point')));
    const strength = lines.find(line => line.startsWith('Your strength is'));
    assert.ok(strength && !strength.includes('base:') && !strength.includes('limit:'));
});
void test('enlightenment expands exceptional strength and explains an exceeded innate limit', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    requireInitializedGame().u.acurr.a[A_STR] = requireInitializedGame().u.amax.a[A_STR] = 118;
    let lines = await enlightenmentText(true);
    assert.ok(lines.includes('Your strength is 18/100.'));
    requireInitializedGame().u.acurr.a[A_INT] = 18;
    game.u.abon = { a: [0, 2, 0, 0, 0, 0] };
    const elf = races.find(race => race.name === 'elf');
    if (!elf)
        throw new Error('The test needs the elven race');
    game.urace = { ...elf, attrmax: [118, 19, 18, 18, 18, 18] };
    lines = await enlightenmentText(true);
    const intelligence = lines.find(line => line.startsWith('Your intelligence is'));
    assert.ok(intelligence?.includes('innate limit:19'));
});
void test('final enlightenment lists live resistances in the past tense', async () => {
    freshGameplayRoom({ flags: { debug: false }, hero: { uhp: 0 } });
    grantIntrinsicProperty('coldResistance', 'outside');
    assert.ok((await enlightenmentText(true, true)).includes('You were cold resistant.'));
});
void test('ordinary enlightenment conceals characteristics hidden by cursed equipment', async () => {
    freshGameplayRoom({ flags: { debug: false } });
    const cap = await addInventoryObject(DUNCE_CAP, { cursed: true });
    await wearHeroArmor(cap);
    const lines = await enlightenmentText(true, false, false);
    assert.ok(lines.includes('Your intelligence is 6.'));
});
void test('a single energy point uses the one-out-of-one wording', async () => {
    freshGameplayRoom({ energy: 1 });
    assert.ok((await enlightenmentText(true)).includes('You have 1 out of 1 energy points (spell power).'));
});
void test('unrestricted autopickup reports all types without thrown-item wording', async () => {
    freshGameplayRoom({ flags: { pickup: true, pickup_types: '', pickup_thrown: true } });
    assert.ok((await enlightenmentText(true)).includes('Autopickup is on for all types.'));
});
void test('the Eyes of the Overworld explain why intrinsic blindness is blocked', async () => {
    freshGameplayRoom({ flags: { debug: true }, hero: { permaBlind: true } });
    const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
    eyes.owornmask = W_TOOL;
    game.ublindf = eyes;
    game.u.ublindf = eyes;
    assert.ok((await enlightenmentText()).includes('You can see because of the Eyes of the Overworld.'));
});
void test('a cornuthaum explains blocked clairvoyance', async () => {
    freshGameplayRoom({ role: 'barbarian', flags: { debug: true } });
    setPropertyTimeout('clairvoyant', 10);
    await wearHeroArmor(await addInventoryObject(CORNUTHAUM));
    assert.ok((await enlightenmentText()).includes('You could be clairvoyant if not for your cornuthaum.'));
});
void test('cream accounts for blindness only when its duration is the whole timed effect', async () => {
    freshGameplayRoom({ flags: { debug: true }, hero: { ucreamed: 12, blindTurns: 12 } });
    let lines = await enlightenmentText();
    assert.ok(lines.some(line => line.includes('blind (12)due to goop covering your face.')));
    game.u.blindTurns = 20;
    lines = await enlightenmentText();
    assert.ok(!lines.some(line => line.includes('goop covering')));
});
void test('quitting alive reports survival in the final attributes', async () => {
    freshGameplayRoom({ flags: { disclose: '-i +a -v -g -c -o', bones: false } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const screens = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            assert.ok(screens.length < 12, 'quitting did not finish disclosure');
            screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
            return 32;
        },
    };
    await finishOrdinaryQuit();
    assert.ok(screens.some(screen => screen.includes('You survived.')));
    assert.ok(!screens.some(screen => screen.includes('You are dead.')));
});
void test('a flying mount supplies latent flight while the hero levitates', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    game.u.usteed = await createSaddledSteed('ki-rin');
    setPropertyTimeout('levitation', 10);
    assert.ok((await enlightenmentText()).includes("You would fly if you weren't levitating."));
});
void test('water walking is not a capability on the Plane of Water', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    grantIntrinsicProperty('waterWalking', 'outside');
    assert.ok((await enlightenmentText()).includes('You can walk on water intrinsically.'));
    game.water_level = { dnum: 0, dlevel: 1, alignment: null, flags: { town: false } };
    assert.ok(!(await enlightenmentText()).some(line => line.includes('walk on water')));
});
void test('a wet towel reports reduced poison gas damage', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    const towel = await addInventoryObject(TOWEL, { spe: 3, owornmask: W_TOOL });
    game.ublindf = towel;
    game.u.ublindf = towel;
    assert.ok((await enlightenmentText()).includes('You take reduced poison gas damage.'));
});
void test('very-fast form bits use the native unknown-cause fallback', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    grantIntrinsicProperty('fast', 'form');
    assert.ok((await enlightenmentText()).includes('You are very fast because of something.'));
});
void test('permanent intrinsic deafness participates in the shared deafness predicate', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    grantIntrinsicProperty('deaf', 'outside');
    assert.ok((await enlightenmentText()).includes('You are deaf intrinsically.'));
});
void test('being in water is underwater for the pinned native rules', async () => {
    freshGameplayRoom({ flags: { debug: true }, hero: { uinwater: true } });
    grantIntrinsicProperty('swimming', 'outside');
    const lines = await enlightenmentText();
    assert.ok(lines.includes('You are underwater.'));
    assert.ok(lines.includes('You can swim intrinsically.'));
});
void test('a blindfold accounts for external blindness while cream is also present', async () => {
    freshGameplayRoom({ flags: { debug: true }, hero: { ucreamed: 12, blindTurns: 12 } });
    const blindfold = await addInventoryObject(BLINDFOLD, { owornmask: W_TOOL });
    game.ublindf = blindfold;
    game.u.ublindf = blindfold;
    assert.ok((await enlightenmentText()).includes('You are temporarily blind because of your blindfold.'));
});
void test('autopickup includes thrown objects by default and honors an explicit opt-out', async () => {
    for (const disabled of [false, true]) {
        freshGameplayRoom({ flags: { pickup: true, pickup_types: '$' } });
        if (disabled)
            game.flags.pickup_thrown = false;
        const lines = await enlightenmentText(true);
        assert.ok(lines.includes(disabled
            ? "Autopickup is on for '$'." : "Autopickup is on for '$' plus thrown."));
    }
});
//# sourceMappingURL=enlightenment_provenance.test.js.map