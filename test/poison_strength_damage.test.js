import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { A_CON, A_STR, FOUNTAIN } from '../js/const.js';
import { loadScoreRecords } from '../js/score_records.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
const sources = [
    { kind: 'corpse', seed: 16n, command: 'e', message: /must have been poisonous/,
        cause: 'killed by a poisonous corpse' },
    { kind: 'fountain', seed: 26n, command: 'q', message: /water is contaminated/,
        cause: 'killed by contaminated water' },
];
async function preparePoison(source, { hp = 100, maximum = 100, lifeSaving = false } = {}) {
    freshObjectRoom({ hero: { uhp: hp, uhpmax: maximum, ulevel: 1 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 4;
    game.u.acurr.a[A_CON] = 12;
    game.u._exercise = [0, 0, 0, 0, 0, 0];
    game.u.urexp = 100;
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    let food;
    if (source.kind === 'corpse') {
        food = await addInventoryObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('kobold'), age: game.moves,
        });
    }
    else
        requireGameLevel().requireAt(10, 10).typ = FOUNTAIN;
    let amulet;
    if (lifeSaving) {
        amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
    }
    initRng(source.seed);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    input.feed((food?.invlet || 'y') + ' '.repeat(60));
    return { input, messages, food, amulet };
}
for (const source of sources) {
    void test(`${source.kind} poison stops on fatal frailty before maximum HP or meal tails`, async () => {
        const { food, messages } = await preparePoison(source, { hp: 1 });
        requirePlayingGame(game);
        const hunger = game.u.uhunger;
        await rhack(source.command.charCodeAt(0));
        assert.match(messages.join('\n'), source.message);
        assert.equal(game.program_state.gameover, true);
        assert.equal(game.u.umortality, 1);
        assert.equal(game.u.uhpmax, 100);
        assert.equal(game.u.acurr.a[A_STR], 4);
        assert.ok(game.u._exercise);
        assert.equal(game.u._exercise[A_CON], 0);
        const [record] = loadScoreRecords();
        assert.ok(record);
        assert.equal(record.death, source.cause);
        assert.ok(!game._occupation);
        if (food) {
            assert.notEqual(food.where, 'gone');
            assert.equal(game.u.uhunger, hunger);
        }
        else
            assert.equal(requireGameLevel().requireAt(10, 10).typ, FOUNTAIN);
    });
    void test(`${source.kind} poison resumes its pre-rolled second damage after life saving`, async () => {
        await preparePoison(source);
        requirePlayingGame(game);
        await rhack(source.command.charCodeAt(0));
        const healthyHp = game.u.uhp;
        const healthyMaximum = game.u.uhpmax;
        const healthyStrength = game.u.acurr.a[A_STR];
        assert.ok(healthyHp < healthyMaximum && healthyMaximum < 100);
        const { amulet, food } = await preparePoison(source, { hp: 1, lifeSaving: true });
        requirePlayingGame(game);
        await rhack(source.command.charCodeAt(0));
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(game.u.umortality, 1);
        assert.ok(amulet);
        assert.equal(amulet.where, 'gone');
        assert.equal(game.u.uhp, healthyHp);
        assert.equal(game.u.uhpmax, healthyMaximum);
        assert.equal(game.u.acurr.a[A_STR], healthyStrength);
        if (food) {
            assert.equal(game._occupation?.key, 'eat-food');
            assert.doesNotMatch(game._pending_message, /must have been poisonous/);
        }
        else
            assert.equal(game.context.move, 1);
    });
    void test(`${source.kind} direct poison can kill again after frailty consumes life saving`, async () => {
        const { amulet } = await preparePoison(source, {
            hp: 1, maximum: 10, lifeSaving: true,
        });
        requirePlayingGame(game);
        await rhack(source.command.charCodeAt(0));
        assert.equal(game.program_state.gameover, true);
        assert.equal(game.u.umortality, 2);
        assert.ok(amulet);
        assert.equal(amulet.where, 'gone');
        assert.equal(game.u.uhpmax, 1);
        assert.equal(game.u.acurr.a[A_STR], 3);
        assert.ok(!game._occupation);
    });
    void test(`${source.kind} poison hits the human body after frailty destroys a monster body`, async () => {
        const { food } = await preparePoison(source);
        requirePlayingGame(game);
        resetInputState().feed(' '.repeat(20));
        await polymonHero(MONSTER_NAME.indexOf('dwarf'));
        game.u.mh = 1;
        game.u.acurr.a[A_STR] = 4;
        initRng(source.seed);
        resetInputState().feed((food?.invlet || 'y') + ' '.repeat(40));
        await rhack(source.command.charCodeAt(0));
        assert.equal(game.u.umonnum, game.u.umonster);
        assert.equal(game.u.uhpmax, 100);
        assert.ok(game.u.uhp >= 85 && game.u.uhp < 100);
        assert.equal(game.u.acurr.a[A_STR], 4);
        assert.equal(!!game.program_state.gameover, false);
    });
}
void test('resisted corpse poison preserves the unaffected message when its meal starts', async () => {
    const source = sources[0];
    await preparePoison(source);
    requirePlayingGame(game);
    grantIntrinsicProperty('poisonResistance', 'outside');
    await rhack('e'.charCodeAt(0));
    assert.equal(game.u.uhp, 100);
    assert.equal(game.u.uhpmax, 100);
    assert.equal(game.u.acurr.a[A_STR], 4);
    assert.match(game._pending_message, /You seem unaffected by the poison/);
    assert.doesNotMatch(game._pending_message, /must have been poisonous/);
    assert.equal(game._occupation?.key, 'eat-food');
});
void test('poison resistance does not prevent a fatal unrefrigerated fountain drink', async () => {
    const source = sources[1];
    const { messages } = await preparePoison(source, { hp: 1 });
    requirePlayingGame(game);
    grantIntrinsicProperty('poisonResistance', 'outside');
    await rhack('q'.charCodeAt(0));
    assert.match(messages.join('\n'), /Perhaps it is runoff/);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.u.uhpmax, 100);
    assert.equal(game.u.acurr.a[A_STR], 4);
    assert.ok(game.u._exercise);
    assert.equal(game.u._exercise[A_CON], 0);
    const [record] = loadScoreRecords();
    assert.ok(record);
    assert.equal(record.death, 'killed by an unrefrigerated sip of juice');
    assert.equal(requireGameLevel().requireAt(10, 10).typ, FOUNTAIN);
});
//# sourceMappingURL=poison_strength_damage.test.js.map