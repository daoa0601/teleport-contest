import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { selectInventoryObject } from '../js/invent.js';
import { BELL_OF_OPENING, FOOD_RATION, GOLD_PIECE, MAGIC_HARP, POT_BOOZE, RIN_PROTECTION, SHORT_SWORD, } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { readObjectName, simpleObjectNameWithArticle } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
async function petPickupMessage(role, type, properties) {
    const input = freshTurnRoom({ role, left: 10, right: 11, top: 10, bottom: 10,
        flags: { pickup: false, verbose: true } });
    const dog = await createPet();
    const object = await floorObject(type, 10, 10, properties);
    let message = '';
    let reads = 0;
    input.display = {
        async readKey() {
            assert.ok(++reads < 400, 'Pet pickup should finish within a few dozen swaps');
            const line = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
            if (line.includes('picks up'))
                message = line.trimEnd();
            if (line.includes('--More--'))
                return ' '.charCodeAt(0);
            return (game.u.ux === 10 ? 'l' : 'h').charCodeAt(0);
        },
    };
    input.beforeRead = () => {
        const line = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        if (line.includes('picks up'))
            message = line.trimEnd();
    };
    try {
        initRng(3n);
        for (let turn = 0; turn < 100 && !message; turn++)
            await moveloop_core();
        assert.ok(message, 'The pet must pick up the floor object');
        assert.ok(dog.minvent.includes(object), 'The announced object must reach the pet inventory');
        return message;
    }
    finally {
        input.display = null;
        input.beforeRead = null;
    }
}
async function createPet() {
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog);
    assert.ok(dog.edog, 'The dog must have pet state');
    dog.edog.apport = 1;
    return dog;
}
void test('a Samurai pet pickup uses sake and preserves dilution and blessing knowledge', async () => {
    const message = await petPickupMessage('samurai', POT_BOOZE, {
        bknown: true, blessed: true, odiluted: true,
    });
    assert.equal(message, 'The little dog picks up a blessed diluted potion of sake.');
});
void test('other roles keep booze in the same pet pickup feedback', async () => {
    const message = await petPickupMessage('caveman', POT_BOOZE, { bknown: false });
    assert.equal(message, 'The little dog picks up a potion of booze.');
});
for (const quantity of [1, 2]) {
    void test(`the inventory help menu names ${quantity} gold piece${quantity === 1 ? '' : 's'} with native quantity grammar`, async () => {
        freshObjectRoom();
        await addInventoryObject(GOLD_PIECE, { quan: quantity, invlet: '$' });
        await addInventoryObject(FOOD_RATION, { invlet: 'a' });
        const input = resetInputState();
        const action = selectInventoryObject();
        await input.waitUntilBlocked();
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        input.feed(' ');
        await action;
        assert.match(text, /Coins/);
        assert.match(text, quantity === 1 ? /\$ - a gold piece\b/ : /\$ - 2 gold pieces\b/);
    });
}
void test('simple Samurai names retain class nouns while omitting dilution and individual names', async () => {
    freshObjectRoom({ role: 'samurai' });
    const potion = await knownObject(POT_BOOZE, { odiluted: true, oname: 'Dinner' });
    assert.equal(simpleObjectNameWithArticle(potion), 'a potion of sake');
    assert.equal(potion.odiluted, true);
    assert.equal(potion.oname, 'Dinner');
});
void test('simple names hide unknown identities and called names without observing the object', async () => {
    freshObjectRoom();
    const ring = await knownObject(RIN_PROTECTION, { typeKnown: false, dknown: false });
    recordObjectCall(RIN_PROTECTION, 'Luck');
    assert.equal(simpleObjectNameWithArticle(ring), 'a ring');
    assert.equal(ring.dknown, false);
});
void test('a simple unique bell name uses its definite article', async () => {
    freshObjectRoom();
    const bell = await knownObject(BELL_OF_OPENING);
    assert.equal(simpleObjectNameWithArticle(bell), 'the Bell of Opening');
});
const wishRoles = ['samurai', 'caveman'];
for (const role of wishRoles) {
    void test(`${role} wishes accept Japanese item names, including qualified potions and plurals`, async () => {
        freshObjectRoom({ role, gameplaySeed: 6103n });
        const potion = await readObjectName('2 potions of sake', { wizardWish: true });
        const sword = await readObjectName('wakizashi', { wizardWish: true });
        const harp = await readObjectName('magic koto', { wizardWish: true });
        assert.ok(potion && !potion.noWish, 'The sake wish must create a potion');
        assert.equal(potion.object.otyp, POT_BOOZE);
        assert.equal(potion.object.quan, 2);
        assert.ok(sword && !sword.noWish, 'The wakizashi wish must create a sword');
        assert.equal(sword.object.otyp, SHORT_SWORD);
        assert.ok(harp && !harp.noWish, 'The magic koto wish must create a harp');
        assert.equal(harp.object.otyp, MAGIC_HARP);
    });
}
//# sourceMappingURL=object_naming_unit.test.js.map