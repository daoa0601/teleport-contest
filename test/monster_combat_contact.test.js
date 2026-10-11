import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { canSeeMonster, flush_screen } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { heroSeductionCompatibility } from '../js/hero_form_contact.js';
import { resetInputState } from '../js/input.js';
import { AD_PHYS, AD_SEDU, AD_SITM, AD_SSEX, AT_CLAW, AT_TENT, AT_TUCH, AT_WEAP, } from '../js/monster_attack_types.js';
import { canSeeMonsterCombat, prepareMonsterCombatContact, rejectMonsterShadeContact, showMonsterArtifactFallbackHit, showMonsterCombatMiss, } from '../js/monster_combat_messages.js';
import { DAGGER, OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { seductionCompatibility } from '../js/seduction_compatibility.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const species of ['wood nymph', 'water nymph', 'mountain nymph']) {
    void test(`${species} seduction contact uses the defender's sight and sex`, async () => {
        freshObjectRoom();
        const nymph = await createMonsterAt(species, 12, 10, MM_NOGRP | NO_MINVENT);
        const orc = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
        orc.female = false;
        const messages = [];
        const publish = async (message) => { messages.push(message); };
        const admitted = await prepareMonsterCombatContact(nymph, orc, [AT_CLAW, AD_SEDU, 0, 0], null, { visible: true, publish });
        orc.mcansee = 0;
        orc.female = true;
        await prepareMonsterCombatContact(nymph, orc, [AT_CLAW, AD_SITM, 0, 0], null, { visible: true, publish });
        assert.equal(admitted, 'contact');
        assert.deepEqual(messages, [
            `The ${species} smiles at the orc seductively.`,
            `The ${species} talks to the orc engagingly.`,
        ]);
    });
}
void test('seduction compatibility distinguishes unseen seduction from theft and sexual attacks', async () => {
    freshObjectRoom();
    const demon = await createMonsterAt('amorous demon', 12, 10, MM_NOGRP | NO_MINVENT);
    demon.female = true;
    demon.minvis = true;
    const orc = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    orc.female = false;
    const perceptive = await createMonsterAt('Archon', 14, 10, MM_NOGRP | NO_MINVENT);
    perceptive.female = false;
    assert.equal(seductionCompatibility(demon, orc, [AT_TUCH, AD_SEDU, 0, 0]), 0);
    assert.equal(seductionCompatibility(demon, orc, [AT_TUCH, AD_SSEX, 0, 0]), 1);
    assert.equal(seductionCompatibility(demon, orc, [AT_TUCH, AD_SITM, 0, 0]), 1);
    assert.equal(seductionCompatibility(demon, perceptive, [AT_TUCH, AD_SEDU, 0, 0]), 1);
    assert.equal(seductionCompatibility(demon, orc, [AT_CLAW, AD_PHYS, 1, 3]), 0);
    assert.equal(seductionCompatibility(demon, orc, null), 1);
    orc.female = true;
    assert.equal(seductionCompatibility(demon, orc, [AT_TUCH, AD_SSEX, 0, 0]), 0);
});
void test('nymphs can engage neuter defenders but amorous demons and animals cannot', async () => {
    freshObjectRoom();
    const nymph = await createMonsterAt('water nymph', 12, 10, MM_NOGRP | NO_MINVENT);
    const cloud = await createMonsterAt('fog cloud', 13, 10, MM_NOGRP | NO_MINVENT);
    const demon = await createMonsterAt('amorous demon', 14, 10, MM_NOGRP | NO_MINVENT);
    const dog = await createMonsterAt('little dog', 15, 10, MM_NOGRP | NO_MINVENT);
    assert.equal(seductionCompatibility(nymph, cloud, [AT_CLAW, AD_SEDU, 0, 0]), 2);
    assert.equal(seductionCompatibility(demon, cloud, [AT_TUCH, AD_SSEX, 0, 0]), 0);
    assert.equal(seductionCompatibility(dog, nymph, [AT_TUCH, AD_SEDU, 0, 0]), 0);
});
void test('hero nymph form shares the same compatibility rule and preserves blindness independence', async () => {
    freshObjectRoom({ flags: { female: true } });
    installPolymorphedHero('mountain nymph');
    const orc = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
    orc.female = false;
    orc.mcansee = 0;
    assert.equal(heroSeductionCompatibility(orc, [AT_CLAW, AD_SEDU, 0, 0]), 1);
    assert.equal(seductionCompatibility('hero', orc, [AT_CLAW, AD_SEDU, 0, 0]), 1);
});
void test('an invisible seducer requires the hero to perceive it for a seduction attack', async () => {
    freshObjectRoom({ flags: { female: true } });
    const demon = await createMonsterAt('amorous demon', 12, 10, MM_NOGRP | NO_MINVENT);
    demon.female = false;
    demon.minvis = true;
    assert.equal(seductionCompatibility(demon, 'hero', [AT_TUCH, AD_SEDU, 0, 0]), 0);
    assert.equal(seductionCompatibility(demon, 'hero', [AT_TUCH, AD_SSEX, 0, 0]), 1);
    grantIntrinsicProperty('seeInvisible', 'outside');
    assert.equal(seductionCompatibility(demon, 'hero', [AT_TUCH, AD_SEDU, 0, 0]), 1);
});
void test('cancelled seducers use ordinary miss feedback', async () => {
    freshObjectRoom();
    const nymph = await createMonsterAt('mountain nymph', 12, 10, MM_NOGRP | NO_MINVENT);
    const orc = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    await showMonsterCombatMiss(nymph, orc, [AT_CLAW, AD_SEDU, 0, 0], { visible: true, publish });
    nymph.mcan = 1;
    await showMonsterCombatMiss(nymph, orc, [AT_CLAW, AD_SEDU, 0, 0], { visible: true, publish });
    assert.deepEqual(messages, ['The mountain nymph pretends to be friendly to the orc.', 'The mountain nymph misses the orc.']);
});
void test('shade admission rejects an ordinary weapon and wakes its defender without damaging it', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('seeInvisible', 'outside');
    const orc = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
    const shade = await createMonsterAt('shade', 13, 10, MM_NOGRP | NO_MINVENT);
    shade.msleeping = 1;
    const hp = shade.mhp;
    const dagger = await knownObject(DAGGER);
    const messages = [];
    const admission = await prepareMonsterCombatContact(orc, shade, [AT_WEAP, AD_PHYS, 1, 8], dagger, {
        visible: true, publish: async (message) => { messages.push(message); },
    });
    assert.equal(admission, 'shade-miss');
    assert.equal(shade.mhp, hp);
    assert.equal(shade.msleeping, 0);
    assert.deepEqual(messages, ["The orc's dagger passes harmlessly through the shade."]);
});
void test('compatible seduction enters a shade contact without the physical rejection', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('seeInvisible', 'outside');
    const nymph = await createMonsterAt('water nymph', 12, 10, MM_NOGRP | NO_MINVENT);
    const shade = await createMonsterAt('shade', 13, 10, MM_NOGRP | NO_MINVENT);
    shade.female = true;
    shade.msleeping = 1;
    const messages = [];
    const admission = await prepareMonsterCombatContact(nymph, shade, [AT_CLAW, AD_SEDU, 0, 0], null, {
        visible: true, publish: async (message) => { messages.push(message); },
    });
    assert.equal(admission, 'contact');
    assert.equal(shade.msleeping, 1);
    assert.deepEqual(messages, ['The water nymph smiles at the shade engagingly.']);
});
void test('the physical shade probe can wake an unseen defender silently even when its opponent is visible', async () => {
    freshObjectRoom();
    const orc = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
    const shade = await createMonsterAt('shade', 13, 10, MM_NOGRP | NO_MINVENT);
    shade.minvis = true;
    shade.msleeping = 1;
    const messages = [];
    assert.equal(canSeeMonsterCombat(orc, shade), true);
    assert.equal(canSeeMonster(shade), false);
    const rejected = await rejectMonsterShadeContact(orc, shade, null, {
        visible: canSeeMonster(orc) && canSeeMonster(shade),
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(rejected, true);
    assert.equal(shade.msleeping, 0);
    assert.equal(messages.length, 0);
});
void test('silver weapon contact reaches a shade without inventing flesh', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('seeInvisible', 'outside');
    const orc = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
    const shade = await createMonsterAt('shade', 13, 10, MM_NOGRP | NO_MINVENT);
    const saber = await knownObject(OBJECT_NAMES.indexOf('silver saber'));
    const messages = [];
    const admission = await prepareMonsterCombatContact(orc, shade, [AT_WEAP, AD_PHYS, 1, 8], saber, {
        visible: true, publish: async (message) => { messages.push(message); },
    });
    assert.equal(admission, 'contact');
    assert.deepEqual(messages, ['The orc hits the shade.', "The orc's silver saber sears the shade!"]);
});
void test('artifact contact leaves hit feedback to its owner while retaining silver feedback', async () => {
    freshObjectRoom({ hero: { protectionFromShapeChangers: true } });
    const orc = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
    const vampire = await createMonsterAt('vampire', 13, 10, MM_NOGRP | NO_MINVENT);
    const saber = await artifactObject('Grayswandir');
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    await prepareMonsterCombatContact(orc, vampire, [AT_WEAP, AD_PHYS, 1, 8], saber, { visible: true, publish });
    assert.deepEqual(messages, ["The orc's silver saber sears the vampire's flesh!"]);
    await showMonsterArtifactFallbackHit(orc, vampire, { visible: true, publish });
    assert.equal(messages[1], 'The orc hits the vampire.');
});
void test('tentacle hits and self-directed misses use native target grammar', async () => {
    freshObjectRoom();
    const flayer = await createMonsterAt('mind flayer', 12, 10, MM_NOGRP | NO_MINVENT);
    flayer.female = true;
    const orc = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const publish = async (message) => { messages.push(message); };
    await prepareMonsterCombatContact(flayer, orc, [AT_TENT, AD_PHYS, 1, 4], null, { visible: true, publish });
    await showMonsterCombatMiss(flayer, flayer, [AT_TENT, AD_PHYS, 1, 4], { visible: true, publish });
    await showMonsterArtifactFallbackHit(flayer, flayer, { visible: true, publish });
    assert.deepEqual(messages, ["The mind flayer's tentacles suck the orc.", 'The mind flayer misses herself.', 'The mind flayer hits herself.']);
});
void test('a self-directed silver strike names the attackers own flesh', async () => {
    freshObjectRoom({ hero: { protectionFromShapeChangers: true } });
    const vampire = await createMonsterAt('vampire', 12, 10, MM_NOGRP | NO_MINVENT);
    vampire.female = false;
    const saber = await knownObject(OBJECT_NAMES.indexOf('silver saber'));
    const messages = [];
    await prepareMonsterCombatContact(vampire, vampire, [AT_WEAP, AD_PHYS, 1, 8], saber, {
        visible: true, publish: async (message) => { messages.push(message); },
    });
    assert.deepEqual(messages, ['The vampire hits himself.', "The vampire's silver saber sears his own flesh!"]);
});
void test('silver contact resumes after the generic hit page and leaves the defender alive', async () => {
    freshObjectRoom({ hero: { protectionFromShapeChangers: true } });
    const orc = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
    const vampire = await createMonsterAt('vampire', 13, 10, MM_NOGRP | NO_MINVENT);
    const saber = await knownObject(OBJECT_NAMES.indexOf('silver saber'));
    const hp = vampire.mhp;
    const input = resetInputState();
    await answerPrompts(prepareMonsterCombatContact(orc, vampire, [AT_WEAP, AD_PHYS, 1, 8], saber, { visible: true }), input, [
        { prompt: /The orc hits the vampire\.[\s\S]*--More--/, keys: ' ' },
    ]);
    await flush_screen();
    assert.equal(vampire.mhp, hp);
    const row = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(row, "The orc's silver saber sears the vampire's flesh!");
});
//# sourceMappingURL=monster_combat_contact.test.js.map