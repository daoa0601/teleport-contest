import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_DESCRIPTIONS, POT_HEALING, RIN_PROTECTION } from '../js/object_data.js';
import { objectClassForType, recordObjectCall, recordObjectKnowledge } from '../js/object_knowledge.js';
import { applyNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a long discovery call name wraps without losing its unidentified appearance', async () => {
    freshObjectRoom();
    recordObjectKnowledge(POT_HEALING);
    recordObjectCall(POT_HEALING, 'a very familiar remedy which I keep in reserve for emergencies');
    const input = resetInputState();
    let text = '';
    input.display = {
        async readKey(): Promise<number> {
            text += requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            return 32;
        },
    };
    try {
        await rhack('\\'.charCodeAt(0));
        assert.ok(text.includes('emergencies'));
        assert.ok(text.includes(`(${game.objectDescriptions?.[POT_HEALING]})`),
            'the appearance belongs on a continuation row when the call name fills the first row');
    } finally {
        input.display = null;
    }
});

void test('sortloot discovers later classes only after the earlier text pages are dismissed', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=sortdiscoveries:s');
    for (let type = 18; type < OBJECT_DESCRIPTIONS.length; type++)
        if (objectClassForType(type) === 3 && OBJECT_DESCRIPTIONS[type]) recordObjectKnowledge(type);
    recordObjectKnowledge(RIN_PROTECTION);
    const input = resetInputState();
    let pages = 0;
    input.display = {
        async readKey(): Promise<number> {
            if (++pages === 1) assert.equal(game._encounteredObjectTypes?.has(RIN_PROTECTION), false,
                'a ring has not been classified while the armor list is still being displayed');
            assert.ok(pages <= 8, 'discoveries must finish within eight pages');
            return 32;
        },
    };
    try {
        await rhack('\\'.charCodeAt(0));
        assert.ok(pages >= 2);
        assert.equal(game._encounteredObjectTypes?.has(RIN_PROTECTION), true);
    } finally {
        input.display = null;
    }
});
