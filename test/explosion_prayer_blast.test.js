import assert from 'node:assert/strict';
import test from 'node:test';
// C explode.c:explode() shields the hero only via the timed INVULNERABLE
// property; prayer's u.uinvulnerable (u.invulnerable here) never blocks or
// zeroes explosion damage.
import { EXPL_NOXIOUS, MON_EXPLODE, PHYS_EXPL_TYPE } from '../js/const.js';
import { explode } from '../js/explosion.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
function blastRoom() {
    freshObjectRoom({ left: 5, right: 21, hero: { uhp: 100, uhpmax: 100 }, flags: { verbose: true } });
    const messages = [];
    return messages;
}
void test('prayer protection does not spare the hero from a blast', async () => {
    const messages = blastRoom();
    game.u.invulnerable = true;
    await explode(10, 10, PHYS_EXPL_TYPE, 12, MON_EXPLODE, EXPL_NOXIOUS, { killer: "gas spore's explosion", publish: async (message) => { messages.push(message); } });
    assert.ok(!messages.includes('You are unharmed!'), messages.join(' | '));
    assert.equal(game.u.uhp, 88);
});
void test('the timed invulnerability property still nullifies blast damage', async () => {
    const messages = blastRoom();
    game.u.invulnerableTurns = 5;
    await explode(10, 10, PHYS_EXPL_TYPE, 12, MON_EXPLODE, EXPL_NOXIOUS, { killer: "gas spore's explosion", publish: async (message) => { messages.push(message); } });
    assert.ok(messages.includes('You are unharmed!'), messages.join(' | '));
    assert.equal(game.u.uhp, 100);
});
//# sourceMappingURL=explosion_prayer_blast.test.js.map