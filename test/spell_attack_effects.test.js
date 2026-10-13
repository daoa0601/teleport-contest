import { createSpecialLevel } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAWBRIDGE_UP, HWALL, IRONBARS, LAVAPOOL, LAVAWALL, MM_ANGRY, MM_NOGRP, MOAT, NO_MINVENT, POOL, STONE, WATER, W_AMUL, } from '../js/const.js';
import { clearMessageWindow, flushPendingTopline, glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_REFLECTION, SPE_CONE_OF_COLD, SPE_FIREBALL } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { makeBlinded } from '../js/sight_change.js';
import { castChainLightning, castSkilledElementalSpell } from '../js/spell_attack_effects.js';
import { vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { withMessagePages } from './support/planned-input.js';
function spellRoom({ hero = {}, ...options } = {}) {
    freshObjectRoom({ left: 5, right: 25, top: 5, bottom: 15,
        hero: { uhp: 500, uhpmax: 500, uen: 40, uenmax: 40, ...hero },
        flags: { verbose: true, tips: false }, gameplaySeed: 17n, ...options });
    requirePlayingGame(game);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    return { input, messages };
}
async function target(species, x, y, hitPoints = 500) {
    const monster = await createMonsterAt(species, x, y, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = hitPoints;
    monster.msleeping = 0;
    return monster;
}
for (const [type, name] of [[SPE_FIREBALL, 'fireball'], [SPE_CONE_OF_COLD, 'cone of cold']]) {
    void test(`a skilled ${name} produces two to nine blasts around the selected center`, async () => {
        const { input } = spellRoom();
        requirePlayingGame(game);
        const pseudo = await knownObject(type, { initialize: false });
        const jackal = await target('jackal', 14, 10);
        input.feed('llll.');
        const result = await withMessagePages(() => castSkilledElementalSpell(pseudo), input, /^(?:Boom!|The jackal is caught in the (?:fireball|ball of cold)!|\s)+$/, 9);
        assert.equal(result.targeted, true);
        const damage = 500 - jackal.mhp;
        assert.ok(damage >= 10 && damage <= 45);
        assert.equal(damage % 5, 0);
        assert.equal(game.u.uhp, 500);
        assert.ok(game.u.dy != null, 'Expected game.u.dy to be initialized');
        assert.ok(game.u.dx != null, 'Expected game.u.dx to be initialized');
        assert.ok(Math.abs(game.u.dx - 14) <= 1 && Math.abs(game.u.dy - 10) <= 1);
    });
}
void test('cancelling skilled spell targeting leaves nearby actors unharmed', async () => {
    const { input } = spellRoom();
    requirePlayingGame(game);
    const jackal = await target('jackal', 11, 10);
    const pseudo = await knownObject(SPE_FIREBALL, { initialize: false });
    input.feed('\x1b');
    const result = await castSkilledElementalSpell(pseudo);
    assert.equal(result.targeted, false);
    assert.equal(jackal.mhp, 500);
    assert.equal(game.u.uhp, 500);
});
void test('skilled targeting leaves the steed unmarked and refreshes its hallucination on exit', async () => {
    spellRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    clearMessageWindow();
    game.u.hallucinationTurns = 20;
    const pseudo = await knownObject(SPE_FIREBALL, { initialize: false });
    const input = resetInputState();
    input.feed('$');
    const casting = castSkilledElementalSpell(pseudo);
    await input.waitUntilBlocked();
    const marked = glyphAt(game.u.ux, game.u.uy);
    input.feed('\x1b');
    const result = await casting;
    const restored = glyphAt(game.u.ux, game.u.uy);
    assert.ok(marked?.kind === 'monster', 'Target marks leave the visible steed on screen.');
    assert.ok(restored?.kind === 'monster');
    assert.notEqual(restored.mnum, marked.mnum, 'Ending targeting refreshes the hallucinated steed.');
    assert.equal(result.targeted, false);
});
void test('a target farther than ten squares makes a skilled spell dissipate', async () => {
    const { input } = spellRoom();
    requirePlayingGame(game);
    const jackal = await target('jackal', 21, 10);
    const pseudo = await knownObject(SPE_FIREBALL, { initialize: false });
    input.feed('Llll.');
    const result = await castSkilledElementalSpell(pseudo);
    assert.equal(result.targeted, false);
    assert.equal(jackal.mhp, 500);
    assert.match(game._pending_message, /dissipates over the distance/);
});
for (const waterPlane of [false, true]) {
    void test(`skilled targeting rejects ${waterPlane ? 'the Plane of Water' : 'an underwater caster'}`, async () => {
        spellRoom();
        requirePlayingGame(game);
        if (waterPlane)
            game.water_level = createSpecialLevel(game.u.uz);
        else
            game.u.uinwater = 1;
        const pseudo = await knownObject(SPE_FIREBALL, { initialize: false });
        const result = await castSkilledElementalSpell(pseudo);
        assert.equal(result.targeted, false);
        assert.equal(game.u.uhp, 500);
        assert.match(game._pending_message, waterPlane ? /sun to come out/ : /In this weather/);
    });
}
void test('a skilled spell cannot lock onto a wall', async () => {
    const { input } = spellRoom();
    requirePlayingGame(game);
    game.level.requireAt(14, 10).typ = HWALL;
    vision_recalc(0);
    const pseudo = await knownObject(SPE_FIREBALL, { initialize: false });
    input.feed('llll.');
    const result = await castSkilledElementalSpell(pseudo);
    assert.equal(result.targeted, false);
    assert.equal(game.level.requireAt(14, 10).typ, HWALL);
    assert.match(game._pending_message, /mind fails to lock/);
});
void test('aiming at a sensed monster behind stone drops the spell before the obstruction', async () => {
    const { input } = spellRoom();
    requirePlayingGame(game);
    const farTarget = await target('jackal', 14, 10);
    const nearTarget = await target('jackal', 11, 9);
    game.level.requireAt(12, 10).typ = STONE;
    grantIntrinsicProperty('telepathy', 'outside');
    grantIntrinsicProperty('fireResistance', 'outside');
    await makeBlinded(30, { talk: false });
    const pseudo = await knownObject(SPE_FIREBALL, { initialize: false });
    input.feed('llll.');
    const result = await withMessagePages(() => castSkilledElementalSpell(pseudo), input, /^(?:You hear a blast\.|You are caught in the fireball!|\s)+$/, 9);
    assert.equal(result.targeted, true);
    assert.equal(farTarget.mhp, 500);
    assert.ok(nearTarget.mhp < 500);
    assert.equal(game.u.uhp, 500);
});
void test('skilled targeting waits for an actual map selection before producing damage', async () => {
    spellRoom();
    requirePlayingGame(game);
    const jackal = await target('jackal', 14, 10);
    const pseudo = await knownObject(SPE_FIREBALL, { initialize: false });
    const input = resetInputState();
    const casting = castSkilledElementalSpell(pseudo);
    await input.waitUntilBlocked();
    try {
        assert.equal(jackal.mhp, 500);
        assert.equal(game.u.uhp, 500);
    }
    finally {
        await withMessagePages(async () => {
            input.feed('llll.');
            await casting;
        }, input, /^(?:Boom!|The jackal is caught in the fireball!|\s)+$/, 9);
    }
    assert.ok(jackal.mhp < 500);
});
void test('a swallowed skilled cold spell is cut short into repeated self-zaps', async () => {
    const { input, messages } = spellRoom();
    requirePlayingGame(game);
    const swallower = await target('purple worm', 11, 10);
    installSwallowedHero(swallower);
    const pseudo = await knownObject(SPE_CONE_OF_COLD, { initialize: false });
    input.feed('.');
    await withMessagePages(async () => {
        await castSkilledElementalSpell(pseudo);
        await flushPendingTopline();
    }, input, /^(?:The spell is cut short!|You imitate a popsicle!|\s)+$/, 9);
    assert.ok(game.u.uhp < 500);
    assert.equal(swallower.mhp, 500);
    assert.match(messages.join(' '), /spell is cut short/);
});
void test('chain lightning jumps between hostile monsters and charges power for each relay', async () => {
    spellRoom();
    requirePlayingGame(game);
    const first = await target('jackal', 13, 10);
    const second = await target('jackal', 16, 10);
    const distant = await target('jackal', 20, 10);
    await castChainLightning();
    assert.ok(first.mhp < 500);
    assert.ok(second.mhp < 500);
    assert.equal(distant.mhp, 500);
    assert.equal(game.u.uen, 38);
    assert.equal(game.u.uhp, 500);
});
void test('chain lightning stops at peaceful monsters without waking or harming them', async () => {
    spellRoom();
    requirePlayingGame(game);
    const peaceful = await target('jackal', 13, 10);
    const beyond = await target('jackal', 16, 10);
    peaceful.mpeaceful = 1;
    peaceful.msleeping = 1;
    await castChainLightning();
    assert.equal(peaceful.mhp, 500);
    assert.equal(peaceful.msleeping, 1);
    assert.equal(peaceful.mpeaceful, 1);
    assert.equal(beyond.mhp, 500);
    assert.equal(game.u.uen, 40);
});
void test('a shock-resistant monster stops chain lightning without relaying its power', async () => {
    spellRoom();
    requirePlayingGame(game);
    const sphere = await target('shocking sphere', 13, 10);
    const beyond = await target('jackal', 16, 10);
    await castChainLightning();
    assert.equal(sphere.mhp, 500);
    assert.equal(beyond.mhp, 500);
    assert.equal(game.u.uen, 40);
});
void test('chain lightning can kill and continue from its dead target', async () => {
    spellRoom();
    requirePlayingGame(game);
    const first = await target('jackal', 13, 10, 1);
    const second = await target('jackal', 16, 10);
    await castChainLightning();
    assert.ok(!game.level.monsters.includes(first));
    assert.ok(second.mhp < 500);
    assert.equal(game.u.uconduct.killer, 1);
});
void test('chain lightning inside a swallower keeps the native no-damage behavior', async () => {
    spellRoom();
    requirePlayingGame(game);
    const swallower = await target('purple worm', 11, 10);
    installSwallowedHero(swallower);
    await castChainLightning();
    assert.equal(swallower.mhp, 500);
    assert.equal(game.u.uhp, 500);
    assert.equal(game.u.uen, 40);
});
for (const [terrain, reachable] of [
    [POOL, true], [MOAT, true], [DRAWBRIDGE_UP, true], [LAVAPOOL, true],
    [WATER, false], [LAVAWALL, false], [IRONBARS, false],
]) {
    void test(`chain lightning ${reachable ? 'crosses' : 'stops before'} terrain ${terrain} without changing it`, async () => {
        spellRoom({ left: 10, right: 15, top: 10, bottom: 10 });
        requirePlayingGame(game);
        const monster = await target('jackal', 12, 10);
        game.level.requireAt(11, 10).typ = terrain;
        vision_recalc(0);
        await castChainLightning();
        assert.equal(monster.mhp < 500, reachable);
        assert.equal(game.level.requireAt(11, 10).typ, terrain);
    });
}
void test('chain lightning still shocks a reflecting monster', async () => {
    spellRoom();
    requirePlayingGame(game);
    const monster = await target('jackal', 13, 10);
    await equipMonsterObject(monster, await knownObject(AMULET_OF_REFLECTION), W_AMUL);
    await castChainLightning();
    assert.ok(monster.mhp < 500);
    assert.equal(game.u.uhp, 500);
});
for (const previousHitAtTarget of [false, true]) {
    void test(`chain lightning ${previousHitAtTarget ? 'marks' : 'does not mark'} an invisible head using native prior hit coordinates`, async () => {
        spellRoom();
        requirePlayingGame(game);
        const monster = await target('jackal', 13, 10);
        monster.minvis = 1;
        newsym(13, 10);
        game.bhitpos = previousHitAtTarget ? { x: 13, y: 10 } : { x: 0, y: 0 };
        await castChainLightning();
        assert.equal(glyphAt(13, 10)?.kind === 'invisible', previousHitAtTarget);
        assert.ok(monster.mhp < 500);
    });
}
void test('one chain-lightning cast covers at most one hundred squares', async () => {
    const { input } = spellRoom();
    requirePlayingGame(game);
    const monsters = [];
    for (let x = 5; x <= 15 && monsters.length < 110; x++) {
        for (let y = 5; y <= 15 && monsters.length < 110; y++) {
            if (x === game.u.ux && y === game.u.uy)
                continue;
            monsters.push(await target('jackal', x, y));
        }
    }
    await withMessagePages(() => castChainLightning(), input, /^(?:You shock the jackal[.!]\s*)+$/, 100);
    const injured = monsters.filter(monster => monster.mhp < 500).length;
    assert.ok(injured > 0 && injured <= 100);
    assert.ok(monsters.some(monster => monster.mhp === 500));
    assert.ok(game.u.uen >= 0);
});
//# sourceMappingURL=spell_attack_effects.test.js.map