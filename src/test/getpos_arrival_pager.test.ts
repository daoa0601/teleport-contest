import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { controlMonsterTeleport } from '../js/teleport.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('targeting restores its goal after a notice while arrival map output is paused', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: true } });
    game._mapFlushPaused = true;
    const input = resetInputState();

    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
    }), input, [
        { prompt: /^Choose a location\./, keys: '#' },
        { prompt: /^Automatic description of features under cursor is off\.--More--/, keys: ' ' },
        { prompt: /^Move cursor to a location: *\n/, keys: '.' },
    ]);

    assert.equal(selected?.x, 10);
});

void test('an unknown key ends monster targeting and offers to force the invalid destination', async () => {
    await freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
    const monster = await createMonsterAt('goblin', 12, 10);
    game._monTelecontrol = true;
    const input = resetInputState();

    const destination = await answerPrompts(controlMonsterTeleport(monster, { x: 12, y: 10 }), input, [
        { prompt: /^Teleport the goblin/, keys: 'w' },
        { prompt: /^Unknown direction: 'w' \(aborted\)\.  Done\.--More--/, keys: ' ' },
        { prompt: /<12,10> is not considered viable; force anyway\?/, keys: 'y' },
    ]);

    assert.equal(destination?.x, -1);
    assert.equal(destination?.y, 0);
});
