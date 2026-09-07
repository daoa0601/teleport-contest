import test from 'node:test';
import assert from 'node:assert/strict';

import { removeHeroAccessory, wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT, PIT, STONE, WEB } from '../js/const.js';
import { canSeeMonster, canSpotMonster } from '../js/display.js';
import { createFireExplosion } from '../js/fire_explosion.js';
import { game } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { heroCanMoveFromTrap, triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { prepareHeroStartup } from './support/startup.js';

test('fire immunity protects a dragon body and ends when the hero changes back', async () => {
    freshObjectRoom({ flags: { debug: true } });
    pushKeys('polyself\nred dragon\n                        ');
    await rhack('#'.charCodeAt(0));
    const monsterHealth = game.u.mh;

    await createFireExplosion(game.u.ux, game.u.uy, 12);

    assert.equal(game.u.mh, monsterHealth);
    resetInputState();
    pushKeys('polyself\ncaveman\n                        ');
    await rhack('#'.charCodeAt(0));
    const humanHealth = game.u.uhp;
    await createFireExplosion(game.u.ux, game.u.uy, 12);
    assert.ok(game.u.uhp < humanHealth);
});

test('losing a cold-resistant form does not remove protection from a ring', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const ring = addInventoryObject(OBJECT_NAMES.indexOf('cold resistance'));
    wearHeroAccessory(ring, 'uleft');
    pushKeys('polyself\nwhite dragon\n                        ');
    await rhack('#'.charCodeAt(0));
    resetInputState();
    pushKeys('polyself\nnewt\n                        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.coldResistance, true);
    removeHeroAccessory(ring);
    assert.equal(game.u.coldResistance, false);
});

test('a floating eye floats over a pit without acquiring flight', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    addTrap(level, PIT, game.u.ux + 1, game.u.uy);
    pushKeys('polyself\nfloating eye\n                        ');
    await rhack('#'.charCodeAt(0));
    resetInputState();
    const x = game.u.ux;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, x + 1);
    assert.ok(!game.u.utrap);
    assert.equal(game.u.levitating, true);
    assert.equal(game.u.flying, false);
});

test('a vampire senses a human behind a wall without seeing an animal there', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    const soldier = await createMonsterAt('soldier', 14, 10, NO_MINVENT);
    const jackal = await createMonsterAt('jackal', 14, 11, NO_MINVENT);
    for (let y = 0; y < 21; y++) level.at(12, y).typ = STONE;
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(canSpotMonster(soldier), false);
    pushKeys('polyself\nvampire\n                        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(canSeeMonster(soldier, 14, 10), false);
    assert.equal(canSpotMonster(soldier), true);
    assert.equal(canSpotMonster(jackal), false);
});

test('a blind mind flayer senses minds but not a mindless golem', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const soldier = await createMonsterAt('soldier', 14, 10, NO_MINVENT);
    const golem = await createMonsterAt('stone golem', 14, 11, NO_MINVENT);
    pushKeys('polyself\nmind flayer\n                        ');
    await rhack('#'.charCodeAt(0));

    setHeroBlindnessTurns(5);
    vision_recalc(0);

    assert.equal(canSpotMonster(soldier), true);
    assert.equal(canSpotMonster(golem), false);
});

test('escaping a web restores flight without changing the bat body', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    pushKeys('polyself\nbat\n                        ');
    await rhack('#'.charCodeAt(0));
    const web = addTrap(level, WEB, game.u.ux, game.u.uy);
    await triggerHeroTrap(web);
    assert.ok(game.u.utrap > 0);
    assert.equal(game.u.flying, false);

    for (let attempt = 0; game.u.utrap > 0 && attempt < 20; attempt++)
        await heroCanMoveFromTrap(game.u.ux + 1, game.u.uy);

    assert.equal(game.u.utrap, 0);
    assert.equal(game.u.umonnum, nameToMonster('bat'));
    assert.equal(game.u.flying, true);
});

test('racial infravision survives a body that lacks it', () => {
    prepareHeroStartup({ role: 'wizard', race: 'elf' });

    setHeroSpecies(nameToMonster('newt'));

    assert.equal(game.u.infravision, true);
});
