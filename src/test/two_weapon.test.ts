import { installPagerInput } from './support/pager-input.js';
import type { ObjectRoomOptions } from './support/object-room.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline } from '../js/display.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { returnHeroToHumanForm } from '../js/polyself.js';
import { rndcurse } from '../js/throne.js';
import { removeCurseEffect } from '../js/scroll_effects.js';
import { initRng } from '../js/rng.js';
import { FOUNTAIN } from '../js/const.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { wearHeroArmor } from '../js/armor.js';
import { addInventoryItem } from '../js/u_init.js';
import { readObjectName } from '../js/objnam.js';
import { BATTLE_AXE, BOW, DAGGER, SACK, SHORT_SWORD, SMALL_SHIELD } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { runExtendedCommand } from './support/commands.js';

function combatRoom(options: ObjectRoomOptions = {}) {
    freshObjectRoom({ role: 'barbarian', ...options });
    requirePlayingGame(game);
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, {
        expected: /weapon|hand|shield|grasp|dagger|sword|ridiculous|feel|turn into|return to human form/i,
        limit: 200,
    });
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
    };
    return messages;
}

async function text(messages: string[]) {
    await flushPendingTopline();
    return messages.splice(0).join('\n');
}

async function equipPair(primaryType = DAGGER, secondaryType = SHORT_SWORD) {
    const primary = await addInventoryObject(primaryType);
    const secondary = await addInventoryObject(secondaryType);
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(secondary);
    return { primary, secondary };
}

void test('X begins two-weapon combat and the named command can always end it', async () => {
    const messages = combatRoom();
    requirePlayingGame(game);
    await equipPair();
    await rhack('X'.charCodeAt(0));
    assert.equal(game.u.twoweap, true);
    assert.match(await text(messages), /You begin two-weapon combat\./);

    await runExtendedCommand('twoweapon');

    assert.equal(game.u.twoweap, false);
    assert.equal(game.context.move, 0);
    assert.match(await text(messages), /You switch to your primary weapon\./);
});

void test('a Caveman cannot begin two-weapon combat', async () => {
    const messages = combatRoom({ role: 'caveman' });
    requirePlayingGame(game);
    await equipPair();

    await rhack('X'.charCodeAt(0));

    assert.equal(!!game.u.twoweap, false);
    assert.equal(game.context.move, 0);
    assert.match(await text(messages), /Cavemen aren't able to use two weapons at once\./);
});

for (const [form, capable] of [['ettin', true], ['human', false]] as const) {
    void test(`polymorphing into ${form} ${capable ? 'permits' : 'prevents'} two-weapon combat`, async () => {
        const messages = combatRoom();
        requirePlayingGame(game);
        installPolymorphedHero(form);
        await equipPair();

        await rhack('X'.charCodeAt(0));

        assert.equal(!!game.u.twoweap, capable);
        if (!capable) {
            assert.equal(game.context.move, 0);
            assert.match(await text(messages), /can't use two weapons in your current form/);
        }
    });
}

void test('an empty secondary hand cannot enter two-weapon combat', async () => {
    const messages = combatRoom();
    requirePlayingGame(game);
    await setPrimaryWeapon(await addInventoryObject(DAGGER));

    await rhack('X'.charCodeAt(0));

    assert.equal(!!game.u.twoweap, false);
    assert.match(await text(messages), /Your left hand is empty\./);
});

for (const [primaryType, secondaryType, rejected] of [
    [BOW, DAGGER, 'primary'], [DAGGER, SACK, 'secondary'],
] as const) {
    void test(`an unsuitable ${rejected} object cannot enter two-weapon combat`, async () => {
        const messages = combatRoom();
        requirePlayingGame(game);
        await equipPair(primaryType, secondaryType);

        await rhack('X'.charCodeAt(0));

        assert.equal(!!game.u.twoweap, false);
        assert.match(await text(messages), new RegExp(`isn't a suitable ${rejected} weapon`));
    });
}

void test('a two-handed weapon cannot enter two-weapon combat', async () => {
    const messages = combatRoom();
    requirePlayingGame(game);
    await equipPair(BATTLE_AXE);

    await rhack('X'.charCodeAt(0));

    assert.equal(!!game.u.twoweap, false);
    assert.match(await text(messages), /isn't one-handed\./);
});

void test('a shield prevents two-weapon combat', async () => {
    const messages = combatRoom();
    requirePlayingGame(game);
    await equipPair();
    await wearHeroArmor(await addInventoryObject(SMALL_SHIELD));

    await rhack('X'.charCodeAt(0));

    assert.equal(!!game.u.twoweap, false);
    assert.match(await text(messages), /can't use two weapons while wearing a shield/);
});

void test('a secondary artifact refuses two-weapon combat before it can slip', async () => {
    const messages = combatRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    await setPrimaryWeapon(await addInventoryObject(DAGGER));
    const wish = await readObjectName('cursed Sting', { wizardWish: true });
    assert.ok(wish && !wish.noWish);
    const sting = await addInventoryItem(wish.object);
    await setSecondaryWeapon(sting);

    await rhack('X'.charCodeAt(0));

    assert.equal(!!game.u.twoweap, false);
    assert.equal(game.uswapwep, sting);
    assert.match(await text(messages), /resists being held second to another weapon/);
});

for (const slippery of [false, true]) {
    void test(`a cursed secondary drops ${slippery ? 'without revealing the curse when hands are slippery' : 'and reveals its curse'}`, async () => {
        const messages = combatRoom({ hero: { glibTurns: slippery ? 10 : 0 } });
        requirePlayingGame(game);
        await setPrimaryWeapon(await addInventoryObject(DAGGER));
        const secondary = await addInventoryObject(SHORT_SWORD, { cursed: true, bknown: false });
        await setSecondaryWeapon(secondary);

        await rhack('X'.charCodeAt(0));

        assert.equal(!!game.u.twoweap, false);
        assert.equal(game.uswapwep, null);
        assert.equal(secondary.where, 'floor');
        assert.equal(secondary.bknown, !slippery);
        assert.equal(game.context.move, 0);
        assert.match(await text(messages), /evades your grasp and drops from your left hand/);
    });
}

for (const action of ['wield', 'swap', 'bare hands']) {
    void test(`a welded primary refuses ${action} without ending legal two-weapon combat`, async () => {
        const messages = combatRoom();
        requirePlayingGame(game);
        const primary = await addInventoryObject(DAGGER, { cursed: true, bknown: false });
        const secondary = await addInventoryObject(SHORT_SWORD);
        await setPrimaryWeapon(primary);
        await setSecondaryWeapon(secondary);
        await rhack('X'.charCodeAt(0));
        assert.equal(game.u.twoweap, true);
        await text(messages);
        if (action !== 'swap') pushKeys(action === 'bare hands' ? '-' : secondary.invlet);

        await rhack((action === 'swap' ? 'x' : 'w').charCodeAt(0));

        assert.equal(game.uwep, primary);
        assert.equal(game.uswapwep, secondary);
        assert.equal(game.u.twoweap, true);
        assert.equal(primary.bknown, true);
        assert.equal(game.context.move, 0);
        assert.match(await text(messages), /Your dagger is welded to your hand!/);
    });
}

for (const [role, canContinue] of [['caveman', false], ['barbarian', true]] as const) {
    void test(`returning to the ${role} body ${canContinue ? 'retains' : 'announces the end of'} two-weapon combat`, async () => {
        const messages = combatRoom({ role });
        requirePlayingGame(game);
        installPolymorphedHero('ettin');
        const { primary, secondary } = await equipPair();
        await rhack('X'.charCodeAt(0));
        await text(messages);

        await returnHeroToHumanForm();

        assert.equal(game.u.twoweap, canContinue);
        assert.equal(game.uwep, primary);
        assert.equal(game.uswapwep, secondary);
        const output = await text(messages);
        if (canContinue) assert.doesNotMatch(output, /no longer wield two weapons/);
        else {
            const returned = output.indexOf('You return to human form!');
            assert.ok(returned >= 0 && output.indexOf('You can no longer wield two weapons at once.') > returned, output);
        }
    });
}

for (const source of ['malignant aura', 'confused remove curse']) {
    void test(`${source} drops a newly cursed active offhand without learning its BUC`, async () => {
        const messages = combatRoom();
        requirePlayingGame(game);
        const { secondary } = await equipPair();
        secondary.bknown = false;
        await rhack('X'.charCodeAt(0));
        await text(messages);
        initRng(1n);

        if (source === 'malignant aura') await rndcurse();
        else await removeCurseEffect({ confused: true });

        assert.equal(secondary.cursed, true);
        assert.equal(secondary.where, 'floor');
        assert.equal(game.uswapwep, null);
        assert.equal(game.u.twoweap, false);
        assert.equal(secondary.bknown, false);
        assert.match(await text(messages), /Your left hand spasms and drops your short sword!/);
    });
}

void test('a fountain curse drops an active offhand at the dip boundary', async () => {
    const messages = combatRoom();
    requirePlayingGame(game);
    await setPrimaryWeapon(await addInventoryObject(DAGGER));
    const secondary = await addInventoryObject(SHORT_SWORD, { oerodeproof: true, bknown: false });
    await setSecondaryWeapon(secondary);
    await rhack('X'.charCodeAt(0));
    game.level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    await text(messages);
    initRng(1n);

    await runExtendedCommand('dip', `${secondary.invlet}y`);

    assert.equal(secondary.cursed, true);
    assert.equal(secondary.where, 'floor');
    assert.equal(game.uswapwep, null);
    assert.equal(game.u.twoweap, false);
    assert.equal(secondary.bknown, false);
    assert.match(await text(messages), /Your left hand spasms and drops your short sword!/);
});

void test('slippery hands drop an uncursed secondary without spending a turn', async () => {
    const messages = combatRoom({ hero: { glibTurns: 10 } });
    requirePlayingGame(game);
    const { secondary } = await equipPair();

    await rhack('X'.charCodeAt(0));

    assert.equal(!!game.u.twoweap, false);
    assert.equal(game.uswapwep, null);
    assert.equal(secondary.where, 'floor');
    assert.equal(game.context.move, 0);
    assert.match(await text(messages), /Your short sword slips from your left hand!/);
});

for (const key of ['w', 'x']) {
    void test(`a handless form cannot use ${key} even with an empty inventory`, async () => {
        const messages = combatRoom();
        requirePlayingGame(game);
        installPolymorphedHero('wolf');

        await rhack(key.charCodeAt(0));

        assert.equal(game.context.move, 0);
        assert.match(await text(messages), /Don't be ridiculous!/);
    });
}

void test('two-weapon combat resumes from a save and can be toggled off', async () => {
    const messages = combatRoom();
    requirePlayingGame(game);
    await equipPair();
    await rhack('X'.charCodeAt(0));
    await text(messages);
    game.plname = 'TwoWeapons';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);

    assert.equal(restoreGame('TwoWeapons', storage), true);
    await rhack('X'.charCodeAt(0));

    assert.equal(game.u.twoweap, false);
    assert.match(await text(messages), /You switch to your primary weapon\./);
});
