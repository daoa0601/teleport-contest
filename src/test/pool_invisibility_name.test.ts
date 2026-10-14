import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterName, possessiveName } from '../js/monster_name.js';
import { POT_INVISIBILITY, WAN_MAKE_INVISIBLE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
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

for (const type of [POT_INVISIBILITY, WAN_MAKE_INVISIBLE]) {
    void test(`invisibility from ${type === POT_INVISIBILITY ? 'drinking' : 'zapping'} names item use before describing the hallucinated body`, async () => {
        freshObjectRoom({ hero: { seeInvisible: true, hallucinationTurns: 20 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.minvis = false;
        monster.movement = 12;
        await addObjectToMonsterInventory(monster, await knownObject(type, { spe: 3 }));
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        const input = resetInputState();
        installPagerInput(input, { expected: /drinks|zap|transparency/, limit: 12 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        initRng(29n);
        const user = monsterName(monster, { capitalized: true });
        const body = possessiveName(monsterName(monster, { capitalized: true }));
        initRng(29n);

        await finishAtCommandInput(input, moveloop_core, /transparency/);

        const feedback = messages.join('\n');
        assert.ok(feedback.startsWith(user),
            `The first perceived identity must describe item use: ${feedback}`);
        assert.ok(feedback.includes(`${body} body takes on a normal transparency.`),
            `The next perceived identity must describe invisibility: ${feedback}`);
    });
}
