import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { KILLED_BY, M_AP_NOTHING, M_AP_TYPE, POOL, TIMEOUT } from '../js/const.js';
import { canSpotMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { grantIntrinsicProperty, propertyIsActive, propertyTimeout, setPropertyTimeout, } from '../js/properties.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('wizard intrinsic counts default to thirty and explicit counts extend the current timeout', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const input = resetInputState();
    const moves = game.moves;
    await selectIntrinsic(input, 'confused', undefined, [/Timeout for confused set to 30\./]);
    assert.equal(propertyTimeout('confusion'), 30);
    assert.equal(propertyIsActive('confusion'), true);
    const label = await selectIntrinsic(input, 'confused', 7, [
        /Timeout for confused increased by 7\./,
    ]);
    assert.match(label, /\[30\]$/);
    assert.equal(propertyTimeout('confusion'), 37);
    assert.equal(game.moves, moves);
    assert.equal(game.context.move, 0);
});
void test('wizard resistance timeouts saturate without removing permanent resistance', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const input = resetInputState();
    grantIntrinsicProperty('coldResistance', 'outside');
    setPropertyTimeout('coldResistance', TIMEOUT - 1);
    await selectIntrinsic(input, 'cold resistance', 5, [
        /Timeout for cold resistance increased by 5\./,
    ]);
    assert.equal(propertyTimeout('coldResistance'), TIMEOUT);
    setPropertyTimeout('coldResistance', 0);
    assert.equal(propertyIsActive('coldResistance'), true);
});
void test('wizard invulnerability and resistance expire through ordinary world turns', async () => {
    const input = freshTurnRoom({ role: 'caveman' });
    game.flags.debug = true;
    grantIntrinsicProperty('coldResistance', 'outside');
    await selectIntrinsic(input, 'fire resistance', 2, [/Timeout for fire resistance set to 2\./]);
    await selectIntrinsic(input, 'cold resistance', 2, [/Timeout for cold resistance set to 2\./]);
    await selectIntrinsic(input, 'invulnerable', 2, [/Timeout for invulnerable set to 2\./]);
    assert.equal(propertyIsActive('fireResistance'), true);
    assert.equal(propertyIsActive('invulnerable'), true);
    const moves = game.moves;
    input.feed('...');
    await moveloop_core();
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.moves, moves + 2);
    assert.equal(propertyIsActive('fireResistance'), false);
    assert.equal(propertyTimeout('coldResistance'), 0);
    assert.equal(propertyIsActive('coldResistance'), true);
    assert.equal(propertyIsActive('invulnerable'), false);
});
void test('wizard petrification bypasses resistance but preserves an active death deadline', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const input = resetInputState();
    grantIntrinsicProperty('stoneResistance', 'outside');
    await selectIntrinsic(input, 'petrifying', 8, [/You are turning into stone\./]);
    assert.equal(propertyTimeout('stoned'), 8);
    assert.equal(game.u.stoneKiller, '#wizintrinsic');
    assert.equal(game.u.stoneKillerFormat, KILLED_BY);
    await selectIntrinsic(input, 'petrifying', 20, []);
    assert.equal(propertyTimeout('stoned'), 8);
    assert.equal(game.u.stoneKiller, '#wizintrinsic');
});
void test('wizard sliming preserves its active death deadline', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const input = resetInputState();
    await selectIntrinsic(input, 'becoming slime', 9, [/You are turning into slime\./]);
    await selectIntrinsic(input, 'becoming slime', 40, []);
    assert.equal(propertyTimeout('slimed'), 9);
});
void test('wizard sickness keeps its deadline while applying the native worsening message', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const input = resetInputState();
    await selectIntrinsic(input, 'fatally sick', 8, [/You feel deathly sick\./]);
    await selectIntrinsic(input, 'fatally sick', 30, [/You feel even worse\./]);
    assert.equal(propertyTimeout('sick'), 8);
    assert.equal(game.u.sickCause, '#wizintrinsic');
});
void test('wizard monster warning senses grid bugs through blindness', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const input = resetInputState();
    const bug = await createMonsterAt('grid bug', 11, 10);
    const goblin = await createMonsterAt('goblin', 12, 10);
    await selectIntrinsic(input, 'blinded', 10, [/A cloud of darkness falls upon you\./]);
    assert.equal(canSpotMonster(bug), false, 'blind hero cannot identify the grid bug before warning');
    await selectIntrinsic(input, 'warn: monster type or class', 5, [
        /Timeout for warn: monster type or class set to 5\./,
    ]);
    assert.equal(canSpotMonster(bug), true, 'grid bug becomes identifiable through warning');
    assert.equal(canSpotMonster(goblin), false, 'species warning must not reveal the goblin');
});
void test('wizard water walking lifts a submerged hero to the surface immediately', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const input = resetInputState();
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    game.u.uinwater = 1;
    game.underwater = true;
    await selectIntrinsic(input, 'water walking', 4, [
        /Timeout for water walking set to 4\./,
        /You slowly rise above the surface\./,
    ]);
    assert.equal(game.u.uinwater, 0);
    assert.equal(game.underwater, false);
    assert.equal(propertyIsActive('waterWalking'), true);
});
void test('wizard shapechanger protection restores a changed monster and reveals a mimic', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const input = resetInputState();
    const shifter = await createMonsterAt('chameleon', 11, 10);
    await changeMonsterForm(shifter, MONSTER_NAME.indexOf('grid bug'));
    const mimic = await createMonsterAt('large mimic', 12, 10);
    assert.notEqual(M_AP_TYPE(mimic), M_AP_NOTHING);
    await selectIntrinsic(input, 'protection from shape changers', 5, [
        /Timeout for protection from shape changers set to 5\./,
        /grid bug turns into a chameleon/,
    ]);
    assert.equal(MONSTER_NAME[shifter.mnum], 'chameleon');
    assert.equal(shifter.cham, -1);
    assert.equal(M_AP_TYPE(mimic), M_AP_NOTHING);
    assert.equal(mimic.msleeping, 1);
});
// Select by the actual displayed label so menu pagination and accelerators
// remain part of the public command exercised by each behavior check.
async function selectIntrinsic(input, name, count, messages) {
    input.feed('wizintrinsic\n');
    const command = rhack('#'.charCodeAt(0));
    const completed = command.then(() => 'completed');
    for (let page = 0; page < 5; page++) {
        const boundary = await Promise.race([
            completed,
            input.waitUntilBlocked().then(() => 'input'),
        ]);
        assert.equal(boundary, 'input', `The intrinsic menu ended before showing ${name}`);
        assert.ok(game.nhDisplay, 'The intrinsic menu needs a live display');
        const rows = game.nhDisplay.grid.map((row) => row
            .map((cell) => cell.ch)
            .join('')
            .trim());
        for (const row of rows) {
            const selection = /^([a-zA-Z]) [-+#] (.+)$/.exec(row);
            const key = selection?.[1];
            const label = selection?.[2];
            if (!key || !label || label.replace(/\s+\[\d+\]$/, '') !== name)
                continue;
            input.feed(`${count ?? ''}${key}\n`);
            await answerPrompts(command, input, messages.map((prompt) => ({ prompt, keys: ' ' })));
            return label;
        }
        input.feed(' ');
    }
    input.feed('\x1b');
    await command;
    assert.fail(`The wizard menu never offered ${name}`);
}
//# sourceMappingURL=wizard_intrinsics.test.js.map