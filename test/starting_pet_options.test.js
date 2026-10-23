import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runSegment } from '../js/jsmain.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterName } from '../js/monster_name.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { makedog } from '../js/u_init.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
async function start(role, options) {
    const engine = await runSegment({
        seed: 73, datetime: '20260830120000', moves: '', storage: memoryStorage(),
        nethackrc: [
            `OPTIONS=name:Traveler,role:${role},race:human,gender:male,align:${role === 'knight' ? 'lawful' : 'neutral'}`,
            'OPTIONS=!legacy,!tutorial,!autopickup',
            options,
        ].join('\n'),
    });
    assert.equal(engine.lastRunResult?.kind, 'input-needed');
    requirePlayingGame(game);
    return game.level.monsters.find(monster => monster.m_id === game.context.startingpet_mid);
}
// C dog.c:makedog() selects a name by the actual species, after pet_type()
// honors the role's fixed pet in preference to the configured type.
for (const [role, preference, species, name] of [
    ['ranger', 'cat', 'little dog', 'Sir Wags'],
    ['wizard', 'dog', 'kitten', 'Miss Mews'],
    ['knight', 'cat', 'pony', 'Lady Hooves'],
]) {
    void test(`${role} starts with its named ${species} despite pettype:${preference}`, async () => {
        const pet = await start(role, `OPTIONS=pettype:${preference},dogname:Sir Wags,catname:Miss Mews,horsename:Lady Hooves`);
        assert.ok(pet);
        assert.equal(MONSTER_NAME[pet.mnum], species);
        assert.equal(monsterName(pet, { suppressIt: true }), name);
    });
}
for (const [option, role, name] of [
    ['dog', 'ranger', 'Wags'], ['cat', 'wizard', 'Mews'], ['hor', 'knight', 'Hooves'],
]) {
    void test(`the abbreviated ${option} name option names the starting pet`, async () => {
        const pet = await start(role, `OPTIONS=${option}:${name}`);
        assert.ok(pet);
        assert.equal(monsterName(pet, { suppressIt: true }), name);
    });
}
for (const preference of ['cat', 'none']) {
    void test(`pettype:${preference} overrides a role without a fixed pet`, async () => {
        const pet = await start('barbarian', `OPTIONS=pettype:${preference},catname:Mews,dogname:Wags`);
        if (preference === 'none') {
            assert.equal(pet === undefined, true);
            assert.equal(game.context.startingpet_typ, -1);
        }
        else {
            assert.ok(pet);
            assert.equal(MONSTER_NAME[pet.mnum], 'kitten');
            assert.equal(monsterName(pet, { suppressIt: true }), 'Mews');
        }
    });
}
void test('negating pettype suppresses even a role-specific starting pet', async () => {
    const pet = await start('knight', 'OPTIONS=!pettype,horsename:Hooves');
    assert.equal(pet === undefined, true);
    assert.equal(game.context.startingpet_typ, -1);
});
void test('the feline pet alias chooses and names a kitten during startup', async () => {
    const pet = await start('barbarian', 'OPTIONS=pet:Feline,catname:Mews');
    assert.ok(pet);
    assert.equal(MONSTER_NAME[pet.mnum], 'kitten');
    assert.equal(monsterName(pet, { suppressIt: true }), 'Mews');
});
// C options.c:optfn_pettype() consumes the first letter, not a full word.
for (const [value, preference] of [
    ['Dog', 'd'], ['canine', 'c'], ['FELINE', 'c'],
    ['Horse', 'h'], ['quadruped', 'h'], ['No pet', 'n'],
    ['Random', ''], ['*', ''],
]) {
    void test(`pettype:${value} uses the native initial-letter selection`, () => {
        const settings = parseNethackrc(`OPTIONS=pettype:${preference === 'd' ? 'cat' : 'dog'}\nOPTIONS=pettype:${value}`);
        assert.equal(settings.preferred_pet, preference);
    });
}
for (const option of ['pettype', 'pet']) {
    for (const suffix of ['', ':cat']) {
        void test(`!${option}${suffix} ${suffix ? 'uses its explicit type' : 'disables the starting pet'}`, () => {
            const settings = parseNethackrc(`OPTIONS=pettype:dog\nOPTIONS=!${option}${suffix}`);
            assert.equal(settings.preferred_pet, suffix ? 'c' : 'n');
        });
    }
}
void test('pettype options on one line apply from right to left', () => {
    const settings = parseNethackrc('OPTIONS=pettype:random,pettype:none');
    assert.equal(settings.preferred_pet, '');
});
void test('an invalid pet type retains the previous preference', () => {
    const settings = parseNethackrc('OPTIONS=pettype:cat\nOPTIONS=pettype:lizard');
    assert.equal(settings.preferred_pet, 'c');
});
void test('configuration fragments update the live pet preference, including random', () => {
    freshObjectRoom();
    game.preferred_pet = 'n';
    applyNethackrc('OPTIONS=pettype:feline');
    assert.equal(game.preferred_pet, 'c');
    applyNethackrc('OPTIONS=pettype:random');
    assert.equal(game.preferred_pet, '');
});
void test('horse preference leaves ordinary roles choosing between a dog and a cat', async () => {
    const species = new Set();
    for (let seed = 1n; seed <= 12n; seed++) {
        const settings = parseNethackrc('OPTIONS=pettype:horse');
        freshObjectRoom({ role: 'barbarian', gameplaySeed: seed });
        if (settings.preferred_pet !== undefined)
            game.preferred_pet = settings.preferred_pet;
        const pet = await makedog();
        assert.ok(pet);
        species.add(MONSTER_NAME[pet.mnum]);
    }
    assert.equal(species.size, 2);
    assert.ok(species.has('little dog'));
    assert.ok(species.has('kitten'));
});
void test('only the first starting pet receives the configured name', async () => {
    freshObjectRoom({ role: 'ranger', flags: { dogname: 'Wags' } });
    const first = await makedog();
    assert.ok(first);
    resetInputState().feed(' '.repeat(10));
    const second = await makedog();
    assert.ok(second);
    assert.equal(monsterName(first, { suppressIt: true }), 'Wags');
    assert.equal(monsterName(second, { suppressIt: true }), 'the little dog');
    assert.equal(game.context.startingpet_mid, first.m_id);
});
//# sourceMappingURL=starting_pet_options.test.js.map