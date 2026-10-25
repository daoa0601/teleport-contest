import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { A_STR, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { G_GENOD } from '../js/const.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from '../js/monster_data.js';
import { installPagerInput } from './support/pager-input.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { loadScoreRecords } from '../js/score_records.js';
import { memoryStorage } from './support/memory-storage.js';
// Monster class symbols for S_ANT and S_SNAKE (mkclass() input classes).
const S_ANT = 1;
const S_SNAKE = 45;
// C mcastu.c:cursetxt() picks its phrasing from the caster's view of the
// hero's apparent position; each variant is reachable through a blocked cast.
async function blockedCastCleric(level) {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    const cleric = await createMonsterAt('aligned cleric', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    cleric.mpeaceful = 0;
    cleric.m_lev = level;
    cleric.mhp = 50;
    cleric.mhpmax = 100;
    cleric.mux = game.u.ux;
    cleric.muy = game.u.uy;
    return cleric;
}
async function observeBlockedCast(monster, blocks) {
    requirePlayingGame(game);
    monster.mcan = blocks.cancelled ? 1 : 0;
    monster.mspec_used = blocks.cooldown ? 2 : 0;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 8 });
    await performMonsterHeroAttack(monster, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    return messages.join('\n');
}
void test('a blocked undirected cure-self spell curses all around', async () => {
    const cleric = await blockedCastCleric(2);
    // rn2(2)=1 selects cure-self (level 1, MCF_INDIRECT) for the wounded cleric.
    const text = await observeBlockedCast(cleric, { cooldown: true });
    assert.match(text, /points all around, then curses\./, text);
    assert.doesNotMatch(text, /mumbled curse/, text);
});
void test('a blocked directed spell curses at the displaced image', async () => {
    const cleric = await blockedCastCleric(1);
    grantIntrinsicProperty('displaced', 'outside');
    cleric.mux = 12;
    cleric.muy = 10;
    const text = await observeBlockedCast(cleric, { cancelled: true });
    assert.match(text, /points and curses at your displaced image\./, text);
});
void test('a blocked directed spell curses in the general direction of an invisible hero', async () => {
    const cleric = await blockedCastCleric(1);
    grantIntrinsicProperty('invisible', 'outside');
    cleric.mux = 12;
    cleric.muy = 10;
    const text = await observeBlockedCast(cleric, { cancelled: true });
    assert.match(text, /points and curses in your general direction\./, text);
});
// C mcastu.c:choose_monster_spell() re-rolls spellval inside the table when
// rn2(m_lev) exceeds the highest spell level, so a level 20 cleric whose first
// draw is 19 casts a level 12 fire pillar rather than the level 13 geyser.
void test('a high-level cleric re-rolls an out-of-range spell choice within the table', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000, fireResistance: true } });
    requirePlayingGame(game);
    const cleric = await createMonsterAt('aligned cleric', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    cleric.mpeaceful = 0;
    cleric.m_lev = 20;
    cleric.mux = game.u.ux;
    cleric.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 12 });
    await performMonsterHeroAttack(cleric, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /A pillar of fire strikes all around you!/, text);
    assert.doesNotMatch(text, /geyser/, text);
});
// C mcastu.c:mcast_insects() and mcast_summon_mons() describe the spot around
// the caster's perceived hero position when the real hero is displaced or
// invisible to the caster.
async function undirectedCasterAttack(species, level) {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    const caster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    caster.mpeaceful = 0;
    caster.m_lev = level;
    caster.mux = 12;
    caster.muy = 10;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    return { caster, input, messages };
}
void test('an insect spell surrounds the displaced image with insects', async () => {
    const { caster, input, messages } = await undirectedCasterAttack('aligned cleric', 9);
    requirePlayingGame(game);
    grantIntrinsicProperty('displaced', 'outside');
    installPagerInput(input, { expected: /^/, limit: 40 });
    await performMonsterHeroAttack(caster, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /summons insects around your displaced image!/, text);
    assert.ok((game.level?.monsters.length ?? 0) > 1, 'the spell creates insects');
});
void test('an insect spell summons insects around a spot near an invisible hero', async () => {
    const { caster, input, messages } = await undirectedCasterAttack('aligned cleric', 9);
    requirePlayingGame(game);
    grantIntrinsicProperty('invisible', 'outside');
    installPagerInput(input, { expected: /^/, limit: 40 });
    await performMonsterHeroAttack(caster, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /summons insects around a spot near you!/, text);
});
void test('a summon nasties spell surrounds the displaced image with monsters', async () => {
    const { caster, input, messages } = await undirectedCasterAttack('apprentice', 16);
    requirePlayingGame(game);
    grantIntrinsicProperty('displaced', 'outside');
    installPagerInput(input, { expected: /^/, limit: 60 });
    await performMonsterHeroAttack(caster, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /(?:Monsters appear around|A monster appears by) your displaced image!/, text);
    assert.ok((game.level?.monsters.length ?? 0) > 1, 'the spell summons at least one nasty monster');
});
void test('magic resistance blocks the destroy-armor spell with a field of force', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000, antimagic: true } });
    requirePlayingGame(game);
    const apprentice = await createMonsterAt('apprentice', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    apprentice.mpeaceful = 0;
    apprentice.m_lev = 9;
    apprentice.mux = game.u.ux;
    apprentice.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 12 });
    await performMonsterHeroAttack(apprentice, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /A field of force surrounds you!/, text);
    assert.doesNotMatch(text, /skin itches/, text);
});
void test('a weaken-you spell drains one point of strength', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    const apprentice = await createMonsterAt('apprentice', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    apprentice.mpeaceful = 0;
    apprentice.m_lev = 7;
    apprentice.mux = game.u.ux;
    apprentice.muy = game.u.uy;
    const strengthBefore = game.u.acurr.a[A_STR];
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 12 });
    await performMonsterHeroAttack(apprentice, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /You suddenly feel weaker!/, text);
    assert.equal(game.u.acurr.a[A_STR], strengthBefore - 1, 'a level 7 caster rolls rnd(1) strength loss');
});
void test('a fatal weaken-you names the caster in the strength-loss death', async () => {
    // C mcastu.c:mcast_weaken_you() passes losestr() a killer built by
    // death_inflicted_by(kbuf, "strength loss", mtmp), so a hero already at
    // the strength minimum dies to that named cause.
    freshObjectRoom({
        flags: { bones: false, disclose: '-i -a -v -c -o' },
        hero: { uhp: 1, uhpmax: 500, uac: -1000 },
    });
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    game.u.acurr.a[A_STR] = 3;
    const apprentice = await createMonsterAt('apprentice', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    apprentice.mpeaceful = 0;
    apprentice.m_lev = 7;
    apprentice.mux = game.u.ux;
    apprentice.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 24 });
    await performMonsterHeroAttack(apprentice, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /You suddenly feel weaker!/, text);
    assert.equal(game.program_state.gameover, true, text);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by strength loss inflicted by an apprentice');
});
void test('a curse-items spell offers unhelpful help', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    const cleric = await createMonsterAt('aligned cleric', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    cleric.mpeaceful = 0;
    cleric.m_lev = 11;
    cleric.mux = game.u.ux;
    cleric.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 12 });
    await performMonsterHeroAttack(cleric, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /You feel as if you need some help\./, text);
});
void test('a small psi bolt gives only a slight headache', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    const apprentice = await createMonsterAt('apprentice', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    apprentice.mpeaceful = 0;
    // C castmu(): a level 1 caster always fumbles (rn2(10) < 20), so a
    // level 3 caster with rn2(3)=0 reaches psi bolt and clears the fumble gate.
    apprentice.m_lev = 3;
    apprentice.mux = game.u.ux;
    apprentice.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 12 });
    await performMonsterHeroAttack(apprentice, game, {
        random: limit => limit === 3 ? 0 : limit - 1,
        rollOne: sides => sides,
        rollDice: () => 4,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /You get a slight headache\./, text);
    assert.equal(game.u.uhp, 500 - 4, 'the four-point psi bolt damage is applied');
});
void test('an insect spell falls back to sticks-to-snakes when ants are genocided', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    // C mcast_insects() picks S_SNAKE only when mkclass(S_ANT, 0) finds no
    // living ant species, so every S_ANT monster must be genocided.
    const ants = MONSTER_NAME.map((_, index) => index)
        .filter(index => MONSTER_SYMBOL[index] === S_ANT);
    for (const mnum of ants) {
        const vital = game.mvitals?.[mnum];
        if (vital)
            vital.mvflags |= G_GENOD;
    }
    const cleric = await createMonsterAt('aligned cleric', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    cleric.mpeaceful = 0;
    cleric.m_lev = 9;
    cleric.mux = game.u.ux;
    cleric.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 40 });
    await performMonsterHeroAttack(cleric, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /transforms a clump of sticks into snakes!/, text);
    const snakes = MONSTER_NAME.map((_, index) => index)
        .filter(index => MONSTER_SYMBOL[index] === S_SNAKE);
    assert.ok(game.level.monsters.filter(monster => monster !== cleric)
        .every(monster => snakes.includes(monster.mnum)), 'only snakes hatch from the sticks');
});
void test('the touch of death spell leaves a demon-bodied hero no deader', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    installPolymorphedHero('marilith', { hitPoints: 500 });
    const caster = await createMonsterAt('apprentice', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    caster.mpeaceful = 0;
    caster.m_lev = 21;
    caster.mux = game.u.ux;
    caster.muy = game.u.uy;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 12 });
    await performMonsterHeroAttack(caster, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /using the touch of death!/, text);
    assert.match(text, /You seem no deader than before\./, text);
    assert.equal(game.u.mh, 500, 'the demon body keeps its hit points');
});
void test('the Wizard summons nasties with a threat rather than an appearance note', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500, uac: -1000 } });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    const wizard = await createMonsterAt('Wizard of Yendor', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    wizard.mpeaceful = 0;
    wizard.m_lev = 16;
    wizard.mux = 12;
    wizard.muy = 10;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /^/, limit: 80 });
    await performMonsterHeroAttack(wizard, game, {
        random: limit => limit - 1,
        rollOne: sides => sides,
        rollDice: count => count,
    });
    await flushPendingTopline();
    const text = messages.join('\n');
    assert.match(text, /Destroy the thief, my pets?!/, text);
    assert.doesNotMatch(text, /appear from nowhere/, text);
    assert.ok((game.level?.monsters.length ?? 0) > 1, 'the Wizard summons at least one nasty');
});
//# sourceMappingURL=audit2_mcastu_spell_feedback.test.js.map