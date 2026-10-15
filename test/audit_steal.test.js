import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_AMUL } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { punishHero } from '../js/punishment.js';
import { unlinkObject } from '../js/object_location.js';
import { addInventoryItem } from '../js/u_init.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, DAGGER, GOLD_PIECE, LEASH, OBJECT_NAMES, STATUE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject, knownObject, untimedCorpse } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { installHeroChainedToBuriedBall } from './support/hero-state.js';
async function nearbyThief(species = 'water nymph') {
    const thief = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    thief.mux = game.u.ux;
    thief.muy = game.u.uy;
    return thief;
}
void test('a nymph gives up on a boulder instead of carrying it away', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const boulder = await addInventoryObject(BOULDER);
    const thief = await nearbyThief();
    const messages = theftMessages();
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    messages.push(game._pending_message);
    assert.ok(game.inventory.includes(boulder));
    assert.equal(thief.minvent.length, 0);
    assert.match(messages.join('\n'), /tries to steal your boulder but gives up/);
});
for (const species of ['water nymph', 'monkey']) {
    for (const cursed of [false, true]) {
        void test(`${species} ${cursed ? 'confronts a cursed' : 'takes an uncursed'} attached leash`, async () => {
            freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
            requirePlayingGame(game);
            const pet = await createMonsterAt('kitten', 9, 10, NO_MINVENT);
            const leash = await addInventoryObject(LEASH, { cursed, leashmon: pet.m_id });
            pet.mleashed = 1;
            const thief = await nearbyThief(species);
            theftMessages();
            await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
            const blocked = species === 'monkey' && cursed;
            assert.equal(game.inventory.includes(leash), blocked);
            assert.equal(thief.minvent.includes(leash), !blocked);
            assert.equal(leash.leashmon, blocked ? pet.m_id : 0);
            assert.equal(!!pet.mleashed, blocked, 'Taking the leash releases its animal');
        });
    }
}
void test('a nymph takes a worn adornment ring before ordinary possessions', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('adornment'));
    await wearHeroAccessory(ring, 'uleft');
    const dagger = await addInventoryObject(DAGGER);
    const thief = await nearbyThief();
    theftMessages();
    await performMonsterHeroAttack(thief, game, { random: limit => limit - 1, rollOne: () => 1 });
    assert.ok(thief.minvent.includes(ring), 'Adornment bypasses the ordinary weighted selection');
    assert.ok(game.inventory.includes(dagger));
    assert.equal(game.uleft, null);
});
for (const deaf of [false, true]) {
    void test(`a nymph talks to a ${deaf ? 'deaf' : 'hearing'} fellow seducer instead of stealing`, async () => {
        freshObjectRoom({ hero: { deafTurns: deaf ? 20 : 0 } });
        requirePlayingGame(game);
        setHeroSpecies(MONSTER_NAME.indexOf('wood nymph'), game);
        game.u.mh = game.u.mhmax = 40;
        game.level.flags.noteleport = true;
        const dagger = await addInventoryObject(DAGGER);
        const thief = await nearbyThief();
        thief.mcan = 1;
        const messages = theftMessages();
        await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
        messages.push(game._pending_message);
        assert.ok(game.inventory.includes(dagger));
        assert.match(messages.join('\n'), deaf
            ? /says something but you can't hear it/
            : /makes some remarks about how difficult theft is lately/);
        assert.match(messages.join('\n'), /prevents the water nymph from teleporting/);
        assert.ok(!thief.mflee, 'Conversation ends the attack without starting flight');
    });
}
function theftMessages() {
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /nymph|monkey|Somebody|She|Something|Someone|punished|chain|anchor|amulet/, limit: 25 });
    return messages;
}
for (const lifeSaving of [false, true]) {
    void test(`stealing a cockatrice corpse petrifies a nymph ${lifeSaving ? 'who is then life saved' : 'with the stolen corpse inside her statue'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        const corpse = await addInventoryItem(await untimedCorpse(MONSTER_NAME.indexOf('cockatrice')));
        const thief = await nearbyThief();
        if (lifeSaving)
            await equipMonsterObject(thief, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        const messages = theftMessages();
        await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
        messages.push(game._pending_message);
        assert.match(messages.join('\n'), /stole[\s\S]*turns to stone/);
        assert.equal(game.inventory.includes(corpse), false);
        assert.ok(!thief.mflee, 'Petrification ends the attack before flight, even with life saving');
        if (lifeSaving) {
            assert.ok(thief.mhp > 0);
            assert.ok(thief.minvent.includes(corpse));
            assert.ok(!thief.minvent.some(object => object.otyp === AMULET_OF_LIFE_SAVING));
        }
        else {
            assert.ok(thief.dead);
            const statue = floorObjectsAt(game.level, 11, 10).find(object => object.otyp === STATUE);
            assert.ok(statue?.contents?.includes(corpse));
            assert.equal(game.u.uconduct.killer, 1, 'The hero gets credit for the petrified thief');
        }
    });
}
for (const carried of [false, true]) {
    void test(`a nymph unlocks punishment ${carried ? 'and steals a carried ball' : 'when the hero has no inventory'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const messages = theftMessages();
        await punishHero();
        const ball = game.uball;
        assert.ok(ball);
        if (carried) {
            unlinkObject(ball, game);
            await addInventoryItem(ball);
        }
        const thief = await nearbyThief();
        await performMonsterHeroAttack(thief, game, { random: limit => Math.min(1, limit - 1), rollOne: () => 1 });
        messages.push(game._pending_message);
        assert.equal(game.u.punished, false);
        assert.equal(game.uchain, null);
        assert.equal(game.uball, null);
        assert.equal(thief.minvent.includes(ball), carried);
        assert.equal(ball.where, carried ? 'minvent' : 'floor');
        assert.match(messages.join('\n'), /takes off the iron chain/);
        assert.ok(!thief.mavenge, 'Unpunishing the hero does not grant retaliation against the nymph');
    });
}
void test('a nymph releases an empty-handed hero from a buried punishment ball', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await installHeroChainedToBuriedBall({ x: 9, y: 10 });
    const thief = await nearbyThief();
    const messages = theftMessages();
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    messages.push(game._pending_message);
    assert.equal(game.u.utrap, 0);
    assert.match(messages.join('\n'), /takes off your unseen chain\.[\s\S]*released from your anchor/);
    assert.equal(thief.minvent.length, 0);
});
for (const possessions of ['nothing', 'gold', 'blind']) {
    void test(`a nymph announces an unsuccessful robbery with ${possessions} and flees`, async () => {
        freshObjectRoom({ hero: { blindTurns: possessions === 'blind' ? 20 : 0 } });
        requirePlayingGame(game);
        const purse = possessions === 'gold' ? await addInventoryObject(GOLD_PIECE, { quan: 90 }) : null;
        const thief = await nearbyThief();
        const messages = theftMessages();
        await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
        messages.push(game._pending_message);
        await flushPendingTopline();
        assert.match(messages.join('\n'), possessions === 'blind'
            ? /Somebody tries to rob you, but finds nothing to steal\./
            : possessions === 'gold'
                ? /The water nymph tries to rob you, but isn't interested in gold\./
                : /The water nymph tries to rob you, but there is nothing to steal!/);
        assert.ok(thief.mflee, 'An empty-handed thief ends her attack and flees');
        assert.equal(thief.minvent.length, 0);
        if (purse)
            assert.ok(game.inventory.includes(purse));
    });
}
//# sourceMappingURL=audit_steal.test.js.map