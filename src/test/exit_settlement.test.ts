import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { flushPendingTopline } from '../js/display.js';
import { finishLivingGame, finishOrdinaryQuit } from '../js/end.js';
import { doGenocide } from '../js/genocide.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { bonesLevelExists } from '../js/mklev.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, DAGGER, GOLD_PIECE, POT_HEALING, SACK } from '../js/object_data.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

function screenText(): string {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

function exitRoom({ outside = true, debug = false, bones = false } = {}) {
    const level = freshObjectRoom({
        heroX: outside ? 24 : 10, right: 26,
        flags: { debug, bones, disclose: '-i -a -v -c -o', tombstone: false },
        hero: {
            uz: { dnum: 0, dlevel: 1 }, ulevel: 1, urexp: 100,
            uhp: 12, uhpmax: 12, ualign: { type: 1, record: 10 },
        },
    });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({
        dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D',
    })];
    game.plname = 'ExitTester';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    return { state: game, level };
}

void test('quitting outside a shop pays stolen gold before disclosure and keeps other possessions', async () => {
    const { state } = exitRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = '+QuitCreditor';
    shopkeeper.eshk.robbed = 37;
    const keeperGold = (shopkeeper.minvent ?? []).filter(object => object.otyp === GOLD_PIECE)
        .reduce((sum, object) => sum + object.quan, 0);
    const dagger = await addInventoryObject(DAGGER);
    setHeroGoldAmount(state, 60);
    state.flags.disclose = '-a -v -c -o';
    const input = resetInputState();
    let sawPayment = false;
    let sawSummary = false;
    input.beforeRead = () => {
        const screen = screenText();
        if (/QuitCreditor.*takes the 37 zorkmids/.test(screen)) sawPayment = true;
        if (!screen.includes('You quit in')) return;
        sawSummary = true;
        assert.match(screen, /with 123 points,/);
        assert.match(screen, /and 23 pieces of gold,/);
        assert.equal(loadScoreRecords(state).length, 0, 'The summary must be acknowledged before recording the score');
    };
    installPagerInput(input, { expected: /QuitCreditor|Goodbye ExitTester the Caveman|You quit|points/i, limit: 4 });
    const pager = input.display;
    assert.ok(pager);
    let disclosed = false;
    input.display = {
        async readKey() {
            if (screenText().includes('Do you want your possessions identified?')) {
                disclosed = true;
                assert.equal(sawPayment, true, 'The payment message precedes possession disclosure');
                assert.equal(heroGoldAmount(state), 23);
                assert.equal(shopkeeper.eshk.robbed, 0);
                assert.equal(shopkeeper.eshk.billct, 0);
                assert.ok(state.inventory.includes(dagger));
                return 'n'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };

    await finishOrdinaryQuit();

    assert.equal(disclosed, true);
    assert.equal(sawSummary, true);
    assert.equal(dagger.where, 'inventory');
    const paidGold = (shopkeeper.minvent ?? []).filter(object => object.otyp === GOLD_PIECE)
        .reduce((sum, object) => sum + object.quan, 0);
    assert.equal(paidGold, keeperGold + 37);
    const record = loadScoreRecords(state)[0];
    assert.ok(record, 'Quitting must save a score record after its summary');
    assert.equal(record.outcome, 'quit');
    assert.equal(record.points, 123);
});

void test('escaping leaves shop debt and gold untouched through disclosure and scoring', async () => {
    const { state } = exitRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = '+EscapeCreditor';
    shopkeeper.eshk.robbed = 37;
    shopkeeper.eshk.debit = 11;
    const keeperGold = (shopkeeper.minvent ?? []).filter(object => object.otyp === GOLD_PIECE)
        .reduce((sum, object) => sum + object.quan, 0);
    const dagger = await addInventoryObject(DAGGER);
    const consumedPotion = await addInventoryObject(POT_HEALING, { quan: 1, in_use: true });
    setHeroGoldAmount(state, 60);
    state.flags.disclose = '-a -v -c -o';
    const input = resetInputState();
    let sawSummary = false;
    input.beforeRead = () => {
        const screen = screenText();
        assert.doesNotMatch(screen, /takes|inherits|your corpse/);
        if (!screen.includes('You escaped from the dungeon')) return;
        sawSummary = true;
        assert.match(screen, /with 160 points,/);
        assert.match(screen, /and 60 pieces of gold,/);
    };
    installPagerInput(input, { expected: /Goodbye ExitTester the Caveman|escaped|points/i, limit: 3 });
    const pager = input.display;
    assert.ok(pager);
    let disclosed = false;
    input.display = {
        async readKey() {
            if (screenText().includes('Do you want your possessions identified?')) {
                disclosed = true;
                assert.equal(shopkeeper.eshk.robbed, 37);
                assert.equal(shopkeeper.eshk.debit, 11);
                assert.equal(heroGoldAmount(state), 60);
                assert.equal(consumedPotion.where, 'gone', 'Exit cleanup finishes the consumed potion before disclosure');
                assert.equal(state.inventory.includes(consumedPotion), false);
                return 'n'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };

    await finishLivingGame('escaped');

    assert.equal(disclosed, true);
    assert.equal(sawSummary, true);
    assert.equal(shopkeeper.eshk.robbed, 37);
    assert.equal(shopkeeper.eshk.debit, 11);
    assert.equal(heroGoldAmount(state), 60);
    assert.ok(state.inventory.includes(dagger));
    assert.equal(consumedPotion.where, 'gone');
    assert.equal(state.inventory.includes(consumedPotion), false);
    const remainingGold = (shopkeeper.minvent ?? []).filter(object => object.otyp === GOLD_PIECE)
        .reduce((sum, object) => sum + object.quan, 0);
    assert.equal(remainingGold, keeperGold);
    const record = loadScoreRecords(state)[0];
    assert.ok(record, 'Escaping must save a score record');
    assert.equal(record.outcome, 'escaped');
    assert.equal(record.points, 160);
});

void test('ascension uses death-style shop settlement before the reward summary', async () => {
    const { state } = exitRoom({ outside: false });
    // A synthetic Astral shop distinguishes native paybill(1) from quit's
    // paybill(0): a second visible keeper comments only in the former case.
    state.dungeons.push(createDungeon({ dname: 'The Elemental Planes', depth_start: -5 }));
    state.astral_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    state.u.uz = { dnum: 1, dlevel: 1 };
    const first = await createStaffedShop();
    first.shopkeeper.eshk.shknam = '+RewardKeeper';
    const second = await createStaffedShop({ left: 16, right: 22, keeperX: 18 });
    second.shopkeeper.eshk.shknam = '+WitnessKeeper';
    const dagger = await addInventoryObject(DAGGER);
    setHeroGoldAmount(state, 60);
    state.flags.disclose = '-a -v -c -o';
    const input = resetInputState();
    let sawInheritance = false;
    let sawWitness = false;
    let sawSummary = false;
    input.beforeRead = () => {
        const screen = screenText();
        if (/RewardKeeper gratefully inherits all your possessions/.test(screen)) sawInheritance = true;
        if (/WitnessKeeper looks at your corpse/.test(screen)) sawWitness = true;
        if (!screen.includes('You went to your reward')) return;
        sawSummary = true;
        assert.match(screen, /with 320 points,/);
        assert.match(screen, /and 60 pieces of gold,/);
    };
    installPagerInput(input, { expected: /inherits|corpse|Goodbye ExitTester the Demigod|reward|points/i, limit: 5 });
    const pager = input.display;
    assert.ok(pager);
    let disclosed = false;
    input.display = {
        async readKey() {
            if (screenText().includes('see what you had when you died?')) {
                disclosed = true;
                assert.equal(sawInheritance, true);
                assert.equal(sawWitness, true, 'Ascension must admit the second keeper\'s native corpse comment');
                assert.ok(state.inventory.includes(dagger));
                return 'n'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };

    await finishLivingGame('ascended');

    assert.equal(disclosed, true);
    assert.equal(sawSummary, true);
    assert.equal(dagger.where, 'inventory', 'Ascension does not drop possessions into bones');
    assert.equal(bonesLevelExists(), false);
    const record = loadScoreRecords(state)[0];
    assert.ok(record, 'Ascension must save a score record');
    assert.equal(record.outcome, 'ascended');
    assert.equal(record.points, 320);
});

void test('quitting with fatal HP settles as death without another death or recovery phase', async () => {
    const { state, level } = exitRoom({ bones: true });
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = '+FinalCreditor';
    shopkeeper.eshk.robbed = 37;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const setupInput = resetInputState();
    installPagerInput(setupInput, { expected: /amulet of life saving/, limit: 1 });
    await flushPendingTopline();
    setHeroGoldAmount(state, 60);
    state.u.uhp = -1;
    const input = resetInputState();
    let sawPayment = false;
    let sawSummary = false;
    input.beforeRead = () => {
        const screen = screenText();
        assert.doesNotMatch(screen, /You die\.\.\.|But wait|medallion|Die\?|Save bones\?/);
        if (/FinalCreditor.*takes the 37 zorkmids/.test(screen)) sawPayment = true;
        if (!screen.includes('You died in')) return;
        sawSummary = true;
        assert.match(screen, /with 121 points,/);
        assert.match(screen, /and 23 pieces of gold,/);
    };
    installPagerInput(input, { expected: /FinalCreditor|Goodbye ExitTester the Caveman|You died|points/i, limit: 4 });

    await finishOrdinaryQuit();

    assert.equal(sawPayment, true);
    assert.equal(sawSummary, true);
    assert.equal(state.u.umortality, 1);
    assert.equal(state.u.uhp, -1);
    assert.equal(state.uamul, amulet);
    assert.ok(state.inventory.includes(amulet), 'Quit conversion cannot consume a life-saving amulet');
    assert.equal(shopkeeper.eshk.robbed, 0);
    assert.equal(heroGoldAmount(state), 23);
    assert.equal(bonesLevelExists(), false);
    assert.equal(floorObjectsAt(level, 24, 10).some(object => object.otyp === CORPSE), false);
    const record = loadScoreRecords(state)[0];
    assert.ok(record, 'A quit on fatal HP must record the converted death');
    assert.equal(record.outcome, 'died');
    assert.equal(record.death, "quit while already on Charon's boat");
    assert.equal(record.points, 121);
});

void test('a death summary counts loose and contained gold before bones removes the inventory', async () => {
    const { state, level } = exitRoom({ debug: true, bones: true });
    const purse = setHeroGoldAmount(state, 40);
    assert.ok(purse);
    const bag = await addInventoryObject(SACK, { contents: [] });
    const hiddenCoins = await knownObject(GOLD_PIECE, { quan: 60 });
    await addCreatedObjectToContainer(bag, hiddenCoins);
    const input = resetInputState();
    let sawSummary = false;
    input.beforeRead = () => {
        const screen = screenText();
        if (!screen.includes('You died in')) return;
        sawSummary = true;
        assert.equal(state.inventory.length, 0, 'Bones must finish dropping the inventory before the summary');
        assert.match(screen, /with 190 points,/);
        assert.match(screen, /and 100 pieces of gold,/);
    };
    installPagerInput(input, { expected: /die|Goodbye ExitTester the Caveman|points|You were/i, limit: 5 });
    const pager = input.display;
    assert.ok(pager);
    let askedToSaveBones = false;
    input.display = {
        async readKey() {
            const screen = screenText();
            if (screen.includes('Die? [yn] (n)')) return 'y'.charCodeAt(0);
            if (screen.includes('Save bones?')) {
                askedToSaveBones = true;
                assert.ok(state.inventory.includes(purse));
                assert.ok(state.inventory.includes(bag));
                return 'y'.charCodeAt(0);
            }
            return pager.readKey();
        },
    };

    const died = await loseHeroHp(14, 'a falling rock');

    assert.equal(died, true);
    assert.equal(askedToSaveBones, true);
    assert.equal(sawSummary, true);
    assert.equal(bonesLevelExists(), true, 'The test must complete a real bones save');
    assert.equal(state.inventory.length, 0);
    assert.ok(floorObjectsAt(level, 24, 10).includes(purse));
    assert.ok(floorObjectsAt(level, 24, 10).includes(bag));
    assert.equal(hiddenCoins.container, bag);
    assert.equal(hiddenCoins.quan, 60);
});

for (const lifeSaving of [false, true]) {
    void test(lifeSaving
        ? 'own-species genocide consumes life saving but still ends the game without bones'
        : 'own-species genocide leaves no bones on an otherwise eligible dungeon level', async () => {
        const { state, level } = exitRoom({ debug: true, bones: true });
        const dagger = await addInventoryObject(DAGGER);
        const amulet = lifeSaving ? await addInventoryObject(AMULET_OF_LIFE_SAVING) : null;
        if (amulet) {
            await wearHeroAccessory(amulet, 'uamul');
            const setupInput = resetInputState();
            installPagerInput(setupInput, { expected: /amulet of life saving/, limit: 1 });
            await flushPendingTopline();
        }
        const input = resetInputState();
        let selectedSpecies = false;
        let confirmedDeath = false;
        let sawFailedRescue = false;
        let sawSummary = false;
        input.beforeRead = () => {
            const screen = screenText();
            assert.doesNotMatch(screen, /Save bones\?/, 'Genocide cannot offer to save bones');
            assert.doesNotMatch(screen, /You die\.\.\./, 'Genocide enters death directly after its own announcement');
            if (screen.includes('Unfortunately you are still genocided...')) {
                sawFailedRescue = true;
                assert.ok(amulet, 'Only life saving produces the failed rescue continuation');
                assert.equal(amulet.where, 'gone');
                assert.equal(state.inventory.includes(amulet), false);
            }
            if (!screen.includes('You died in')) return;
            sawSummary = true;
            assert.equal(state.program_state.gameover, true);
            assert.equal(state.u.umortality, 1);
            assert.match(screen, /with 100 points,/);
        };
        installPagerInput(input, {
            expected: /Wiped out all humans|But wait|medallion|much better|still genocided|Goodbye ExitTester the Caveman|points/i,
            limit: 12,
        });
        const pager = input.display;
        assert.ok(pager);
        input.display = {
            async readKey() {
                const screen = screenText();
                if (!selectedSpecies && screen.includes('What type of monster do you want to genocide?')) {
                    selectedSpecies = true;
                    input.feed('uman\n');
                    return 'h'.charCodeAt(0);
                }
                if (screen.includes('Die? [yn] (n)')) {
                    assert.equal(confirmedDeath, false, 'Genocide must enter the death decision only once');
                    confirmedDeath = true;
                    return 'y'.charCodeAt(0);
                }
                // The ending discloses its categories before the summary.
                if (/Do you want/.test(screen)) return 'n'.charCodeAt(0);
                return pager.readKey();
            },
        };

        const genocided = await doGenocide(1);

        assert.equal(genocided, true);
        assert.equal(selectedSpecies, true);
        assert.equal(confirmedDeath, true);
        assert.equal(sawSummary, true);
        assert.equal(sawFailedRescue, lifeSaving);
        assert.equal(state.program_state.gameover, true);
        assert.equal(state.u.umortality, 1, 'Failed life saving does not count a second death');
        assert.equal(bonesLevelExists(), false);
        assert.equal(dagger.where, 'inventory');
        assert.ok(state.inventory.includes(dagger));
        assert.equal(floorObjectsAt(level, 24, 10).some(object => object.otyp === CORPSE), false);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.equal(state.inventory.includes(amulet), false);
            assert.equal(state.uamul ?? null, null);
        }
    });
}

void test('the quit summary uses singular counts for one gold piece, one move, and one hit point', async () => {
    const { state } = exitRoom();
    state.u.uhpmax = 1;
    state.u.uhp = 1;
    state.moves = 1;
    setHeroGoldAmount(state, 1);
    const input = resetInputState();
    let summary = '';
    input.beforeRead = () => {
        const screen = screenText();
        if (screen.includes('You quit in')) summary = screen;
    };
    installPagerInput(input, { expected: /Goodbye ExitTester|You quit|identified|points?/i, limit: 8 });

    await finishOrdinaryQuit();

    assert.match(summary, /and 1 piece of gold, after 1 move\./);
    assert.match(summary, /with a maximum of 1 hit point when you quit\./);
});
