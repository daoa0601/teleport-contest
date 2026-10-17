import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { applyArtifactHit } from '../js/artifact_hit.js';
import { currentMulti } from '../js/command_state.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, Upolyd, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterHeroAttack } from '../js/monmove.js';
import { OIL_LAMP, POT_HEALING } from '../js/object_data.js';
import { artifactObject, addInventoryObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const deferred of [false, true]) {
    void test(`a monster wielding Frost Brand freezes the hero in ${deferred ? 'presented' : 'immediate'} combat`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        goblin.mux = game.u.ux;
        goblin.muy = game.u.uy;
        await equipMonsterObject(goblin, await artifactObject('Frost Brand'), W_WEP);
        const input = resetInputState();
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /goblin|blade/, limit: 8 });
        if (deferred)
            await performMonsterHeroAttack(goblin, game, {
                random: range => range - 1, rollOne: () => 1, rollDice: count => count,
            });
        else
            await beginMonsterHeroAttack(goblin, game, range => range - 1, () => 1, count => count, []);
        assert.equal(game.u.uhp, 96, 'The attack and sword each do 1 damage; Frost Brand doubles their total.');
        const prose = [...messages, game._pending_message].join('\n');
        assert.match(prose, /The ice-cold blade freezes you!/);
        assert.doesNotMatch(prose, /goblin hits!/);
    });
}
void test('cold resistance stops Frost Brand bonus damage but leaves potions vulnerable', async () => {
    freshObjectRoom({ hero: { coldResistance: true, uhp: 40, uhpmax: 40 } });
    const potion = await addInventoryObject(POT_HEALING);
    const messages = [];
    const hit = await applyArtifactHit(await artifactObject('Frost Brand'), 'hero', 10, {
        random: () => 0, rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 10, 'Item destruction damage is applied immediately, once.');
    assert.equal(game.u.uhp, 36);
    assert.equal(potion.where, 'gone');
    assert.equal(messages[0], 'The ice-cold blade hits you.');
    assert.ok(messages.some(message => /potion.*freezes and shatters/.test(message)));
});
void test('Fire Brand burns away slime even when the hero resists its fire', async () => {
    freshObjectRoom({ hero: { fireResistance: true, slimed: true, slimedTurns: 5 } });
    const lamp = await addInventoryObject(OIL_LAMP, { lamplit: false });
    const messages = [];
    const hit = await applyArtifactHit(await artifactObject('Fire Brand'), 'hero', 10, {
        random: () => 0, rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 10);
    assert.equal(game.u.slimedTurns, 0);
    assert.equal(lamp.lamplit, false, 'Native ignite_items uses the empty youmonst inventory.');
    assert.equal(messages.at(-1), 'The slime that covers you is burned away!');
});
for (const blind of [false, true]) {
    void test(`Stormbringer drains a ${blind ? 'blind' : 'sighted'} hero level and heals its wielder`, async () => {
        const hpIncrements = Array.from({ length: 31 }, () => 0);
        hpIncrements[7] = 6;
        const energyIncrements = Array.from({ length: 31 }, () => 0);
        energyIncrements[7] = 3;
        freshObjectRoom({ hero: { uhp: 40, uhpmax: 40, ulevel: 8,
                uhpinc: hpIncrements, ueninc: energyIncrements,
                uen: 10, uenmax: 10, blindTurns: blind ? 10 : 0 } });
        const attacker = await createMonsterAt('orc', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        attacker.mhp = 5;
        attacker.mhpmax = 20;
        const messages = [];
        const hit = await applyArtifactHit(await artifactObject('Stormbringer'), 'hero', 4, {
            attacker, random: limit => limit - 1, rollOne: sides => sides,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(hit.damage, 6);
        assert.equal(game.u.ulevel, 7);
        assert.equal(game.u.uhpmax, 34);
        assert.equal(game.u.uenmax, 7);
        assert.equal(attacker.mhp, 8, 'The wielder recovers half the lost maximum HP.');
        assert.equal(messages[0], blind ? 'You feel an unholy blade drain your life!'
            : 'The black blade drains your life!');
    });
}
void test('drain resistance prevents Stormbringer level loss and healing', async () => {
    freshRoomWithPolymorphedHero('vampire');
    const attacker = await createMonsterAt('orc', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    attacker.mhp = 5;
    attacker.mhpmax = 20;
    const oldLevel = game.u.ulevel;
    const hit = await applyArtifactHit(await artifactObject('Stormbringer'), 'hero', 4, { attacker });
    assert.equal(hit.damage, 4);
    assert.equal(hit.specialMessage, false);
    assert.equal(game.u.ulevel, oldLevel);
    assert.equal(attacker.mhp, 5);
});
void test('Magicbane cancellation takes magical energy without cancelling carried objects', async () => {
    freshObjectRoom({ hero: { uen: 5, uenmax: 10 } });
    const potion = await addInventoryObject(POT_HEALING, { blessed: true });
    const messages = [];
    const hit = await applyArtifactHit(await artifactObject('Magicbane'), 'hero', 4, {
        dieRoll: 1, random: limit => limit - 1, rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 24);
    assert.equal(game.u.uen, 4);
    assert.equal(game.u.uenmax, 9);
    assert.equal(potion.otyp, POT_HEALING);
    assert.equal(potion.blessed, true);
    assert.equal(messages[0], 'The magic-absorbing blade cancels you!');
    assert.equal(messages[1], 'You lose magical energy!');
});
void test('antimagic resists Magicbane cancellation but can still leave the hero stunned', async () => {
    freshObjectRoom({ hero: { antimagic: true, uen: 5, uenmax: 10 } });
    const messages = [];
    const hit = await applyArtifactHit(await artifactObject('Magicbane'), 'hero', 4, {
        dieRoll: 1, random: limit => limit - 1, rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 20);
    assert.equal(game.u.uen, 5);
    assert.equal(game.u.uenmax, 10);
    assert.equal(game.u.stunnedTurns, 3);
    assert.ok(messages.includes('You resist!'));
    assert.ok(messages.includes('You are stunned.'));
});
void test('Magicbane rehumanization prevents the remaining weapon damage', async () => {
    freshRoomWithPolymorphedHero('wolf', { hero: { uen: 5, uenmax: 10 } });
    const hit = await applyArtifactHit(await artifactObject('Magicbane'), 'hero', 4, {
        dieRoll: 1, random: limit => limit - 1, rollOne: sides => sides,
    });
    assert.equal(Upolyd(game.u), false);
    assert.equal(hit.damage, 0);
    assert.equal(game.u.uenmax, 9);
});
void test('Magicbane scares a sticky hero into releasing its attacker for three turns', async () => {
    freshRoomWithPolymorphedHero('owlbear');
    const attacker = await createMonsterAt('orc', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    game.u.ustuck = attacker;
    const messages = [];
    await applyArtifactHit(await artifactObject('Magicbane'), 'hero', 4, {
        attacker, dieRoll: 4, random: limit => limit - 1, rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(currentMulti(game), -3);
    assert.equal(game.u.ustuck, null);
    assert.ok(messages.includes('You release the orc!'));
});
void test('a Magicbane probe can confuse the hero without probing a monster', async () => {
    freshObjectRoom();
    const messages = [];
    await applyArtifactHit(await artifactObject('Magicbane'), 'hero', 4, {
        dieRoll: 8, random: () => 0, rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(game.u.confusionTurns, 4);
    assert.deepEqual(messages, ['The magic-absorbing blade probes you!', 'You are confused.']);
});
for (const name of ['Vorpal Blade', 'The Tsurugi of Muramasa']) {
    void test(`${name} delivers fatal damage to a human hero on a natural one`, async () => {
        freshObjectRoom({ hero: { uhp: 30, uhpmax: 30 } });
        const messages = [];
        const blade = await artifactObject(name, { dknown: false });
        const hit = await applyArtifactHit(blade, 'hero', 4, {
            dieRoll: 1, random: () => 0,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(hit.damage, 260);
        assert.equal(blade.dknown, true);
        assert.match(messages[0] ?? '', /beheads you|cuts you in half/);
    });
}
void test('Vorpal Blade misses a headless hero without inflicting weapon damage', async () => {
    freshRoomWithPolymorphedHero('gas spore');
    const hit = await applyArtifactHit(await artifactObject('Vorpal Blade'), 'hero', 4, {
        dieRoll: 1,
    });
    assert.equal(hit.damage, 0);
    assert.equal(hit.specialMessage, true);
});
void test('a Vorpal miss on a headless hero bypasses armor reduction and poisoned weapon effects', async () => {
    freshRoomWithPolymorphedHero('gas spore', {
        polymorph: { hitPoints: 100 }, hero: { uac: -10 },
    });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    goblin.mux = game.u.ux;
    goblin.muy = game.u.uy;
    await equipMonsterObject(goblin, await artifactObject('Vorpal Blade', { opoisoned: true }), W_WEP);
    installPagerInput(resetInputState(), { expected: /goblin|misses you wildly/, limit: 8 });
    await performMonsterHeroAttack(goblin, game, {
        random: limit => limit - 1, rollOne: () => 1, rollDice: count => count,
    });
    assert.equal(game.u.mh, 100);
    assert.match(game._pending_message, /misses you wildly/);
});
void test('Vorpal Blade passes through a ghost hero neck without beheading', async () => {
    freshRoomWithPolymorphedHero('ghost');
    const messages = [];
    const hit = await applyArtifactHit(await artifactObject('Vorpal Blade'), 'hero', 4, {
        dieRoll: 1, publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 5);
    assert.equal(messages[0], 'Vorpal Blade slices through your neck.');
});
void test('Tsurugi cuts deeply into a large hero instead of cutting it in half', async () => {
    freshRoomWithPolymorphedHero('giant');
    const messages = [];
    const hit = await applyArtifactHit(await artifactObject('The Tsurugi of Muramasa'), 'hero', 4, {
        dieRoll: 1, rollOne: sides => sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(hit.damage, 24, 'The deep cut doubles the physical hit and the 1d8 artifact bonus.');
    assert.equal(messages[0], 'The razor-sharp blade cuts deeply into you!');
});
void test('Cleaver adds physical damage without replacing the ordinary hit message', async () => {
    freshObjectRoom();
    const hit = await applyArtifactHit(await artifactObject('Cleaver'), 'hero', 7, {
        rollOne: sides => sides,
    });
    assert.equal(hit.damage, 13, 'Cleaver adds 1d6 artifact damage.');
    assert.equal(hit.specialMessage, false);
});
void test('an artifact message does not make the next ordinary weapon hit say again', async () => {
    freshRoomWithPolymorphedHero('giant', {
        polymorph: { hitPoints: 100 }, hero: { uac: 10 },
    });
    requirePlayingGame(game);
    const ettin = await createMonsterAt('ettin', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    ettin.mux = game.u.ux;
    ettin.muy = game.u.uy;
    await equipMonsterObject(ettin, await artifactObject('The Tsurugi of Muramasa'), W_WEP);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /ettin|blade/, limit: 12 });
    let attackDie = 0;
    await performMonsterHeroAttack(ettin, game, {
        random: limit => limit - 1,
        rollOne: sides => sides >= 20 ? ++attackDie : 1,
        rollDice: count => count,
    });
    const prose = [...messages, game._pending_message].join('\n');
    assert.match(prose, /The ettin cuts deeply into you!/);
    assert.match(prose, /The ettin hits!/);
    assert.doesNotMatch(prose, /hits again/);
});
//# sourceMappingURL=artifact_hit_hero.test.js.map