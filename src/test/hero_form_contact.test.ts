import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_RINGL } from '../js/const.js';
import { specialContactDamage } from '../js/contact_damage.js';
import { canSpotMonster, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { releaseHeroGrip } from '../js/hero_expulsion.js';
import { heroGrabMisses, showHeroSilverContact } from '../js/hero_form_contact.js';
import { resetInputState } from '../js/input.js';
import { AD_WRAP, AT_TUCH } from '../js/monster_attack_types.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { getObjectClassBounds, OBJECT_MATERIAL } from '../js/object_data.js';
import { objectMaterial } from '../js/object_material.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';

const BIRTH_FLAGS = NO_MINVENT | MM_NOGRP | MM_NOWAIT;
const SILVER = 14;

async function messageLine(): Promise<string> {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}

void test('a known ring shuffled to silver sears with its current material name', async () => {
    freshObjectRoom();
    installPolymorphedHero('minotaur');
    const { first, last } = getObjectClassBounds(4);
    const ringType = Array.from({ length: last - first + 1 }, (_, index) => first + index)
        .find(type => objectMaterial(type, game) === SILVER && OBJECT_MATERIAL[type] !== SILVER);
    assert.ok(ringType !== undefined, 'The initialized ring appearances must include a ring newly made of silver');
    const imp = await createMonsterAt('imp', 11, 10, BIRTH_FLAGS);
    installPagerInput(resetInputState(), { expected: /ring|feel|imp/, limit: 4 });
    await wearHeroAccessory(await addInventoryObject(ringType, { dknown: true }), 'uleft');
    const contact = specialContactDamage(game.u, imp, W_RINGL);
    assert.equal(contact.silverMask, W_RINGL);

    await showHeroSilverContact(imp, contact.silverMask);

    assert.match(await messageLine(), /Your silver ring sears the imp!/);
});

void test('a hallucinating hero can mistake an unseen worm tail for someone rather than something', async () => {
    freshObjectRoom({ gameplaySeed: 97n });
    installPolymorphedHero('giant eel');
    const worm = await createMonsterAt('long worm', 11, 10, BIRTH_FLAGS);
    const tail = worm.wormSegments?.find(segment => segment.x !== 0
        && (segment.x !== worm.mx || segment.y !== worm.my));
    assert.ok(tail, 'The real long worm must have a tail for the failed grab');
    worm.minvis = 1;
    game.u.hallucinationTurns = 100;
    assert.equal(canSpotMonster(worm), false);
    installPagerInput(resetInputState(), {
        expected: /Your grab attempt fails to hold (someone|something)'s tail!/, limit: 20,
    });
    initRng(97n);
    let sawSomeone = false;
    let sawSomething = false;

    for (let attempt = 0; attempt < 20 && !(sawSomeone && sawSomething); attempt++) {
        assert.equal(await heroGrabMisses(worm, [AT_TUCH, AD_WRAP, 1, 1], tail), true);
        const text = await messageLine();
        assert.match(text, /Your grab attempt fails to hold (someone|something)'s tail!/);
        sawSomeone ||= text.includes("someone's tail");
        sawSomething ||= text.includes("something's tail");
    }

    assert.ok(sawSomeone, 'Hallucination should sometimes give an unseen tail a human identity');
    assert.ok(sawSomething, 'Hallucination should also permit an impersonal unseen-tail description');
    assert.ok(!game.u.ustuck, 'A failed tail grab must never establish a hold');
});

void test('releasing a named creature while hallucinating hides its real name and clears the hold', async () => {
    freshObjectRoom();
    installPolymorphedHero('rope golem');
    const monster = await createMonsterAt('goblin', 11, 10, BIRTH_FLAGS);
    setMonsterGivenName(monster, 'The Carefully Named Goblin');
    game.u.ustuck = monster;
    game.u.hallucinationTurns = 100;
    initRng(97n);

    await releaseHeroGrip(game);

    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.uswldtim, 0);
    const text = await messageLine();
    assert.match(text, /is no longer in your clutches\./);
    assert.doesNotMatch(text, /The Carefully Named Goblin/);
});
