import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import type { InputGate } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
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
    freshObjectRoom({ flags: { debug: true } });
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
    assert.equal((log.match(/It can't become that\./g) ?? []).length, 5,
        'each of the five answers rejects');
    assert.match(log, /into what kind of monster\?/,
        'the second and later prompts spell out the expected answer');
    assert.match(log, /That's enough tries!/, 'five failures give up on the player');
    assert.notEqual(MONSTER_NAME[monster.mnum], 'zzzz');
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
