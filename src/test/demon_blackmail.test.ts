import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { talkToDemon } from '../js/demon_talk.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterName } from '../js/monster_name.js';
import { runMonsterAction, resumeDeferredCovetousRelocation } from '../js/monmove.js';
import { pushKey, pushKeys } from '../js/input.js';
import { RING_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a peaceful invisible demon prince reveals itself and attacks a penniless hero', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const prince = await createMonsterAt('Baalzebub', 11, 10, NO_MINVENT);
    prince.msleeping = 0;
    assert.equal(!!prince.mpeaceful, true);
    assert.equal(!!prince.minvis, true);
    pushKeys(' '.repeat(20));

    const action = await runMonsterAction(prince, game);
    if (action.movement?.deferredCovetousRelocation)
        await resumeDeferredCovetousRelocation(action, game);

    assert.equal(!!prince.minvis, false, 'the prince reveals itself before asking for payment');
    assert.equal(!!prince.perminvis, false);
    assert.equal(!!prince.mpeaceful, false, 'a hero without spendable gold cannot buy safe passage');
});

void test('a demon attacks a wealthy hero who is still putting on armor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const armor = await addInventoryObject(RING_MAIL);
    pushKey(armor.invlet);
    await rhack('W'.charCodeAt(0));
    const delay = game.multi;
    assert.ok(delay < 0);
    setHeroGoldAmount(game, 1000);
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.mpeaceful = 1;
    demon.mux = game.u.ux;
    demon.muy = game.u.uy;
    game._pending_message = '';
    pushKeys(' 9999\n' + ' '.repeat(20));

    const satisfied = await talkToDemon(demon, game);

    assert.equal(satisfied, false);
    assert.equal(!!demon.mpeaceful, false);
    assert.equal(heroGoldAmount(game), 1000, 'dressing prevents a bribe offer or payment');
    assert.equal(game.multi, delay, 'the demon does not cancel dressing');
    assert.equal(game.uarm, armor);
});

void test('a zero bribe leaves the next hallucinated demon identity for its anger message', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 10 } });
    requirePlayingGame(game);
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.mpeaceful = 1;
    demon.mux = game.u.ux;
    demon.muy = game.u.uy;
    setHeroGoldAmount(game, 1000);
    // Exercise message naming without map glyphs drawing from the same stream.
    game.nhDisplay = null;
    initRng(83n);
    monsterName(demon, { state: game, capitalized: true, article: 'a' });
    const angryName = monsterName(demon, { state: game, capitalized: true, article: 'a' });
    initRng(83n);
    pushKeys(' 0\n' + ' '.repeat(20));

    await talkToDemon(demon, game);

    assert.equal(game._lastPlineMessage, `${angryName} gets angry...`);
    assert.equal(heroGoldAmount(game), 1000);
});

void test('a demon greeting reports the force that prevents its teleport', async () => {
    const level = freshObjectRoom({ hero: {
        mtimedone: 50, umonnum: MONSTER_NAME.indexOf('water demon'),
    } });
    requirePlayingGame(game);
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.mux = game.u.ux;
    demon.muy = game.u.uy;
    level.flags.stasis_until = game.moves + 10;
    pushKeys(' '.repeat(20));

    const satisfied = await talkToDemon(demon, game);

    assert.equal(satisfied, true);
    assert.equal(game._lastPlineMessage, 'A mysterious force prevents the water demon from teleporting!');
    assert.equal(demon.mx, 11);
    assert.equal(demon.my, 10);
});

void test('an unseen demon angered by Excalibur appears as tension in a sleeping hero\'s dream', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
    demon.minvis = true;
    demon.mux = game.u.ux;
    demon.muy = game.u.uy;
    await setPrimaryWeapon(await artifactObject('Excalibur'));
    await putHeroToSleep(5);
    game._pending_message = '';

    await talkToDemon(demon, game);

    assert.equal(game._lastPlineMessage, 'You dream that you feel tension building.');
    assert.equal(!!demon.mpeaceful, false);
});
