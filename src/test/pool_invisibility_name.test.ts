import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { POT_INVISIBILITY } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a proper-name monster becoming invisible uses its name in the possessive', async () => {
    const input = freshTurnRoom({ hero: { seeInvisible: true, uhp: 200, uhpmax: 200 } });
    const juiblex = await createMonsterAt('Juiblex', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    juiblex.minvis = false;
    juiblex.mpeaceful = false;
    juiblex.movement = 12;
    await addObjectToMonsterInventory(juiblex, await knownObject(POT_INVISIBILITY));
    input.display = { async readKey() {
        const text = requireScreenRow(0).map(cell => cell.ch).join('');
        return text.includes('--More--') ? 32 : 46;
    } };
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed('..');

    await moveloop_core();
    await moveloop_core();
    await flushPendingTopline();

    assert.ok(juiblex.minvis);
    assert.match(messages.join('\n'), /Juiblex's body takes on a strange transparency\./);
    assert.doesNotMatch(messages.join('\n'), /The Juiblex/);
});
