import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a blind hero feels a water demon and receives its wish without seeing its gender', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 20, uz: { dnum: 0, dlevel: 1 }, ulevel: 1 } });
    setHeroBlindnessTurns(20);
    vision_recalc(0);
    level.requireAt(10, 10).typ = FOUNTAIN;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    let replies = 0;
    input.display = {
        async readKey() {
            assert.ok(++replies <= 4, 'The demon release and wish have at most three message pages');
            if (/^For what do you wish/.test(game._pending_message)) {
                input.feed('othing\n');
                return 'n'.charCodeAt(0);
            }
            return 32;
        },
    };
    input.feed('y');
    initRng(80n);
    await rhack('q'.charCodeAt(0));
    assert.match(messages.join('\n'), /You feel the presence of evil\./);
    assert.match(messages.join('\n'), /Grateful for its release, it grants you a wish!/);
    assert.equal(level.monsters.length, 0, 'The wish-granting demon departs');
});
//# sourceMappingURL=fountain_actor_senses.test.js.map