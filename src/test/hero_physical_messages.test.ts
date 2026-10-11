import test from 'node:test';
import assert from 'node:assert/strict';

import { discoverArtifact } from '../js/artifacts.js';
import { M_AP_OBJECT, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flush_screen, glyphAt, plineWithContinuation } from '../js/display.js';
import { addFruit } from '../js/fruit.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    captureHeroPhysicalObjectName, captureHeroProjectileName, captureUnpoisonedPhysicalObjectName,
    reportHeroThrownMiss,
    showHeroHarmlessStoneHit, showHeroPhysicalHit, showHeroPhysicalLight,
    showHeroPhysicalPoisonWoreOff, showHeroPhysicalSilver, showHeroShadeMiss,
} from '../js/hero_physical_messages.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    ARROW, BULLWHIP, CORPSE, DAGGER, HEAVY_IRON_BALL, IRON_CHAIN,
    OBJECT_NAMES, ROCK, SLIME_MOLD, SMALL_SHIELD, SPEAR, TOWEL, WAN_FIRE,
} from '../js/object_data.js';
import { deleteObject } from '../js/object_delete.js';
import { setMonsterSpecies } from '../js/monster_species.js';
import { rayMissMessage } from '../js/ray_hit_message.js';
import { makeBlinded } from '../js/sight_change.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const SILVER_SPEAR = OBJECT_NAMES.indexOf('silver spear');

for (const [label, type, verb] of [
    ['fist', null, 'hit'], ['shield', SMALL_SHIELD, 'bash'], ['iron ball', HEAVY_IRON_BALL, 'bash'],
    ['whip', BULLWHIP, 'lash'], ['wet towel', TOWEL, 'lash'],
] as const) {
    void test(`a ${label} uses its native melee-hit verb`, async () => {
        freshObjectRoom({ flags: { verbose: true } });
        const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
        const object = type === null ? null : await knownObject(type, { spe: type === TOWEL ? 2 : 0 });
        const messages: string[] = [];

        const shown = await showHeroPhysicalHit(monster, object, {
            mode: 'melee', damage: 8, destroyed: false, hitTextShown: false,
            publish: async message => { messages.push(message); },
        });

        assert.equal(shown, true);
        assert.deepEqual(messages, [`You ${verb} the orc!`]);
    });
}

void test('a barbarian smites with an ordinary weapon but quiet combat just reports a hit', async () => {
    freshObjectRoom({ role: 'barbarian', flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    const spear = await knownObject(SPEAR);
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };

    await showHeroPhysicalHit(monster, spear, { mode: 'melee', damage: 3, destroyed: false, hitTextShown: false, publish });
    game.flags.verbose = false;
    await showHeroPhysicalHit(monster, spear, { mode: 'melee', damage: 9, destroyed: false, hitTextShown: false, publish });

    assert.deepEqual(messages, ['You smite the orc.', 'You hit it.']);
});

void test('a sensed invisible defender is named but does not reveal melee damage through punctuation', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.minvis = true;
    game.u.detectMonsters = true;
    const messages: string[] = [];

    await showHeroPhysicalHit(monster, null, {
        mode: 'melee', damage: 12, destroyed: false, hitTextShown: false,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['You hit the invisible orc.']);
});

for (const mode of ['thrown', 'kicked', 'applied', 'dragged'] as const) {
    void test(`${mode} objects use projectile hit feedback`, async () => {
        freshObjectRoom({ flags: { verbose: true } });
        const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
        const spear = await knownObject(SPEAR);
        const messages: string[] = [];

        await showHeroPhysicalHit(monster, spear, {
            mode, damage: 7, destroyed: false, hitTextShown: false,
            publish: async message => { messages.push(message); },
        });

        assert.deepEqual(messages, ['The spear hits the orc!']);
    });
}

void test('ordinary lethal hits and already-described contacts suppress the generic hit line', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    const spear = await knownObject(SPEAR);
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };

    const lethal = await showHeroPhysicalHit(monster, spear, {
        mode: 'thrown', damage: 10, destroyed: true, hitTextShown: false, publish,
    });
    const described = await showHeroPhysicalHit(monster, spear, {
        mode: 'melee', damage: 10, destroyed: false, hitTextShown: true, publish,
    });

    assert.equal(lethal, false);
    assert.equal(described, false);
    assert.equal(messages.length, 0);
});

void test('a killing arrow in a volley still reports its ordinal hit', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    const arrow = await knownObject(ARROW);
    monster.mhp = 0;
    const messages: string[] = [];

    const shown = await showHeroPhysicalHit(monster, arrow, {
        mode: 'thrown', damage: 7, destroyed: true, hitTextShown: false,
        volley: { count: 3, index: 2, objectType: ARROW },
        publish: async message => { messages.push(message); },
    });

    assert.equal(shown, true);
    assert.deepEqual(messages, ['The 2nd arrow hits the orc!']);
});

void test('a volley of a different object does not expose an unrelated killing hit', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    const dagger = await knownObject(DAGGER);
    const messages: string[] = [];

    const shown = await showHeroPhysicalHit(monster, dagger, {
        mode: 'thrown', damage: 8, destroyed: true, hitTextShown: false,
        volley: { count: 3, index: 2, objectType: ARROW },
        publish: async message => { messages.push(message); },
    });

    assert.equal(shown, false);
    assert.equal(messages.length, 0);
});

void test('a missed projectile retains its volley ordinal without a second article', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    const arrow = await knownObject(ARROW);
    const name = captureHeroProjectileName(arrow, game, { count: 3, index: 3, objectType: ARROW });

    assert.equal(rayMissMessage(name, monster, { x: 11, y: 10 }), 'The 3rd arrow misses the orc.');
});

void test('a missed throw omits a sensed invisible defender and leaves waking to the caller', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { detectMonsters: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.minvis = true;
    monster.msleeping = 1;
    const arrow = await knownObject(ARROW);
    const messages: string[] = [];

    await reportHeroThrownMiss(monster, arrow, {
        volley: { count: 3, index: 2, objectType: ARROW },
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['The 2nd arrow misses.']);
    assert.equal(monster.msleeping, 1);
});

void test('a missed stack of arrows does not identify an object-disguised mimic', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const mimic = await createMonsterAt('small mimic', 11, 10, MM_NOGRP | NO_MINVENT);
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = DAGGER;
    const arrows = await knownObject(ARROW, { quan: 2 });
    const messages: string[] = [];

    await reportHeroThrownMiss(mimic, arrows, {
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['The arrows miss.']);
    assert.equal(mimic.m_ap_type, M_AP_OBJECT);
});

void test('a visible missed throw names its defender according to verbosity', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    const arrow = await knownObject(ARROW);
    const messages: string[] = [];
    const publish = async (message: string) => { messages.push(message); };

    await reportHeroThrownMiss(monster, arrow, { publish });
    game.flags.verbose = false;
    await reportHeroThrownMiss(monster, arrow, { publish });

    assert.deepEqual(messages, ['The arrow misses the orc.', 'The arrow misses it.']);
});

void test('capitalized fruit keeps its article when it hits a monster', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    const fruit = await knownObject(SLIME_MOLD, { spe: addFruit('Dragon Fruit') });
    const messages: string[] = [];

    await showHeroPhysicalHit(monster, fruit, {
        mode: 'thrown', damage: 1, destroyed: false, hitTextShown: false,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['The Dragon Fruit hits the orc.']);
});

void test('an artifact personal name stays bare even when it is also a fruit name', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('orc', 11, 10, MM_NOGRP | NO_MINVENT);
    addFruit('Sunsword');
    const sword = await artifactObject('Sunsword', { rknown: true });
    assert.ok(sword.oartifact);
    discoverArtifact(sword.oartifact);
    const messages: string[] = [];

    await showHeroPhysicalHit(monster, sword, {
        mode: 'thrown', damage: 8, destroyed: false, hitTextShown: false,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['Sunsword hits the orc!']);
});

void test('a swallowed projectile names its unseen engulfer only with verbose feedback', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const engulfer = await createMonsterAt('purple worm', 11, 10, MM_NOGRP | NO_MINVENT);
    engulfer.mx = game.u.ux;
    engulfer.my = game.u.uy;
    game.u.uswallow = 1;
    game.u.ustuck = engulfer;
    await makeBlinded(1, { talk: false });
    const messages: string[] = [];
    const dagger = await knownObject(DAGGER);
    const publish = async (message: string) => { messages.push(message); };

    game.flags.verbose = false;
    await showHeroPhysicalHit(engulfer, dagger, {
        mode: 'thrown', damage: 8, destroyed: false, hitTextShown: false,
        publish,
    });
    game.flags.verbose = true;
    await showHeroPhysicalHit(engulfer, dagger, {
        mode: 'thrown', damage: 8, destroyed: false, hitTextShown: false,
        publish,
    });

    assert.deepEqual(messages, ['The dagger hits it!', 'The dagger hits the purple worm!']);
});

void test('a harmless stone projectile uses the same ordinal and target naming', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('xorn', 11, 10, MM_NOGRP | NO_MINVENT);
    const rock = await knownObject(ROCK);
    const messages: string[] = [];

    await showHeroHarmlessStoneHit(monster, rock, {
        volley: { count: 3, index: 2, objectType: ROCK },
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['The 2nd rock hits the xorn but does no harm.']);
});

void test('silver feedback retains the destroyed object name and native plural agreement', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { protectionFromShapeChangers: true } });
    const monster = await createMonsterAt('vampire', 11, 10, MM_NOGRP | NO_MINVENT);
    const spears = await knownObject(SILVER_SPEAR, { quan: 2, oname: '100% faithful' });
    const savedObjectName = captureHeroPhysicalObjectName(spears);
    await deleteObject(spears);
    const messages: string[] = [];

    await showHeroPhysicalSilver(monster, {
        originalSpecies: monster.mnum, savedObjectName, silverObject: true, silverRings: 0,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ["Your silver spears named 100% faithful sear the vampire's flesh!"]);
});

for (const silverRings of [1, 2] as const) {
    void test(`${silverRings} silver ${silverRings === 1 ? 'ring sears' : 'rings sear'} a vampire`, async () => {
        freshObjectRoom({ flags: { verbose: true }, hero: { protectionFromShapeChangers: true } });
        const monster = await createMonsterAt('vampire', 11, 10, MM_NOGRP | NO_MINVENT);
        const messages: string[] = [];

        await showHeroPhysicalSilver(monster, {
            originalSpecies: monster.mnum, savedObjectName: '', silverObject: false, silverRings,
            publish: async message => { messages.push(message); },
        });

        assert.deepEqual(messages, [`Your silver ${silverRings === 1 ? 'ring sears' : 'rings sear'} the vampire's flesh!`]);
    });
}

void test('silver uses the saved body anatomy after its target changes form', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { protectionFromShapeChangers: true } });
    const monster = await createMonsterAt('vampire', 11, 10, MM_NOGRP | NO_MINVENT);
    const originalSpecies = monster.mnum;
    setMonsterSpecies(monster, MONSTER_NAME.indexOf('fog cloud'));
    const messages: string[] = [];

    await showHeroPhysicalSilver(monster, {
        originalSpecies, savedObjectName: '', silverObject: false, silverRings: 0,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ["The silver sears the fog cloud's flesh!"]);
});

void test('unseen flesh is seared without identifying the monster or the silver object', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { protectionFromShapeChangers: true } });
    const monster = await createMonsterAt('vampire', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.minvis = true;
    const messages: string[] = [];

    await showHeroPhysicalSilver(monster, {
        originalSpecies: monster.mnum, savedObjectName: 'dagger', silverObject: true, silverRings: 0,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['Its flesh is seared!']);
});

void test('a lit Sunsword retains its bare artifact name for radiance feedback', async () => {
    freshObjectRoom({ flags: { verbose: true }, hero: { protectionFromShapeChangers: true } });
    const monster = await createMonsterAt('vampire', 11, 10, MM_NOGRP | NO_MINVENT);
    const sword = await artifactObject('Sunsword', { lamplit: true });
    const savedObjectName = captureHeroPhysicalObjectName(sword);
    const messages: string[] = [];

    await showHeroPhysicalLight(monster, {
        originalSpecies: monster.mnum, savedObjectName,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ["Sunsword's radiance penetrates deep into the vampire's flesh!"]);
});

void test('silver searing an amorphous target does not invent flesh', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('fog cloud', 11, 10, MM_NOGRP | NO_MINVENT);
    const messages: string[] = [];

    await showHeroPhysicalSilver(monster, {
        originalSpecies: monster.mnum, savedObjectName: 'dagger', silverObject: true, silverRings: 0,
        publish: async message => { messages.push(message); },
    });

    assert.deepEqual(messages, ['Your silver dagger sears the fog cloud!']);
});

void test('shade contact wakes an unseen adjacent defender and marks its position', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('shade', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.minvis = true;
    monster.msleeping = 1;
    const messages: string[] = [];

    const missed = await showHeroShadeMiss(monster, await knownObject(IRON_CHAIN), {
        rollOne: () => 1, publish: async message => { messages.push(message); },
    });

    assert.equal(missed, true);
    assert.equal(monster.msleeping, 0);
    assert.deepEqual(messages, ['Your attack passes harmlessly through it.']);
    assert.equal(glyphAt(11, 10)?.kind, 'invisible');
});

void test('a silver weapon that can damage a shade does not report harmless passage', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const monster = await createMonsterAt('shade', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.msleeping = 1;
    const messages: string[] = [];

    const missed = await showHeroShadeMiss(monster, await knownObject(SILVER_SPEAR), {
        rollOne: () => 1, publish: async message => { messages.push(message); },
    });

    assert.equal(missed, false);
    assert.equal(monster.msleeping, 1);
    assert.equal(messages.length, 0);
});

for (const [species, subject] of [
    ['Medusa', "Medusa's corpse"], ['Wizard of Yendor', "The Wizard of Yendor's corpse"],
] as const) {
    void test(`a thrown ${species} corpse keeps native possessive naming when it passes through a shade`, async () => {
        freshObjectRoom({ flags: { verbose: true } });
        const shade = await createMonsterAt('shade', 11, 10, MM_NOGRP | NO_MINVENT);
        const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf(species) });
        const messages: string[] = [];

        const missed = await showHeroShadeMiss(shade, corpse, {
            thrown: true, publish: async message => { messages.push(message); },
        });

        assert.equal(missed, true);
        assert.deepEqual(messages, [`${subject} passes harmlessly through the shade.`]);
    });
}

void test('captured corpse names include species while thrown-object names follow xname', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });

    assert.equal(captureHeroPhysicalObjectName(corpse), 'cockatrice corpse');
    assert.equal(captureHeroProjectileName(corpse), 'corpse');
});

void test('capturing an unseen wand name does not reveal its appearance while blind', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const wand = await knownObject(WAN_FIRE, { dknown: false, typeKnown: false });
    await makeBlinded(1, { talk: false });

    assert.equal(captureHeroPhysicalObjectName(wand), 'wand');
    assert.equal(wand.dknown, false);
});

void test('the deferred unpoisoned name survives deletion and follows the hit pager', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const arrows = await knownObject(ARROW, { quan: 2, opoisoned: 1, oname: 'Venom' });
    assert.equal(captureHeroPhysicalObjectName(arrows), 'poisoned arrows named Venom');
    arrows.opoisoned = 0;
    const savedName = captureUnpoisonedPhysicalObjectName(arrows);
    await deleteObject(arrows);
    await plineWithContinuation('The arrows hit the orc!  The poison was deadly...');
    const input = resetInputState();

    await answerPrompts(showHeroPhysicalPoisonWoreOff(savedName), input, [
        { prompt: /The arrows hit the orc![\s\S]*poison was deadly[\s\S]*--More--/, keys: ' ' },
    ]);
    await flush_screen(1);

    assert.ok(game.nhDisplay);
    const row = game.nhDisplay.grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(row, /Your arrows named Venom are no longer poisoned\./);
});
