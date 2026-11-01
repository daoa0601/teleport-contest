import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import type { InputGate } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/mon.js';
import { initRng } from '../js/rng.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CANDELABRUM_OF_INVOCATION } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C mon.c:wiz_force_cham_form(): with monpolycontrol set in wizard mode,
// every unforced shape change prompts for the new form first. A pager that
// acknowledges a rejection consumes keys before the next prompt, so the
// script embeds those dismissals; exhaustion answers like Escape.
function scriptedInput(script: string): InputGate {
    const input = resetInputState();
    let index = 0;
    input.display = {
        async readKey() {
            const code = script.charCodeAt(index++);
            return Number.isNaN(code) ? 27 : code;
        },
    };
    return input;
}

function messageLog(): string {
    return [...game._messageHistory, game._toplines, game._pending_message].join('\n');
}

async function setupShapechanger(form: string, cham: string) {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game._monPolycontrol = true;
    const monster = await createMonsterAt(form, 11, 10, NO_MINVENT);
    monster.cham = MONSTER_NAME.indexOf(cham);
    return monster;
}

void test('monpolycontrol prompts for and applies a named form', async () => {
    const monster = await setupShapechanger('jackal', 'chameleon');
    initRng(9n);
    const input = scriptedInput('ogre\n');

    try {
        await changeMonsterForm(monster, null, game);
    } finally {
        input.display = null;
    }

    assert.match(messageLog(), /Change the jackal @ <11,10> into what\? ogre/,
        'the prompt names the current form and its position, and echoes the answer');
    assert.equal(MONSTER_NAME[monster.mnum], 'ogre');
});

void test('a rejected monpolycontrol answer retries and relabels the prompt', async () => {
    const monster = await setupShapechanger('jackal', 'chameleon');
    initRng(23n);
    const input = scriptedInput('zzzz\n zzzz\n zzzz\n zzzz\n zzzz\n');

    try {
        await changeMonsterForm(monster, null, game);
    } finally {
        input.display = null;
    }

    const log = messageLog();
    // Five prompts appeared: their getlin echoes all name the shapechanger.
    // The last rejection merges with the enough-tries line in the recall
    // history, so count prompts rather than rejection lines.
    const history = game._messageHistory.join('\n');
    assert.equal((history.match(/Change the jackal @ <11,10> into what/g) ?? []).length, 5,
        'each of the five answers rejects');
    assert.match(log, /into what kind of monster\?/,
        'the second and later prompts spell out the expected answer');
    assert.match(log, /That's enough tries!/, 'five failures give up on the player');
});

void test('monpolycontrol maps a bat class answer onto the vampire bat', async () => {
    const monster = await setupShapechanger('vampire bat', 'vampire');
    initRng(9n);
    const input = scriptedInput('B\n');

    try {
        await changeMonsterForm(monster, null, game);
    } finally {
        input.display = null;
    }

    assert.match(messageLog(), /Change the vampire bat @ <11,10> into what\? B/);
    assert.equal(MONSTER_NAME[monster.mnum], 'vampire bat',
        'a vampshifter interprets a class answer as its own form');
});

void test('a basic vampire cannot be forced into a wolf', async () => {
    const monster = await setupShapechanger('vampire bat', 'vampire');
    initRng(9n);
    const input = scriptedInput('wolf\n fog cloud\n');

    try {
        await changeMonsterForm(monster, null, game);
    } finally {
        input.display = null;
    }

    const log = messageLog();
    assert.match(log, /It can't become that\./);
    assert.equal(MONSTER_NAME[monster.mnum], 'fog cloud');
});

void test('Vlad with the Candelabrum keeps his true form on a random answer', async () => {
    const monster = await setupShapechanger('vampire bat', 'Vlad the Impaler');
    await addObjectToMonsterInventory(monster, await knownObject(CANDELABRUM_OF_INVOCATION));
    initRng(9n);
    const input = scriptedInput('*\n');

    try {
        await changeMonsterForm(monster, null, game);
    } finally {
        input.display = null;
    }

    assert.equal(MONSTER_NAME[monster.mnum], 'Vlad the Impaler',
        'an empty answer still lands on his own form, not an arbitrary one');
});

void test('a rejected answer then Escape falls back to a random form', async () => {
    const monster = await setupShapechanger('jackal', 'chameleon');
    initRng(9n);
    const input = scriptedInput('zzzz\n zzzz\n');

    try {
        await changeMonsterForm(monster, null, game);
    } finally {
        input.display = null;
    }

    const log = messageLog();
    const history = game._messageHistory.join('\n');
    assert.equal((history.match(/It can't become that\./g) ?? []).length, 2);
    assert.doesNotMatch(log, /That's enough tries!/,
        'two rejections followed by Escape are not exhaustion');
    // NON_PM from the prompt means "pick a random shape now": the change
    // completes. A random draw the accept loop rejects may legitimately
    // re-prompt, so only the outcome is pinned here.
    assert.notEqual(MONSTER_NAME[monster.mnum], 'jackal');
});

void test('a newborn shapechanger is prompted for its first form under monpolycontrol', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game._monPolycontrol = true;
    initRng(9n);
    const input = scriptedInput('ogre\n');

    let newborn: Awaited<ReturnType<typeof createMonsterAt>> | null = null;
    try {
        newborn = await createMonsterAt('chameleon', 11, 10, NO_MINVENT);
    } finally {
        input.display = null;
    }

    assert.match(messageLog(), /Change the chameleon @ <11,10> into what\? ogre/,
        'makemon() births the shapechanger through the wizard prompt');
    assert.ok(newborn);
    assert.equal(MONSTER_NAME[newborn.mnum], 'ogre');
    assert.equal(newborn.cham, MONSTER_NAME.indexOf('chameleon'));
});
