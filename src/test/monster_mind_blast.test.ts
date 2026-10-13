import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { useMonsterMindBlast } from '../js/monster_mind_blast.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const attitude of ['hostile', 'peaceful', 'invulnerable']) {
    void test(`a ${attitude} mind flayer can unleash a psychic blast before moving`, async () => {
        freshObjectRoom({ right: 26, hero: { uhp: 100, uhpmax: 100, telepathy: true,
            invulnerable: attitude === 'invulnerable' } });
        requirePlayingGame(game);
        const flayer = await createMonsterAt('mind flayer', 15, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        flayer.mpeaceful = attitude === 'peaceful' ? 1 : 0;
        flayer.mcan = 1;
        const messages: string[] = [];
        const input = resetInputState();
        installPagerInput(input, { expected: /mind flayer|psychic|telepathy|soothing/, limit: 10 });
        input.beforeRead = () => { messages.push(game._pending_message); };

        await runMonsterAction(flayer, game,
            limit => limit === 20 ? 0 : limit - 1, count => count,
            sides => sides === 15 ? 7 : 1);
        await flushPendingTopline();

        assert.equal(game.u.uhp, attitude === 'hostile' ? 93 : 100);
        const text = messages.join('\n');
        assert.match(text, /A wave of psychic energy pours over you!/);
        if (attitude === 'peaceful') assert.match(text, /It feels quite soothing\./);
        if (attitude === 'hostile') assert.match(text, /It locks on to your latent telepathy!/);
    });
}

void test('a psychic blast wakes and hurts opposing minds anywhere on the level', async () => {
    freshObjectRoom({ right: 30, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const flayer = await createMonsterAt('mind flayer', 15, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const enemy = await createMonsterAt('floating eye', 25, 10, MM_NOGRP | NO_MINVENT);
    enemy.mpeaceful = 1;
    enemy.mhp = enemy.mhpmax = 20;
    enemy.mcansee = 0;
    enemy.mblinded = 5;
    enemy.msleeping = 1;
    const mindless = await createMonsterAt('straw golem', 16, 11, MM_NOGRP | NO_MINVENT);
    mindless.mpeaceful = 1;
    mindless.mhp = mindless.mhpmax = 20;
    const ally = await createMonsterAt('floating eye', 17, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    ally.mhp = ally.mhpmax = 20;
    ally.mcansee = 0;
    ally.mblinded = 5;
    const input = resetInputState();
    installPagerInput(input, { expected: /mind flayer|psychic|floating eye/, limit: 10 });

    await runMonsterAction(flayer, game,
        limit => limit === 20 ? 0 : limit - 1, count => count,
        sides => sides === 15 ? 7 : 1);

    assert.equal(enemy.mhp, 13, 'the monster targets have no distance restriction');
    assert.equal(enemy.msleeping, 0);
    assert.equal(mindless.mhp, 20);
    assert.equal(ally.mhp, 20);
});

void test('a psychic blast hits newer monsters first, assigning damage and messages in that order', async () => {
    freshObjectRoom({ right: 24, hero: { invulnerable: true } });
    requirePlayingGame(game);
    const flayer = await createMonsterAt('mind flayer', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const older = await createMonsterAt('floating eye', 14, 10, MM_NOGRP | NO_MINVENT);
    older.mpeaceful = 1;
    older.mhp = older.mhpmax = 20;
    const newer = await createMonsterAt('master mind flayer', 15, 10, MM_NOGRP | NO_MINVENT);
    newer.mpeaceful = 1;
    newer.mhp = newer.mhpmax = 20;
    const messages: string[] = [];
    let damage = 0;

    await useMonsterMindBlast(flayer, game, {
        resistsConflict: () => true,
        random: limit => limit - 1,
        rollOne: () => { damage += 3; return damage; },
        publish: async message => { messages.push(message); },
    });

    assert.equal(newer.mhp, 17, 'the newest opposing mind receives the first damage roll');
    assert.equal(older.mhp, 14, 'the older opposing mind receives the second damage roll');
    assert.deepEqual(messages.filter(message => message.startsWith('It locks on to ')), [
        'It locks on to the master mind flayer.',
        'It locks on to the floating eye.',
    ]);
});

void test('a distant psychic blast is faint and does not attack any minds', async () => {
    freshObjectRoom({ right: 30, hero: { uhp: 100, uhpmax: 100, telepathy: true } });
    requirePlayingGame(game);
    const flayer = await createMonsterAt('mind flayer', 20, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const enemy = await createMonsterAt('floating eye', 21, 10, MM_NOGRP | NO_MINVENT);
    enemy.mpeaceful = 1;
    enemy.mhp = enemy.mhpmax = 20;
    enemy.mcansee = 0;
    enemy.mblinded = 5;
    const input = resetInputState();
    const messages: string[] = [];
    installPagerInput(input, { expected: /mind flayer|psychic/, limit: 10 });
    input.beforeRead = () => { messages.push(game._pending_message); };

    await runMonsterAction(flayer, game,
        limit => limit === 20 ? 0 : limit - 1, count => count,
        sides => sides === 15 ? 7 : 1);
    await flushPendingTopline();

    assert.equal(game.u.uhp, 100);
    assert.equal(enemy.mhp, 20);
    assert.match(messages.join('\n'), /You sense a faint wave of psychic energy\./);
});

void test('a psychic hit reveals a hiding hero and halves odd damage with Half spell damage', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, telepathy: true,
        halfSpellDamage: true, uundetected: true } });
    requirePlayingGame(game);
    const flayer = await createMonsterAt('mind flayer', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const messages: string[] = [];

    await useMonsterMindBlast(flayer, game, {
        resistsConflict: () => true, random: limit => limit - 1, rollOne: () => 7,
        publish: async message => { messages.push(message); },
    });

    assert.equal(game.u.uhp, 96);
    assert.equal(game.u.uundetected, false);
    assert.match(messages.join('\n'), /It locks on to your latent telepathy!/);
});

void test('a lethal psychic blast kills an opposing monster without hero kill credit', async () => {
    freshObjectRoom({ right: 24, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const flayer = await createMonsterAt('mind flayer', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const eye = await createMonsterAt('floating eye', 14, 10, MM_NOGRP | NO_MINVENT);
    eye.mpeaceful = 1;
    eye.mhp = eye.mhpmax = 1;
    eye.mcansee = 0;
    eye.mblinded = 5;
    const experience = game.u.uexp;
    const kills = game.u.uconduct.killer;

    await useMonsterMindBlast(flayer, game, {
        resistsConflict: () => true, random: limit => limit - 1, rollOne: () => 7,
        publish: async () => {},
    });

    assert.equal(game.level.monsters.includes(eye), false);
    assert.equal(game.u.uexp, experience);
    assert.equal(game.u.uconduct.killer, kills);
});
