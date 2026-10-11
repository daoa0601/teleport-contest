import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, PIT, POOL, SPIKED_PIT, TT_PIT, W_WEP } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { DAGGER, RIN_CONFLICT } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

function collectAttackMessages(expected: RegExp): string[] {
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, { expected, limit: 12 });
    input.beforeRead = () => { messages.push(game._pending_message); };
    return messages;
}

for (const trapType of [PIT, SPIKED_PIT]) {
    void test(`a horse trapped in ${trapType === PIT ? 'a pit' : 'a spiked pit'} can bite but cannot kick`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const horse = await createMonsterAt('horse', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        horse.mux = game.u.ux;
        horse.muy = game.u.uy;
        await maketrap(horse.mx, horse.my, trapType);
        horse.mtrapped = 1;
        const messages = collectAttackMessages(/horse/);

        await performMonsterHeroAttack(horse, game, {
            random: range => range - 1, rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();

        assert.equal(game.u.uhp, 99, 'only the bite deals damage');
        assert.match(messages.join('\n'), /horse bites/);
        assert.doesNotMatch(messages.join('\n'), /kicks|misses/);
        assert.equal(horse.mtrapped, 1);
    });
}

void test('a horse can kick a hero who is trapped in a pit', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    await maketrap(game.u.ux, game.u.uy, PIT);
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    const horse = await createMonsterAt('horse', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    horse.mux = game.u.ux;
    horse.muy = game.u.uy;
    const messages = collectAttackMessages(/horse/);

    await performMonsterHeroAttack(horse, game, {
        random: range => range - 1, rollOne: () => 1, rollDice: count => count,
    });
    await flushPendingTopline();

    assert.equal(game.u.uhp, 98, 'both the kick and bite deal damage');
    assert.match(messages.join('\n'), /horse kicks/);
    assert.match(messages.join('\n'), /horse bites/);
});

for (const condition of ['ordinary', 'confused', 'Conflict'] as const) {
    void test(`an armed ${condition} centaur ${condition === 'ordinary' ? 'avoids' : 'risks'} kicking a cockatrice`, async () => {
        freshRoomWithPolymorphedHero('cockatrice', { polymorph: { hitPoints: 100 }, hero: { uac: 10 } });
        requirePlayingGame(game);
        if (condition === 'Conflict')
            await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
        const centaur = await createMonsterAt('forest centaur', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        centaur.mux = game.u.ux;
        centaur.muy = game.u.uy;
        centaur.mconf = condition === 'confused' ? 1 : 0;
        await equipMonsterObject(centaur, await knownObject(DAGGER, { spe: 0 }), W_WEP);
        const messages = collectAttackMessages(/centaur|stone|statue/);

        await performMonsterHeroAttack(centaur, game, {
            random: range => range - 1, rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();

        assert.ok(game.u.mh < 100, 'the armed attack still damages the cockatrice');
        assert.equal(Boolean(centaur.dead), condition !== 'ordinary',
            'only an unprotected kick exposes the centaur to petrification');
        assert.equal(/centaur kicks/.test(messages.join('\n')), condition !== 'ordinary');
    });
}

for (const hits of [false, true]) {
    void test(`a ${hits ? 'successful' : 'missed'} kick at a thick-skinned hero ${hits ? 'is harmless and silent' : 'still reports a miss'}`, async () => {
        freshRoomWithPolymorphedHero('mastodon', { polymorph: { hitPoints: 100 }, hero: { uac: 0 } });
        requirePlayingGame(game);
        const horse = await createMonsterAt('horse', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        horse.mux = game.u.ux;
        horse.muy = game.u.uy;
        const messages = collectAttackMessages(/horse/);

        await performMonsterHeroAttack(horse, game, {
            random: range => range - 1, rollOne: () => hits ? 1 : 20, rollDice: count => count,
        });
        await flushPendingTopline();

        assert.equal(game.u.mh, hits ? 99 : 100, 'only an accurate bite can penetrate the thick skin');
        assert.doesNotMatch(messages.join('\n'), /kicks/);
        if (hits) assert.doesNotMatch(messages.join('\n'), /misses/);
        else assert.match(messages.join('\n'), /misses/);
    });
}

for (const species of ['lichen', 'large mimic', 'giant eel']) {
    void test(`a ${species} cannot hold an unsolid hero`, async () => {
        freshRoomWithPolymorphedHero('wraith', { polymorph: { hitPoints: 100 }, hero: { uac: 10 } });
        requirePlayingGame(game);
        if (species === 'giant eel') {
            const location = game.level.at(11, 10);
            assert.ok(location);
            location.typ = POOL;
        }
        const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        const messages = collectAttackMessages(/lichen|mimic|eel|It|hidden/);

        await performMonsterHeroAttack(monster, game, {
            random: range => range - 1, rollOne: () => 1, rollDice: count => count,
        });
        await flushPendingTopline();

        assert.ok(!game.u.ustuck, 'the hero remains unheld');
        assert.equal(game.u.mh, species === 'giant eel' ? 97 : 100,
            'the eel bite can hurt, but sticking and wrapping contacts pass through the hero');
        assert.match(messages.join('\n'), /(?:adhere|grab) attempt passes right through you!/);
    });
}

void test('an owlbear claws an unsolid hero but its following hug passes through', async () => {
    freshRoomWithPolymorphedHero('wraith', { polymorph: { hitPoints: 100 }, hero: { uac: 10 } });
    requirePlayingGame(game);
    const owlbear = await createMonsterAt('owlbear', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    owlbear.mux = game.u.ux;
    owlbear.muy = game.u.uy;
    const messages = collectAttackMessages(/owlbear/);

    await performMonsterHeroAttack(owlbear, game, {
        random: range => range - 1, rollOne: () => 1, rollDice: count => count,
    });
    await flushPendingTopline();

    assert.equal(game.u.mh, 98, 'both claws hurt, but the hug causes no damage');
    assert.ok(!game.u.ustuck, 'the hero remains unheld');
    assert.match(messages.join('\n'), /owlbear's grab attempt passes right through you!/);
});

void test('a purple worm bites an unsolid hero but cannot swallow it', async () => {
    freshRoomWithPolymorphedHero('wraith', { polymorph: { hitPoints: 100 }, hero: { uac: 10 } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    worm.mux = game.u.ux;
    worm.muy = game.u.uy;
    const messages = collectAttackMessages(/purple worm/);

    await performMonsterHeroAttack(worm, game, {
        random: range => range - 1, rollOne: () => 1, rollDice: count => count,
    });
    await flushPendingTopline();

    assert.equal(game.u.mh, 98);
    assert.equal(Boolean(game.u.uswallow), false);
    assert.ok(!game.u.ustuck, 'the hero remains unheld');
    assert.match(messages.join('\n'), /purple worm's gulp attempt passes right through you!/);
});
