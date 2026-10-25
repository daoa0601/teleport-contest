import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { initRng, rnd, rn2 } from '../js/rng.js';
import { throneSitEffect } from '../js/throne.js';
import { bot } from '../js/display.js';
import { createDungeon } from './support/topology.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { GAUNTLETS_OF_POWER, POT_GAIN_ABILITY } from '../js/object_data.js';
function captureMessages(feed) {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    input.feed(feed);
    return messages;
}
// C sit.c special_throne_effect() case 13 calls adjattrib(ability, rn2(5) - 2,
// -1) for every attribute in order; a delta of -2 makes adjattrib describe the
// loss with the "very " emphasis (attrib.c adjattrib: incr < -1).
void test("Vlad's throne shuffle reports a large ability loss with emphasis", async () => {
    // Seed chosen so the throne triggers and at least one shuffle roll is -2.
    let seed = 1n;
    for (; seed < 4000n; seed++) {
        initRng(seed);
        if (rnd(6) <= 4)
            continue;
        const rolls = [0, 0, 0, 0, 0, 0].map(() => rn2(5));
        if (rolls.some(roll => roll === 0))
            break;
    }
    freshObjectRoom({ flags: { debug: true, verbose: true } });
    requirePlayingGame(game);
    game.u.uz = { dnum: 3, dlevel: 8 };
    game.dungeons[3] = createDungeon({ dname: "Vlad's Tower" });
    game.u.amax.a = [12, 12, 12, 12, 12, 12];
    await bot();
    initRng(seed);
    const messages = captureMessages('13\n' + '\n'.repeat(80));
    await throneSitEffect();
    messages.push(game._pending_message || '');
    const text = messages.join('\n');
    assert.match(text, /As you sit on the throne, your body and mind start to warp\./);
    assert.match(text, /You feel very (weak|stupid|foolish|clumsy|fragile|repulsive)!/);
    // The shuffle keeps every base inside the racial limits.
    const bases = game.u.acurr.a;
    for (const attribute of [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA]) {
        assert.ok(bases[attribute] >= 10 && bases[attribute] <= 14, 'shuffle moves every base by two points at most');
    }
});
// C attrib.c adjattrib(): when a loss would take the base below the racial
// minimum, the base is clamped to the minimum and the maximum absorbs part of
// the excess (average half), so the current value stays put and the msgflg-0
// caller (sit.c throne case 1) reports "Your innate strength has declined.".
void test('a cursed throne loss at the minimum drains the maximum instead', async () => {
    // Seed chosen so the throne triggers and the case-1 attribute roll and
    // excess decr are deterministic; any picked attribute has base 3/max 12.
    let seed = 1n;
    for (; seed < 4000n; seed++) {
        initRng(seed);
        if (rnd(6) <= 4)
            continue;
        break;
    }
    freshObjectRoom({ flags: { debug: true, verbose: true } });
    requirePlayingGame(game);
    game.u.acurr.a = [3, 3, 3, 3, 3, 3];
    game.u.amax.a = [12, 12, 12, 12, 12, 12];
    await bot();
    initRng(seed);
    const messages = captureMessages('1\n' + '\n'.repeat(80));
    await throneSitEffect();
    messages.push(game._pending_message || '');
    const maximum = game.u.amax?.a;
    const current = game.u.acurr?.a;
    if (!maximum || !current)
        throw new Error('throne loss requires attributes');
    const text = messages.join('\n');
    const lowered = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA]
        .filter(attribute => maximum[attribute] < 12);
    const intact = [A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA]
        .filter(attribute => maximum[attribute] === 12);
    assert.equal(lowered.length, 1, 'exactly the rolled attribute is drained');
    const attribute = lowered[0];
    if (attribute === undefined)
        throw new Error('no attribute was drained');
    assert.equal(current[attribute], 3, 'the base stays at the minimum');
    assert.ok(maximum[attribute] >= 3, 'the maximum never drops below the minimum');
    for (const untouched of intact)
        assert.deepEqual([current[untouched], maximum[untouched]], [3, 12]);
    // The excess amount is rn2(excess + 1) of the loss; with rn1(4, 3) that is
    // 0..3 points for a base 3 hero losing 3..6 strength.
    assert.ok(maximum[attribute] > 12 - 7, 'the drain keeps part of the maximum');
    assert.match(text, /Your innate (strength|intelligence|wisdom|dexterity|constitution|charisma) has declined\./);
});
// C attrib.c adjattrib(): a base gain that cannot move the current value
// because fixed equipment (gauntlets of power) pins it reports "Your innate
// strength has improved." on the msgflg-0 attempt of a blessed gain ability.
void test('a blessed gain ability under gauntlets of power reports the innate gain', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    game.u.acurr.a = [16, 18, 18, 18, 18, 18];
    game.u.amax.a = [16, 18, 18, 18, 18, 18];
    game.uarmg = await addInventoryObject(GAUNTLETS_OF_POWER);
    assert.equal(game.uarmg.otyp, GAUNTLETS_OF_POWER);
    const potion = await addInventoryObject(POT_GAIN_ABILITY, { blessed: true });
    const messages = captureMessages(`${potion.invlet}${' '.repeat(60)}`);
    await rhack('q'.charCodeAt(0));
    messages.push(game._pending_message || '');
    const text = messages.join('\n');
    assert.match(text, /Your innate strength has improved\./);
    // The gauntlets hold the current value at 18/100-equivalent strength, so
    // only the underlying base and maximum move.
    assert.equal(game.u.acurr.a[A_STR], 17);
    assert.equal(game.u.amax.a[A_STR], 17);
    assert.match(text, /You're already as smart as you can get\./);
});
//# sourceMappingURL=attribute_min_max_messages.test.js.map