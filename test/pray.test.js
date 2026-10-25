import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { angryGodMaximum } from '../js/divine_wrath.js';
import { finishHeroHelplessness, moveloop_core } from '../js/allmain.js';
import { A_NONE, ALTAR, Align2amask, LAVAPOOL, PARANOID_PRAY, ROOM, STONE, TT_LAVA, W_NONPASSWALL, W_TOOL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { artifactById, artifactByName, initializeArtifacts, nameArtifact } from '../js/artifacts.js';
import { grantPrayerFavor } from '../js/divine_gifts.js';
import { magicNegation } from '../js/magic_negation.js';
import { game, requireGameDisplay, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { pushKey, resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, BLINDFOLD, BOULDER, CORPSE, DAGGER, FIGURINE, GAUNTLETS_OF_FUMBLING, LEATHER_GLOVES, LOADSTONE, LONG_SWORD, LUCKSTONE, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { startHeroPetrification } from '../js/stoning.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { createHarmlessGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createMonsterAt } from './support/monsters.js';
import { answerPrompts } from './support/input-boundaries.js';
import { objectTimers } from '../js/object_timers.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initializePet } from '../js/dog.js';
import { saveMonsterTraits } from '../js/monster_traits.js';
import { installSwallowedHero } from './support/hero-state.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { syncBlindness } from '../js/senses.js';
import { beginObjectBurn, objectLightRadius } from '../js/light.js';
import { fullyIdentifyObject } from '../js/invent.js';
function prayerRoom({ hero = {}, flags = {}, ...room } = {}) {
    freshObjectRoom({
        ...room,
        flags: { paranoia_bits: PARANOID_PRAY, ...flags },
        hero: { ublesscnt: 0, uluck: 0, ugangr: 0,
            ualign: { type: 0, record: 10 }, ...hero },
    });
    requirePlayingGame(game);
}
async function resolvePrayer(answers = 'y\x1b') {
    await runExtendedCommand('pray', answers);
    await finishHeroHelplessness();
}
async function prayAndReadMessages() {
    const input = resetInputState();
    const prayer = runExtendedCommand('pray', 'y').then(() => finishHeroHelplessness());
    const messages = [];
    try {
        for (;;) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), prayer.then(() => false),
            ]);
            if (!blocked)
                break;
            assert.ok(messages.length < 30, 'prayer did not finish its message pages');
            messages.push(requireGameDisplay().grid.slice(0, 3)
                .map(row => row.map(cell => cell.ch).join('')).join('\n'));
            input.feed(' ');
        }
        messages.push(game._pending_message);
    }
    finally {
        input.feed('\x1b');
        await prayer;
    }
    return messages;
}
void test('a successful ordinary prayer protects an injured hero while praying', async () => {
    freshObjectRoom({
        flags: { paranoia_bits: PARANOID_PRAY },
        hero: { uhp: 1, uhpmax: 20, ulevel: 1, ublesscnt: 0,
            uluck: 0, ugangr: 0, ualign: { type: 0, record: 10 } },
    });
    requirePlayingGame(game);
    await runExtendedCommand('pray', 'y\x1b');
    assert.equal(game.u.invulnerable, true);
    assert.equal(game.context.move, 1);
});
void test('ordinary prayer heals after three world turns and then releases protection', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = 1;
    game.u.uhpmax = 20;
    game.u.ualign.record = 10;
    const start = game.moves;
    const nutrition = game.u.uhunger;
    input.feed('#pray\ny\x1b');
    await moveloop_core();
    await moveloop_core();
    await moveloop_core();
    input.feed(27);
    await moveloop_core();
    assert.equal(game.moves - start, 3);
    assert.equal(game.u.uhp, game.u.uhpmax);
    assert.equal(game.u.invulnerable, false);
    assert.equal(game.u.uhunger, nutrition);
    assert.ok(game.u.ublesscnt > 0);
});
void test('a modest prayer cures petrification before hunger', async () => {
    prayerRoom({ hero: { uhunger: 10, ualign: { type: 0, record: 1 } } });
    requirePlayingGame(game);
    startHeroPetrification({ turns: 5 });
    await resolvePrayer();
    assert.equal(game.u.stonedTurns, 0);
    assert.equal(game.u.uhunger, 10);
});
void test('#pray names the whole stack when releasing cursed loadstones', async () => {
    prayerRoom({ hero: { uluck: 10 } });
    requirePlayingGame(game);
    const stones = await addInventoryObject(LOADSTONE, { cursed: true, quan: 2, quantity: 2 });
    initRng(1n);
    installPagerInput(resetInputState(), {
        expected: /pray|prayer|shimmering light|pleased|loadstones/, limit: 6,
    });
    await runExtendedCommand('pray', 'y');
    await finishHeroHelplessness();
    assert.equal(stones.cursed, false);
    assert.match(game._pending_message, /Your 2 loadstones softly glow amber\./);
});
void test('#pray rescues a hero whose only exit requires a forbidden diagonal boulder push', async () => {
    prayerRoom({ left: 10, right: 10, top: 10, bottom: 10, hero: { ualign: { type: 0, record: 1 } } });
    requirePlayingGame(game);
    game.level.flags.sokoban_rules = true;
    game.level.requireAt(11, 11).typ = ROOM;
    game.level.requireAt(12, 12).typ = ROOM;
    await floorObject(BOULDER, 11, 11);
    await resolvePrayer();
    assert.ok(game.u.ux !== 10 || game.u.uy !== 10, 'the diagonal boulder leaves no pushable exit');
});
void test('#pray restores the carried luck bonus when it uncurses a luckstone', async () => {
    prayerRoom({ hero: { uluck: 10 } });
    requirePlayingGame(game);
    const stone = await addInventoryObject(LUCKSTONE, { cursed: true });
    assert.equal(game.u.moreluck, -3);
    initRng(2n);
    await resolvePrayer();
    assert.equal(stone.cursed, false);
    assert.equal(game.u.moreluck, 3);
});
void test('#pray announces the safe ground reached after rescuing a hero from lava', async () => {
    prayerRoom({ hero: { utrap: 5, utraptype: TT_LAVA, ualign: { type: 0, record: 1 } } });
    requirePlayingGame(game);
    game.level.requireAt(10, 10).typ = LAVAPOOL;
    grantIntrinsicProperty('fireResistance', 'outside');
    installPagerInput(resetInputState(), {
        expected: /pray|prayer|shimmering light|satisfied|solid ground/, limit: 6,
    });
    await runExtendedCommand('pray', 'y');
    await finishHeroHelplessness();
    assert.equal(game.u.utrap, 0);
    assert.match(game._pending_message, /You find yourself on solid ground\./);
});
void test('Moloch\'s laughter during #pray visibly wakes a nearby sleeping monster', async () => {
    prayerRoom();
    requirePlayingGame(game);
    const altar = game.level.requireAt(10, 10);
    altar.typ = ALTAR;
    altar.flags = Align2amask(A_NONE);
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.msleeping = 1;
    const input = resetInputState();
    await runExtendedCommand('pray', 'y');
    await answerPrompts(finishHeroHelplessness(), input, [
        { prompt: /You finish your prayer\.[\s\S]*--More--/, keys: ' ' },
        { prompt: /The goblin wakes up\.[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(goblin.msleeping, 0);
});
void test('#pray stops a cursed figurine\'s transformation when granting an inventory cleansing', async () => {
    prayerRoom({ hero: { uluck: 10, ualign: { type: 0, record: 20 } } });
    requirePlayingGame(game);
    const figurine = await addInventoryObject(FIGURINE, {
        cursed: true, corpsenm: MONSTER_NAME.indexOf('wumpus'),
    });
    await addInventoryObject(LUCKSTONE);
    assert.equal(objectTimers(figurine).length, 1);
    initRng(5n);
    await resolvePrayer();
    assert.equal(figurine.cursed, false);
    assert.equal(objectTimers(figurine).length, 0);
});
for (const quantity of [1, 2]) {
    void test(`#pray names the species of ${quantity} cursed corpses during inventory cleansing`, async () => {
        prayerRoom({ hero: { uluck: 10, ualign: { type: 0, record: 20 } } });
        const corpse = await addInventoryObject(CORPSE, {
            cursed: true, corpsenm: MONSTER_NAME.indexOf('newt'), quan: quantity,
        });
        await addInventoryObject(LUCKSTONE);
        initRng(5n);
        const messages = await prayAndReadMessages();
        const announcement = quantity === 1
            ? 'Your newt corpse softly glows amber.'
            : 'Your 2 newt corpses softly glow amber.';
        assert.ok(messages.some(message => message.includes(announcement)), `Expected ${announcement} in prayer messages: ${messages.join('\n')}`);
        assert.equal(corpse.cursed, false);
        assert.equal(corpse.bknown, true);
    });
}
void test('#pray omits the ownership prefix when cleansing Medusa\'s corpse', async () => {
    prayerRoom({ hero: { uluck: 10, ualign: { type: 0, record: 20 } } });
    const corpse = await addInventoryObject(CORPSE, {
        cursed: true, corpsenm: MONSTER_NAME.indexOf('Medusa'),
    });
    await addInventoryObject(LUCKSTONE);
    initRng(5n);
    const messages = await prayAndReadMessages();
    assert.match(messages.join('\n'), /(?:^|\n| {2})Medusa's corpse softly glows amber\./);
    assert.equal(corpse.cursed, false);
    assert.equal(corpse.bknown, true);
});
void test('#pray makes a former pet\'s corpse glow when reviving it on an altar', async () => {
    prayerRoom();
    requirePlayingGame(game);
    const altar = game.level.requireAt(10, 10);
    altar.typ = ALTAR;
    altar.flags = Align2amask(0);
    const pet = await createMonsterAt('little dog', 11, 10);
    initializePet(pet);
    const traits = saveMonsterTraits(pet);
    game.level.monsters = game.level.monsters.filter(monster => monster !== pet);
    const corpse = await floorObject(CORPSE, 10, 10, {
        corpsenm: pet.mnum, oextra: { omonst: traits },
    });
    const input = resetInputState();
    await runExtendedCommand('pray', 'y ');
    await answerPrompts(finishHeroHelplessness(), input, [
        { prompt: /You finish your prayer\.[\s\S]*--More--/, keys: ' ' },
        { prompt: /little dog corpse glows iridescently\.[\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(corpse.where, 'gone');
    assert.ok(game.level.monsters.some(monster => monster.mnum === pet.mnum && monster.mtame));
});
void test('altar wrath considers a carried luckstone when deciding whether to reduce luck', async () => {
    prayerRoom({ hero: { uluck: -6 } });
    requirePlayingGame(game);
    const altar = game.level.requireAt(10, 10);
    altar.typ = ALTAR;
    altar.flags = Align2amask(1);
    await addInventoryObject(LUCKSTONE);
    assert.equal(game.u.moreluck, 3);
    initRng(2n);
    await runExtendedCommand('sit', '\x1b');
    assert.ok((game.u.uluck ?? 0) < -6, 'total luck above -5 can still be reduced by altar wrath');
});
void test('divine lightning from #pray names the monster swallowing the hero', async () => {
    prayerRoom({ hero: { ugangr: 5 } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10);
    setMonsterGivenName(worm, 'Gullet');
    await installSwallowedHero(worm);
    grantIntrinsicProperty('disintegrationResistance', 'outside');
    initRng(2n);
    const messages = await prayAndReadMessages();
    const strike = messages.find(message => message.includes('It strikes'));
    assert.match(strike ?? '', /Gullet/, 'the divine bolt must name its swallowing victim');
    assert.notEqual(monsterAtPosition(game.level, worm.mx, worm.my), worm);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.ok(!game.program_state.gameover);
});
void test('#pray tells a permanently blind hero that cured deafness relieved their eyes', async () => {
    prayerRoom({ hero: { permaBlind: true, uluck: 10, ualign: { type: 0, record: 10 } } });
    requirePlayingGame(game);
    const altar = game.level.requireAt(10, 10);
    altar.typ = ALTAR;
    altar.flags = Align2amask(0);
    game.u.deafTurns = 2;
    initRng(3n);
    const messages = await prayAndReadMessages();
    assert.equal(game.u.deafTurns ?? 0, 0, 'the prayer must clear the timed deafness');
    assert.ok(messages.some(message => message.includes('Your eyes feel better and you can hear again.')), `Expected the combined eye and ear recovery in prayer messages: ${messages.join('\n')}`);
});
void test('a blind hero feels the deity\'s blessing over the weapon during #pray', async () => {
    prayerRoom({ hero: { permaBlind: true, uluck: 10, ualign: { type: 0, record: 20 } } });
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);
    await addInventoryObject(LUCKSTONE);
    initRng(9n);
    const messages = await prayAndReadMessages();
    assert.equal(dagger.blessed, true);
    assert.ok(messages.some(message => message.includes('You feel the blessing of Ishtar over your dagger.')));
});
void test('#pray names known gauntlets when curing slippery fingers before uncursing them', async () => {
    prayerRoom({ hero: { uluck: 10 } });
    requirePlayingGame(game);
    const gloves = await addInventoryObject(GAUNTLETS_OF_FUMBLING, { cursed: true });
    wearHeroArmor(gloves);
    setPropertyTimeout('glib', 10);
    initRng(1n);
    const messages = await prayAndReadMessages();
    assert.equal(game.u.glibTurns, 0);
    assert.equal(gloves.cursed, false);
    assert.ok(messages.some(message => message.includes('Your gauntlets are no longer slippery.')));
});
void test('#pray does not reveal a blindfold\'s curse when another intrinsic also prevents sight', async () => {
    prayerRoom({ hero: { ualign: { type: 0, record: 1 } } });
    requirePlayingGame(game);
    grantIntrinsicProperty('blinded', 'outside');
    const blindfold = await addInventoryObject(BLINDFOLD, { cursed: true, bknown: false });
    game.ublindf = game.u.ublindf = blindfold;
    blindfold.owornmask = W_TOOL;
    syncBlindness();
    assert.equal(blindfold.bknown, false);
    await resolvePrayer();
    assert.equal(blindfold.cursed, false);
    assert.equal(blindfold.bknown, false);
});
void test('#pray brightens a lit artifact when blessing the wielded weapon', async () => {
    prayerRoom({ hero: { uluck: 10, ualign: { type: 0, record: 20 } } });
    requirePlayingGame(game);
    initializeArtifacts();
    const sunsword = artifactByName('Sunsword');
    assert.ok(sunsword);
    const sword = await addInventoryObject(LONG_SWORD);
    assert.equal(nameArtifact(sword, sunsword), true);
    await setPrimaryWeapon(sword);
    beginObjectBurn(sword);
    assert.equal(objectLightRadius(sword), 2);
    await addInventoryObject(LUCKSTONE);
    initRng(9n);
    const messages = await prayAndReadMessages();
    assert.equal(objectLightRadius(sword), 3);
    assert.ok(messages.some(message => message.includes('It shines brighter.')));
});
void test('#pray crowns a lawful hero with Sunsword shining under its identified name', async () => {
    prayerRoom({ role: 'valkyrie', hero: { uluck: 10, ualign: { type: 1, record: 20 } } });
    requirePlayingGame(game);
    initializeArtifacts();
    const sunsword = artifactByName('Sunsword');
    assert.ok(sunsword);
    const sword = await addInventoryObject(LONG_SWORD);
    assert.equal(nameArtifact(sword, sunsword), true);
    fullyIdentifyObject(sword);
    await setPrimaryWeapon(sword);
    beginObjectBurn(sword);
    await addInventoryObject(LUCKSTONE);
    initRng(2n);
    const messages = await prayAndReadMessages();
    assert.equal(game.u.uevent?.uhand_of_elbereth, 1);
    assert.equal(objectLightRadius(sword), 3);
    assert.ok(messages.some(message => /(?:^|\n)Sunsword shines brighter\./.test(message)), `Expected Sunsword's light announcement in prayer messages: ${messages.join('\n')}`);
});
void test('prayer releases the cursed gloves trapping a levitation ring', async () => {
    prayerRoom();
    requirePlayingGame(game);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('levitation'));
    await wearHeroAccessory(ring, 'uleft');
    const gloves = await addInventoryObject(LEATHER_GLOVES, { cursed: true });
    await wearHeroArmor(gloves);
    await resolvePrayer();
    assert.equal(gloves.cursed, false);
    assert.equal(game.uleft, ring);
    assert.equal(ring.cursed, false);
});
void test('prayer rescues a hero embedded in rock without allowing passage through warded walls', async () => {
    prayerRoom();
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++)
            requireGameLevel().requireAt(x, y).typ = STONE;
    }
    await resolvePrayer();
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.ok((game.u.passesWallsTurns ?? 0) >= 8 && (game.u.passesWallsTurns ?? 0) <= 20);
    requireGameLevel().requireAt(12, 10).wall_info = W_NONPASSWALL;
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
});
for (const alignment of [0, 1]) {
    void test(`praying at ${alignment === 0 ? 'the hero\'s' : 'another god\'s'} altar makes water ${alignment === 0 ? 'holy' : 'unholy'}`, async () => {
        prayerRoom();
        requirePlayingGame(game);
        const altarSquare = requireGameLevel().requireAt(10, 10);
        altarSquare.typ = ALTAR;
        altarSquare.flags = Align2amask(alignment);
        const water = await floorObject(OBJECT_NAMES.indexOf('water'), 10, 10, { quan: 3 });
        await resolvePrayer();
        assert.equal(water.blessed, alignment === 0);
        assert.equal(water.cursed, alignment !== 0);
        assert.equal(water.quan, 3);
        if (alignment !== 0)
            assert.ok((game.u.uluck ?? 0) < 0);
    });
}
void test('praying too soon brings a penalty without granting protection', async () => {
    prayerRoom({ hero: { ublesscnt: 500 } });
    requirePlayingGame(game);
    await runExtendedCommand('pray', 'y\x1b');
    assert.ok(!game.u.invulnerable);
    await finishHeroHelplessness();
    assert.ok(game.u.ublesscnt > 500);
    assert.equal(game.u.uluck, -3);
});
void test('crowning a neutral fighter gives a usable Vorpal Blade and permanent resistances', async () => {
    prayerRoom({ role: 'barbarian', hero: { ualign: { type: 0, record: 20 } } });
    requirePlayingGame(game);
    initializeArtifacts();
    pushKey(27);
    await grantPrayerFavor(7, 0);
    const sword = floorObjectsAt(requireGameLevel(), 10, 10).find(object => object.oartifact);
    assert.ok(sword);
    const artifact = artifactById(sword.oartifact);
    assert.ok(artifact);
    assert.equal(artifact.name, 'Vorpal Blade');
    assert.equal(sword.blessed, true);
    assert.equal(sword.spe, 1);
    assert.equal(game.u.fireResistance, true);
    assert.ok(game.u.uevent != null);
    assert.equal(game.u.uevent.uhand_of_elbereth, 2);
});
void test('a wizard receives a blessed death spellbook when crowned without an artifact weapon', async () => {
    prayerRoom({ role: 'wizard', hero: { ualign: { type: 0, record: 20 } } });
    requirePlayingGame(game);
    initializeArtifacts();
    pushKey(27);
    await grantPrayerFavor(7, 0);
    const book = floorObjectsAt(requireGameLevel(), 10, 10)
        .find(object => object.otyp === OBJECT_NAMES.indexOf('finger of death'));
    assert.ok(book);
    assert.equal(book.blessed, true);
    assert.equal(game.u.ugifts, 1);
});
void test('divine protection improves armor class and protection from special attacks', async () => {
    prayerRoom();
    requirePlayingGame(game);
    for (const property of ['telepathy', 'fast', 'stealth'])
        grantIntrinsicProperty(property, 'outside');
    const armorClass = findArmorClass();
    pushKey(27);
    await grantPrayerFavor(5, 0);
    assert.ok(game.u.ublessed != null);
    assert.equal(findArmorClass(), armorClass - game.u.ublessed);
    assert.ok(game.u.ublessed != null);
    assert.ok(game.u.ublessed >= 2 && game.u.ublessed <= 4);
    assert.equal(magicNegation(game.u), 1);
});
void test('prayer grants breathing when a permanent poison cloud has no safe exit', async () => {
    prayerRoom();
    requirePlayingGame(game);
    const cells = [];
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++)
            cells.push({ x, y });
    }
    const cloud = await createHarmlessGasCloudSelection(game, cells, { ttl: -1 });
    assert.ok(cloud);
    cloud.damage = 5;
    cloud.heroFault = false;
    const hp = game.u.uhp;
    await resolvePrayer();
    await runLevelRegions(game);
    assert.equal(game.u.uhp, hp);
    assert.ok((game.u.magicalBreathingTurns ?? 0) >= 8 && (game.u.magicalBreathingTurns ?? 0) <= 20);
    assert.equal(game.u.invulnerable, false);
});
void test('angrygods computes the live same-alignment range', () => {
    assert.equal(angryGodMaximum({
        responseAlignment: 0,
        heroAlignment: 0,
        alignmentRecord: 0,
        anger: 1,
        luck: -3,
    }), 6);
    assert.equal(angryGodMaximum({
        responseAlignment: 1,
        heroAlignment: 1,
        alignmentRecord: 4,
        anger: 1,
        luck: -3,
    }), 4);
});
void test('angrygods clamps cross-alignment ranges to source bounds', () => {
    assert.equal(angryGodMaximum({
        responseAlignment: -1,
        heroAlignment: 1,
        alignmentRecord: -20,
        anger: 0,
        luck: 13,
    }), 1);
    assert.equal(angryGodMaximum({
        responseAlignment: -1,
        heroAlignment: 1,
        alignmentRecord: 40,
        anger: 0,
        luck: -13,
    }), 15);
});
void test('life saving lets an unanswered prayer complete on the next world turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    game.u.ublesscnt = 500;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    input.feed('#pray\ny');
    await moveloop_core();
    // Dismiss the death message and the amulet's glow.
    input.feed([27, 27]);
    await loseHeroHp(100, 'a falling rock');
    input.feed(27);
    await moveloop_core();
    assert.equal(amulet.where, 'gone');
    assert.ok(game.u.uhp > 0);
    assert.equal(game.u.uluck, -3);
});
//# sourceMappingURL=pray.test.js.map