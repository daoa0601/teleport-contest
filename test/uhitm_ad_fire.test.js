import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { mhitmAdFire } from '../js/uhitm.js';
import { resolveMonsterCombatDamage } from '../js/mhitm.js';
import { M_ATTK_DEF_DIED, M_SEEN_FIRE, MM_ANGRY, MM_NOGRP, NO_MINVENT, Upolyd } from '../js/const.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_PROTECTION } from '../js/object_data.js';
import { AD_FIRE, AT_BITE } from '../js/monster_attack_types.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function angrierFireAnt() {
    const ant = await createMonsterAt('fire ant', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    ant.mux = game.u.ux;
    ant.muy = game.u.uy;
    return ant;
}
function recordedPager(expected, limit) {
    const input = resetInputState();
    const messages = [];
    installPagerInput(input, { expected, limit });
    input.beforeRead = () => { messages.push(game._pending_message); };
    return { messages };
}
// C uhitm.c:mhitm_ad_fire() mhitu branch: hitmsg() precedes the magic
// cancellation probe, and a negated fire bite announces "You avoid harm."
// instead of any fire line.
void test('a negated fire bite keeps its hit line, avoids harm and deals no damage', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    await addInventoryObject(CLOAK_OF_PROTECTION);
    game.inventory.forEach(object => { object.owornmask = 0; });
    const cloak = game.inventory[game.inventory.length - 1];
    if (!cloak)
        throw new Error('the protection cloak must exist');
    cloak.owornmask = 8; // W_ARMC
    const ant = await angrierFireAnt();
    const { messages } = recordedPager(/fire ant|fire|avoid harm|cloak/, 10);
    await performMonsterHeroAttack(ant, game, {
        random: limit => limit === 10 ? 0 : limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    const bite = prose.indexOf('The fire ant bites!');
    const again = prose.indexOf('The fire ant bites again!');
    const avoided = prose.indexOf('You avoid harm.');
    assert.ok(bite >= 0 && again > bite && avoided > again, `the hit line precedes the negation message:\n${prose}`);
    assert.equal(game.u.uhp, 92, 'the first physical bite deals 2d4; the negated fire bite deals none');
});
// C uhitm.c:mhitm_ad_fire() mhitu branch: a paper-golem hero burns before
// fire resistance is consulted, monstunseesu(M_SEEN_FIRE) runs before
// rehumanize(), and hitmu() still applies the declared damage to the
// restored human body.
void test('a burning paper-golem hero goes up in flames, rehumanizes and keeps the damage', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    installPolymorphedHero('paper golem', { hitPoints: 60 });
    const ant = await angrierFireAnt();
    ant.seen_resistance = M_SEEN_FIRE;
    const { messages } = recordedPager(/fire ant|fire|flames|human/, 12);
    await performMonsterHeroAttack(ant, game, {
        random: limit => limit - 1,
        rollOne: () => 1, rollDice: (count, sides) => count * sides,
    });
    await flushPendingTopline();
    const prose = messages.join('\n');
    const onFire = prose.indexOf("You're on fire!");
    const flames = prose.indexOf('You go up in flames!');
    assert.ok(onFire >= 0 && flames > onFire, `the fire line precedes the golem burn:\n${prose}`);
    assert.ok(!Upolyd(game.u), 'rehumanize() ends the polymorph');
    assert.equal(game.u.uhp, 92, 'hitmu() applies the declared 2d4 fire damage to the human body');
    assert.equal((ant.seen_resistance ?? 0) & M_SEEN_FIRE, 0, 'monstunseesu() clears the witnessed fire resistance');
});
// C uhitm.c:mhitm_ad_fire() mhitm branch: a paper golem defender burns
// completely and the attack reports its death.
void test('a monster fire bite burns a paper golem defender completely', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const ant = await createMonsterAt('fire ant', 11, 10, MM_NOGRP | NO_MINVENT);
    const golem = await createMonsterAt('paper golem', 12, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const result = await resolveMonsterCombatDamage(ant, golem, [AT_BITE, AD_FIRE, 2, 4], {
        visible: true,
        random: limit => limit - 1,
        rollDice: (count, sides) => count * sides,
        publish: async (message) => { messages.push(String(message)); },
    });
    const prose = messages.join('\n');
    assert.ok(prose.includes('The paper golem is on fire!'), prose);
    assert.ok(prose.includes('The paper golem burns completely!'), prose);
    assert.ok(golem.dead, 'the golem body is destroyed');
    assert.equal(result.nativeResult & M_ATTK_DEF_DIED, M_ATTK_DEF_DIED);
});
// C uhitm.c:mhitm_ad_fire() uhitm branch: a blind hero smells the golem
// burn instead of seeing either fire line.
void test('a blind hero smells a burning paper golem it just hit', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    game.u.blindTurns = 5;
    const golem = await createMonsterAt('paper golem', 11, 10, MM_NOGRP | NO_MINVENT);
    const messages = [];
    const context = {
        state: game,
        publish: async (message) => { messages.push(String(message)); },
        random: limit => limit - 1,
        rollDice: (count, sides) => count * sides,
        rollOne: () => 1,
        attack: [AT_BITE, AD_FIRE, 2, 4],
        damage: 8,
        specialDamage: 0,
        target: { x: golem.mx, y: golem.my },
    };
    const fire = await mhitmAdFire({ magr: 'youmonst', defender: golem, context });
    assert.deepEqual(messages, ['You smell burning paper.']);
    assert.ok(golem.dead, 'the golem body is destroyed without a corpse message');
    assert.equal(fire.damage, 0);
    assert.equal(fire.done, false);
});
//# sourceMappingURL=uhitm_ad_fire.test.js.map