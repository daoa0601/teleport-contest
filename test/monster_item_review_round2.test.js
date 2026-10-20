import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_OBJECT, MM_ANGRY, NO_MINVENT, POLY_TRAP, ROOM, STRAT_WAITFORU, STRAT_CLOSE, TELEP_TRAP, LEVEL_TELEP, W_ARMF } from '../js/const.js';
import { canSeeMonster, pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterHeroAttack, completeHeroAttackSlot, finishDeferredMonsterMiscItem, rollDeferredHeroSpellDamage, takeMonsterTurn } from '../js/monmove.js';
import { useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { prepareMonsterItemUse } from '../js/monster_item_use.js';
import { summonMonsterInsects } from '../js/monster_spell_insects.js';
import { IRON_SHOES, KICKING_BOOTS, SPEED_BOOTS, LEASH, POT_HEALING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { teleportMonsterToRandomLevel } from '../js/teleport.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
for (const { boots, name, iron } of [
    { boots: IRON_SHOES, name: 'iron shoes', iron: true },
    { boots: KICKING_BOOTS, name: 'kicking boots', iron: true },
    { boots: SPEED_BOOTS, name: 'speed boots', iron: false },
]) {
    void test(`a monster wearing ${name} ${iron ? 'avoids' : 'seeks'} a polymorph trap`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        await addObjectToMonsterInventory(monster, await knownObject(boots, { owornmask: W_ARMF }), game);
        addTrap(level, POLY_TRAP, 9, 10);
        const turn = await takeMonsterTurn(monster, game, limit => limit - 1);
        assert.equal(turn.movement?.usedMisc?.kind === 'polymorph-trap', !iron);
    });
}
void test('a ghost from a bottle ends the drinker meal and waiting, while preserving other strategy', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, NO_MINVENT);
    monster.meating = 7;
    monster.m_ap_type = M_AP_OBJECT;
    monster.mappearance = POT_HEALING;
    monster.mstrategy = STRAT_WAITFORU | STRAT_CLOSE;
    const potion = await addObjectToMonsterInventory(monster, await knownObject(POT_HEALING), game);
    assert.ok(potion);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[POT_HEALING] = 'milky';
    await prepareMonsterItemUse(monster, potion, { state: game, random: () => 0, publish: () => { } });
    assert.equal(monster.mcanmove, 0);
    assert.equal(monster.mfrozen, 3);
    assert.equal(monster.meating, 0);
    assert.equal(monster.mstrategy, STRAT_CLOSE);
    assert.equal(monster.m_ap_type, M_AP_OBJECT);
    assert.equal(monster.mappearance, POT_HEALING);
});
void test('a hallucinated djinni receives a fresh perceived name when vanishing', async () => {
    let changingNames = 0;
    for (let seed = 1; seed <= 8; seed++) {
        freshObjectRoom({ heroX: 14, heroY: 10, hero: { hallucinationTurns: 20 } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 10, 10, NO_MINVENT);
        const potion = await addObjectToMonsterInventory(monster, await knownObject(POT_HEALING), game);
        assert.ok(potion);
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[POT_HEALING] = 'smoky';
        initRng(BigInt(seed));
        const messages = [];
        await prepareMonsterItemUse(monster, potion, {
            state: game, random: () => 0, publish: message => { messages.push(message); },
        });
        const speaking = messages.find(message => message.endsWith(' speaks.'))?.replace(/ speaks\.$/, '');
        const vanishing = messages.find(message => message.endsWith(' vanishes.'))?.replace(/ vanishes\.$/, '');
        assert.ok(speaking && vanishing, messages.join('\n'));
        if (speaking !== vanishing)
            changingNames++;
    }
    assert.ok(changingNames > 0, 'Hallucination must not retain the speaking name for every disappearance');
});
void test('an unseen humanoid deliberately entering a visible polymorph trap is someone', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.minvis = true;
    addTrap(level, POLY_TRAP, 9, 10);
    const turn = await takeMonsterTurn(monster, game, limit => limit - 1);
    assert.ok(turn.movement);
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    installPagerInput(input, { expected: /deliberately|changes|armor|orc/, limit: 8 });
    await finishDeferredMonsterMiscItem({ monster, ...turn, movement: turn.movement }, game);
    messages.push(game._pending_message || '');
    assert.match(messages.join('\n'), /Someone deliberately jumps onto a polymorph trap!/);
});
for (const destinationVisible of [true, false]) {
    void test(`a defensive teleport trap reports a monster ${destinationVisible ? 'remaining visible' : 'disappearing'}`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        monster.mhp = 1;
        monster.mhpmax = 40;
        const trap = addTrap(level, TELEP_TRAP, 9, 10);
        trap.teledest = { x: destinationVisible ? 12 : 38, y: 10 };
        level.requireAt(38, 10).typ = ROOM;
        const messages = [];
        installPagerInput(resetInputState(), { expected: /orc|disappears|disoriented/, limit: 8 });
        await useMonsterDefensiveItem(monster, { kind: 'trap', trap }, {
            state: game, publish: message => { messages.push(message); },
        });
        assert.equal(canSeeMonster(monster), destinationVisible);
        assert.ok(messages.includes(destinationVisible ? 'The orc seems disoriented.' : 'The orc suddenly disappears!'), messages.join('\n'));
        assert.equal(trap.tseen, true);
    });
}
for (const species of ['floating eye', 'vampire bat', 'naga hatchling']) {
    void test(`${species} enters an escape trap using its native locomotion`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species === 'naga hatchling' ? 'red naga hatchling' : species, 10, 10, NO_MINVENT);
        const trap = addTrap(level, TELEP_TRAP, 9, 10);
        trap.teledest = { x: 12, y: 10 };
        const messages = [];
        installPagerInput(resetInputState(), { expected: /eye|bat|naga|disoriented/, limit: 8 });
        await useMonsterDefensiveItem(monster, { kind: 'trap', trap }, {
            state: game, publish: message => { messages.push(message); },
        });
        const verb = species === 'floating eye' ? 'floats' : species === 'vampire bat' ? 'flies' : 'slithers';
        assert.match(messages[0] ?? '', new RegExp(` ${verb} onto a teleportation trap!$`));
    });
}
void test('a hallucinating hero sees random trap names when monsters jump onto escape and polymorph traps', async () => {
    const names = new Set();
    for (let seed = 1n; seed <= 6n; seed++) {
        const level = freshObjectRoom({ heroX: 14, heroY: 10, hero: { hallucinationTurns: 50 } });
        requirePlayingGame(game);
        initRng(seed);
        const fleeing = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        const trap = addTrap(level, TELEP_TRAP, 9, 10);
        trap.teledest = { x: 12, y: 10 };
        const messages = [];
        installPagerInput(resetInputState(), { expected: /onto|disoriented/, limit: 8 });
        await useMonsterDefensiveItem(fleeing, { kind: 'trap', trap }, {
            state: game, publish: message => { messages.push(message); },
        });
        names.add((messages[0] ?? '').replace(/^.* onto a (.*)!$/, '$1'));
    }
    for (let seed = 1n; seed <= 6n; seed++) {
        const level = freshObjectRoom({ heroX: 14, heroY: 10, hero: { hallucinationTurns: 50 } });
        requirePlayingGame(game);
        initRng(seed);
        const seeker = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        addTrap(level, POLY_TRAP, 9, 10);
        const turn = await takeMonsterTurn(seeker, game, limit => limit - 1);
        assert.ok(turn.movement);
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message || ''); };
        installPagerInput(input, { expected: /deliberately|changes|armor|turns/, limit: 8 });
        await finishDeferredMonsterMiscItem({ monster: seeker, ...turn, movement: turn.movement }, game);
        messages.push(game._pending_message || '');
        const jump = messages.join('\n').match(/deliberately \w+ onto a ([^!]*)!/);
        assert.ok(jump, messages.join('\n'));
        names.add(jump[1] ?? '');
    }
    names.delete('teleportation trap');
    names.delete('polymorph trap');
    assert.ok(names.size > 0, 'trapname() draws a hallucinated name from the display stream');
});
void test('a visible priest who cannot see the invisible hero summons insects around the mistaken spot', async () => {
    freshObjectRoom({ right: 25, heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    grantIntrinsicProperty('invisible', 'outside', game);
    const priest = await createMonsterAt('aligned cleric', 10, 10, MM_ANGRY | NO_MINVENT);
    priest.m_lev = 10;
    priest.mux = 13;
    priest.muy = 10;
    const effect = await summonMonsterInsects(priest, game);
    assert.ok(effect.created.length);
    assert.match(effect.message ?? '', /summons insects around a spot near you!$/);
});
void test('a successful aggravation spell aimed at a misplaced hero still explains its effect', async () => {
    freshObjectRoom({ heroX: 11, heroY: 10, hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    grantIntrinsicProperty('invisible', 'outside', game);
    const caster = await createMonsterAt('lich', 10, 10, MM_ANGRY | NO_MINVENT);
    caster.m_lev = 14;
    caster.mux = 10;
    caster.muy = 9;
    caster.mcansee = 0;
    const sleeper = await createMonsterAt('orc', 15, 10, NO_MINVENT);
    sleeper.msleeping = 1;
    installPagerInput(resetInputState(), { expected: /lich|misses|spell/, limit: 8 });
    const calls = [];
    const initiation = await beginMonsterHeroAttack(caster, game, limit => limit - 1, () => 1, () => 1, calls);
    const action = { monster: caster, calls,
        movement: { oldx: 10, oldy: 10, x: 10, y: 10, moved: false, ...initiation } };
    for (let slot = 0; slot < 6 && action.movement.heroAttackSequence?.current?.kind !== 'hero-spell'; slot++)
        await completeHeroAttackSlot(action, game, limit => limit - 1);
    const attack = rollDeferredHeroSpellDamage(action, game);
    assert.equal(attack?.kind, 'hero-spell');
    assert.equal(attack?.spell, 'aggravation');
    assert.equal(attack?.damage, 0);
    assert.equal(attack?.spellEffectMessage, 'You feel that monsters are aware of your presence.');
    assert.equal(game.u.uhp, 500);
});
void test('a cursed leash makes a teleporting pet yelp, wake a nearby sleeper, and interrupt running', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 10, 10, NO_MINVENT);
    const sleeper = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    sleeper.msleeping = 1;
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { cursed: true, leashmon: pet.m_id });
    game.context.run = 1;
    game.multi = 5;
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    installPagerInput(resetInputState(), { expected: /yelps/, limit: 4 });
    await teleportMonsterToRandomLevel(pet, trap, { state: game });
    assert.match(game._pending_message || '', /little dog yelps!/);
    assert.equal(sleeper.msleeping, 0);
    assert.equal(game.context.run, 0);
    assert.equal(game.multi, 0);
    assert.equal(leash.leashmon, pet.m_id);
});
void test('a leash stays attached while its slack message waits for acknowledgement', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    const pet = await createMonsterAt('little dog', 10, 10, NO_MINVENT);
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    const trap = addTrap(level, LEVEL_TELEP, 10, 10);
    const input = resetInputState();
    let checkedAttachment = false;
    input.beforeRead = () => {
        if (checkedAttachment)
            return;
        checkedAttachment = true;
        assert.equal(leash.leashmon, pet.m_id, 'The message must finish before detaching the leash');
        assert.equal(pet.mleashed, 1);
    };
    installPagerInput(input, { expected: /earlier|leash|disappears/, limit: 4 });
    await pline('An earlier message fills the line before the pet reaches the teleport trap.');
    await teleportMonsterToRandomLevel(pet, trap, { state: game, random: limit => limit === 5 ? 2 : 10 });
    assert.equal(checkedAttachment, true);
    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 0);
});
//# sourceMappingURL=monster_item_review_round2.test.js.map