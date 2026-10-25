import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNethackOptions, parseNethackrc } from '../js/options.js';
const PLAY = 'OPTIONS=name:Traveler,!legacy,!tutorial,!autopickup';
function fileErrors(rc) {
    return parseNethackrc(rc).configErrors[0]?.errors ?? [];
}
void test('an unmatched option element is reported as unknown', () => {
    assert.deepEqual(fileErrors(`${PLAY},zzzz`).map(error => error.message), ["Unknown option 'zzzz'"]);
});
void test('the unknown-option diagnostic echoes the element after negation prefixes', () => {
    assert.deepEqual(fileErrors('OPTIONS=!nozzz:1').map(error => error.message), ["Unknown option 'zzz:1'"]);
});
void test('a name shorter than the option minimum length is unknown', () => {
    // "time" needs all four letters to win over timed_delay; the bare
    // "menu" is shorter than every menu_* minimum.
    assert.deepEqual(fileErrors('OPTIONS=tim:1').map(error => error.message), ["Unknown option 'tim:1'"]);
    assert.deepEqual(fileErrors('OPTIONS=menu').map(error => error.message), ["Unknown option 'menu'"]);
});
void test('known spellings an alias or abbreviation reaches stay silent', () => {
    assert.deepEqual(fileErrors('OPTIONS=prayconfirm:+pray,colour,sortl:none,pet:dog'), []);
    // Options the recorder knows but the port does not implement are
    // accepted without a diagnostic, exactly as parseoptions() does.
    assert.deepEqual(fileErrors('OPTIONS=msghistory:20,font_map:big'), []);
    assert.deepEqual(fileErrors('OPTIONS=S_door:^'), []);
});
void test('negating an option that forbids negation is refused before it applies', () => {
    const configuration = parseNethackrc('OPTIONS=!fruit,name:Traveler');
    assert.deepEqual((configuration.configErrors[0]?.errors ?? []).map(error => error.message), ['The fruit option may not both have a value and be negated.']);
    // optfn_fruit() never runs, so the fruit stays at its default name.
    assert.equal(configuration.fruit, undefined);
});
void test('negation of compound options without a value is refused too', () => {
    for (const option of ['number_pad', 'sortloot', 'scores', 'pickup_types',
        'warnings', 'symset', 'packorder', 'versinfo']) {
        assert.deepEqual(fileErrors(`OPTIONS=!${option}`).map(error => error.message), [`The ${option} option may not both have a value and be negated.`], option);
    }
});
void test('a repeated file option draws the duplicate complaint and still applies', () => {
    const configuration = parseNethackrc('OPTIONS=runmode:run\nOPTIONS=runmode:walk');
    assert.deepEqual((configuration.configErrors[0]?.errors ?? []).map(error => error.message), ['compound option specified multiple times: runmode']);
    assert.equal(configuration.flags.runmode, 'walk');
});
void test('a repeated boolean option reports its own kind and the alias spelling', () => {
    assert.deepEqual(fileErrors('OPTIONS=color,time\nOPTIONS=!color').map(error => error.message), ['boolean option specified multiple times: color']);
    // colour matched via the alias after the plain spelling, so the
    // complaint carries the alias suffix of the canonical option.
    assert.deepEqual(fileErrors('OPTIONS=color,colour').map(error => error.message), ['boolean option specified multiple times: color (via alias: colour)']);
});
void test('environment options accept repeats without the duplicate complaint', () => {
    const configuration = parseNethackrc('OPTIONS=name:Traveler');
    const report = parseNethackOptions('runmode:run,runmode:walk', configuration);
    assert.deepEqual(report.errors, []);
    // Elements apply right to left, so the first spelling in the list wins.
    assert.equal(configuration.flags.runmode, 'run');
});
void test('a boolean value outside the true and false spellings is invalid', () => {
    const configuration = parseNethackrc('OPTIONS=time:2,name:Traveler');
    assert.deepEqual((configuration.configErrors[0]?.errors ?? []).map(error => error.message), ["'time:2' is not valid for a boolean"]);
    assert.notEqual(configuration.flags.time, true);
});
void test('a negated boolean refuses its parameter', () => {
    const configuration = parseNethackrc('OPTIONS=!time:1,name:Traveler');
    assert.deepEqual((configuration.configErrors[0]?.errors ?? []).map(error => error.message), ["Negated boolean 'time' should not have a parameter"]);
    assert.notEqual(configuration.flags.time, true);
});
void test('boolean values spell on and off', () => {
    for (const [value, expected] of [['true', true], ['yes', true], ['on', true],
        ['1', true], ['tru', true], ['false', false], ['no', false], ['off', false],
        ['0', false], ['01', true]]) {
        assert.equal(parseNethackrc(`OPTIONS=color:${value}`).flags.color, expected, value);
    }
    // A space after the delimiter keeps the value off C's digit check.
    const spaced = parseNethackrc('OPTIONS=color: 1');
    assert.deepEqual((spaced.configErrors[0]?.errors ?? []).map(error => error.message), ["'color: 1' is not valid for a boolean"]);
});
void test('a valok boolean accepts any other value as on', () => {
    assert.equal(parseNethackrc('OPTIONS=menucolors:junk').flags.menucolors, true);
    assert.equal(parseNethackrc('OPTIONS=!menucolors:junk').flags.menucolors, undefined);
});
void test('gender booleans accept values like any boolean', () => {
    assert.equal(parseNethackrc('OPTIONS=male:true').flags.female, false);
    assert.equal(parseNethackrc('OPTIONS=female:false').flags.female, false);
    assert.equal(parseNethackrc('OPTIONS=male:false').flags.female, false);
    assert.equal(parseNethackrc('OPTIONS=female:yes').flags.female, true);
});
//# sourceMappingURL=options_parse_errors.test.js.map