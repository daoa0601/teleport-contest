import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { artifactByName } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { flush_screen, flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    AKLYS, AMULET_OF_LIFE_SAVING, BATTLE_AXE, CORPSE, DAGGER,
    LEATHER_GLOVES, OBJECT_NAMES, SMALL_SHIELD,
} from '../js/object_data.js';
import { pickupAtHero } from '../js/pickup.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
import { createStaffedShop } from './support/shop.js';

function readinessRoom() {
    freshObjectRoom({ role: 'rogue' });
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, {
        expected: /wield|hand|weapon|axe|shield|stone|wait|medallion|better|saber|control|tether|dagger|blasted/,
        limit: 30,
    });
    input.beforeRead = () => { messages.push(game._pending_message); };
    return messages;
}

for (const command of ['w', 'x']) {
    void test(`${command} refuses a two-handed axe with a shield and keeps both weapon slots`, async () => {
        readinessRoom();
        const dagger = await addInventoryObject(DAGGER);
        const axe = await addInventoryObject(BATTLE_AXE);
        const shield = await addInventoryObject(SMALL_SHIELD);
        await setPrimaryWeapon(dagger);
        await setSecondaryWeapon(axe);
        game.uarms = game.u.uarms = shield;

        if (command === 'w') pushKeys(axe.invlet);
        await rhack(command.charCodeAt(0));

        assert.equal(game.uwep, dagger);
        assert.equal(game.uswapwep, axe);
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, 'You cannot wield a two-handed axe while wearing a shield.');
    });

    void test(`${command} life-saves bare-handed cockatrice wielding without installing the corpse`, async () => {
        const messages = readinessRoom();
        const dagger = await addInventoryObject(DAGGER);
        const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
        await setPrimaryWeapon(dagger);
        await setSecondaryWeapon(corpse);
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');

        if (command === 'w') pushKeys(corpse.invlet);
        await rhack(command.charCodeAt(0));
        await flushPendingTopline();

        assert.equal(game.uwep, dagger);
        assert.equal(game.uswapwep, corpse);
        assert.equal(game.inventory.includes(amulet), false);
        assert.equal(game.context.move, 1);
        assert.match(messages.join('\n'), /You wield the cockatrice corpse in your bare hands\./);
    });
}

void test('swapping to an incompatible artifact checks its touch refusal', async () => {
    readinessRoom();
    const dagger = await addInventoryObject(DAGGER);
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    const sword = await addInventoryObject(artifact.baseType, {
        oartifact: artifact.id, oextra: { oname: artifact.name },
    });
    await setPrimaryWeapon(dagger);
    await setSecondaryWeapon(sword);

    await rhack('x'.charCodeAt(0));

    assert.equal(game.uwep, dagger);
    assert.equal(game.uswapwep, sword);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /beyond your control/);
});

void test('a silver-hating form cannot wield an ordinary silver weapon', async () => {
    readinessRoom();
    game.u.umonnum = MONSTER_NAME.indexOf('vampire');
    game.u.mh = game.u.mhmax = 40;
    const saber = await addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));

    pushKeys(saber.invlet);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uwep, null);
    assert.ok(game.u.mh < 40);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /can't handle your silver saber/);
});

void test('gloves permit wielding a cockatrice corpse', async () => {
    readinessRoom();
    const gloves = await addInventoryObject(LEATHER_GLOVES);
    game.uarmg = game.u.uarmg = gloves;
    const corpse = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });

    pushKeys(corpse.invlet);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uwep, corpse);
    assert.equal(game.context.move, 1);
});

void test('empty hands use the gloved description', async () => {
    readinessRoom();
    const gloves = await addInventoryObject(LEATHER_GLOVES);
    game.uarmg = game.u.uarmg = gloves;

    pushKeys('-');
    await rhack('w'.charCodeAt(0));

    assert.equal(game._pending_message, 'You are already empty handed.');
    assert.equal(game.context.move, 0);
});

// C doswapweapon(): with neither slot set, ready_weapon(Null) reports the
// unchanged empty hand and uwep == oldwep still holds, so the failed-wield
// branch restores the (empty) secondary and never announces a missing one.
void test('swapping with no weapons reports the unchanged hand once', async () => {
    readinessRoom();
    // A hero whose slots were never populated (fresh u_init without a
    // starting weapon) keeps the optional fields unset rather than null.
    delete game.uwep;
    delete game.uswapwep;
    delete game.u.uwep;
    delete game.u.uswapwep;

    await rhack('x'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(game._pending_message, 'You are already bare handed.');
    assert.equal(
        requireScreenRow(0).map(cell => cell.ch).join('').trim(),
        'You are already bare handed.',
    );
    assert.equal(game.uwep ?? null, null);
    assert.equal(game.uswapwep ?? null, null);
    assert.equal(game.context.move, 0);
});

void test('wielding an uncursed aklys secures its tether', async () => {
    const messages = readinessRoom();
    const aklys = await addInventoryObject(AKLYS);

    pushKeys(aklys.invlet);
    await rhack('w'.charCodeAt(0));
    await flushPendingTopline();

    assert.equal(game.uwep, aklys);
    assert.match(messages.join('\n'), /You secure the tether\./);
});

for (const quantity of [1, 5]) {
    void test(`wielding ${quantity} unpaid dagger${quantity === 1 ? '' : 's'} names the shopkeeper's goods with the right number`, async () => {
        readinessRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Izchak';
        const daggers = await floorObject(DAGGER, game.u.ux, game.u.uy, { quan: quantity });
        await pickupAtHero();
        assert.ok(daggers.unpaid, 'Picking up shop stock must leave it unpaid');
        assert.ok(daggers.invlet, 'The shop goods need an inventory selection letter');

        pushKeys(daggers.invlet);
        await rhack('w'.charCodeAt(0));

        assert.equal(game.uwep, daggers);
        assert.equal(game.context.move, 1);
        assert.equal(game._pending_message,
            `Izchak says "You be careful with my ${quantity === 1 ? 'dagger' : 'daggers'}!"`);
    });
}
