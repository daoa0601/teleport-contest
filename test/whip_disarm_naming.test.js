import test from 'node:test';
import assert from 'node:assert/strict';
import { resetInputState } from '../js/input.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BULLWHIP, CLUB, OBJECT_NAMES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
const KNIFE = OBJECT_NAMES.indexOf('knife');
async function wieldedWhip() {
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = whip;
    return whip;
}
function captureMessages() {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    return messages;
}
// C apply.c:3166: the wrap message names the weapon with yname(), whose
// shk_your() prefixes the carrier ("the soldier's") and whose cxname()
// carries no beatitude even when the hero knows it.
void test('a bullwhip wrap names the wielded weapon with its monster owner', async () => {
    freshPlayableRoom({ role: 'tourist' });
    const whip = await wieldedWhip();
    const knife = await knownObject(KNIFE, { cursed: true });
    const soldier = await createMonsterAt('soldier', 11, 10);
    await equipMonsterObject(soldier, knife, W_WEP);
    const messages = captureMessages();
    await applyInventoryObject(whip, 'l ');
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /You wrap your bullwhip around the soldier's knife\./);
    assert.doesNotMatch(text, /cursed/);
    assert.match(text, /The bullwhip slips free\./);
});
// C apply.c:3168-3170: the welded message uses mhis(mtmp), the monster's
// pronoun — never its name with a possessive suffix.
void test('a welded weapon is named by its owner pronoun', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    const whip = await wieldedWhip();
    const knife = await knownObject(KNIFE, { cursed: true, bknown: false });
    const soldier = await createMonsterAt('soldier', 11, 10);
    await equipMonsterObject(soldier, knife, W_WEP);
    const messages = captureMessages();
    await applyInventoryObject(whip, 'l ');
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /You wrap your bullwhip around the soldier's knife\./);
    assert.match(text, /It is welded to his hand!/);
    assert.doesNotMatch(text, /welded to the soldier's/);
    assert.match(text, /The bullwhip slips free\./);
    assert.equal(knife.bknown, true);
});
// C apply.c:3235-3236: the disarm's default branch reports the(onambuf)
// and s_suffix(mon_nam(mtmp)) — "the club" plain, without beatitude or
// enchantment, and the monster's own name.
void test('a yanked weapon falls under its owner named without adornment', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    const whip = await wieldedWhip();
    const club = await knownObject(CLUB, { spe: 0 });
    const bugbear = await createMonsterAt('bugbear', 11, 10);
    await equipMonsterObject(bugbear, club, W_WEP);
    const messages = captureMessages();
    initRng(7105n);
    await applyInventoryObject(whip, 'l ');
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /You wrap your bullwhip around the bugbear's club\./);
    assert.match(text, /You yank the club from the bugbear's hand!/);
    assert.doesNotMatch(text, /\+0 club from/);
});
//# sourceMappingURL=whip_disarm_naming.test.js.map