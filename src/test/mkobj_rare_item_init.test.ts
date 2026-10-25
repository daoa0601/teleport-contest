import test from 'node:test';
import assert from 'node:assert/strict';

import { mkcorpstat, mksobj, set_corpsenm } from '../js/mklev.js';
import {
    CANDY_BAR, CORPSE, KELP_FROND, LOADSTONE, LUCKSTONE, ROCK, SPE_NOVEL,
    STATUE, TIN,
} from '../js/object_data.js';
import { MONSTER_BODY_META, MONSTER_NAME } from '../js/monster_data.js';
import { objectWeight } from '../js/weight.js';
import { objectTimers } from '../js/object_timers.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_KILLER_BEE = MONSTER_NAME.indexOf('killer bee');
const PM_HUMAN = MONSTER_NAME.indexOf('human');

// C mkobj.c:mksobj_init() FOOD_CLASS and GEM_CLASS branches for the rarely
// generated comestibles, plus the species-driven body objects.
void test('tins are spinach or a nutritious monster meat preparation', async () => {
    freshObjectRoom({ gameplaySeed: 601n });

    let spinach = 0;
    let meat = 0;
    for (let i = 0; i < 600; i++) {
        const tin = await mksobj(TIN, true, false);
        if (tin.spe === 1 && tin.corpsenm === -1) {
            spinach++;
        } else {
            meat++;
            const species = tin.corpsenm;
            assert.ok(typeof species === 'number' && species >= 0,
                `meat tin without a species: corpsenm ${tin.corpsenm}`);
            assert.ok((MONSTER_BODY_META[species]?.[1] ?? 0) > 0,
                `meat tin of nutrition-free ${MONSTER_NAME[species]}`);
            assert.ok(tin.spe <= -1 && tin.spe >= -15,
                `tin preparation ${tin.spe} outside the native table`);
        }
    }
    assert.ok(spinach > 0 && meat > 0, 'this seed rolls both tin kinds');
});

void test('kelp and candy bars keep their native quantity and wrapper', async () => {
    freshObjectRoom({ gameplaySeed: 602n });

    for (let i = 0; i < 200; i++) {
        const kelp = await mksobj(KELP_FROND, true, false);
        assert.ok(kelp.quan === 1 || kelp.quan === 2,
            `kelp quantity ${kelp.quan} outside 1..2`);
        const candy = await mksobj(CANDY_BAR, true, false);
        assert.ok(candy.spe >= 1 && candy.spe <= 12,
            `candy wrapper ${candy.spe} outside the twelve printed labels`);
    }
});

void test('gems follow their native quantity rules', async () => {
    freshObjectRoom({ gameplaySeed: 603n });

    for (let i = 0; i < 200; i++) {
        const rock = await mksobj(ROCK, true, false);
        assert.ok(rock.quan >= 6 && rock.quan <= 11,
            `rock quantity ${rock.quan} outside 6..11`);

        const loadstone = await mksobj(LOADSTONE, true, false);
        assert.equal(loadstone.cursed, true, 'generated loadstones are cursed');

        const luckstone = await mksobj(LUCKSTONE, true, false);
        assert.equal(luckstone.quan, 1, 'luckstones generate singly');
    }
});

void test('a corpse weighs its species body weight and keeps one timer', async () => {
    freshObjectRoom({ gameplaySeed: 604n });

    for (let i = 0; i < 200; i++) {
        const corpse = await mksobj(CORPSE, true, false);
        const species = corpse.corpsenm;
        assert.ok(typeof species === 'number' && species >= 0,
            'a corpse names its species');
        assert.equal(corpse.owt, MONSTER_BODY_META[species]?.[0] ?? 0,
            `${MONSTER_NAME[species]} corpse weighs ${corpse.owt}`);
        assert.ok(objectTimers(corpse).length <= 1,
            'a fresh corpse carries at most one rot or revival timer');
    }
});

void test('statues of tiny bodies still weigh a hundred units', async () => {
    // C weight(): a statue weighs 1.5 times the depicted corpse's weight
    // but never less than (2*body size + 1) * 100, so tiny or weightless
    // species still yield substantial statues; a human statue weighs 2175.
    freshObjectRoom({ gameplaySeed: 605n });

    const bee = await mkcorpstat(STATUE, null, PM_KILLER_BEE, 9, 8, 0);
    assert.equal(objectWeight(bee), 100);
    assert.equal(bee.owt, 100);

    const human = await mkcorpstat(STATUE, null, PM_HUMAN, 9, 9, 0);
    assert.equal(objectWeight(human), 2175);

    // Ordinary generated statues hold at most one non-novel spellbook.
    let books = 0;
    for (let i = 0; i < 200; i++) {
        const statue = await mksobj(STATUE, true, false);
        assert.ok((statue.contents ?? []).length <= 1,
            'a generated statue contains at most one spellbook');
        for (const item of statue.contents ?? []) {
            books++;
            assert.equal(item.oclass, 10);
            assert.notEqual(item.otyp, SPE_NOVEL);
        }
    }
    assert.ok(books > 0, 'this seed hides a book in at least one statue');
});

void test('set_corpsenm reweighs a statue for its new species', async () => {
    freshObjectRoom({ gameplaySeed: 606n });

    const statue = await mksobj(STATUE, true, false);
    set_corpsenm(statue, PM_KILLER_BEE);
    assert.equal(statue.owt, 100,
        'a killer bee statue keeps the hundred-unit statue floor');
});
