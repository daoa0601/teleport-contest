import { requireFixtureGame } from './support/game-state.js';
import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SICK_ALL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { healHero } from '../js/hero_healing.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { woundHeroLegs } from '../js/hero_legs.js';
import { resetInputState } from '../js/input.js';
import { POT_HEALING, POT_EXTRA_HEALING, POT_FULL_HEALING } from '../js/object_data.js';
import { heroIsBlind, heroIsDeaf, setHeroBlindnessTurns, syncDeafness } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

async function drink(potion: GameObject, answers = '') {
    resetInputState().feed(potion.invlet + answers);
    await rhack('q'.charCodeAt(0));
}

function ailHero() {
    game.u.sickTurns = 18;
    game.u.sick = true;
    game.u.sickType = SICK_ALL;
    game.u.sickCause = 'food poisoning';
    game.u.vomitingTurns = 12;
    game.u.vomiting = true;
    game.u.deafTurns = 9;
    game.u.ucreamed = 5;
    setHeroBlindnessTurns(20);
    syncDeafness();
}

void test('healing below maximum restores current HP without raising maximum or peak', async () => {
    freshObjectRoom({ hero: { uhp: 10, uhpmax: 40, uhppeak: 50 } });
    requireFixtureGame(game);
    await healHero(10, 5);
    assert.equal(game.u.uhp, 20);
    assert.equal(game.u.uhpmax, 40);
    assert.equal(game.u.uhppeak, 50);
});

void test('reaching the maximum exactly does not earn extra maximum HP', async () => {
    freshObjectRoom({ hero: { uhp: 30, uhpmax: 40 } });
    requireFixtureGame(game);
    await healHero(10, 5);
    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.uhpmax, 40);
});

void test('overflowing healing raises human maximum HP and records the new peak', async () => {
    freshObjectRoom({ hero: { uhp: 35, uhpmax: 40, uhppeak: 40 } });
    requireFixtureGame(game);
    await healHero(10, 5);
    assert.equal(game.u.uhp, 45);
    assert.equal(game.u.uhpmax, 45);
    assert.equal(game.u.uhppeak, 45);
});

void test('healing a polymorph body preserves the human HP and its peak', async () => {
    freshObjectRoom({ hero: { uhp: 12, uhpmax: 40, uhppeak: 50 } });
    requireFixtureGame(game);
    installPolymorphedHero('dog', { hitPoints: 8, maxHitPoints: 10 });
    await healHero(8, 3);
    assert.equal(game.u.mh, 13);
    assert.equal(game.u.mhmax, 13);
    assert.equal(game.u.uhp, 12);
    assert.equal(game.u.uhpmax, 40);
    assert.equal(game.u.uhppeak, 50);
});

void test('zero-point healing can cure ailments without raising maximum HP', async () => {
    freshObjectRoom({ hero: { uhp: 40, uhpmax: 40, deafTurns: 9, ucreamed: 5 } });
    requireFixtureGame(game);
    setHeroBlindnessTurns(5);
    resetInputState().feed(' '); // Hearing feedback follows the regained-sight message.
    await healHero(0, 8, { cureBlindness: true });
    assert.equal(game.u.uhpmax, 40);
    assert.equal(game.u.ucreamed, 0);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.u.deafTurns, 0);
    assert.equal(heroIsBlind(), false);
    assert.equal(heroIsDeaf(), false);
});

void test('healing without cure flags leaves blindness, cream, nausea, sickness and deafness', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    ailHero();
    await healHero(10, 0);
    assert.equal(game.u.blindTurns, 20);
    assert.equal(game.u.ucreamed, 5);
    assert.equal(game.u.deafTurns, 9);
    assert.equal(game.u.vomitingTurns, 12);
    assert.equal(game.u.sickTurns, 18);
});

void test('sickness-curing healing clears both sickness types and nausea', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    ailHero();
    resetInputState().feed(' '); // The sickness cure follows the nausea-relief line.
    await healHero(0, 0, { cureSickness: true });
    assert.equal(game.u.sickTurns, 0);
    assert.equal(game.u.sickType, 0);
    assert.equal(game.u.sickCause, undefined);
    assert.equal(game.u.vomitingTurns, 0);
    assert.equal(game.u.vomiting, false);
    assert.equal(game.u.blindTurns, 20);
    assert.equal(game.u.deafTurns, 9);
});

void test('healing commits HP and removes cream before awaiting regained-sight feedback', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhpmax: 40 } });
    requireFixtureGame(game);
    ailHero();
    await pline('You carefully examine the old inscriptions covering this long corridor.');
    const input = resetInputState();
    const action = healHero(30, 2, { cureBlindness: true, cureSickness: true });
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.uhp, 42);
        assert.equal(game.u.ucreamed, 0);
        assert.equal(game.u.blindTurns, 20);
        assert.equal(game.u.deafTurns, 9);
        assert.equal(game.u.vomitingTurns, 12);
        assert.equal(game.u.sickTurns, 18);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(game.u.blindTurns, 0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(game.u.vomitingTurns, 0);
        assert.equal(game.u.sickTurns, 18);
        assert.match(game._pending_message, /can hear again/);
    } finally {
        input.feed('  '); // Finish nausea and sickness feedback at their native topline boundaries.
        await action;
    }
    assert.equal(game.u.sickTurns, 0);
});

void test('unconscious healing suppresses sight, hearing and nausea feedback but reports the sickness cure', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    ailHero();
    putHeroToSleep(8);
    await healHero(0, 0, { cureBlindness: true, cureSickness: true });
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.u.deafTurns, 0);
    assert.equal(game.u.vomitingTurns, 0);
    assert.equal(game.u.sickTurns, 0);
    assert.equal(game._pending_message, 'You feel cured.  What a relief!');
});

for (const [type, name, extra] of [[POT_HEALING, 'healing', 1], [POT_EXTRA_HEALING, 'extra healing', 2]] as const) {
    void test(`quaffing an uncursed ${name} potion heals the current monster body`, async () => {
        freshObjectRoom({ hero: { uhp: 12, uhpmax: 40, uhppeak: 40 } });
        requireFixtureGame(game);
        installPolymorphedHero('dog', { hitPoints: 1, maxHitPoints: 10 });
        const potion = await addInventoryObject(type);
        await drink(potion);
        assert.equal(game.u.mh, 10 + extra);
        assert.equal(game.u.mhmax, 10 + extra);
        assert.equal(game.u.uhp, 12);
        assert.equal(game.u.uhpmax, 40);
        assert.equal(game.u.uhppeak, 40);
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(game.context.move, 1);
    });
}

void test('a cursed healing potion leaves cream, blindness, deafness and illness intact', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    ailHero();
    const potion = await addInventoryObject(POT_HEALING, { cursed: true });
    const maximum = game.u.uhpmax;
    await drink(potion);
    assert.equal(game.u.uhpmax, maximum);
    assert.equal(game.u.ucreamed, 5);
    assert.equal(game.u.blindTurns, 20);
    assert.equal(game.u.deafTurns, 9);
    assert.equal(game.u.sickTurns, 18);
    assert.equal(game.u.vomitingTurns, 12);
});

void test('a cursed extra-healing potion still cleans cream and cures sight and hearing', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    ailHero();
    const potion = await addInventoryObject(POT_EXTRA_HEALING, { cursed: true });
    await drink(potion, ' '); // Regained-sight feedback follows the potion's healing line.
    assert.equal(game.u.ucreamed, 0);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.u.deafTurns, 0);
    assert.equal(game.u.sickTurns, 18);
    assert.equal(game.u.vomitingTurns, 12);
});

void test('a blessed extra-healing potion repairs the unmounted hero legs', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await woundHeroLegs('left', 30);
    const potion = await addInventoryObject(POT_EXTRA_HEALING, { blessed: true });
    await drink(potion, ' '); // Leg relief follows the healing line.
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(game.u._woundedLegSide, null);
});

void test('blessed extra-healing does not heal leg wounds belonging to the mount', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.ok(game.u.usteed);
    await woundHeroLegs('left', 30);
    const potion = await addInventoryObject(POT_EXTRA_HEALING, { blessed: true });
    await drink(potion);
    assert.equal(game.u._woundedLegTurns, 30);
    assert.equal(game.u._woundedLegSide, 'left');
});


for (const [beatitude, properties, extra] of [
    ['ordinary', {}, 4], ['blessed', { blessed: true }, 8], ['cursed', { cursed: true }, 0],
] as const) {
    void test(`a ${beatitude} full-healing potion restores 400 HP and its source maximum bonus`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 40, uhppeak: 40 } });
        requireFixtureGame(game);
        const potion = await addInventoryObject(POT_FULL_HEALING, properties);
        await drink(potion);
        assert.equal(game.u.uhp, 40 + extra);
        assert.equal(game.u.uhpmax, 40 + extra);
        assert.equal(game.u.uhppeak, 40 + extra);
        assert.equal(game.inventory.includes(potion), false);
        assert.ok(game._knownObjectTypes != null);
        assert.equal(game._knownObjectTypes.has(potion.otyp), true);
        assert.equal(game.context.move, 1);
    });
}

void test('full healing below a very large maximum adds exactly 400 current HP', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 500 } });
    requireFixtureGame(game);
    await drink(await addInventoryObject(POT_FULL_HEALING));
    assert.equal(game.u.uhp, 401);
    assert.equal(game.u.uhpmax, 500);
});

void test('full healing cures cream, temporary sight and hearing loss, hallucination and illness', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    ailHero();
    game.u.hallucinationTurns = 20;
    const potion = await addInventoryObject(POT_FULL_HEALING);
    await drink(potion, '  '); // Sight/hearing, nausea/illness, and hallucination prose cross two More boundaries.
    assert.equal(game.u.ucreamed, 0);
    assert.equal(game.u.blindTurns, 0);
    assert.equal(game.u.deafTurns, 0);
    assert.equal(game.u.hallucinationTurns, 0);
    assert.equal(game.u.sickTurns, 0);
    assert.equal(game.u.vomitingTurns, 0);
});

void test('blessed full healing restores one lost level and lowers the remembered maximum', async () => {
    freshObjectRoom({ hero: { ulevel: 3, ulevelmax: 8, uexp: 0 } });
    requireFixtureGame(game);
    const potion = await addInventoryObject(POT_FULL_HEALING, { blessed: true });
    await drink(potion, ' '); // Level restoration announces both the experience gain and welcome back.
    assert.equal(game.u.ulevel, 4);
    assert.equal(game.u.ulevelmax, 7);
    assert.ok(game.u.uexp > 0);
});

void test('blessed full healing also cures the actual mount leg wounds', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    await woundHeroLegs('left', 30);
    await drink(await addInventoryObject(POT_FULL_HEALING, { blessed: true }));
    assert.ok(game.u.usteed);
    assert.equal(game.u._woundedLegTurns, 0);
    assert.equal(game.u._woundedLegSide, null);
});
