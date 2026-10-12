import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MFAST, MM_ANGRY, MM_NOWAIT, NO_MINVENT, W_ARMF } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { lootMonsterContainer } from '../js/monster_container_loot.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterName } from '../js/monster_name.js';
import { beginMonsterHeroAttack, resolveDeferredHeroHasteSelf, resumeDeferredHeroSpell } from '../js/monmove.js';
import { addObjectToContainer } from '../js/object_container.js';
import { DAGGER, POT_FULL_HEALING, SACK, SPEED_BOOTS } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('a blinded Wizard finishes its turn after relocating and drinking healing', async () => {
    let relocations = 0;
    for (let seed = 1; seed <= 24; seed++) {
        freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const wizard = await createMonsterAt('Wizard of Yendor', 12, 10, MM_ANGRY | MM_NOWAIT | NO_MINVENT);
        wizard.mhp = wizard.mhpmax = 40;
        wizard.mcansee = 0;
        wizard.mblinded = 20;
        wizard.movement = 12;
        const potion = await addObjectToMonsterInventory(wizard, await knownObject(POT_FULL_HEALING), game);
        assert.ok(potion);
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        installPagerInput(input, { expected: /reappears|drinks|can see|looks completely healed/, limit: 6 });

        await finishAtCommandInput(input, moveloop_core, /looks completely healed/);

        assert.equal(potion.where, 'gone');
        assert.equal(wizard.mcansee, 1);
        assert.equal(wizard.mhp, wizard.mhpmax);
        assert.equal(game.u.uhp, 40);
        if (wizard.mx !== 12 || wizard.my !== 10) relocations++;
    }
    assert.ok(relocations > 0, 'The healing turn must include a covetous relocation');
});

for (const feedback of ['unseen', 'already fast', 'asleep', 'frozen', 'immobile', 'level creation']) {
    void test(`silent haste (${feedback}) preserves the next hallucinated name`, async () => {
        freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const caster = await createMonsterAt('kobold shaman', 13, 10, MM_ANGRY | NO_MINVENT);
        const witness = await createMonsterAt('orc', 14, 11, NO_MINVENT);
        caster.m_lev = 4;
        caster.mux = game.u.ux;
        caster.muy = game.u.uy;
        if (feedback === 'already fast')
            await equipMonsterObject(caster, await knownObject(SPEED_BOOTS), W_ARMF);
        const calls: string[] = [];
        const attack = await beginMonsterHeroAttack(caster, game,
            limit => limit === 4 ? 2 : limit - 1, () => 1, () => 1, calls);
        const action = { monster: caster, calls, movement: {
            oldx: caster.mx, oldy: caster.my, x: caster.mx, y: caster.my,
            moved: false, ...attack,
        } };
        assert.equal(action.movement.heroAttackSequence?.current?.kind, 'hero-spell');
        resumeDeferredHeroSpell(action, game);
        if (feedback === 'unseen') {
            caster.minvis = true;
            game.u.detectMonsters = true;
        }
        if (feedback === 'asleep') caster.msleeping = 1;
        if (feedback === 'frozen') caster.mfrozen = 10;
        if (feedback === 'immobile') caster.mmove = 0;
        if (feedback === 'level creation') game.in_mklev = true;
        game.u.hallucinationTurns = 20;
        initRng(7n);
        const nextName = monsterName(witness);
        initRng(7n);

        const haste = resolveDeferredHeroHasteSelf(action, game);

        assert.ok(haste, 'The selected haste spell must finish');
        assert.equal(haste.message, null);
        assert.equal(caster.permspeed, MFAST);
        assert.equal(caster.mspeed, MFAST);
        assert.equal(monsterName(witness), nextName,
            'A silent speed effect must leave the next perceived monster unchanged');
    });
}

void test('additional adjacent container removals keep their pronoun without changing the next hallucinated name', async () => {
    const nextNames: string[] = [];
    for (const count of [1, 3]) {
        freshObjectRoom({ heroX: 12, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        const bag = await addObjectToMonsterInventory(monster, await knownObject(SACK, { initialize: false }), game);
        assert.ok(bag);
        const items = [];
        for (let index = 0; index < count; index++) {
            const item = await knownObject(DAGGER, { spe: index });
            await addObjectToContainer(bag, item, game);
            items.push(item);
        }
        game.u.hallucinationTurns = 20;
        initRng(7n);
        const messages: string[] = [];

        const removed = await lootMonsterContainer(monster, bag, { state: game,
            random: limit => limit - 1, publish: message => { messages.push(message); } });

        assert.equal(removed, true);
        assert.equal(bag.contents?.length, 0);
        for (const item of items) assert.equal(item.ocarry, monster);
        assert.equal(messages.length, count, messages.join('\n'));
        assert.match(messages[0] ?? '', /removes .* from /);
        if (count > 1) {
            const second = messages[1] ?? '';
            const third = messages[2] ?? '';
            assert.match(second, /^(He|She|They|It) removes /);
            assert.equal(third.split(' ')[0], second.split(' ')[0]);
        }
        nextNames.push(monsterName(monster));
    }
    assert.equal(nextNames[1], nextNames[0],
        'Pronoun-only removals must leave the next perceived monster unchanged');
});
