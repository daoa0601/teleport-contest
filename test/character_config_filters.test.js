import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import { Engine, runSegment } from '../js/jsmain.js';
import { parseNethackrc } from '../js/options.js';
import { memoryStorage } from './support/memory-storage.js';
async function selection(options, moves = 'n') {
    const engine = await runSegment({
        seed: 27, datetime: '20260801120000', moves, storage: memoryStorage(),
        nethackrc: `OPTIONS=name:Filtered,!legacy,!tutorial,pettype:none\n${options}`,
    });
    await engine.lua.destroy();
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim()).join('\n');
}
void test('a configured negative role list removes each excluded role', async () => {
    const menu = await selection('OPTIONS=!role:rogue ranger');
    assert.match(menu, /Pick a role or profession/);
    assert.match(menu, /a Wizard/);
    assert.doesNotMatch(menu, /a Rogue|a Ranger/);
});
void test('configured race, gender and alignment exclusions constrain automatic choices', async () => {
    await selection('OPTIONS=role:wizard,race:!human !elf !orc,gender:!male,alignment:!chaotic', 'y');
    assert.equal(game.moves, 1);
    assert.equal(game.urace?.name, 'gnome');
    assert.equal(game.flags.female, true);
    assert.equal(game.initAlignment?.name, 'neutral');
});
void test('the filter editor retains configured role exclusions', async () => {
    const menu = await selection('OPTIONS=role:!knight !samurai', 'n~');
    assert.match(menu, /k \* a Knight/);
    assert.match(menu, /s \* a Samurai/);
});
void test('a new option source replaces that facet filter instead of accumulating it', async () => {
    const engine = new Engine({
        seed: 27, datetime: '20260801120000', storage: memoryStorage(), display: new GameDisplay(null),
        nethackrc: 'OPTIONS=name:Filtered,role:!rogue,!legacy,!tutorial,pettype:none',
        nethackOptions: 'role:!ranger',
    });
    engine.inputGate.feed('n');
    await engine.runUntilInputNeeded();
    await engine.lua.destroy();
    const menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim()).join('\n');
    assert.match(menu, /a Rogue/);
    assert.doesNotMatch(menu, /a Ranger/);
});
void test('an incompatible random role falls back to an unfiltered role before correcting its alignment', async () => {
    const menu = await selection('OPTIONS=role:random,race:dwarf,gender:male,alignment:lawful\n'
        + 'OPTIONS=!role:arc bar cav hea kni mon pri rog ran sam tou val', '');
    assert.match(menu, /Pick an alignment or creed/);
    assert.match(menu, /Filtered the lawful male human Wizard/);
});
void test('canonical alignment and the character role alias specify the whole hero', async () => {
    await selection('OPTIONS=character:priest,race:human,gender:female,alignment:lawful', '');
    assert.equal(game.moves, 1, 'canonical option names and aliases must resolve before prompting');
    assert.equal(game.urole?.key, 'priest');
    assert.equal(game.initAlignment?.name, 'lawful');
});
void test('the opening question omits an alignment excluded by configuration', async () => {
    const menu = await selection('OPTIONS=role:priest,race:human,alignment:lawful\n'
        + 'OPTIONS=alignment:!lawful', '');
    assert.match(menu, /your human Priest\/Priestess's gender and alignment for you/);
    assert.doesNotMatch(menu, /your lawful/);
});
for (const { value, message } of [
    { value: 'sam !val', message: "Invalid mixed negation for 'role'" },
    { value: 'sam val', message: 'Multiple role values only allowed when list is negated' },
    { value: '!', message: "Negated nothing for 'role'" },
    { value: '!unknown', message: "Invalid role 'unknown'" },
]) {
    void test(`the role option reports an invalid list: ${value}`, () => {
        const configuration = parseNethackrc(`OPTIONS=role:${value}`);
        const messages = configuration.configErrors.flatMap(report => report.errors.map(error => error.message));
        assert.ok(messages.includes(message), messages.join('\n'));
        assert.equal(configuration.role, null, 'a rejected list must not install its first positive choice');
    });
}
//# sourceMappingURL=character_config_filters.test.js.map