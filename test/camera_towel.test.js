import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_FURNITURE, M_AP_OBJECT, NO_MINVENT, STONE, W_WEP } from '../js/const.js';
import { useCamera } from '../js/camera.js';
import { inventoryItemDescription } from '../js/invent.js';
import { objectName } from '../js/objnam.js';
import { useTowel } from '../js/towel.js';
import { flashHitsMonster } from '../js/flash.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { lightDamage } from '../js/light.js';
import { EXPENSIVE_CAMERA, TOWEL, BLINDFOLD, LENSES, TWO_HANDED_SWORD, LEATHER_GLOVES, BOULDER, WAN_LIGHT, } from '../js/object_data.js';
import { seeMonsterCloseup } from '../js/monster_observation.js';
import { heroIsBlind, setHeroBlindnessTurns } from '../js/senses.js';
import { flashBurn } from '../js/sight_change.js';
import { wearEyewear } from '../js/eyewear.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { initRng } from '../js/rng.js';
import { canSeeMonster, flushPendingTopline, newsym } from '../js/display.js';
import { vision_recalc } from '../js/vision.js';
import { makedog } from '../js/u_init.js';
import { saveGame, restoreGame } from '../js/save.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { beginHeroEngulf } from '../js/hero_engulf.js';
import { MONSTER_ATTACKS } from '../js/monster_data.js';
import { AT_ENGL } from '../js/monster_attack_types.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, artifactObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createStaffedShop } from './support/shop.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function camera(properties = {}) {
    return addInventoryObject(EXPENSIVE_CAMERA, { spe: 3, ...properties });
}
async function towel(properties = {}) {
    return addInventoryObject(TOWEL, { spe: 0, ...properties });
}
async function aim(object, keys = 'l') {
    resetInputState().feed(keys);
    return useCamera(object);
}
void test('a camera refuses underwater without a charge or direction prompt', async () => {
    freshObjectRoom({ hero: { uinwater: 1 } });
    requirePlayingGame(game);
    const object = await camera();
    const result = await useCamera(object);
    assert.equal(result.spentTime, false);
    assert.equal(object.spe, 3);
    assert.match(game._pending_message, /void the warranty/);
});
void test('cancelling the camera direction preserves charges and time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await camera();
    assert.equal((await aim(object, '\x1b')).spentTime, false);
    assert.equal(object.spe, 3);
});
void test('an exhausted camera still asks a direction and spends time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await camera({ spe: 0 });
    assert.equal((await aim(object)).spentTime, true);
    assert.equal(object.spe, 0);
    assert.match(game._pending_message, /Nothing happens/);
});
for (const [key, surface] of [
    ['>', 'floor'],
    ['<', 'ceiling'],
]) {
    void test(`photographing the ${surface} consumes one charge`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const object = await camera();
        await aim(object, key);
        assert.equal(object.spe, 2);
        assert.match(game._pending_message, new RegExp(`picture of the ${surface}`));
        assert.equal(heroIsBlind(), false);
    });
}
void test('a self photograph blinds the hero without injuring a human body', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await camera();
    const hp = game.u.uhp;
    await aim(object, '.');
    assert.equal(object.spe, 2);
    assert.equal(game.u.uhp, hp);
    assert.ok((game.u.blindTurns ?? 0) >= 6 && (game.u.blindTurns ?? 0) <= 30);
    assert.equal(heroIsBlind(), true);
    assert.match(game._pending_message, /blinded by the flash/);
});
void test('an already blind hero resists self-flash without extending blindness', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    setHeroBlindnessTurns(42);
    await aim(await camera(), '.');
    assert.equal(game.u.blindTurns, 42);
});
void test('a cursed camera can flash the user despite aiming at a monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('dog', 12, 10, NO_MINVENT);
    target.msleeping = 1;
    const object = await camera({ cursed: true });
    initRng(5n); // Native cursed rn2(2) takes the self-flash branch.
    await aim(object);
    assert.equal(heroIsBlind(), true);
    assert.equal(target.msleeping, 1);
    assert.equal(object.spe, 2);
});
void test('the first flash wakes an eyed sleeping target without blinding it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('dog', 12, 10, NO_MINVENT);
    target.msleeping = 1;
    target.mpeaceful = 1;
    await aim(await camera());
    assert.equal(target.msleeping, 0);
    assert.equal(target.mcansee, 1);
    assert.equal(target.mpeaceful, 1);
    assert.match(game._pending_message, /flash awakens the dog/);
    assert.equal(requireMonsterVital(target.mnum).photographed, 1);
});
void test('a point-blank flash can permanently blind a waking hostile creature', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('dog', 11, 10, NO_MINVENT);
    target.msleeping = 0;
    target.mpeaceful = 0;
    await aim(await camera(), 'l '); // Flee feedback can require More after the blindness line.
    assert.equal(target.mcansee, 0);
    assert.equal(target.mblinded, 0);
});
void test('a distant flash causes bounded temporary blindness without fear', async () => {
    freshObjectRoom({ right: 22 });
    requirePlayingGame(game);
    const target = await createMonsterAt('dog', 16, 10, NO_MINVENT);
    target.msleeping = 0;
    target.mpeaceful = 0;
    await aim(await camera());
    assert.equal(target.mcansee, 0);
    assert.ok((target.mblinded ?? 0) >= 1 && (target.mblinded ?? 0) <= 2);
    assert.ok(!target.mflee);
});
void test('the camera beam stops at a closed terrain cell', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('dog', 14, 10, NO_MINVENT);
    target.msleeping = 1;
    requireGameLevel().requireAt(12, 10).typ = STONE;
    await aim(await camera());
    assert.equal(target.msleeping, 1);
    assert.equal(requireMonsterVital(target.mnum).photographed, undefined);
});
void test('flash passes through an invisible creature and reaches the visible one behind', async () => {
    freshObjectRoom({ right: 22 });
    requirePlayingGame(game);
    const hidden = await createMonsterAt('dog', 12, 10, NO_MINVENT);
    const target = await createMonsterAt('kitten', 14, 10, NO_MINVENT);
    hidden.minvis = 1;
    hidden.msleeping = target.msleeping = 1;
    await aim(await camera());
    assert.equal(hidden.msleeping, 0);
    assert.equal(target.msleeping, 0);
    assert.equal(requireMonsterVital(hidden.mnum).photographed, undefined);
    assert.equal(requireMonsterVital(target.mnum).photographed, 1);
});
void test('eyeless creatures resist the flash and keep their sight state', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const target = await createMonsterAt('acid blob', 12, 10, NO_MINVENT);
    target.msleeping = 0;
    target.mcansee = 1;
    await aim(await camera());
    assert.equal(target.mcansee, 1);
    assert.match(game._pending_message, /flash of light shines on the acid blob/);
});
void test('a camera temporarily illuminates a dark target then remembers its location', async () => {
    freshObjectRoom({ right: 22 });
    requirePlayingGame(game);
    const target = await createMonsterAt('dog', 16, 10, NO_MINVENT);
    for (let x = 7; x <= 22; x++)
        for (let y = 6; y <= 14; y++)
            requireGameLevel().requireAt(x, y).lit = false;
    vision_recalc(0);
    assert.equal(canSeeMonster(target), false);
    target.msleeping = 1;
    await aim(await camera(), 'l '); // Native dark flash prose is acknowledged before light cleanup.
    assert.equal(target.msleeping, 0);
    assert.equal(requireMonsterVital(target.mnum).photographed, 1);
    assert.equal(canSeeMonster(target), false);
    assert.equal(requireGameLevel().requireAt(16, 10).lit, false);
    assert.equal(requireGameLevel().requireAt(16, 10).remembered_glyph?.kind, 'invisible');
});
void test('a Tourist earns experience for the first photo of a species only', async () => {
    freshObjectRoom({ role: 'tourist', hero: { ulevel: 1, uexp: 0, urexp: 0 } });
    requirePlayingGame(game);
    await createMonsterAt('lichen', 13, 10, NO_MINVENT);
    const object = await camera();
    await aim(object);
    const experience = game.u.uexp;
    assert.ok(experience > 0);
    await aim(object, 'l ');
    assert.equal(game.u.uexp, experience);
    assert.ok(game.context.lifelist);
    assert.equal(game.context.lifelist.total_photographed, 1);
});
void test('photographing the starting pet awards no Tourist experience', async () => {
    freshObjectRoom({ role: 'tourist', hero: { uexp: 0 } });
    requirePlayingGame(game);
    const pet = await createMonsterAt('kitten', 13, 10, NO_MINVENT);
    pet.msleeping = 1;
    game.context.startingpet_mid = pet.m_id;
    game.context.startingpet_typ = pet.mnum;
    await aim(await camera());
    assert.equal(game.u.uexp, 0);
    assert.ok(pet);
    assert.equal(requireMonsterVital(pet.mnum).photographed, 1);
});
void test('hallucination prevents closeup and photographic records', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    requirePlayingGame(game);
    const target = await createMonsterAt('lichen', 13, 10, NO_MINVENT);
    await seeMonsterCloseup(target, { photo: true });
    assert.equal(requireMonsterVital(target.mnum).seen_close, undefined);
    assert.equal(requireMonsterVital(target.mnum).photographed, undefined);
});
void test('a flash does not blind a worm when only the tail is struck', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('long worm', 13, 10, NO_MINVENT);
    const object = await camera();
    object.ox = 10;
    object.oy = 10;
    await flashHitsMonster(target, object, { onHead: false });
    assert.equal(target.mcansee, 1);
});
void test('camera light hurts a gremlin body and returns unreduced blindness duration', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('gremlin', { halfPhysicalDamage: true, hitPoints: 40 });
    const amount = await lightDamage(await camera(), true, 5);
    assert.ok(amount >= 1 && amount <= 5);
    assert.equal(game.u.mh, 40 - Math.trunc((amount + 1) / 2));
});
void test('the Eyes block blindness while retaining the underlying flash timeout', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const eyes = await artifactObject('The Eyes of the Overworld');
    await wearEyewear(eyes);
    resetInputState().feed(' ');
    await flashBurn(20);
    assert.equal(game.u.blindTurns, 20);
    assert.equal(heroIsBlind(), false);
});
void test('a clean towel takes no time and remains wet', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await towel({ spe: 4 });
    assert.equal((await useTowel(object)).spentTime, false);
    assert.equal(object.spe, 4);
    assert.match(game._pending_message, /face and hands are already clean/);
});
void test('a wielded wet towel removes slippery hands and dries one step', async () => {
    freshObjectRoom({ hero: { glibTurns: 12, glib: true } });
    requirePlayingGame(game);
    const object = await towel({ spe: 1 });
    await setPrimaryWeapon(object);
    resetInputState().feed(' ');
    assert.equal((await useTowel(object)).spentTime, true);
    assert.equal(game.u.glibTurns, 0);
    assert.equal(game.u.glib, false);
    assert.equal(object.spe, 0);
    assert.equal(game._unweapon, true);
    assert.match(game._pending_message, /moist towel dries out/);
});
for (const cursed of [false, true]) {
    void test(`applying a wielded dry ${cursed ? 'cursed ' : ''}towel does not announce drying`, async () => {
        freshObjectRoom({ hero: { glibTurns: 8, glib: true } });
        requirePlayingGame(game);
        const object = await towel({ cursed });
        await setPrimaryWeapon(object);
        const input = resetInputState();
        installPagerInput(input, { expected: /towel|hands/, limit: 5 });
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        initRng(4n); // The cursed towel makes already slippery hands filthier.
        await applyInventoryObject(object);
        await flushPendingTopline();
        assert.equal(game.context.move, 1);
        assert.equal(object.spe, 0);
        if (cursed) {
            assert.ok((game.u.glibTurns ?? 0) > 8);
            assert.match(messages.join('\n'), /Your hands are filthier than ever!/);
        }
        else {
            assert.equal(game.u.glibTurns, 0);
            assert.match(messages.join('\n'), /You wipe off your hands\./);
        }
        assert.doesNotMatch(messages.join('\n'), /towel dries/);
    });
}
void test('cleaning hands leaves face grime for a second towel application', async () => {
    freshObjectRoom({ hero: { glibTurns: 8, ucreamed: 6 } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(6);
    const object = await towel();
    await useTowel(object);
    assert.equal(game.u.ucreamed, 6);
    assert.equal(game.u.blindTurns, 6);
    resetInputState().feed(' ');
    await useTowel(object);
    assert.equal(game.u.ucreamed, 0);
    assert.equal(heroIsBlind(), false);
});
void test('removing face grime preserves blindness from another cause', async () => {
    freshObjectRoom({ hero: { ucreamed: 6 } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(30);
    await useTowel(await towel());
    assert.equal(game.u.ucreamed, 0);
    assert.equal(game.u.blindTurns, 24);
    assert.match(game._pending_message, /face feels clean now/);
});
void test('a towel being worn cannot clean the hero', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    const object = await towel();
    await wearEyewear(object);
    resetInputState().feed(' ');
    assert.equal((await useTowel(object)).spentTime, false);
    assert.equal(game.u.glibTurns, 8);
});
void test('a welded two-handed weapon prevents towel use', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    const weapon = await addInventoryObject(TWO_HANDED_SWORD, { cursed: true });
    await setPrimaryWeapon(weapon);
    assert.equal((await useTowel(await towel())).spentTime, false);
    assert.equal(game.u.glibTurns, 8);
    assert.match(game._pending_message, /no free hand/);
});
void test('a cursed towel can make already slippery hands filthier', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    const object = await towel({ cursed: true, spe: 3 });
    initRng(4n); // Native rn2(3) selects slippery hands.
    await useTowel(object);
    assert.ok((game.u.glibTurns ?? 0) >= 11 && (game.u.glibTurns ?? 0) <= 20);
    assert.equal(object.spe, 2);
    assert.match(game._pending_message, /filthier than ever/);
});
void test('a cursed towel can add face grime and blindness', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await towel({ cursed: true });
    initRng(2n); // Native rn2(3) selects face or eyewear.
    resetInputState().feed(' ');
    await useTowel(object);
    assert.ok((game.u.ucreamed ?? 0) >= 3 && (game.u.ucreamed ?? 0) <= 12);
    assert.equal(game.u.blindTurns, game.u.ucreamed);
    assert.equal(heroIsBlind(), true);
});
void test('a cursed towel can fall through to normal cleaning', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    const object = await towel({ cursed: true });
    initRng(1n); // Native rn2(3) selects ordinary cleaning.
    await useTowel(object);
    assert.equal(game.u.glibTurns, 0);
});
for (const [type, name] of [
    [BLINDFOLD, 'blindfold'],
    [LENSES, 'lenses'],
    [TOWEL, 'other towel'],
]) {
    void test(`a cursed towel pushes uncursed ${name} off and onto the floor`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const worn = await addInventoryObject(type);
        await wearEyewear(worn);
        const object = await towel({ cursed: true });
        initRng(2n);
        resetInputState().feed(' '); // Removal can announce regained sight.
        const result = await useTowel(object);
        assert.equal(result.spentTime, true);
        assert.equal(game.ublindf, null);
        assert.equal(game.inventory.includes(worn), false);
        assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(worn), true);
        assert.equal(worn.owornmask, 0);
    });
}
void test('a cursed towel only skews cursed eyewear and leaves it worn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const worn = await addInventoryObject(LENSES, { cursed: true });
    await wearEyewear(worn);
    const object = await towel({ cursed: true });
    initRng(2n);
    await useTowel(object);
    assert.equal(game.ublindf, worn);
    assert.equal(worn.where, 'inventory');
    assert.match(game._pending_message, /lenses (cock-eyed|crooked)/);
});
void test('gloved hands use the glove name when cleaning grease', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    game.uarmg = await addInventoryObject(LEATHER_GLOVES);
    await useTowel(await towel());
    assert.match(game._pending_message, /wipe off your gloves/);
    assert.equal(game.u.glibTurns, 0);
});
void test('public apply uses a camera charge and a clean towel takes no turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const object = await camera();
    await applyInventoryObject(object, '>');
    assert.equal(game.context.move, 1);
    assert.equal(object.spe, 2);
    const cloth = await towel();
    await applyInventoryObject(cloth, ' ');
    assert.equal(game.context.move, 0);
});
void test('a non-self cursed photograph can still awaken a monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('dog', 12, 10, NO_MINVENT);
    target.msleeping = 1;
    const object = await camera({ cursed: true });
    initRng(1n); // Native cursed rn2(2) permits the aimed flash.
    await aim(object);
    assert.equal(target.msleeping, 0);
    assert.equal(heroIsBlind(), false);
});
void test('a photograph from inside a monster records the stomach instead of flashing it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const holder = await createMonsterAt('purple worm', 11, 10, NO_MINVENT);
    resetInputState().feed(' '); // Native engulf announcement precedes the swallowed screen.
    game.u.ustuck = holder; // Native attack admission establishes the holder before gulpmu.
    const engulf = MONSTER_ATTACKS[holder.mnum]?.find((attack) => attack[0] === AT_ENGL);
    assert.ok(engulf);
    const attack = {
        kind: 'hero-attack',
        attackType: AT_ENGL,
        hit: true,
        damageType: engulf[1],
        engulfOldX: holder.mx,
        engulfOldY: holder.my,
    };
    placeMonsterAt(holder, game.u.ux, game.u.uy);
    assert.equal((await beginHeroEngulf(holder, attack)).captured, true);
    const object = await camera();
    await aim(object, '>');
    assert.match(game._pending_message, /picture of the purple worm's stomach/);
    assert.equal(object.spe, 2);
    assert.equal(heroIsBlind(), false);
});
void test('object-disguised mimics do not stop the light beam', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 12, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = BOULDER;
    const target = await createMonsterAt('dog', 14, 10, NO_MINVENT);
    target.msleeping = 1;
    await aim(await camera());
    assert.equal(target.msleeping, 0);
    assert.equal(mimic.m_ap_type, M_AP_OBJECT);
    assert.equal(requireMonsterVital(mimic.mnum).photographed, undefined);
});
void test('a furniture-disguised mimic is exposed by the flash', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 12, 10, NO_MINVENT);
    mimic.m_ap_type = M_AP_FURNITURE;
    mimic.mappearance = 15; // Native closed-door appearance.
    mimic.msleeping = 0;
    mimic.mpeaceful = 0;
    newsym(12, 10);
    await aim(await camera(), 'l  '); // Reveal, blindness, and fear can cross two native prose boundaries.
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(mimic.mcansee, 1); // Eyeless mimics resist flash blindness.
    assert.equal(requireMonsterVital(mimic.mnum).photographed, 1);
});
void test('light creatures do not become blind from a photograph', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('yellow light', 12, 10, NO_MINVENT);
    target.msleeping = 0;
    await aim(await camera());
    assert.equal(target.mcansee, 1);
    assert.equal(target.mblinded || 0, 0);
});
void test('Sunsword protects a monster from camera blindness', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const target = await createMonsterAt('elf', 12, 10, NO_MINVENT);
    target.msleeping = 0;
    await equipMonsterObject(target, await artifactObject('Sunsword'), W_WEP);
    await aim(await camera());
    assert.equal(target.mcansee, 1);
    assert.match(game._pending_message, /flash of light shines on/);
});
void test('Sunsword protects the hero from self-flash and gives observable resistance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await setPrimaryWeapon(await artifactObject('Sunsword'));
    const observed = await flashBurn(27);
    assert.equal(observed, true);
    assert.equal(heroIsBlind(), false);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(await flashBurn(27, true), false);
});
void test('light can destroy a gremlin through the ordinary kill owner', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('gremlin', 12, 10, NO_MINVENT);
    target.mhp = 1;
    target.msleeping = 0;
    const object = await camera();
    object.ox = 10;
    object.oy = 10;
    resetInputState().feed('  '); // Blindness, pain, and kill announcements can own two More boundaries.
    const result = await flashHitsMonster(target, object);
    assert.equal(result.heroDied, false);
    assert.ok(target.mhp <= 0);
    assert.equal(requireGameLevel().monsters.includes(target), false);
    assert.ok(game.u.uexp > 0);
});
void test('wand light also owns real gremlin damage through the shared flash effect', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const target = await createMonsterAt('gremlin', 14, 10, NO_MINVENT);
    target.mhp = 50;
    target.msleeping = 0;
    target.mpeaceful = 0;
    const source = await addInventoryObject(WAN_LIGHT, { spe: 2, ox: 10, oy: 10 });
    resetInputState().feed(' '); // Pain follows the blindness announcement.
    await flashHitsMonster(target, source);
    assert.ok(target.mhp >= 38 && target.mhp <= 47);
    assert.equal(target.mcansee, 0);
});
void test('self-flash can rehumanize a gremlin without injuring the restored body', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const hp = game.u.uhp;
    installPolymorphedHero('gremlin', { hitPoints: 1 });
    const object = await camera();
    resetInputState().feed('.  '); // Pain, rehumanization, and flash blindness each publish normally.
    const result = await useCamera(object);
    assert.equal(result.heroDied, false);
    assert.equal(game.u.mtimedone, 0);
    assert.equal(game.u.uhp, hp);
    assert.equal(heroIsBlind(), true);
});
void test('a Tourist starting pet is recorded as photographed at actual creation', async () => {
    freshObjectRoom({ role: 'tourist', hero: { ulevel: 1, uexp: 0 } });
    requirePlayingGame(game);
    await camera();
    const pet = await makedog();
    assert.ok(pet);
    assert.equal(game.context.startingpet_mid, pet.m_id);
    assert.equal(game.context.startingpet_typ, pet.mnum);
    assert.ok(pet);
    assert.equal(requireMonsterVital(pet.mnum).photographed, 1);
    assert.ok(game.context.lifelist);
    assert.equal(game.context.lifelist.total_photographed, 1);
    assert.equal(game.u.uexp, 0);
});
void test('photographic discovery survives save and restore', async () => {
    freshObjectRoom({ role: 'tourist' });
    requirePlayingGame(game);
    const target = await createMonsterAt('lichen', 13, 10, NO_MINVENT);
    await aim(await camera());
    const storage = memoryStorage();
    game.plname = 'Photographer';
    await saveGame(storage);
    game.mvitals = [];
    restoreGame('Photographer', storage);
    assert.equal(requireMonsterVital(target.mnum).photographed, 1);
    assert.ok(game.context.lifelist);
    assert.equal(game.context.lifelist.total_photographed, 1);
});
void test('a charged unpaid camera adds real shop usage debt before taking its picture', async () => {
    freshObjectRoom({ hero: { deafTurns: 20 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const object = await floorObject(EXPENSIVE_CAMERA, 10, 10, { spe: 3 });
    const { rhack } = await import('../js/cmd.js');
    resetInputState().feed(' '); // Pickup records the actual unpaid ownership.
    await rhack(','.charCodeAt(0));
    assert.equal(object.unpaid, true);
    const bill = shopkeeper.eshk.bill.find((entry) => entry.bo_id === object.o_id);
    await aim(object, ' >'); // Acknowledge the pickup message before aiming.
    assert.ok(shopkeeper.eshk.debit > 0);
    assert.equal(object.spe, 2);
    assert.ok(bill);
    assert.equal(bill.useup, false);
    assert.equal(game.inventory.includes(object), true);
});
void test('a towel does not strip grease from the gloves while cleaning slippery hands', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    game.uarmg = await addInventoryObject(LEATHER_GLOVES, { greased: true });
    await useTowel(await towel());
    assert.equal(game.u.glibTurns, 0);
    assert.equal(game.uarmg.greased, true);
});
void test('a polymorphed hero cleans the current face and hands', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    installPolymorphedHero('dog');
    await useTowel(await towel());
    assert.match(game._pending_message, /wipe off your paws/);
    assert.equal(game.u.glibTurns, 0);
});
void test('cleaning grime inside a dust vortex immediately exposes the eyes again', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const holder = await createMonsterAt('dust vortex', 11, 10, NO_MINVENT);
    resetInputState().feed(' ');
    game.u.ustuck = holder; // Native attack admission establishes the holder before gulpmu.
    const engulf = MONSTER_ATTACKS[holder.mnum]?.find((attack) => attack[0] === AT_ENGL);
    assert.ok(engulf);
    const attack = {
        kind: 'hero-attack',
        attackType: AT_ENGL,
        hit: true,
        damageType: engulf[1],
        engulfOldX: holder.mx,
        engulfOldY: holder.my,
    };
    placeMonsterAt(holder, game.u.ux, game.u.uy);
    assert.equal((await beginHeroEngulf(holder, attack)).captured, true);
    game.u.ucreamed = 6;
    setHeroBlindnessTurns(6);
    const timer = game.u.uswldtim;
    resetInputState().feed(' '); // Glop removal precedes fresh engulf blindness.
    await useTowel(await towel());
    assert.equal(game.u.ucreamed, 0);
    assert.equal(heroIsBlind(), true);
    assert.equal(game.u.uswldtim, timer);
});
void test('an unchanging gremlin dies from self-flash through the ordinary hero-death owner', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('gremlin', { hitPoints: 1, unchanging: true });
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    const object = await camera();
    resetInputState().feed('.    '); // Pain, death, summary, and the native blank death page each own More.
    const result = await useCamera(object);
    assert.equal(result.heroDied, true);
    assert.equal(game.program_state.gameover, true);
    assert.equal(object.spe, 2);
    assert.equal(game.u.umortality, 1);
});
void test('using a wet towel updates the visible wetness name without changing weight', async () => {
    freshObjectRoom({ hero: { glibTurns: 8 } });
    requirePlayingGame(game);
    const object = await towel({ spe: 3 });
    const weight = object.owt;
    assert.match(inventoryItemDescription(object), /wet towel/);
    await useTowel(object);
    assert.equal(object.spe, 2);
    assert.match(inventoryItemDescription(object), /moist towel/);
    assert.equal(object.owt, weight);
});
void test('wizard towel names expose the remaining wetness', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const object = await towel({ spe: 4 });
    assert.equal(objectName(object), 'wet towel (4)');
});
//# sourceMappingURL=camera_towel.test.js.map