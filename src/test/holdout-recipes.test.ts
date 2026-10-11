// holdout-recipes.test.js — rule checks for scripts/holdout/recipes.mjs
//
// Two layers, both pinned to observable C behavior rather than private key
// plans or generated data:
//   1. Character legality from the C role.c allow masks.
//   2. validateRecipeRecording predicates: synthetic minimal recordings
//      built from real C-observable screen behavior (status lines with
//      T:/Dlvl:/HP:/Pw:/AC:, welcome-back restore text, save/bones state
//      counts) prove the validator accepts genuine effects and rejects
//      their absence.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    LEGAL_CHARACTERS, RECIPE_NAMES, ROLES, RACES,
    DEPTH_TOUR_TARGETS, makeRecipe, acceptsCharacter, isLegalCharacter,
    validateRecipeRecording,
} from '../scripts/holdout/recipes.mjs';

import type { Character, RecipePlan, RecipeSegment, RecipeObservation } from '../scripts/holdout/recipes.mjs';
import type { Cursor } from '../scripts/lib/session-types.mjs';

const DT = '20000110090000';

function has(combo: Character) {
    return LEGAL_CHARACTERS.some((c) =>
        c.role === combo.role && c.race === combo.race
        && c.gender === combo.gender && c.align === combo.align);
}

// --- Character legality: pinned C role.c mask rules ---

void test('thirteen roles exist in C order', () => {
    assert.equal(ROLES.length, 13);
    assert.equal(ROLES[0], 'archeologist');
    assert.equal(ROLES[12], 'wizard');
});

void test('every legal combination has all four axes filled', () => {
    for (const c of LEGAL_CHARACTERS) {
        assert.ok(ROLES.includes(c.role));
        assert.ok(RACES.includes(c.race));
        assert.ok(['male', 'female'].includes(c.gender));
        assert.ok(['lawful', 'neutral', 'chaotic'].includes(c.align));
    }
});

void test('no duplicate combinations', () => {
    const seen = new Set(LEGAL_CHARACTERS.map((c) => `${c.role}/${c.race}/${c.gender}/${c.align}`));
    assert.equal(seen.size, LEGAL_CHARACTERS.length);
});

void test('valkyrie is female-only over both legal races', () => {
    assert.equal(has({ role: 'valkyrie', race: 'human', gender: 'female', align: 'lawful' }), true);
    assert.equal(has({ role: 'valkyrie', race: 'dwarf', gender: 'female', align: 'lawful' }), true);
    assert.equal(has({ role: 'valkyrie', race: 'human', gender: 'male', align: 'lawful' }), false);
    assert.equal(has({ role: 'valkyrie', race: 'elf', gender: 'female', align: 'lawful' }), false);
});

void test('race alignment restrictions come from the C masks', () => {
    assert.equal(has({ role: 'priest', race: 'elf', gender: 'male', align: 'chaotic' }), true);
    assert.equal(has({ role: 'priest', race: 'elf', gender: 'male', align: 'lawful' }), false);
    assert.equal(has({ role: 'wizard', race: 'gnome', gender: 'male', align: 'neutral' }), true);
    assert.equal(has({ role: 'wizard', race: 'gnome', gender: 'male', align: 'lawful' }), false);
    assert.equal(has({ role: 'caveman', race: 'dwarf', gender: 'male', align: 'lawful' }), true);
    assert.equal(has({ role: 'barbarian', race: 'orc', gender: 'female', align: 'chaotic' }), true);
    assert.equal(has({ role: 'rogue', race: 'orc', gender: 'male', align: 'neutral' }), false);
});

void test('role race restrictions come from the C masks', () => {
    assert.equal(has({ role: 'knight', race: 'human', gender: 'male', align: 'lawful' }), true);
    assert.equal(has({ role: 'knight', race: 'elf', gender: 'male', align: 'lawful' }), false);
    assert.equal(has({ role: 'samurai', race: 'human', gender: 'female', align: 'lawful' }), true);
    assert.equal(has({ role: 'healer', race: 'gnome', gender: 'female', align: 'neutral' }), true);
    assert.equal(has({ role: 'healer', race: 'elf', gender: 'female', align: 'neutral' }), false);
    assert.equal(has({ role: 'ranger', race: 'orc', gender: 'male', align: 'chaotic' }), true);
});

void test('isLegalCharacter rejects broken or partial input', () => {
    assert.equal(isLegalCharacter(null), false);
    assert.equal(isLegalCharacter({ role: 'wizard' }), false);
    assert.equal(isLegalCharacter({ role: 'wizzard', race: 'human', gender: 'male', align: 'neutral' }), false);
});

// --- Recipe metadata preflight ---

void test('recipe preflight accepts legal roles and rejects unsupported characters', () => {
    const knight = { role: 'knight', race: 'human', gender: 'male', align: 'lawful' };
    const rogue = { role: 'rogue', race: 'human', gender: 'male', align: 'chaotic' };
    assert.equal(acceptsCharacter('equipment', knight), true);
    assert.equal(acceptsCharacter('equipment', rogue), false);
    assert.equal(acceptsCharacter('save-restore', rogue), true);
    assert.equal(acceptsCharacter('save-restore', { ...knight, race: 'elf' }), false);
});

// --- Skeleton contract (recorder-facing shape, not key content) ---

function firstLegal(name: string): Character {
    const character = LEGAL_CHARACTERS.find(c => acceptsCharacter(name, c));
    assert.ok(character, `recipe ${name} must accept a legal character`);
    return character;
}

function segmentAt(plan: RecipePlan, index: number) {
    const segment = plan.segments[index];
    assert.ok(segment, `recipe is missing segment ${index}`);
    return segment;
}

function finalAction(plan: RecipePlan, index: number) {
    const action = segmentAt(plan, index).driver.at(-1);
    assert.ok(action, `recipe segment ${index} has no actions`);
    return action;
}

for (const name of RECIPE_NAMES) {
    void test(`skeleton shape: ${name}`, () => {
        const character = firstLegal(name);
        const doc = makeRecipe(name, { seed: 42424, datetime: DT, character });
        assert.equal(doc.version, 5);
        assert.ok(Array.isArray(doc.segments) && doc.segments.length >= 1);
        for (const seg of doc.segments) {
            assert.equal(seg.datetime, DT, 'datetime applies to every segment');
            assert.ok(typeof seg.nethackrc === 'string' && seg.nethackrc.length > 0);
            // Recipes are adaptive: every segment carries driver actions
            // whose keys entries request automatic --More-- dismissal.
            assert.ok(Array.isArray(seg.driver) && seg.driver.length > 0,
                'segment carries driver actions');
            assert.equal(seg.moves, undefined, 'driver segments carry no fixed moves');
            for (const action of seg.driver) {
                assert.ok(['keys', 'select-menu-entry'].includes(action.type));
                if (action.type === 'keys') {
                    assert.equal(action.dismissMore, true,
                        'keys actions must dismiss pending --More-- prompts');
                }
            }
        }
        // Baseline options keep chargen prompts away and turn display on.
        assert.ok(segmentAt(doc, 0).nethackrc.includes('!legacy'));
        assert.ok(segmentAt(doc, 0).nethackrc.includes('!tutorial'));
        assert.ok(segmentAt(doc, 0).nethackrc.includes('!news'));
        assert.ok(segmentAt(doc, 0).nethackrc.includes('time'));
        assert.ok(segmentAt(doc, 0).nethackrc.includes('symset:DECgraphics'));
        // The explicit legal character rides in the OPTIONS line.
        assert.ok(segmentAt(doc, 0).nethackrc.includes(`role:${character.role}`));
        assert.ok(segmentAt(doc, 0).nethackrc.includes(`race:${character.race}`));
        assert.ok(segmentAt(doc, 0).nethackrc.includes(`gender:${character.gender}`));
        assert.ok(segmentAt(doc, 0).nethackrc.includes(`align:${character.align}`));
    });
}

void test('segment 0 uses the requested seed unchanged', () => {
    const doc = makeRecipe('save-restore', { seed: 50000, datetime: DT, character: firstLegal('save-restore') });
    assert.equal(segmentAt(doc, 0).seed, 50000);
});

void test('restore segments reuse the seed; only a fresh game bumps it', () => {
    const c = firstLegal('save-chain');
    const doc = makeRecipe('save-chain', { seed: 50001, datetime: DT, character: c });
    for (const seg of doc.segments) assert.equal(seg.seed, 50001);
    const d = firstLegal('death-newgame');
    const doc2 = makeRecipe('death-newgame', { seed: 50002, datetime: DT, character: d });
    assert.equal(segmentAt(doc2, 0).seed, 50002);
    assert.equal(segmentAt(doc2, 1).seed, 50003);
});

void test('options parameter adds an extra OPTIONS line', () => {
    const c = firstLegal('engraving');
    const doc = makeRecipe('engraving', { seed: 50004, datetime: DT, character: c, options: 'showexp' });
    assert.ok(segmentAt(doc, 0).nethackrc.includes('OPTIONS=showexp'));
});

void test('depth-tour destinations are parameterizable with verified targets', () => {
    const c = firstLegal('depth-tour');
    const doc = makeRecipe('depth-tour', { seed: 50010, datetime: DT, character: c, targets: ['castle', 'valley'] });
    const menu = segmentAt(doc, 0).driver.filter((a) => a.type === 'select-menu-entry');
    assert.deepEqual(menu.map((a) => a.target), ['castle', 'valley']);
    assert.ok(DEPTH_TOUR_TARGETS.includes('strt'), 'quest home target stays available');
    assert.throws(() => makeRecipe('depth-tour', {
        seed: 50011, datetime: DT, character: c, targets: ['not-a-place'],
    }));
});

void test('segments that end the game request a native process exit', () => {
    const sr = makeRecipe('save-restore', { seed: 50020, datetime: DT, character: firstLegal('save-restore') });
    assert.equal(finalAction(sr, 0).expectExit, true, 'save segment asks for native exit');
    assert.equal(finalAction(sr, 1).expectExit, undefined, 'restore segment continues in-process');

    const sc = makeRecipe('save-chain', { seed: 50021, datetime: DT, character: firstLegal('save-chain') });
    for (let i = 0; i < 3; i++) {
        assert.equal(finalAction(sc, i).expectExit, true, `save-chain segment ${i} exits`);
    }
    assert.equal(finalAction(sc, 3).expectExit, undefined, 'final restore continues in-process');

    const dn = makeRecipe('death-newgame', { seed: 50022, datetime: DT, character: firstLegal('death-newgame') });
    assert.equal(finalAction(dn, 0).expectExit, true, 'death segment exits natively');
    assert.equal(finalAction(dn, 1).expectExit, undefined, 'fresh game continues in-process');
});

void test('unknown recipe and illegal character are rejected', () => {
    const c = firstLegal('engraving');
    assert.throws(() => makeRecipe('no-such-recipe', { seed: 1, datetime: DT, character: c }));
    assert.throws(() => makeRecipe('engraving', { seed: 1, datetime: DT, character: null }));
    assert.throws(() => makeRecipe('engraving', {
        seed: 1, datetime: DT,
        character: { role: 'knight', race: 'elf', gender: 'male', align: 'lawful' },
    }));
    assert.throws(() => makeRecipe('equipment', {
        seed: 1, datetime: DT,
        character: { role: 'rogue', race: 'human', gender: 'male', align: 'chaotic' },
    }));
    assert.throws(() => makeRecipe('engraving', { seed: 1, datetime: 'oops', character: c }));
});

// --- validateRecipeRecording: native-effects proof on synthetic recordings ---

// Screen strings mirror what the C tty actually renders (message line,
// map lines, two status lines). Fixtures stay minimal.
function step(screen: string, key: string | null = null): RecipeObservation & { key: string | null; cursor: Cursor } {
    return { key, screen, cursor: [0, 0, 1] };
}
function status(T: number, extra: { dlvl?: number; pw?: number; ac?: number } = {}) {
    const dlvl = extra.dlvl ?? 1;
    const pw = extra.pw ?? 2;
    const ac = extra.ac ?? 7;
    return `Dlvl:${dlvl} $:0 HP:12(12) Pw:${pw}(${pw}) AC:${ac} Xp:1 T:${T}`;
}
function segOf(steps: (RecipeObservation & { key: string | null })[], extra: Omit<RecipeSegment, "steps"> = {}): RecipeSegment {
    return { steps, moves: steps.slice(1).map((s) => s.key).join(''), ...extra };
}

void test('save-restore validation accepts a real save/restore evidence chain', () => {
    const save0 = segOf([
        step('Hello Nomad, welcome to NetHack!  You are a chaotic male human Rogue\nx\n' + status(1)),
        step('Be seeing you...\n' + status(4), 'y'),
    ], { recording: { state: { saves: 1, bones: 0 } } });
    const restore = segOf([
        step('Hello Nomad, the human Rogue, welcome back to NetHack!\n' + status(4)),
        step('Unknown command\n' + status(6), 'k'),
    ]);
    const r = validateRecipeRecording('save-restore', { version: 5, segments: [save0, restore] });
    assert.equal(r.ok, true, JSON.stringify(r.checks));
});

void test('save-restore validation fails when the restore started a new game', () => {
    const save0 = segOf([
        step('welcome\n' + status(1)),
        step('Be seeing you...\n' + status(4), 'y'),
    ], { recording: { state: { saves: 1, bones: 0 } } });
    const fresh = segOf([
        step('Hello Nomad, welcome to NetHack!  You are a chaotic male human Rogue\n' + status(1)),
        step('x\n' + status(1), 'k'),
    ]);
    const r = validateRecipeRecording('save-restore', { version: 5, segments: [save0, fresh] });
    assert.equal(r.ok, false);
    assert.ok(r.checks.some((c) => !c.ok && c.check.includes('welcome back')));
});

void test('state checks fail closed when recorder metadata is absent', () => {
    const save0 = segOf([
        step('welcome\n' + status(1)),
        step('Be seeing you...\n' + status(4), 'y'),
    ]); // no recording.state
    const restore = segOf([
        step('welcome back to NetHack!\n' + status(4)),
        step('x\n' + status(6), 'k'),
    ]);
    const r = validateRecipeRecording('save-restore', { version: 5, segments: [save0, restore] });
    assert.equal(r.ok, false);
    assert.ok(r.checks.some((c) => !c.ok && c.check.includes('save file written')));
});

void test('spellcasting validation requires consumed power and the failure path', () => {
    const good = segOf([
        step('welcome\n' + status(1, { pw: 8 })),
        step('Choose which spell to cast\n' + status(1, { pw: 8 }), 'Z'),
        step('In what direction?\n' + status(1, { pw: 8 }), 'a'),
        step('map\n' + status(2, { pw: 1 }), 'h'),
        step('Choose which spell to cast\n' + status(2, { pw: 1 }), 'Z'),
        step("You don't have enough energy to cast that spell.\n" + status(2, { pw: 1 }), 'a'),
        step('d - a ring (on right hand)\n' + status(3, { pw: 1 }), 'r'),
        step('You were wearing a ring.\n' + status(4, { pw: 1 }), 'R'),
    ]);
    const r = validateRecipeRecording('spellcasting', { version: 5, segments: [good] });
    assert.equal(r.ok, true, JSON.stringify(r.checks));

    const noDrain = segOf([
        step('Choose which spell to cast\n' + status(1, { pw: 8 }), 'Z'),
        step('map\n' + status(2, { pw: 8 }), 'a'),
    ]);
    const r2 = validateRecipeRecording('spellcasting', { version: 5, segments: [noDrain] });
    assert.equal(r2.ok, false);
    assert.ok(r2.checks.some((c) => !c.ok && /power consumed/i.test(c.check)));
});

void test('depth-tour validation counts Dlvl transitions, not repeated prose', () => {
    const good = segOf([
        step('welcome\n' + status(1, { dlvl: 1 })),
        step('To what level do you want to teleport?\n' + status(1, { dlvl: 1 }), '5'),
        step('You materialize on a different level!\n' + status(1, { dlvl: 5 }), '\r'),
        step('Level teleport to where:\n' + status(1, { dlvl: 5 }), 'b'),
        step('You materialize on a different level!\n' + status(1, { dlvl: 3 }), 'b'),
        step('map\n' + status(1, { dlvl: 3 }), ' '),
    ], { moves: '\x16' + '5\r' + 'm\x16b' + 'm\x16d' });
    const r = validateRecipeRecording('depth-tour', { version: 5, segments: [good] });
    assert.equal(r.ok, true, JSON.stringify(r.checks));

    // Same depth throughout: prose alone must not pass.
    const stuck = segOf([
        step('You materialize on a different level!\n' + status(1, { dlvl: 5 })),
        step('You materialize on a different level!\n' + status(1, { dlvl: 5 }), 'b'),
    ], { moves: 'm\x16bm\x16d' });
    const r2 = validateRecipeRecording('depth-tour', { version: 5, segments: [stuck] });
    assert.equal(r2.ok, false);
    assert.ok(r2.checks.some((c) => !c.ok && /depth actually changed/i.test(c.check)));
});

void test('death-newgame validation requires bones state and a fresh game', () => {
    const die = segOf([
        step('Go to Nowhere.  Are you sure? [ynq] (q)\n' + status(1)),
        step('Die? [yn] (n)\n' + status(1), 'y'),
        step('Save bones? [yn] (n)\n' + status(1), 'y'),
        step('Since you were in wizard mode, the score list will not be checked.', 'y'),
    ], { recording: { state: { saves: 0, bones: 1 } } });
    const fresh = segOf([
        step('Hello Nomad, welcome to NetHack!  You are a lawful male human Knight\n' + status(1)),
        step('map\n' + status(2), 's'),
    ]);
    const r = validateRecipeRecording('death-newgame', { version: 5, segments: [die, fresh] });
    assert.equal(r.ok, true, JSON.stringify(r.checks));

    const noBones = { ...die, recording: { state: { saves: 0, bones: 0 } } };
    const r2 = validateRecipeRecording('death-newgame', { version: 5, segments: [noBones, fresh] });
    assert.equal(r2.ok, false);
    assert.ok(r2.checks.some((c) => !c.ok && /bones file written/i.test(c.check)));
});

void test('negative AC parses and registers as a status change', () => {
    const good = segOf([
        step('map\n' + status(1, { ac: 3 })),
        step('You finish taking off your helm.\n' + status(2, { ac: 4 }), 'd'),
        step('You finish your dressing maneuver.\n' + status(3, { ac: 3 }), 'd'),
        step('You were wearing a small shield.\n' + status(4, { ac: 4 }), 'e'),
        step('You are now wearing a small shield.\n' + status(5, { ac: 3 }), 'e'),
        step('a - a long sword (weapon in left hand).\n' + status(6, { ac: 3 }), 'x'),
        step('b - a lance (weapon in left hand).\n' + status(7, { ac: 3 }), 'x'),
        step('b - a lance (weapon in left hand).\n' + status(8, { ac: 3 }), 'b'),
        step('a - a long sword (weapon in left hand).\n' + status(9, { ac: 3 }), 'a'),
        step('Weapons\n' + status(9, { ac: 3 }), 'i'),
    ]);
    const r = validateRecipeRecording('equipment', { version: 5, segments: [good] });
    assert.equal(r.ok, true, JSON.stringify(r.checks));
});

void test('unknown recipe reports an error instead of throwing', () => {
    const r = validateRecipeRecording('no-such', { version: 5, segments: [] });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'unknown recipe');
});
