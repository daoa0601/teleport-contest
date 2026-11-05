import test from 'node:test';
import assert from 'node:assert/strict';

import { findArmorClass, projectedArmorClass, wearHeroArmor } from '../js/do_wear.js';
import { POLY_TRAP } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { HAWAIIAN_SHIRT, TIN_OPENER } from '../js/object_data.js';
import { dotrap } from '../js/trap.js';
import { setPrimaryWeapon } from '../js/wield.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C polyself.c polymon(): break_armor() (line 888) and drop_weapon() (line
// 889) both pline() before find_ac() runs (line 890).  No body-armor
// transition recomputes u.uac on the way there — setworn()/setnotworn()
// (worn.c:73,150) and Armor_off()/Armor_gone() (do_wear.c) call no
// find_ac() — so when drop_weapon()'s pager flushes the screen through
// vpline()'s flush_screen() (pline.c:273), the status line still carries
// the pre-polymorph armor class while the monster HP and hit dice are
// already live.

async function wearShirtAndTinOpener(): Promise<number> {
    const shirt = await addInventoryObject(HAWAIIAN_SHIRT, { spe: 3 });
    await wearHeroArmor(shirt);
    const opener = await addInventoryObject(TIN_OPENER);
    await setPrimaryWeapon(opener);
    return findArmorClass();
}

function captureStatusAtShirtPage(): { capture: () => void, status: () => string } {
    let statusAtShirt = '';
    return {
        capture: () => {
            if (/shirt rips/.test(game._pending_message || ''))
                statusAtShirt = game.nhDisplay?.statusLines?.[1] ?? '';
        },
        status: () => statusAtShirt,
    };
}

void test('a slime polymorph pages the armor-break message with the pre-polymorph AC', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    const before = await wearShirtAndTinOpener();
    assert.equal(before, 7, 'a hero in a +3 shirt has AC 7 before the change');

    const page = captureStatusAtShirtPage();
    const input = resetInputState();
    input.beforeRead = page.capture;
    initRng(11n);
    pushKeys('polyself\ngreen slime\n' + ' '.repeat(30));

    await rhack('#'.charCodeAt(0));

    assert.match(page.status(), /AC:7\b/,
        'break_armor() and drop_weapon() page before polymon() calls find_ac()');
    assert.equal(game.u.uac, projectedArmorClass(game),
        'polymon() recomputes the armor class once the form settles');
    assert.equal(game.uarmu ?? game.u.uarmu, null);
});

void test('a polymorph trap pages the armor-break message with the pre-polymorph AC', async () => {
    const level = await freshObjectRoom({ hero: { polymorphControl: true }, gameplaySeed: 2n });
    const before = await wearShirtAndTinOpener();
    assert.equal(before, 7);

    const trap = addTrap(level, POLY_TRAP, 10, 10);
    const page = captureStatusAtShirtPage();
    const input = resetInputState();
    let answeredForm = false;
    input.beforeRead = () => {
        const visible = (game.nhDisplay?.grid ?? [])
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (!answeredForm && /Become what kind of monster/.test(visible)) {
            answeredForm = true;
            input.feed('black pudding\n');
            return;
        }
        page.capture();
        input.feed(' ');
    };

    await dotrap(trap);

    assert.ok(answeredForm, 'the trap asks for the new form');
    assert.match(page.status(), /AC:7\b/,
        'the trap polymorph keeps the old AC through the shirt message');
    assert.equal(game.u.uac, projectedArmorClass(game));
    assert.equal(game.uarmu ?? game.u.uarmu, null);
});
