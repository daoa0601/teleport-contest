import assert from 'node:assert/strict';
import test from 'node:test';
import {
    GlyphOffset, altarToGlyph, cmapToGlyph, detectedMonnumToGlyph,
    explosionToGlyph, glyphIsCmapZap, glyphIsDetectedMonster, glyphIsInvisible,
    glyphIsMonster, glyphIsObject, glyphIsPet, glyphIsStatue, glyphIsSwallow,
    glyphIsTrap, glyphIsWarning, glyphIsBody, glyphToExplosion, glyphToMon,
    glyphToObj, glyphToSwallow, glyphToTrap, glyphToWarning, monnumToGlyph,
    petnumToGlyph, riddenMonnumToGlyph, warningToGlyph,
} from '../js/glyph_numbers.js';
import { swallowToGlyph, zapdirToGlyph } from '../js/display.js';
import { glyphToCmapSymbol } from '../js/getpos.js';
import { AM_CHAOTIC, AM_LAWFUL, AM_MASK, AM_NEUTRAL, AM_SANCTUM, FEMALE, MALE, WARNCOUNT } from '../js/const.js';
import { MONSTER_COLOR } from '../js/monster_data.js';
import { CORPSE, OBJECT_COLOR, STATUE } from '../js/object_data.js';


const NUMMONS = MONSTER_COLOR.length;
const NUM_OBJECTS = OBJECT_COLOR.length;

void test('the four monster glyph ranges keep their species and sex separate', () => {
    // display.h:monnum/petnum/detected_monnum/ridden_monnum_to_glyph put every
    // gender but MALE (including NEUTER) into the female range of each state.
    for (const species of [0, 1, 77, NUMMONS - 1]) {
        assert.equal(monnumToGlyph(species, MALE), GlyphOffset.monMale + species);
        assert.equal(monnumToGlyph(species, FEMALE), GlyphOffset.monFemale + species);
        assert.equal(petnumToGlyph(species, 2), GlyphOffset.petFemale + species);
        assert.equal(detectedMonnumToGlyph(species, MALE), GlyphOffset.detectMale + species);
        assert.equal(riddenMonnumToGlyph(species, FEMALE), GlyphOffset.riddenFemale + species);
    }
    // glyph_to_mon() decodes pets, detected and ridden monsters back to their
    // species, and every other glyph to the fencepost species NUMMONS.
    assert.equal(glyphToMon(GlyphOffset.petMale + 42), 42);
    assert.equal(glyphToMon(GlyphOffset.riddenFemale + 7), 7);
    assert.equal(glyphToMon(GlyphOffset.detectMale + NUMMONS - 1), NUMMONS - 1);
    assert.equal(glyphToMon(GlyphOffset.invisible), NUMMONS);
    // glyph_is_monster() covers exactly those four ranges: the invisible
    // placeholder, bodies and statues are not monsters.
    assert.ok(glyphIsMonster(GlyphOffset.monFemale + 3));
    assert.ok(glyphIsMonster(GlyphOffset.detectMale));
    assert.ok(!glyphIsMonster(GlyphOffset.invisible));
    assert.ok(!glyphIsMonster(GlyphOffset.body));
    assert.ok(!glyphIsPet(GlyphOffset.monMale));
});

void test('bodies and statues are objects that decode to their generic object', () => {
    // display.h:glyph_is_body() spans the plain and piletop corpse ranges;
    // statues have male and female plain and piletop ranges.
    assert.ok(glyphIsBody(GlyphOffset.body + NUMMONS - 1));
    assert.ok(glyphIsBody(GlyphOffset.bodyPiletop));
    assert.ok(glyphIsStatue(GlyphOffset.statueFemale + 5));
    assert.ok(glyphIsStatue(GlyphOffset.statueMalePiletop + 5));
    assert.ok(glyphIsObject(GlyphOffset.object + CORPSE));
    assert.ok(!glyphIsObject(GlyphOffset.monMale));
    // glyph_to_obj() maps every body to CORPSE, every statue to STATUE, and
    // decodes plain object numbers; the fencepost is NUM_OBJECTS.
    assert.equal(glyphToObj(GlyphOffset.bodyPiletop + 2), CORPSE);
    assert.equal(glyphToObj(GlyphOffset.statueFemalePiletop), STATUE);
    assert.equal(glyphToObj(GlyphOffset.object + 3), 3);
    assert.equal(glyphToObj(-1), NUM_OBJECTS);
});

void test('warning levels occupy their six consecutive glyphs', () => {
    // display.h:warning_to_glyph()/glyph_is_warning()/glyph_to_warning()
    for (let level = 0; level < WARNCOUNT; level++) {
        const glyph = warningToGlyph(level);
        assert.ok(glyphIsWarning(glyph));
        assert.equal(glyphToWarning(glyph), level);
    }
    assert.ok(!glyphIsWarning(warningToGlyph(WARNCOUNT)));
    assert.equal(glyphToWarning(GlyphOffset.warning - 1), 0);
});

void test('altar alignment and sanctum select the five altar glyphs', () => {
    // display.h:altar_to_glyph(): undefined alignment masks stay unaligned,
    // and AM_SANCTUM wins over the alignment bits.
    assert.equal(altarToGlyph(0), GlyphOffset.altar);
    assert.equal(altarToGlyph(AM_NEUTRAL), GlyphOffset.altar + 2);
    assert.equal(altarToGlyph(AM_CHAOTIC), GlyphOffset.altar + 1);
    assert.equal(altarToGlyph(AM_LAWFUL), GlyphOffset.altar + 3);
    assert.equal(altarToGlyph(AM_MASK & ~AM_LAWFUL), GlyphOffset.altar);
    assert.equal(altarToGlyph(AM_SANCTUM | AM_NEUTRAL), GlyphOffset.altar + 4);
});

void test('zap directions and beam types pack into the zap range', () => {
    // display.c:zapdir_to_glyph(): four directions per beam type.
    assert.equal(zapdirToGlyph(0, 1, 0), GlyphOffset.zap);
    assert.equal(zapdirToGlyph(1, 0, 0), GlyphOffset.zap + 1);
    assert.equal(zapdirToGlyph(1, 1, 0), GlyphOffset.zap + 2);
    assert.equal(zapdirToGlyph(1, -1, 0), GlyphOffset.zap + 3);
    assert.equal(zapdirToGlyph(-1, -1, 7), GlyphOffset.zap + 7 * 4 + 2);
    // display.c:2463-2466 reports impossible("zapdir_to_glyph:  illegal
    // beam type") before resetting beam_type to 0; the port clamps the same
    // way without the report, which no caller can reach (every C caller
    // passes a zap-colors enum value below NUM_ZAP).  A negative beam type
    // keeps its own bits, passing the >= NUM_ZAP guard on both sides.
    assert.equal(zapdirToGlyph(0, 1, 8), GlyphOffset.zap);
    assert.equal(zapdirToGlyph(0, 1, -1), GlyphOffset.zap - 4);
    assert.ok(glyphIsCmapZap(zapdirToGlyph(1, 0, 5)));
    assert.ok(!glyphIsCmapZap(GlyphOffset.cmapC));
});

void test('explosion styles default to fiery and decode within one blast', () => {
    // display.h:explosion_to_glyph()/glyph_to_explosion(): idx runs over the
    // nine explosion characters; EXPL_DARK and unknown styles are fiery.
    assert.equal(explosionToGlyph(5, 96 + 8), GlyphOffset.explodeFiery + 8);
    assert.equal(explosionToGlyph(0, 96), GlyphOffset.explodeFiery);
    assert.equal(explosionToGlyph(6, 96 + 4), GlyphOffset.explodeFrosty + 4);
    for (let idx = 0; idx < 9; idx++)
        assert.equal(glyphToExplosion(explosionToGlyph(2, 96 + idx)), idx);
    assert.equal(glyphToExplosion(GlyphOffset.warning), 0);
});

void test('a swallow border cell packs its species and position', async () => {
    // display.c:swallow_to_glyph(): monster<<3 | position.  With a sober
    // hero the shown species is the swallower itself.
    // heroIsHallucinating() with an uninitialized hero stays false here.
    for (let loc = 88; loc <= 95; loc++) {
        const glyph = swallowToGlyph(12, loc);
        assert.ok(glyphIsSwallow(glyph));
        assert.equal(glyph, GlyphOffset.swallow + 12 * 8 + (loc - 88));
        assert.equal(glyphToSwallow(glyph), loc - 88);
    }
    // display.c:2441-2444 reports impossible("swallow_to_glyph: bad swallow
    // location") before clamping to S_sw_br; the port clamps without the
    // report — swallowed() only ever passes S_sw_tl..S_sw_br.
    assert.equal(swallowToGlyph(3, 87), GlyphOffset.swallow + 3 * 8 + 7);
    assert.equal(glyphToSwallow(GlyphOffset.explodeDark), 0);
});

void test('trap glyphs decode to trap types and terrain inverts over cmap glyphs', () => {
    // display.h:glyph_to_trap(): the trap tail of cmap range B is one glyph
    // per trap type character, defsym_to_trap being symbol - S_arrow_trap + 1.
    const firstTrap = GlyphOffset.cmapB + 15;
    assert.ok(glyphIsTrap(firstTrap));
    assert.ok(glyphIsTrap(firstTrap + 24));
    assert.ok(!glyphIsTrap(firstTrap - 1) && !glyphIsTrap(firstTrap + 25));
    assert.equal(glyphToTrap(firstTrap), 1);
    assert.equal(glyphToTrap(firstTrap + 9), 10);
    assert.equal(glyphToTrap(GlyphOffset.cmapStone), GlyphOffset.max);
    // glyphs.c:glyph_to_cmap() inverts cmap_to_glyph() over every terrain
    // symbol for each branch's wall range.
    for (const wallOffset of [GlyphOffset.cmapMain, GlyphOffset.cmapMines,
        GlyphOffset.cmapGehennom, GlyphOffset.cmapKnox, GlyphOffset.cmapSokoban]) {
        for (let symbol = 0; symbol <= 87; symbol++) {
            const glyph = cmapToGlyph(symbol, wallOffset);
            if (symbol === 33) continue;    // the altar branch takes AM_NEUTRAL
            assert.equal(glyphToCmapSymbol(glyph), symbol,
                `symbol ${symbol} at wall offset ${wallOffset}`);
        }
    }
    // Non-terrain glyphs decode to null in the port; C's MAXPCHARS sentinel
    // has no terrain meaning either.
    assert.equal(glyphToCmapSymbol(GlyphOffset.monMale), null);
    assert.equal(glyphToCmapSymbol(GlyphOffset.swallow), null);
});

void test('the invisible placeholder is a glyph of its own', () => {
    assert.ok(glyphIsInvisible(GlyphOffset.invisible));
    assert.ok(!glyphIsInvisible(GlyphOffset.invisible - 1));
    assert.ok(!glyphIsInvisible(GlyphOffset.invisible + 1));

});
