import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { game } from '../js/gstate.js';
import { hitHeroWithRay } from '../js/hero_breath.js';
import { resetInputState } from '../js/input.js';
import { AD_DISN, AT_BREA } from '../js/monster_attack_types.js';
import { CLOAK_OF_DISPLACEMENT } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('fatal disintegration proceeds from cloak loss to the wizard death question', async () => {
    freshObjectRoom({ flags: { debug: true } });
    wearHeroArmor(await addInventoryObject(CLOAK_OF_DISPLACEMENT));
    const messages: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            const row = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
            messages.push(row);
            if (row.startsWith('Die?')) return 'n'.charCodeAt(0);
            const screen = game.nhDisplay?.grid.map(line => line.map(cell => cell.ch).join('')).join('\n') ?? '';
            assert.match(screen, /--More--/);
            return 32;
        },
    };

    await hitHeroWithRay({
        attack: [AT_BREA, AD_DISN, 6, 6], source: 'monster-breath', nativeType: -24,
        random: limit => limit - 1, name: 'blast of disintegration',
    });

    assert.ok(messages.some(message => message.startsWith('Die?')));
    assert.equal(messages.some(message => message.includes('You die...')), false,
        'zhitu() calls done() directly without the losehp() death announcement');
});
