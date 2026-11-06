import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { BEAR_TRAP, TT_BEARTRAP, TT_INFLOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { setHeroTrap } from '../js/trap.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
function collectMessages() {
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    return { input, messages };
}
async function metallivoreHeldBySeenBearTrap() {
    const level = await freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('xorn');
    addTrap(level, BEAR_TRAP, game.u.ux, game.u.uy, { tseen: true });
    return level;
}
// C eat.c:3604-3619 floorfood(): a metallivore held by a seen bear trap that
// eats it answers deltrap() with reset_utrap(TRUE) (eat.c:3619), so a
// levitation source the trap had blocked returns with float_up()'s message
// and the hero leaves the ground.
void test('a metallivore eating the bear trap holding it resumes blocked levitation', async () => {
    await metallivoreHeldBySeenBearTrap();
    game.u.levitationTurns = 50;
    setHeroTrap(300, TT_BEARTRAP);
    assert.equal(game.u.levitating, false, 'the bear trap blocks the levitation source');
    const { input, messages } = collectMessages();
    input.feed(`y${' '.repeat(8)}`);
    await rhack('e'.charCodeAt(0));
    assert.equal(game.u.utrap, 0);
    const said = [...messages, game._pending_message ?? ''].join('\n');
    assert.ok(said.includes('You start to float in the air!'), 'reset_utrap(TRUE) must announce the returning levitation');
});
// C eat.c:3619 reset_utrap(TRUE): a flight source the bear trap had blocked
// returns with reset_utrap()'s own "You can fly." (trap.c:1053-1055).
void test('a metallivore eating the bear trap holding it resumes blocked flight', async () => {
    await metallivoreHeldBySeenBearTrap();
    game.u.flyingTurns = 50;
    setHeroTrap(300, TT_BEARTRAP);
    assert.equal(game.u.flying, false, 'the bear trap blocks the flight source');
    const { input, messages } = collectMessages();
    input.feed(`y${' '.repeat(8)}`);
    await rhack('e'.charCodeAt(0));
    assert.equal(game.u.utrap, 0);
    const said = [...messages, game._pending_message ?? ''].join('\n');
    assert.ok(said.includes('You can fly.'), 'reset_utrap(TRUE) must announce the returning flight');
});
// C polyself.c:976-986 polymon(): a wall-passing body leaves the floor that
// held it via reset_utrap(TRUE) (polyself.c:984), so a levitation source the
// floor had blocked returns with float_up()'s message.
void test('a rock-passing body escaping the floor resumes blocked levitation', async () => {
    await freshObjectRoom();
    requireFixtureGame(game);
    game.u.levitationTurns = 50;
    setHeroTrap(50, TT_INFLOOR);
    assert.equal(game.u.levitating, false, 'the floor blocks the levitation source');
    const { input, messages } = collectMessages();
    input.feed(' '.repeat(8));
    await polymonHero(MONSTER_NAME.indexOf('xorn'));
    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.levitating, true, 'the freed hero floats again');
    const said = [...messages, game._pending_message ?? ''].join('\n');
    assert.ok(said.includes('You start to float in the air!'), 'reset_utrap(TRUE) must announce the returning levitation');
});
//# sourceMappingURL=beartrap_eat_release.test.js.map