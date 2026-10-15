import { advanceHeroSliming } from './support/condition-turn.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroDeath } from '../js/end.js';
import { resetInputState } from '../js/input.js';
import { LEATHER_CLOAK } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';

import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';

void test('sliming announces the new body before breaking the cloak clasp', async () => {
    freshObjectRoom({ flags: { female: false }, hero: { slimedTurns: 1, slimed: true } });
    requirePlayingGame(game);
    wearHeroArmor(await addInventoryObject(LEATHER_CLOAK));
    const input = resetInputState();
    installPagerInput(input, { expected: /slime|cloak|command/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await advanceHeroSliming({ transform: polymonHero, publish: plineWithContinuation,
        die: async () => true });
    await flushPendingTopline();

    assert.match(messages.join('\n'), /You have become a green slime\.  You turn into a green slime!/);
    assert.match(messages.join('\n'), /clasp on your cloak breaks open/);
});

void test('the fatal slime condition stays visible during the explore death question', async () => {
    freshObjectRoom({ flags: { explore: true, female: false }, hero: { slimedTurns: 1, slimed: true } });
    const input = resetInputState();
    let questions = 0;
    input.display = { async readKey() {
        const text = requireScreenRow(0).map(cell => cell.ch).join('');
        if (text.includes('Die?')) {
            assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bSlime\b/);
            questions++;
            return 110;
        }
        return 32;
    } };

    await advanceHeroSliming({ transform: polymonHero, publish: plineWithContinuation, die: finishHeroDeath });

    assert.equal(questions, 1);
    assert.equal(game.u.slimed, false);
});
