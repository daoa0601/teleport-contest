import test from 'node:test';
import assert from 'node:assert/strict';
import { DBWALL, DB_FLOOR, DB_NORTH, DRAWBRIDGE_UP, NO_MINVENT } from '../js/const.js';
import { destroyDrawbridge } from '../js/dbridge.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { setPropertyTimeout } from '../js/properties.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

async function collapseRoom(invisible: boolean) {
    const level = freshGameplayRoom();
    const span = level.requireAt(12, 10);
    span.typ = DRAWBRIDGE_UP;
    span.drawbridgemask = DB_NORTH | DB_FLOOR;
    level.requireAt(12, 9).typ = DBWALL;
    const goblin = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    goblin.mhp = goblin.mhpmax = 1000;
    goblin.minvis = invisible;
    pushKeys(' '.repeat(100));
    return goblin;
}

function displayedMessages() {
    return [...game._messageHistory, game._toplines, game._pending_message].join('\n');
}

void test('an unseen monster hit by drawbridge shrapnel makes a crushing sound', async () => {
    const goblin = await collapseRoom(true);

    await destroyDrawbridge(12, 10);

    assert.ok(goblin.mhp <= 0);
    assert.match(displayedMessages(), /You hear a crushing sound\./);
});

void test('a deaf sleeping hero does not dream the caller-guarded shrapnel sound', async () => {
    await collapseRoom(true);
    setPropertyTimeout('deaf', 10);
    await putHeroToSleep(5);

    await destroyDrawbridge(12, 10);

    assert.doesNotMatch(displayedMessages(), /crushing sound/);
});

void test('hallucination describes a monster crushed by bridge debris as heavy metal', async () => {
    const goblin = await collapseRoom(false);
    game.u.hallucinationTurns = 10;

    await destroyDrawbridge(12, 10);

    assert.ok(goblin.mhp <= 0);
    assert.match(displayedMessages(), /gets into some heavy metal!/);
});
