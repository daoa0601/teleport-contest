import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty, hasPermanentIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { attrcurse } from '../js/throne.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('losing intrinsic telepathy preserves a hallucinated monster sensed through an amulet', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 } });
    setHeroBlindnessTurns(30);
    vision_recalc(0);
    grantIntrinsicProperty('telepathy', 'outside');
    await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('amulet of ESP')), 'uamul');
    const monster = await createMonsterAt('kobold', 12, 10, NO_MINVENT);
    newsym(monster.mx, monster.my);
    const before = glyphAt(monster.mx, monster.my);
    assert.equal(before?.kind, 'monster');
    initRng(2n);

    await attrcurse();

    assert.equal(hasPermanentIntrinsicProperty('telepathy'), false);
    const after = glyphAt(monster.mx, monster.my);
    assert.ok(before?.kind === 'monster' && after?.kind === 'monster');
    assert.equal(after.mnum, before.mnum, 'The amulet keeps the existing perceived identity visible.');
});

void test('losing the last telepathy source removes a blind hero\'s sensed monster', async () => {
    freshObjectRoom();
    setHeroBlindnessTurns(30);
    vision_recalc(0);
    grantIntrinsicProperty('telepathy', 'outside');
    const monster = await createMonsterAt('kobold', 12, 10, NO_MINVENT);
    newsym(monster.mx, monster.my);
    assert.equal(glyphAt(monster.mx, monster.my)?.kind, 'monster');
    initRng(2n);

    await attrcurse();

    assert.equal(hasPermanentIntrinsicProperty('telepathy'), false);
    assert.notEqual(glyphAt(monster.mx, monster.my)?.kind, 'monster');
});
