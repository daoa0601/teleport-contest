import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { STR19, W_WEP } from '../js/const.js';
import { AKLYS, BOOMERANG, CLUB, CREAM_PIE, HELMET, POT_WATER, ROCK, SCR_IDENTIFY } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, addInventoryWeapon, artifactObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('unimpaired upward throws catch returning weapons and restore their equipment slots', async () => {
    for (const weapon of ['aklys', 'Mjollnir', 'boomerang']) {
        freshObjectRoom({
            role: 'valkyrie', flags: { fixinv: false },
            hero: { acurr: { a: [STR19(25), 12, 12, 12, 12, 12] } },
        });
        const item = weapon === 'Mjollnir'
            ? await addInventoryItem(await artifactObject(weapon, { overrideIdentified: true }))
            : await addInventoryWeapon(weapon === 'aklys' ? AKLYS : BOOMERANG, { quan: weapon === 'boomerang' ? 3 : 1 });
        const alternate = await addInventoryWeapon(CLUB);
        await setSecondaryWeapon(alternate);
        if (weapon === 'boomerang')
            await setQuiverObject(item);
        else {
            await setPrimaryWeapon(item);
            setTwoWeaponCombat(true);
        }
        const letter = item.invlet;
        if (weapon === 'boomerang') {
            resetInputState().feed('<' + ' '.repeat(20));
            await rhack('f'.charCodeAt(0));
        }
        else {
            await throwInventoryObject(item, '<', ' '.repeat(20));
        }
        assert.equal(game.u.uhp, 40, `${weapon} must be caught without injury`);
        assert.equal(game._pending_message, `${weapon === 'Mjollnir' ? weapon : `The ${weapon}`} hits the ceiling and returns to your hand!`);
        assert.equal(item.where, 'inventory');
        assert.equal(item.invlet, letter);
        assert.equal(game.inventory[0], item, 'return preserves unfixed inventory order');
        assert.equal(game.uswapwep, alternate);
        if (weapon === 'boomerang') {
            assert.equal(game.uquiver, item);
            assert.equal(item.quan, 3, 'the returning piece rejoins its original stack');
        }
        else {
            assert.equal(game.uwep, item);
            assert.equal((item.owornmask ?? 0) & W_WEP, W_WEP);
            assert.equal(game.u.twoweap, true);
        }
        assert.equal(game.context.move, 1);
    }
});
void test('throwing downward announces the object hitting the floor at the hero', async () => {
    freshObjectRoom();
    const club = await addInventoryWeapon(CLUB);
    await throwInventoryObject(club, '>');
    assert.match(game._pending_message, /club hits the floor\.$/);
    assert.equal(club.where, 'floor');
    assert.equal(club.ox, game.u.ux);
    assert.equal(club.oy, game.u.uy);
    assert.equal(game.context.move, 1);
});
void test('a club tossed upward falls onto the hero before hitting the floor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const club = await addInventoryWeapon(CLUB);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    await throwInventoryObject(club, '<', ' '.repeat(20));
    assert.ok(game.u.uhp < 40, 'the falling club must injure the hero');
    assert.ok(messages.some(message => /then falls back on top of your head\.$/.test(message)));
    assert.equal(club.where, 'floor');
    assert.equal(club.ox, game.u.ux);
    assert.equal(club.oy, game.u.uy);
});
void test('a hard helmet limits falling weapon damage before the ring damage bonus', async () => {
    freshObjectRoom({ hero: { udaminc: 6 } });
    const helmet = await addInventoryObject(HELMET);
    game.uarmh = game.u.uarmh = helmet;
    const club = await addInventoryWeapon(CLUB);
    await throwInventoryObject(club, '<', ' '.repeat(20));
    assert.equal(game.u.uhp, 33);
});
void test('a scroll tossed upward falls harmlessly onto the hero', async () => {
    freshObjectRoom({ hero: { udaminc: 6 } });
    const scroll = await addInventoryObject(SCR_IDENTIFY);
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    await throwInventoryObject(scroll, '<', ' '.repeat(20));
    assert.equal(game.u.uhp, 40);
    assert.match(messages.join('\n') + game._pending_message, /It doesn't hurt\./);
    assert.equal(scroll.where, 'floor');
});
void test('firing a cream pie upward splashes onto the face when underwater', async () => {
    freshObjectRoom();
    const pie = await addInventoryObject(CREAM_PIE);
    game.underwater = true;
    await setQuiverObject(pie);
    resetInputState().feed('<' + ' '.repeat(20));
    await rhack('f'.charCodeAt(0));
    assert.ok((game.u.ucreamed ?? 0) > 0);
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.equal(pie.where, 'gone');
});
void test('a potion falling back onto the hero cuts them with its bottle', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.underwater = true;
    const potion = await addInventoryObject(POT_WATER);
    await throwInventoryObject(potion, '<', ' '.repeat(20));
    assert.ok(game.u.uhp >= 38 && game.u.uhp <= 39);
    assert.equal(potion.where, 'gone');
});
for (const wearHelmet of [false, true]) {
    void test(`a rock falling onto a xorn ${wearHelmet ? 'hits its helmet' : 'passes harmlessly through'}`, async () => {
        freshObjectRoom();
        installPolymorphedHero('xorn');
        game.underwater = true;
        if (wearHelmet) {
            const helmet = await addInventoryObject(HELMET);
            game.uarmh = game.u.uarmh = helmet;
        }
        const rock = await addInventoryObject(ROCK);
        await throwInventoryObject(rock, '<', ' '.repeat(20));
        assert.equal(game.u.mh, wearHelmet ? 39 : 40);
        assert.equal(rock.where, 'floor');
        assert.equal(rock.ox, game.u.ux);
        assert.equal(rock.oy, game.u.uy);
    });
}
void test('a named rock falling harmlessly through a xorn uses its simple name for the hit', async () => {
    freshObjectRoom();
    installPolymorphedHero('xorn');
    const rock = await addInventoryObject(ROCK, { oname: 'Ripple' });
    const messages = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };
    await throwInventoryObject(rock, '<', ' '.repeat(20));
    const text = messages.join('\n') + '\n' + game._pending_message;
    assert.match(text, /rock named Ripple (?:almost )?hits the ceiling/);
    assert.match(text, /The rock hits you but doesn't hurt\./);
    assert.equal(game.u.mh, 40);
    assert.equal(rock.where, 'floor');
    assert.equal(rock.oname, 'Ripple');
});
//# sourceMappingURL=throw_vertical.test.js.map