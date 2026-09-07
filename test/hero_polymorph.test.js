import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroArmor } from '../js/armor.js';
import { touchArtifactByHero } from '../js/artifact_touch.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { retouchEquipment } from '../js/hero_retouch.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { OBJECT_NAMES, SHIELD_OF_REFLECTION } from '../js/object_data.js';
import { roles, races } from '../js/roles.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';

test('human renewal restarts the slime countdown even when already human', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true }, gameplaySeed: 2317n });
    game.urace = races.find(race => race.name === 'human');
    game.u.umonster = game.u.umonnum = MONSTER_NAME.indexOf('archeologist');
    game.u.slimed = true;
    game.u.slimedTurns = 2;
    pushKeys('polyself\nhuman\n        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.slimedTurns, 10);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.match(game._pending_message, /still slime on you/);
});

test('a vampire taking silver damage loses monster health, not human health', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true }, gameplaySeed: 2317n });
    const saber = addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));
    setPrimaryWeapon(saber);
    const humanHealth = game.u.uhp;
    pushKeys('polyself\nvampire\n        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.uhp, humanHealth);
    assert.ok(game.u.mh > 0 && game.u.mh < game.u.mhmax);
    assert.equal(game.uwep, null);
    assert.ok(game.level.objects[game.u.ux][game.u.uy].includes(saber));
});

test('losing a shield during polymorph also loses its reflection', async () => {
    freshObjectRoom({ role: roles[0], flags: { debug: true }, gameplaySeed: 2317n });
    const shield = addInventoryObject(SHIELD_OF_REFLECTION);
    wearHeroArmor(shield);
    assert.equal(game.u.reflection, true);
    pushKeys('polyself\nfog cloud\n        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.uarms, null);
    assert.equal(game.u.reflection, false);
    assert.ok(game.level.objects[game.u.ux][game.u.uy].includes(shield));
});

test('an artifact blast that kills a monster form preserves the human body', async () => {
    freshObjectRoom({ role: roles[0], gameplaySeed: 2317n });
    game.urace = races.find(race => race.name === 'human');
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const excalibur = artifactObject('Excalibur');
    const humanHealth = game.u.uhp;
    pushKeys('        ');

    const result = await touchArtifactByHero(excalibur);

    assert.equal(result.died, false);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
});

test('losing a form during equipment checks finishes the original item removal', async () => {
    freshObjectRoom({ role: roles[0], gameplaySeed: 2317n });
    game.urace = races.find(race => race.name === 'human');
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const saber = addInventoryObject(OBJECT_NAMES.indexOf('silver saber'));
    setPrimaryWeapon(saber);
    const humanHealth = game.u.uhp;
    pushKeys('        ');

    const result = await retouchEquipment(2);

    assert.equal(result.died, false);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(game.uwep, null);
    assert.ok(game.level.objects[game.u.ux][game.u.uy].includes(saber));
});

test('declining death in wizard mode restores an unchanging monster body', async () => {
    freshObjectRoom({ flags: { debug: true }, gameplaySeed: 2317n });
    installPolymorphedHero('vampire', { hitPoints: 1, maxHitPoints: 40 });
    game.u.unchanging = true;
    const vampire = game.u.umonnum;
    pushKeys(' n');

    const died = await loseHeroHp(5, 'injury');

    assert.equal(died, false);
    assert.equal(game.u.umonnum, vampire);
    assert.ok(game.u.mh > 0);
});
