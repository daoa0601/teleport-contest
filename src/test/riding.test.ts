import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { BEAR_TRAP, P_RIDING, TT_BEARTRAP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { AMULET_OF_LIFE_SAVING, RING_MAIL, SADDLE } from '../js/object_data.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { W_AMUL } from '../js/const.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ensureHeroSkills } from '../js/skills.js';
import { putSaddleOnMonster } from '../js/steed.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { addTrap } from './support/level-state.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { nameToMonster } from '../js/mondata.js';
import { removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { initRng } from '../js/rng.js';
import { installPagerInput } from './support/pager-input.js';
import { grantIntrinsicProperty } from '../js/properties.js';

void test('a steed does not retaliate after an elemental attacker explodes and is life saved', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30, uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const horse = await createSaddledSteed('horse');
    await runExtendedCommand('ride', 'l');
    horse.mhp = horse.mhpmax = 500;
    horse.m_lev = 30;
    const sphere = await createMonsterAt('flaming sphere', 12, 10, NO_MINVENT);
    sphere.mhp = sphere.mhpmax = 100;
    const amulet = await equipMonsterObject(sphere, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    installPagerInput(resetInputState(), {
        expected: /sphere|medallion|caught in the|Boom!|horse|But wait|looks much better/,
        limit: 8,
    });
    initRng(5n);

    const result = await performMonsterHeroAttack(sphere, game);

    assert.equal(amulet.where, 'gone', 'the explosion must consume the attacker\'s life saving');
    assert.equal(game.u.usteed, horse);
    assert.ok(horse.mhp > 0 && horse.mhp < 500, 'the steed survives the blast');
    assert.equal(sphere.mhp, sphere.mhpmax, 'the revived attacker receives no retaliation damage');
    assert.equal(result.nativeResult, 1, 'mattacku preserves the explosion\'s attacker-death result');
});

void test('a nearby orc can attack the steed and receive its immediate retaliation', async () => {
    let steedFight = false;
    for (let seed = 1; seed <= 8 && !steedFight; seed++) {
        freshObjectRoom({ role: 'knight', hero: { ulevel: 30, uhp: 100, uhpmax: 100, uac: 100 } });
        requirePlayingGame(game);
        const horse = await createSaddledSteed('horse');
        await runExtendedCommand('ride', 'l');
        const orc = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
        orc.m_lev = 30;
        orc.mhp = orc.mhpmax = 100;
        horse.mhp = horse.mhpmax = 100;
        horse.movement = 0;
        orc.mux = game.u.ux;
        orc.muy = game.u.uy;
        pushKeys(' '.repeat(20));
        initRng(BigInt(seed));

        await performMonsterHeroAttack(orc, game);

        if (horse.mhp < 100) {
            assert.equal(game.u.uhp, 100, 'an attack on the steed leaves the rider unharmed');
            assert.equal(horse.movement, 0, 'retaliation does not spend a movement ration');
            steedFight = orc.mhp < 100;
        }
    }
    assert.ok(steedFight, 'the steed must be able to retaliate during the attacker turn');
});

void test('an animal body cannot mount a saddled pony', async () => {
    freshObjectRoom({ role: 'knight' });
    requirePlayingGame(game);
    await createSaddledSteed();
    installPolymorphedHero('bat');

    await runExtendedCommand('ride', 'l');

    assert.ok(!game.u.usteed);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /won't fit on a saddle/);
});

void test('a non-knight loses a barely tame mount before getting on', async () => {
    freshObjectRoom({ role: 'barbarian', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    pony.mtame = 1;

    await runExtendedCommand('ride', 'l');

    assert.ok(!game.u.usteed);
    assert.equal(pony.mtame, 0);
    assert.equal(game.context.move, 0);
});

void test('slipping from a cursed saddle damages the active monster body', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await createSaddledSteed('pony', { saddle: { cursed: true } });
    installPolymorphedHero('vampire', { hitPoints: 1 });
    const humanHealth = game.u.uhp;

    await runExtendedCommand('ride', 'l                ');

    assert.ok(!game.u.usteed);
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHealth);
    assert.equal(game.context.move, 0);
});

void test('mount and voluntary dismount preserve the live pony identity', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const steed = await createSaddledSteed();

    await runExtendedCommand('ride', 'l');

    assert.equal(game.u.usteed, steed);
    assert.equal(level.monsters.includes(steed), true);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /mount the saddled pony/);

    await runExtendedCommand('ride');

    assert.equal(game.u.usteed, null);
    assert.equal(level.monsters.filter(monster => monster === steed).length, 1);
    assert.deepEqual([steed.mx, steed.my], [11, 10]);
    assert.equal(
        Math.abs(game.u.ux - steed.mx) + Math.abs(game.u.uy - steed.my),
        1,
    );
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /pony with no name/);
});

void test('an unsaddled pony rejects riding without time or state mutation',
    async () => {
        const level = freshObjectRoom({ role: 'knight' });
        requirePlayingGame(game);
        const target = await createMonsterAt('pony', 11, 10);
        initializePet(target, { state: game });
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await runExtendedCommand('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /not saddled/);
    });

void test('a saddled but untamed pony refuses the mount without injuring the hero',
    async () => {
        const level = freshObjectRoom({ role: 'knight' });
        requirePlayingGame(game);
        const target = await createMonsterAt('pony', 11, 10);
        await putSaddleOnMonster(await knownObject(SADDLE), target);
        const before = [game.u.ux, game.u.uy, game.u.uhp];

        await runExtendedCommand('ride', 'l');

        assert.equal(game.u.usteed, undefined);
        assert.deepEqual([game.u.ux, game.u.uy, game.u.uhp], before);
        assert.deepEqual(level.monsters, [target]);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /would mind/);
    });

void test('chat derives a pony response from its current tame and hunger state',
    async () => {
        const level = freshObjectRoom({ role: 'knight' });
        requirePlayingGame(game);
        const target = await createMonsterAt('pony', 11, 10);
        initializePet(target, { state: game });
        const hitPointsBefore = target.mhp;

        await runExtendedCommand('chat', 'l');

        assert.equal(game.context.move, 1);
        assert.equal(level.monsters[0], target);
        assert.deepEqual([target.mx, target.my], [11, 10]);
        assert.equal(target.mhp, hitPointsBefore);
        assert.match(game._pending_message, /pony whickers\.$/i);
    });

void test('riding moves the pony with the hero and trains riding skill', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    ensureHeroSkills(game);
    game.u.urideturns = 99;
    const ridingSkill = game.u.weaponSkills?.[P_RIDING];
    assert.ok(ridingSkill);
    const practice = ridingSkill.advance;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 12);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
    assert.ok(game.u.weaponSkills != null);
    assert.equal(game.u.weaponSkills[P_RIDING]?.advance, practice + 1);
});

void test('a sleeping pony prevents walking but not an attack from the saddle', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    pony.msleeping = 1;

    await rhack('l'.charCodeAt(0));

    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message, /pony won't move/);
    const foe = await createMonsterAt('lichen', 12, 10);
    foe.mpeaceful = false;
    const health = foe.mhp;

    await rhack('l'.charCodeAt(0));

    assert.ok(foe.mhp < health);
    assert.equal(game.u.usteed, pony);
});

void test('changing into a bat forces a dismount even when the saddle is cursed', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.ok(pony.saddle);
    pony.saddle.cursed = true;
    game.flags.debug = true;
    const health = game.u.uhp;

    await runExtendedCommand('polyself', 'bat\n                ');

    assert.equal(game.u.usteed, null);
    assert.ok(level.monsters.includes(pony));
    assert.ok(game.u.ux !== pony.mx || game.u.uy !== pony.my);
    assert.equal(game.u.uhp, health);
});

void test('a medium humanoid form can stay on the same pony', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    game.flags.debug = true;

    await runExtendedCommand('polyself', 'vampire\n                ');

    assert.equal(game.u.usteed, pony);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
});

void test('dismounting leaves the pony in the bear trap without striking it again', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    const trap = addTrap(level, BEAR_TRAP, pony.mx, pony.my);
    game.u.utrap = 5;
    game.u.utraptype = TT_BEARTRAP;
    const health = pony.mhp;

    await runExtendedCommand('ride', ' ');

    assert.equal(game.u.usteed, null);
    assert.equal(game.u.utrap, 0);
    assert.equal(pony.mhp, health);
    assert.ok(level.monsters.includes(pony));
    assert.equal(trap.tseen, true);
});

void test('a mount becoming too small drops its saddle and throws the rider', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    const saddle = pony.saddle;
    assert.ok(saddle);
    const health = game.u.uhp;
    const messages: string[] = [];

    await changeMonsterForm(pony, nameToMonster('grid bug'), game, {
        showMessage: true,
        publish: async message => messages.push(message),
    });

    assert.equal(game.u.usteed, null);
    assert.ok(level.monsters.includes(pony));
    assert.ok(saddle != null);
    assert.equal(saddle.where, 'floor');
    assert.ok(game.u.uhp <= health - 10 && game.u.uhp >= health - 19);
    assert.ok((game.u._woundedLegTurns ?? 0) > 0);
    // C newcham() announces the new form before mon_break_armor() drops the saddle.
    assert.equal(messages[0], 'Your pony turns into a saddled grid bug!');
});

void test('a mount becoming a horse keeps its rider and saddle', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    const saddle = pony.saddle;
    assert.ok(saddle);
    const health = game.u.uhp;
    const messages: string[] = [];

    await changeMonsterForm(pony, nameToMonster('horse'), game, {
        publish: async message => messages.push(message),
    });

    assert.equal(game.u.usteed, pony);
    assert.equal(pony.saddle, saddle);
    assert.ok(saddle != null);
    assert.equal(saddle.where, 'minvent');
    assert.equal(game.u.uhp, health);
    assert.ok(messages.some(message => /adjust yourself.*new horse/.test(message)));
});

void test('removing a worn saddle makes the rider fall', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    const saddle = pony.saddle;
    assert.ok(saddle);
    const health = game.u.uhp;

    await removeObjectFromMonsterInventory(pony, saddle, game, {
        publish: async () => {},
    });

    assert.equal(game.u.usteed, null);
    assert.equal(pony.saddle, null);
    assert.ok(saddle != null);
    assert.equal(saddle.where, 'free');
    assert.ok(game.u.uhp < health);
});

for (const lifesaving of [false, true]) {
    void test(`environmental steed death ${lifesaving ? 'keeps a life-saved steed mounted' : 'dismounts without a saddle-removal accident'}`, async () => {
        freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
        requirePlayingGame(game);
        const steed = await createSaddledSteed();
        if (lifesaving)
            await equipMonsterObject(steed, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        await runExtendedCommand('ride', 'l');
        assert.equal(game.u.usteed, steed);
        const health = game.u.uhp;
        pushKeys(' '.repeat(100));

        const death = await finishEnvironmentalMonsterDeath(steed, game);

        assert.equal(death.survived, lifesaving);
        assert.equal(game.u.usteed, lifesaving ? steed : null);
        assert.equal(game.u.uhp, health, 'generic dismount has no riding-accident damage');
        assert.ok(!game.u._woundedLegSide);
        if (lifesaving) assert.ok(steed.mhp > 0);
        else {
            assert.notEqual(monsterAtPosition(requireGameLevel(), steed.mx, steed.my), steed);
            assert.ok(!steed.minvent.length);
        }
    });
}

void test('a hallucinating hero is told to find a designated driver', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await createSaddledSteed();
    game.u.hallucinationTurns = 20;

    await runExtendedCommand('ride', 'l');

    assert.equal(game._pending_message, 'Maybe you should find a designated driver.');
    assert.equal(game.u.usteed, undefined);
    assert.equal(game.context.move, 0);
});

void test('a hero with a wounded left leg cannot mount', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await createSaddledSteed();
    game.u._woundedLegTurns = 5;
    game.u._woundedLegSide = 'left';

    await runExtendedCommand('ride', 'l');

    assert.equal(game._pending_message, 'Your left leg is in no shape for riding.');
    assert.equal(game.u.usteed, undefined);
    assert.equal(game.context.move, 0);
});

void test('involuntary levitation keeps the hero from reaching the steed', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await createSaddledSteed();
    grantIntrinsicProperty('levitation', 'outside');

    await runExtendedCommand('ride', 'l');

    assert.equal(game._pending_message, 'You cannot reach the saddled pony.');
    assert.equal(game.u.usteed, undefined);
    assert.equal(game.context.move, 0);
});

void test('a hero levitating at will mounts and the steed floats up to them', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await createSaddledSteed();
    grantIntrinsicProperty('levitation', 'potion');

    await runExtendedCommand('ride', 'l');

    assert.equal(game._pending_message,
        'The saddled pony magically floats up!  You mount the saddled pony.');
    assert.equal(game.u.usteed !== null, true);
    assert.equal(game.context.move, 1);
});

void test('eroded metallic armor is too stiff to mount from', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await createSaddledSteed();
    const mail = await addInventoryObject(RING_MAIL);
    mail.oeroded = 1;
    game.uarm = game.u.uarm = mail;

    await runExtendedCommand('ride', 'l');

    assert.equal(game._pending_message,
        'Your rusty armor is too stiff to be able to mount the saddled pony.');
    assert.equal(game.u.usteed, undefined);
    assert.equal(game.context.move, 0);
});
