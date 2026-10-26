import assert from 'node:assert/strict';
import test from 'node:test';
import { gameLogEvents } from '../js/gamelog.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKillOutcome } from '../js/hero_monster_death.js';
import { gotoLevel } from '../js/level_change.js';
import { pushKeys } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { freshConnectedLevels } from './support/connected-levels.js';
function logTexts() {
    return gameLogEvents().map(event => event.text);
}
// mon.c:xkilled() livelog-prints the murder of a tame monster, keeping any
// given name and the hero's possessive pronoun (insight.c:#chronicle then
// shows it under "Logged events:").  The first kill of the game also logs
// exper.c's "killed for the first time".
void test('killing a tame kitten chronicles the murder with the hero pronoun', async () => {
    freshObjectRoom({ role: 'valkyrie' });
    game.flags.female = false;
    const kitten = await createMonsterAt('kitten', 11, 10);
    kitten.mtame = 1;
    await finishHeroMonsterKillOutcome(kitten, 11, 10, { noCorpse: true });
    assert.deepEqual(logTexts(), ['killed for the first time', 'murdered his faithful kitten']);
});
void test('killing a named pet chronicles the given name first', async () => {
    freshObjectRoom({ role: 'valkyrie' });
    game.flags.female = true;
    const dog = await createMonsterAt('little dog', 11, 10);
    dog.mtame = 1;
    dog.mgivenname = 'Slasher';
    await finishHeroMonsterKillOutcome(dog, 11, 10, { noCorpse: true });
    assert.deepEqual(logTexts(), ['killed for the first time', 'murdered Slasher, her faithful little dog']);
});
// A peaceful non-tame death costs alignment but leaves no murder line.
void test('killing a peaceful monster does not chronicle a murder', async () => {
    freshObjectRoom({ role: 'valkyrie' });
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mpeaceful = 1;
    await finishHeroMonsterKillOutcome(jackal, 11, 10, { noCorpse: true });
    assert.deepEqual(logTexts(), ['killed for the first time']);
});
// do.c:goto_level() livelog-prints "entered <level>" with describe_level()'s
// branch name after arriving on a freshly generated level.
void test('arriving on a new level chronicles the level entry', async () => {
    freshConnectedLevels({ generateDestination: true });
    pushKeys(' '.repeat(4));
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    assert.deepEqual(logTexts(), ['entered level 2, the Dungeons of Doom']);
});
//# sourceMappingURL=gamelog_events.test.js.map