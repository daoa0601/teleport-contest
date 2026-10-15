import { ensureQuestStatus } from '../js/quest.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName, discoverArtifact } from '../js/artifacts.js';
import { game } from '../js/gstate.js';
import { heroHasConflict } from '../js/hero_conflict.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import {
    ARROW, CRYSKNIFE, ELVEN_DAGGER, LEATHER_ARMOR, LONG_SWORD,
    PICK_AXE, ROCK, SCR_ENCHANT_WEAPON, TIN_OPENER, WORM_TOOTH,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { unpaidObjectCost } from '../js/shk.js';
import { itemizedShopBill } from '../js/shop_payment.js';
import { pickupAtHero } from '../js/pickup.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { objectWeight } from '../js/weight.js';
import { addInventoryObject, addInventoryWeapon, floorObject } from './support/game-objects.js';
import { createStaffedShop } from './support/shop.js';
import { invokeInventoryObject, readInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('confused enchant weapon repairs and proofs a weapon without enchanting it', async () => {
    freshObjectRoom({ hero: { confusionTurns: 5 } });
    requireFixtureGame(game);
    const weapon = await addInventoryWeapon(LONG_SWORD, {
        spe: 2, oeroded: 2, oeroded2: 1,
    });
    await setPrimaryWeapon(weapon);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '    ');

    assert.equal(weapon.spe, 2);
    assert.equal(weapon.oeroded, 0);
    assert.equal(weapon.oeroded2, 0);
    assert.ok(weapon.oerodeproof);
    assert.equal(scroll.where, 'gone');
    assert.equal(game.context.move, 1);
});

void test('enchant weapon fuses a stack of worm teeth into one uncursed crysknife', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const teeth = await addInventoryWeapon(WORM_TOOTH, {
        quan: 4, cursed: true, spe: 0, oerodeproof: true,
    });
    await setPrimaryWeapon(teeth);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '    ');

    assert.equal(teeth.otyp, CRYSKNIFE);
    assert.equal(teeth.quan, 1);
    assert.equal(teeth.spe, 0);
    assert.equal(teeth.cursed, false);
    assert.ok(!teeth.oerodeproof);
    assert.equal(teeth.owt, objectWeight(teeth));
    assert.match(inventoryItemDescription(teeth), /crysknife/);
    assert.equal(game.uwep, teeth);
});


void test('cursed confused enchantment removes proofing without repairing damage', async () => {
    freshObjectRoom({ hero: { confusionTurns: 5 } });
    const weapon = await addInventoryWeapon(LONG_SWORD, {
        spe: 2, oerodeproof: true, oeroded: 1,
    });
    await setPrimaryWeapon(weapon);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { cursed: true });

    await readInventoryObject(scroll, '    ');

    assert.equal(weapon.spe, 2);
    assert.equal(weapon.oeroded, 1);
    assert.ok(!weapon.oerodeproof);
    assert.ok(weapon.rknown);
});

void test('a blind hero feels a confused repair but does not learn proofing', async () => {
    freshObjectRoom({ hero: { confusionTurns: 5, blindTurns: 10 } });
    requireFixtureGame(game);
    const weapon = await addInventoryWeapon(LONG_SWORD, {
        spe: 1, oeroded: 1, rknown: true,
    });
    await setPrimaryWeapon(weapon);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '      ');

    assert.ok(weapon.oerodeproof);
    assert.equal(weapon.oeroded, 0);
    assert.ok(!weapon.rknown);
    assert.equal(weapon.spe, 1);
    assert.match(game._pending_message, /feels as good as new/);
});

void test('a wielded armor item cannot be proofed by confused enchant weapon', async () => {
    freshObjectRoom({ hero: { confusionTurns: 5 } });
    requireFixtureGame(game);
    const armor = await addInventoryObject(LEATHER_ARMOR, { oeroded: 1, spe: 0 });
    await setPrimaryWeapon(armor);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '    ');

    assert.ok(!armor.oerodeproof);
    assert.equal(armor.oeroded, 1);
    assert.equal(armor.spe, 0);
    assert.match(game._pending_message, /hands twitch/);
});

void test('weapon-tools are enchanted and uncursed like weapons', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const pick = await addInventoryObject(PICK_AXE, { cursed: true, spe: 0 });
    await setPrimaryWeapon(pick);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '    ');

    assert.equal(pick.spe, 1);
    assert.ok(!pick.cursed);
    assert.equal(game.uwep, pick);
});

void test('enchant weapon frees a welded tin opener without enchanting it', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const opener = await addInventoryObject(TIN_OPENER, { cursed: true, spe: 0 });
    await setPrimaryWeapon(opener);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '    ');

    assert.ok(!opener.cursed);
    assert.equal(opener.spe, 0);
    assert.match(game._pending_message, /amber aura/);
});

void test('cursed enchantment dulls a crysknife without changing its enchantment', async () => {
    freshObjectRoom();
    const knife = await addInventoryWeapon(CRYSKNIFE, {
        quan: 3, spe: 2, oerodeproof: true,
    });
    await setPrimaryWeapon(knife);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { cursed: true });

    await readInventoryObject(scroll, '    ');

    assert.equal(knife.otyp, WORM_TOOTH);
    assert.equal(knife.quan, 1);
    assert.equal(knife.spe, 2);
    assert.ok(!knife.oerodeproof);
    assert.equal(knife.owt, objectWeight(knife));
    assert.match(inventoryItemDescription(knife), /worm tooth/);
});

void test('restricted artifacts resist cursed enchantment', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact !== null && artifact !== undefined);
    const sword = await addInventoryWeapon(artifact.baseType, {
        oartifact: artifact.id, oextra: { oname: artifact.name }, spe: 2,
    });
    await setPrimaryWeapon(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { cursed: true });

    await readInventoryObject(scroll, '    ');

    assert.equal(sword.spe, 2);
    assert.equal(game.uwep, sword);
    assert.match(game._pending_message, /faintly glows black/);
});

void test('ordinary cursed enchantment reduces the primary weapon, not its alternate', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const primary = await addInventoryWeapon(LONG_SWORD, { spe: 2 });
    const alternate = await addInventoryWeapon(LONG_SWORD, { spe: 3 });
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(alternate);
    game.u.twoweap = true;
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { cursed: true });

    await readInventoryObject(scroll, '    ');

    assert.equal(primary.spe, 1);
    assert.equal(alternate.spe, 3);
    assert.ok(game.u.twoweap);
});

void test('over-enchantment can evaporate the entire wielded stack', async () => {
    let destroyed = 0;
    let survived = 0;
    for (let seed = 1; seed <= 24; seed++) {
        freshObjectRoom();
        requireFixtureGame(game);
        const arrows = await addInventoryWeapon(ARROW, { spe: 6, quan: 12 });
        await setPrimaryWeapon(arrows);
        const alternate = await addInventoryWeapon(LONG_SWORD);
        await setSecondaryWeapon(alternate);
        game.u.twoweap = true;
        const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);
        initRng(BigInt(seed));

        await readInventoryObject(scroll, '      ');

        if (game.inventory.includes(arrows)) {
            survived++;
            assert.equal(arrows.spe, 7);
            assert.equal(arrows.quan, 12);
        } else {
            destroyed++;
            assert.equal(game.uwep, null);
            assert.equal(arrows.where, 'gone');
            assert.ok(!game.u.twoweap);
            assert.equal(game.uswapwep, alternate);
        }
    }
    assert.ok(destroyed > 0, 'over-enchantment never destroyed a weapon');
    assert.ok(survived > 0, 'over-enchantment always destroyed a weapon');
});

void test('weapons at +9 sometimes resist a further enchantment even when they survive', async () => {
    let unchanged = 0;
    for (let seed = 1; seed <= 24; seed++) {
        freshObjectRoom();
        requireFixtureGame(game);
        const sword = await addInventoryWeapon(LONG_SWORD, { spe: 9 });
        await setPrimaryWeapon(sword);
        const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);
        initRng(BigInt(seed));

        await readInventoryObject(scroll, '      ');

        if (game.inventory.includes(sword)) {
            assert.ok(sword.spe === 9 || sword.spe === 10);
            if (sword.spe === 9) unchanged++;
        }
    }
    assert.ok(unchanged > 0, 'all surviving weapons gained an enchantment');
});

void test('identifying enchant weapon through a known weapon gives no experience award', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const sword = await addInventoryWeapon(LONG_SWORD, { known: true });
    await setPrimaryWeapon(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { typeKnown: false });
    const experience = game.u.urexp || 0;

    await readInventoryObject(scroll, '    ');

    assert.ok(game._knownObjectTypes !== null && game._knownObjectTypes !== undefined);
    assert.ok(game._knownObjectTypes.has(SCR_ENCHANT_WEAPON));
    assert.equal(game.u.urexp || 0, experience);
});

void test('an unrecognized scroll can be named after its effect before it is consumed', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const sword = await addInventoryWeapon(LONG_SWORD, { known: false });
    await setPrimaryWeapon(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { typeKnown: false });
    const input = resetInputState();
    const reading = readInventoryObject(scroll, ' ');
    await input.waitUntilBlocked();
    try {
        assert.equal(game._pending_message, 'Your long sword glows blue for a moment.');
        assert.equal(sword.spe, 1);
        assert.ok(game.inventory.includes(scroll));
        input.feed(' '); // getlin acknowledges the effect before asking for a name.
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /^Call a scroll labeled /);
        assert.equal(sword.spe, 1);
        assert.ok(game.inventory.includes(scroll));
        assert.ok(!game._knownObjectTypes?.has(SCR_ENCHANT_WEAPON));
    } finally {
        input.feed('weapon magic\n');
        await reading;
    }

    assert.ok(game._objectCallNames !== null && game._objectCallNames !== undefined);
    assert.equal(game._objectCallNames[SCR_ENCHANT_WEAPON], 'weapon magic');
    assert.equal(scroll.where, 'gone');
    assert.equal(game.context.move, 1);
});

void test('improving an unpaid weapon raises its price without settling its bill', async () => {
    freshObjectRoom();
    await createStaffedShop();
    const sword = await floorObject(LONG_SWORD, 10, 10, { spe: 0 });
    pushKeys(' ');
    await pickupAtHero();
    await setPrimaryWeapon(sword);
    const before = unpaidObjectCost(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '      ');

    assert.equal(sword.spe, 1);
    assert.ok(sword.unpaid);
    assert.ok(unpaidObjectCost(sword) > before);
});

void test('degrading an unpaid crysknife charges its old value before transformation', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    // Real provenance: an unproofed floor crysknife reverts to a worm
    // tooth at placement, the hero picks THAT up, and an uncursed enchant
    // in hand turns it back into a genuine wielded crysknife before the
    // cursed degrade is read.
    const knife = await floorObject(CRYSKNIFE, 10, 10, { spe: 0 });
    pushKeys(' ');
    await pickupAtHero();
    assert.equal(knife.otyp, WORM_TOOTH);
    const uncurse = await addInventoryObject(SCR_ENCHANT_WEAPON, { blessed: false });
    await setPrimaryWeapon(knife);
    await readInventoryObject(uncurse, '      ');
    assert.equal(knife.otyp, CRYSKNIFE);
    const before = unpaidObjectCost(knife);
    assert.ok(before > 0, 'the billed crysknife must carry a real price');
    // The sharpen flow leaves queued pager keys; a clean queue keeps the
    // second read's selection honest.
    resetInputState();
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { cursed: true });

    await readInventoryObject(scroll, '    ');

    assert.equal(knife.otyp, WORM_TOOTH);
    assert.ok(!knife.unpaid);
    const amountOwed = itemizedShopBill(shopkeeper)
        .reduce((total, item) => total + item.price, 0);
    assert.equal(amountOwed, before);
});


void test('reading without a weapon does not invent a pager when the message fits', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll);

    assert.equal(scroll.where, 'gone');
    assert.match(game._pending_message, /scroll, it disappears\.  Your hands twitch\./);
});

void test('a blind hero can enchant a known weapon without identifying the scroll', async () => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    requireFixtureGame(game);
    const sword = await addInventoryWeapon(LONG_SWORD, { known: true });
    await setPrimaryWeapon(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { typeKnown: false });

    await readInventoryObject(scroll, ' \n'); // Acknowledge the effect, then cancel its call name.

    assert.equal(sword.spe, 1);
    assert.ok(!game._knownObjectTypes?.has(SCR_ENCHANT_WEAPON));
    assert.equal(scroll.where, 'gone');
});

void test('elven weapons warn after an enchantment takes them beyond +5', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const dagger = await addInventoryWeapon(ELVEN_DAGGER, { spe: 5 });
    await setPrimaryWeapon(dagger);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '      ');

    assert.equal(dagger.spe, 6);
    assert.match(game._pending_message, /suddenly vibrates unexpectedly/);
});


void test('a beginner gets the strange-feeling message when there is no weapon', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.flags.beginner = true;
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '    ');

    assert.match(game._pending_message, /You have a strange feeling for a moment, then it passes/);
    assert.equal(scroll.where, 'gone');
});

for (const [species, action] of [['wolf', 'pronounce'], ['killer bee', 'cogitate']] as const) {
    void test(`a blind ${species} reads a scroll using the form's speech ability`, async () => {
        freshObjectRoom({ hero: {
            blindTurns: 10, umonnum: MONSTER_NAME.indexOf(species),
        } });
        requireFixtureGame(game);
        const sword = await addInventoryWeapon(LONG_SWORD);
        await setPrimaryWeapon(sword);
        const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

        await readInventoryObject(scroll);

        assert.equal(sword.spe, 1);
        assert.match(game._pending_message, new RegExp(`As you ${action} the formula`));
    });
}


void test('a fully identified artifact uses its personal name in enchantment feedback', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact !== null && artifact !== undefined);
    const sword = await addInventoryWeapon(artifact.baseType, {
        oartifact: artifact.id, oextra: { oname: artifact.name },
        spe: 2, rknown: true,
    });
    discoverArtifact(artifact.id);
    await setPrimaryWeapon(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON, { cursed: true });

    await readInventoryObject(scroll, '    ');

    assert.equal(game._pending_message,
        'As you read the scroll, it disappears.  Excalibur faintly glows black.');
});

void test('a tooth transformation does not include a user-supplied individual name', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const tooth = await addInventoryWeapon(WORM_TOOTH, {
        oextra: { oname: 'Keepsake' },
    });
    await setPrimaryWeapon(tooth);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '    ');

    assert.equal(game._pending_message, 'Your worm tooth is much sharper now.');
    assert.ok(tooth.oextra !== null && tooth.oextra !== undefined);
    assert.equal(tooth.oextra.oname, 'Keepsake');
    assert.equal(tooth.otyp, CRYSKNIFE);
});


void test('evaporating an invoked quest weapon ends its power and carried status', async () => {
    let destroyed = 0;
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom({ role: 'caveman', hero: { ualign: { type: 1, record: 10 } } });
        requireFixtureGame(game);
        ensureQuestStatus().touched_artifact = true;
        const artifact = artifactByName('The Sceptre of Might');
        assert.ok(artifact !== null && artifact !== undefined);
        const weapon = await addInventoryWeapon(artifact.baseType, {
            oartifact: artifact.id, oextra: { oname: artifact.name }, spe: 6,
        });
        await setPrimaryWeapon(weapon);
        assert.ok(game.u.uhave.questart);
        await invokeInventoryObject(weapon);
        assert.equal(heroHasConflict(game), true);
        const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);
        initRng(BigInt(seed));

        await readInventoryObject(scroll, '      ');

        if (weapon.where === 'gone') {
            destroyed++;
            assert.ok(!game.u.uhave.questart);
            assert.equal(heroHasConflict(game), false);
        }
    }
    assert.ok(destroyed > 0);
});


void test('fusing teeth reports the first load-status change even when the hero remains burdened', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await addInventoryObject(ROCK, { quan: 70 });
    const teeth = await addInventoryWeapon(WORM_TOOTH, { quan: 4 });
    await setPrimaryWeapon(teeth);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);

    await readInventoryObject(scroll, '      ');

    assert.equal(teeth.quan, 1);
    assert.match(game._pending_message, /Your movements are slowed slightly because of your load/);
});

void test('evaporating an unpaid weapon leaves its full purchase price owed', async () => {
    let destroyed = 0;
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom();
        requireFixtureGame(game);
        const { shopkeeper } = await createStaffedShop();
        const sword = await floorObject(LONG_SWORD, 10, 10, { spe: 6 });
        pushKeys(' ');
        await pickupAtHero();
        await setPrimaryWeapon(sword);
        const price = unpaidObjectCost(sword);
        const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);
        initRng(BigInt(seed));

        await readInventoryObject(scroll, '      ');

        if (!game.inventory.includes(sword)) {
            destroyed++;
            const amountOwed = itemizedShopBill(shopkeeper)
                .reduce((total, item) => total + item.price, 0);
            assert.equal(amountOwed, price);
            assert.equal(game.uwep, null);
        }
    }
    assert.ok(destroyed > 0);
});


void test('enchantment waits for the visible read message to be acknowledged', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const sword = await addInventoryWeapon(LONG_SWORD, { spe: 0 });
    await setPrimaryWeapon(sword);
    const scroll = await addInventoryObject(SCR_ENCHANT_WEAPON);
    const input = resetInputState();
    const reading = readInventoryObject(scroll);
    await input.waitUntilBlocked();
    try {
        assert.equal(game._pending_message, 'As you read the scroll, it disappears.');
        assert.equal(sword.spe, 0);
        assert.ok(game.inventory.includes(scroll));
    } finally {
        input.feed(' ');
        await reading;
    }

    assert.equal(sword.spe, 1);
    assert.equal(scroll.where, 'gone');
});
