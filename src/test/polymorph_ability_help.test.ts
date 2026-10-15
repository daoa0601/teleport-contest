import test from 'node:test';
import assert from 'node:assert/strict';
import { POLY_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [form, help] of [
    ['wood nymph', 'remove an iron ball'],
    ['cave spider', 'hide or to spin a web'],
    ['mind flayer', 'emit a mental blast'],
] as const) {
    void test(`a polymorph trap explains how to ${help} in ${form} form`, async () => {
        const level = freshObjectRoom({ hero: { polymorphControl: true }, gameplaySeed: 2n });
        const trap = addTrap(level, POLY_TRAP, game.u.ux, game.u.uy);
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        pushKeys(` ${form}\n                        `);

        await triggerHeroTrap(trap);
        messages.push(game._pending_message);

        assert.equal(game.u.umonnum, MONSTER_NAME.indexOf(form));
        assert.ok(messages.some(message => message.includes(`Use the command #monster to ${help}.`)),
            `Missing ability explanation in: ${messages.join('\n')}`);
    });
}
