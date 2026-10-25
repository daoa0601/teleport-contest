import test from 'node:test';
import assert from 'node:assert/strict';
import { BAG_OF_TRICKS, BELL_OF_OPENING, BRASS_LANTERN, CAN_OF_GREASE, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, HORN_OF_PLENTY, MAGIC_FLUTE, MAGIC_HARP, MAGIC_MARKER, OIL_LAMP, OBJECT_COST, OBJECT_NAMES, TALLOW_CANDLE, TINNING_KIT, WAX_CANDLE, FIGURINE, } from '../js/object_data.js';
import { mksobj } from '../js/mklev.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from '../js/monster_data.js';
import { objectWeight } from '../js/weight.js';
import { freshObjectRoom } from './support/object-room.js';
// C mkobj.c:mksobj_init() TOOL_CLASS branches for candles, lamps, and the
// charged tools, plus the figurine species draw.
void test('candles are unlit single-wick stacks with cost-derived fuel', async () => {
    freshObjectRoom({ gameplaySeed: 4004n });
    for (const typ of [TALLOW_CANDLE, WAX_CANDLE]) {
        for (let i = 0; i < 150; i++) {
            const candle = await mksobj(typ, true, false);
            assert.equal(candle.spe, 1);
            assert.equal(candle.age, 20 * (OBJECT_COST[typ] ?? 0), 'a candle holds twenty times its price in fuel');
            assert.equal(candle.lamplit, false, 'generated candles start dark');
            assert.ok(candle.quan >= 1 && candle.quan <= 7, `candle quantity ${candle.quan} outside 1..7`);
        }
    }
});
void test('lamps and lanterns carry partial fuel but never a charge', async () => {
    freshObjectRoom({ gameplaySeed: 4010n });
    for (const typ of [OIL_LAMP, BRASS_LANTERN]) {
        for (let i = 0; i < 150; i++) {
            const lamp = await mksobj(typ, true, false);
            assert.equal(lamp.spe, 1);
            assert.equal(lamp.lamplit, false);
            assert.ok(lamp.age >= 1000 && lamp.age <= 1499, `lamp fuel ${lamp.age} outside 1000..1499`);
        }
    }
});
void test('charged tools roll their native charge ranges', async () => {
    freshObjectRoom({ gameplaySeed: 4020n });
    const ranges = {
        [BAG_OF_TRICKS]: [3, 20],
        [HORN_OF_PLENTY]: [3, 20],
        [EXPENSIVE_CAMERA]: [30, 99],
        [TINNING_KIT]: [30, 99],
        [MAGIC_MARKER]: [30, 99],
        [CAN_OF_GREASE]: [5, 25],
        [CRYSTAL_BALL]: [3, 7],
        [MAGIC_FLUTE]: [4, 8],
        [MAGIC_HARP]: [4, 8],
        [FROST_HORN]: [4, 8],
        [FIRE_HORN]: [4, 8],
        [DRUM_OF_EARTHQUAKE]: [4, 8],
    };
    for (const [typ, [low, high]] of Object.entries(ranges)) {
        const otyp = Number(typ);
        for (let i = 0; i < 120; i++) {
            const tool = await mksobj(otyp, true, false);
            assert.ok(tool.spe >= low && tool.spe <= high, `${OBJECT_NAMES[otyp]} charge ${tool.spe} outside ${low}..${high}`);
        }
    }
    const bell = await mksobj(BELL_OF_OPENING, true, false);
    assert.equal(bell.spe, 3);
});
void test('figurines depict non-human monsters at a fixed weight', async () => {
    // C: the figurine draw retries up to thirty times to avoid human forms
    // while keeping the harder monster band, and figurines keep the fixed
    // object-table weight regardless of the depicted species.
    freshObjectRoom({ gameplaySeed: 4030n });
    for (let i = 0; i < 300; i++) {
        const figurine = await mksobj(FIGURINE, true, false);
        const species = figurine.corpsenm;
        assert.ok(typeof species === 'number' && species >= 0, 'a figurine names the monster it depicts');
        assert.ok(!((MONSTER_FLAGS2[species] ?? 0) & 0x8), `figurine of human form ${MONSTER_NAME[species]}`);
        assert.equal(objectWeight(figurine), 50);
        assert.equal(figurine.owt, 50);
    }
});
//# sourceMappingURL=mkobj_tool_init.test.js.map