import assert from 'node:assert/strict';
import test from 'node:test';

import { addBuriedObject } from '../js/buried_object.js';
import { MM_NOWAIT, NO_MINVENT, PIT } from '../js/const.js';
import { reviveCorpseImmediately } from '../js/corpse_revival.js';
import { glyphAt } from '../js/display.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { maketrap } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { initRng } from '../js/rng.js';
import { untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a buried revival keeps the hallucinated appearance shown when its pit opens', async () => {
    await freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    initRng(17n);
    const emerging = await createMonsterAt('troll', 12, 10, NO_MINVENT | MM_NOWAIT);
    await maketrap(emerging.mx, emerging.my, PIT);
    const expected = glyphAt(emerging.mx, emerging.my);
    assert.ok(expected?.kind === 'monster');

    const level = await freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    const corpse = await untimedCorpse(emerging.mnum);
    addBuriedObject(corpse, 12, 10);
    initRng(17n);

    const revival = await reviveCorpseImmediately(corpse, game, { announce: false });

    assert.ok(revival?.monster);
    assert.equal(corpse.where, 'gone');
    assert.equal(level.traps.find(trap => trap.tx === 12 && trap.ty === 10)?.ttyp, PIT);
    assert.equal(glyphAt(12, 10)?.glyph, expected.glyph,
        'consuming the buried body must not change the emerging monster appearance');
});

void test('announcing a floor revival preserves the monster appearance shown as the corpse disappears', async () => {
    async function reviveOnFloor(announce: boolean) {
        await freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        const corpse = await untimedCorpse(MONSTER_NAME.indexOf('troll'));
        placeCreatedObject(corpse, 12, 10);
        initRng(17n);

        const revival = await reviveCorpseImmediately(corpse, game, { announce });

        assert.ok(revival?.monster);
        assert.equal(corpse.where, 'gone');
        if (announce) assert.match(revival.messages[0] ?? '', / rises from the dead!$/);
        return glyphAt(12, 10)?.glyph;
    }

    const silent = await reviveOnFloor(false);
    const announced = await reviveOnFloor(true);

    assert.equal(announced, silent,
        'the revival message must not change the appearance left by corpse removal');
});

for (const species of ['cave spider', 'small mimic']) {
    void test(`a revived ${species} appears without hiding or a disguise`, async () => {
        await freshObjectRoom();
        const corpse = await untimedCorpse(MONSTER_NAME.indexOf(species));
        placeCreatedObject(corpse, 12, 10);

        const revival = await reviveCorpseImmediately(corpse);

        assert.ok(revival?.monster);
        assert.equal(!!revival.monster.mundetected, false);
        const shown = glyphAt(12, 10);
        assert.ok(shown?.kind === 'monster');
        assert.equal(shown.mnum, revival.monster.mnum);
    });
}
