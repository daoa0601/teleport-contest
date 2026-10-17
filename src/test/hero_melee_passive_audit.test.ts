import assert from 'node:assert/strict';
import test from 'node:test';
import { finishHeroHelplessness } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, Upolyd } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { DAGGER, ELVEN_LEATHER_HELM, IRON_SHOES, LEATHER_GLOVES } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { heroIsBlind } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

async function meleeRoom(form: string, defender: string) {
    freshObjectRoom({
        flags: { verbose: true, bones: false, disclose: '-i -a -v -c -o' },
        hero: { uhitinc: 100, uhp: 200, uhpmax: 200 },
    });
    installPolymorphedHero(form, { hitPoints: 200 });
    const monster = await createMonsterAt(defender, 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    monster.mhp = monster.mhpmax = 2000;
    monster.mpeaceful = false;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    monster.minvis = 0;
    monster.mundetected = 0;
    return monster;
}

async function attackEast(expected: RegExp, force = false): Promise<string> {
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 20 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    if (force) pushKey('l');
    await rhack((force ? 'F' : 'l').charCodeAt(0));
    if (!game.program_state.gameover)
        assert.equal(game.context.move, 1, 'An attack against the adjacent target must spend a turn');
    messages.push(game._pending_message);
    return messages.join('\n');
}

void test('hallucination lets an attacker see a floating eye look numb or stupefied', async () => {
    await meleeRoom('newt', 'floating eye');
    game.u.hallucinationTurns = 100;
    game.u.freeAction = true;
    initRng(41n);
    const reactions: string[] = [];

    for (let attempt = 0; attempt < 24; attempt++) {
        const messages = await attackEast(/bite|looks|stiffen/);
        for (const match of messages.matchAll(/looks ([^.\n]+)\./g)) {
            assert.ok(match[1]);
            reactions.push(match[1]);
        }
    }

    assert.ok(reactions.length > 0, 'The hallucinating attacker should sometimes escape the gaze');
    for (const reaction of reactions)
        assert.match(reaction, /^(?:rather )?(?:numb|stupefied)$/,
            'The eye reaction has one optional adjective');
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('free action resists a hallucinated floating eye gaze without freezing the attacker', async () => {
    await meleeRoom('newt', 'floating eye');
    game.u.hallucinationTurns = 100;
    game.u.freeAction = true;
    initRng(41n);
    let messages = '';

    for (let attempt = 0; attempt < 24; attempt++) {
        messages += await attackEast(/bite|looks|stiffen/, true) + '\n';
        assert.equal(game._helplessTurns ?? 0, 0);
    }

    assert.match(messages, /You momentarily stiffen under .+ gaze!/,
        'Free action resists the gaze when hallucination does not provide an escape');
    assert.doesNotMatch(messages, /You are frozen/);
});

void test('a blind floating eye cannot freeze the hero who strikes it', async () => {
    const eye = await meleeRoom('newt', 'floating eye');
    eye.mcansee = 0;
    eye.mblinded = 10;
    initRng(41n);
    let messages = '';

    for (let attempt = 0; attempt < 6; attempt++)
        messages += await attackEast(/floating eye|cannot defend/);

    assert.match(messages, /The blind floating eye cannot defend itself\./);
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('a natural melee kick does not offer boots to an acid blob\'s object passive', async () => {
    await meleeRoom('sasquatch', 'acid blob');
    const boots = await addInventoryObject(IRON_SHOES);
    wearHeroArmor(boots);
    // Intrinsic acid resistance protects the body, not these boots.
    game.u.acidResistance = true;
    initRng(41n);
    let messages = '';

    for (let attempt = 0; attempt < 6; attempt++)
        messages += await attackEast(/acid blob|splashed|corrode/);

    assert.match(messages, /You kick the acid blob/);
    assert.equal(boots.oeroded2 ?? 0, 0,
        'hmonas passes no contact object for a natural kick');
});

void test('an eyeless attacker feels an acid splash without seeing its source', async () => {
    await meleeRoom('gray ooze', 'acid blob');
    vision_recalc(0);
    assert.equal(heroIsBlind(game), true, 'The ooze form has no eyes');
    game.u.acidResistance = true;
    initRng(41n);
    let messages = '';

    for (let attempt = 0; attempt < 8; attempt++)
        messages += await attackEast(/bite|splashed/, true);

    assert.match(messages, /You are splashed!/);
    assert.doesNotMatch(messages, /splashed by/);
});

void test('a hallucinating attacker sees acid splashes as fanciful liquids', async () => {
    await meleeRoom('newt', 'acid blob');
    game.u.hallucinationTurns = 100;
    game.u.acidResistance = true;
    initRng(41n);
    let messages = '';

    for (let attempt = 0; attempt < 12; attempt++)
        messages += await attackEast(/bite|splashed/);

    assert.match(messages, /splashed by .*'s (?!acid!)[^!]+!/,
        'Hallucination can change the perceived splash without changing its acidity');
    assert.equal(game.u.mh, 200);
});

for (const gloved of [false, true]) {
    void test(`a gnomish wizard's melee spell slot ${gloved ? 'is protected by gloves' : 'touches a cockatrice with bare hands'}`, async () => {
        const cockatrice = await meleeRoom('gnomish wizard', 'cockatrice');
        game.storage = memoryStorage();
        game.iflags.toptenwin = false;
        if (gloved) wearHeroArmor(await addInventoryObject(LEATHER_GLOVES));
        initRng(41n);

        const messages = await attackEast(/cockatrice|stone|Goodbye|points|survived|turns/, true);

        assert.ok(cockatrice.mhp < 2000, 'The spell slot delivers an ordinary hand strike');
        assert.equal(!!game.program_state.gameover, !gloved);
        if (gloved) assert.doesNotMatch(messages, /turn to stone/);
        else assert.match(messages, /You turn to stone/);
    });
}

for (const { defender, reason } of [
    { defender: 'gelatinous cube', reason: 'frozen by a gelatinous cube' },
    { defender: 'floating eye', reason: "frozen by a floating eye's gaze" },
]) {
    void test(`paralysis from a named ${defender} retains its species in the lasting reason`, async () => {
        const monster = await meleeRoom('newt', defender);
        setMonsterGivenName(monster, 'My Named Foe');
        initRng(41n);

        for (let attempt = 0; attempt < 6 && !(game._helplessTurns ?? 0); attempt++)
            await attackEast(/My Named Foe|frozen/);

        assert.ok((game._helplessTurns ?? 0) > 0, 'The contact must leave the hero paralyzed');
        const helplessness = game._helplessReason;
        assert.ok(helplessness && typeof helplessness !== 'string',
            'Paralysis retains the causing monster for later death attribution');
        assert.equal(helplessness.monsterId, monster.m_id);
        assert.equal(helplessness.text, reason,
            'The lasting reason names the true species even when the visible message uses a given name');
    });

    void test(`paralysis from a ${defender} ends with the default recovery message`, async () => {
        await meleeRoom('newt', defender);
        initRng(41n);

        for (let attempt = 0; attempt < 6 && !(game._helplessTurns ?? 0); attempt++)
            await attackEast(/floating eye|gelatinous cube|frozen/);
        assert.ok((game._helplessTurns ?? 0) > 0, 'The contact must leave the hero paralyzed');
        await finishHeroHelplessness();

        assert.match(game._pending_message, /You can move again\./);
    });
}

void test('a hero explosion announces waking a distant sleeper before ending the monster form', async () => {
    await meleeRoom('flaming sphere', 'hill giant');
    const sleeper = await createMonsterAt('kobold', 16, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    sleeper.msleeping = 1;
    initRng(41n);

    const messages = await attackEast(/explode|Boom|hill giant|kobold|human|normal|return/, true);

    assert.match(messages, /The kobold wakes up\./);
    assert.equal(sleeper.msleeping, 0);
    assert.equal(Upolyd(game.u), false);
    const wake = messages.indexOf('The kobold wakes up.');
    const restoration = messages.indexOf('You return to');
    assert.ok(restoration > wake, 'The explosion wakes its neighbors before rehumanizing the hero');
});

void test('a wielded primary weapon protects later claws from contact petrification', async () => {
    const bird = await meleeRoom('minotaur', 'cockatrice');
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    await setPrimaryWeapon(await addInventoryObject(DAGGER));
    // A flexible helm fits the horned form and insulates its head butt.
    wearHeroArmor(await addInventoryObject(ELVEN_LEATHER_HELM));
    initRng(41n);

    const messages = await attackEast(/cockatrice|stone|Goodbye|points|survived|turns/, true);

    assert.equal(!!game.program_state.gameover, false);
    assert.match(messages, /You head butt the cockatrice/);
    assert.equal(game.u.uconduct?.weaphit, 1);
    assert.ok(bird.mhp < 2000);
});
