import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { addExperience, adjustLevelAbilities, awardMonsterExperience, checkExperienceLevel, gainExperienceLevel, loseHeroExperience, monsterExperience, newExperienceThreshold, randomExperience, } from '../js/exper.js';
import { A_CON, A_WIS, SINK } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { nameToMonster } from '../js/mondata.js';
import { initRng } from '../js/rng.js';
import { races } from '../js/roles.js';
import { freshGame } from './support/game-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { pushKeys } from '../js/input.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING } from '../js/object_data.js';
import { heroIsPolymorphed } from '../js/polyself.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { runExtendedCommand } from './support/commands.js';
const experienceTarget = (species, state = {}) => ({
    mnum: nameToMonster(species),
    m_lev: 0,
    ...state,
});
void test('experience includes source attack bonuses for early hostiles', () => {
    assert.equal(monsterExperience(experienceTarget('kobold')), 6);
    assert.equal(monsterExperience(experienceTarget('grid bug')), 1);
    assert.equal(monsterExperience(experienceTarget('jackal')), 1);
    assert.equal(monsterExperience(experienceTarget('lichen')), 4);
});
void test('revived monster awards use the source repeated-kill bands', () => {
    assert.equal(monsterExperience(experienceTarget('kobold', { mrevived: 1 }), {
        killCount: 20,
    }), 6);
    assert.equal(monsterExperience(experienceTarget('kobold', { mrevived: 1 }), {
        killCount: 21,
    }), 3);
});
void test('awarding experience adds four times as much score', () => {
    freshGame({ hero: { uexp: 2, urexp: 8 } });
    requireFixtureGame(game);
    assert.equal(awardMonsterExperience(experienceTarget('lichen')), 4);
    assert.equal(game.u.uexp, 6);
    assert.equal(game.u.urexp, 24);
});
void test('a gained level retains the HP and power that losing it removes', async () => {
    const attributes = [10, 10, 10, 10, 10, 10];
    attributes[A_CON] = 14;
    attributes[A_WIS] = 12;
    freshObjectRoom({
        flags: { female: false },
        hero: {
            ulevel: 1, ulevelmax: 1,
            uhp: 10, uhpmax: 10, uhppeak: 10,
            uen: 5, uenmax: 5, uenpeak: 5,
            uexp: 19,
            acurr: { a: attributes },
        },
    });
    requireFixtureGame(game);
    game.urole = { ...game.urole,
        key: 'archeologist', name: { m: 'Archeologist', f: 'Archeologist' }, xlev: 10,
        title: [{ m: 'Digger', f: 'Digger' }],
        hpadv: { ...game.urole.hpadv, lofix: 2, lornd: 0 },
        enadv: { ...game.urole.enadv, lofix: 1, lornd: 0 },
    };
    game.urace = { ...game.urace,
        hpadv: { ...game.urace.hpadv, lofix: 0, lornd: 0 },
        enadv: { ...game.urace.enadv, lofix: 0, lornd: 0 },
    };
    initRng(712n);
    pushKeys(' '.repeat(30));
    await gainExperienceLevel();
    const hpGain = game.u.uhpinc[1];
    const powerGain = game.u.ueninc[1];
    assert.equal(game.u.ulevel, 2);
    assert.ok(hpGain !== null && hpGain !== undefined);
    assert.equal(game.u.uhpmax, 10 + hpGain);
    assert.ok(powerGain !== null && powerGain !== undefined);
    assert.equal(game.u.uenmax, 5 + powerGain);
    pushKeys(' '.repeat(30));
    await loseHeroExperience();
    assert.equal(game.u.ulevel, 1);
    assert.equal(game.u.uhpmax, 10);
    assert.equal(game.u.uenmax, 5);
});
void test('losexp removes the exact retained level HP and power increments', async () => {
    freshObjectRoom({ hero: {
            ulevel: 20, uhp: 10, uhpmax: 99, uen: 213, uenmax: 213,
            uexp: newExperienceThreshold(19),
            uhpinc: Array.from({ length: 30 }, () => 0), ueninc: Array.from({ length: 30 }, () => 0),
        } });
    requireFixtureGame(game);
    game.u.uhpinc[19] = 2;
    game.u.ueninc[19] = 14;
    pushKeys(' '.repeat(30));
    await loseHeroExperience();
    assert.deepEqual({
        level: game.u.ulevel,
        hp: game.u.uhp, hpmax: game.u.uhpmax,
        energy: game.u.uen, energymax: game.u.uenmax,
        experience: game.u.uexp,
    }, {
        level: 19, hp: 8, hpmax: 97, energy: 199, energymax: 199,
        experience: newExperienceThreshold(19) - 1,
    });
});
void test('losexp preserves the source maximum-HP floor', async () => {
    freshObjectRoom({ hero: {
            ulevel: 2, uhp: 3, uhpmax: 12, uen: 4, uenmax: 4,
            uexp: 40, uhpinc: [0, 9], ueninc: [0, 6],
        } });
    requireFixtureGame(game);
    pushKeys(' '.repeat(30));
    await loseHeroExperience();
    assert.deepEqual([
        game.u.ulevel, game.u.uhp, game.u.uhpmax,
        game.u.uen, game.u.uenmax,
    ], [1, 1, 10, 0, 0]);
});
void test('level drain applies the HP floor before subtracting the lost level health', async () => {
    freshObjectRoom({ hero: {
            ulevel: 2, uhp: 20, uhpmax: 20,
            uhpinc: [0, 11],
        } });
    requireFixtureGame(game);
    await loseHeroExperience(null, { publish: async () => undefined });
    assert.equal(game.u.ulevel, 1);
    assert.equal(game.u.uhpmax, 10);
    assert.equal(game.u.uhp, 1);
});
for (const lifesaving of [false, true]) {
    void test(`named level-one drain ${lifesaving ? 'resumes HP and power loss after life saving' : 'is fatal before HP and power loss'}`, async () => {
        freshObjectRoom({ hero: {
                ulevel: 1, uhp: 100, uhpmax: 100, uen: 20, uenmax: 20,
                uexp: 5, uhpinc: [0, 2], ueninc: [0, 3],
            } });
        requireFixtureGame(game);
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        const died = await loseHeroExperience('life drainage');
        assert.equal(died, !lifesaving);
        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(game.u.ulevel, 1);
        assert.equal(game.u.uexp, lifesaving ? 0 : 5);
        assert.equal(game.u.uhpmax, lifesaving ? 98 : 100);
        assert.equal(game.u.uenmax, lifesaving ? 17 : 20);
        if (lifesaving)
            assert.equal(game.u.uhp, 98);
        else
            assert.equal(game._deathKiller, 'life drainage');
    });
}
void test('unnamed level-one loss clears experience without killing a healthy hero', async () => {
    freshObjectRoom({ hero: { ulevel: 1, uhp: 20, uhpmax: 20, uexp: 5 } });
    requireFixtureGame(game);
    pushKeys(' '.repeat(30));
    const died = await loseHeroExperience();
    assert.equal(died, false);
    assert.equal(game.u.ulevel, 1);
    assert.equal(game.u.uexp, 0);
    assert.equal(game.u.uhp, 20);
});
for (const wielded of [false, true]) {
    void test(`Stormbringer ${wielded ? 'defends its wielder from level drain' : 'does not defend a hero merely carrying it'}`, async () => {
        freshObjectRoom({ role: 'wizard', hero: {
                ulevel: 4, uhp: 30, uhpmax: 30, uexp: 100,
                ualign: { type: -1, record: 0 },
            } });
        requireFixtureGame(game);
        const artifact = artifactByName('Stormbringer');
        assert.ok(artifact !== null && artifact !== undefined);
        const sword = await addInventoryObject(artifact.baseType);
        nameArtifact(sword, artifact);
        if (wielded)
            await setPrimaryWeapon(sword);
        pushKeys(' '.repeat(30));
        const died = await loseHeroExperience('life drainage');
        assert.equal(died, false);
        assert.equal(game.u.ulevel, wielded ? 4 : 3);
    });
}
for (const unchanging of [false, true]) {
    void test(`level drain destroying a monster form ${unchanging ? 'can kill an unchanging hero' : 'returns the hero to human form'}`, async () => {
        freshObjectRoom({ hero: { ulevel: 4, uhp: 30, uhpmax: 30, uexp: 100 } });
        requireFixtureGame(game);
        installPolymorphedHero('giant ant', { hitPoints: 1, maxHitPoints: 20 });
        if (unchanging)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_UNCHANGING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);
        const died = await loseHeroExperience('life drainage');
        assert.equal(died, unchanging);
        assert.equal(game.u.ulevel, 3);
        if (unchanging)
            assert.equal(game._deathKiller, 'killed while stuck in creature form');
        else {
            assert.equal(heroIsPolymorphed(game), false);
            assert.equal(game.u.uhp, 30);
        }
    });
}
void test('losing an elven experience ability also loses its resistance', async () => {
    const elf = races.find(race => race.name === 'elf');
    assert.ok(elf);
    freshObjectRoom({
        role: 'wizard', race: elf,
        hero: { ulevel: 4, uhp: 30, uhpmax: 30 },
    });
    requireFixtureGame(game);
    pushKeys(' '.repeat(30));
    await adjustLevelAbilities(3, 4);
    assert.equal(game.u.sleepResistance, true);
    await loseHeroExperience();
    assert.equal(game.u.ulevel, 3);
    assert.equal(game.u.sleepResistance, false);
});
void test('wizard level reduction uses the full loss owner even with drain resistance', async () => {
    freshObjectRoom({ flags: { debug: true, verbose: true }, hero: {
            ulevel: 4, ulevelmax: 4, uhp: 30, uhpmax: 30,
            uhpinc: [0, 1, 2, 3], uen: 20, uenmax: 20,
            ueninc: [0, 1, 2, 3],
        } });
    requireFixtureGame(game);
    installPolymorphedHero('vampire', { hitPoints: 100 });
    await loseHeroExperience('life drainage');
    assert.equal(game.u.ulevel, 4, 'ordinary drain cannot affect this form');
    await runExtendedCommand('levelchange', '2\n' + ' '.repeat(50));
    assert.equal(game.u.ulevel, 2);
    assert.equal(game.u.ulevelmax, 2);
    assert.equal(game.u.uhpmax, 25);
    assert.equal(game.u.uenmax, 15);
});
void test('level drain lowers both monster HP values and the hidden human HP', async () => {
    for (const seed of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]) {
        freshObjectRoom({ hero: {
                ulevel: 4, uhp: 30, uhpmax: 30, uhpinc: [0, 0, 0, 2],
            } });
        requireFixtureGame(game);
        installPolymorphedHero('giant ant', { hitPoints: 100 });
        pushKeys(' '.repeat(30));
        initRng(seed);
        await loseHeroExperience();
        assert.equal(game.u.uhp, 28);
        assert.equal(game.u.uhpmax, 28);
        assert.equal(game.u.mh, game.u.mhmax);
        assert.ok(game.u.mh >= 96 && game.u.mh < 100, 'an ordinary hero monster body loses one to four HP per level');
    }
});
void test('a form resistance does not hide permanent ability gain or loss feedback', async () => {
    freshObjectRoom({ role: 'monk', hero: { ulevel: 11, uhp: 40, uhpmax: 40 } });
    requireFixtureGame(game);
    installPolymorphedHero('fire ant', { hitPoints: 40 });
    assert.equal(game.u.fireResistance, true);
    const messages = [];
    const publish = async (message) => messages.push(message);
    await adjustLevelAbilities(10, 11, publish);
    await loseHeroExperience(null, { publish });
    assert.ok(messages.includes('You feel cool!'));
    assert.ok(messages.includes('You feel warmer!'));
    assert.equal(game.u.fireResistance, true, 'the monster body still supplies resistance');
    assert.equal(game.u.ulevel, 10);
});
void test('one large experience award gains one level and keeps only that level range', async () => {
    freshObjectRoom({ hero: { ulevel: 1, uexp: 0, urexp: 0 } });
    requireFixtureGame(game);
    const messages = [];
    addExperience(1000);
    await checkExperienceLevel({ publish: async (message) => messages.push(message) });
    assert.equal(game.u.ulevel, 2);
    assert.equal(game.u.uexp, 39);
    assert.equal(game.u.urexp, 4000);
    assert.ok(!messages.includes('You feel more experienced.'));
    assert.ok(messages.includes('Welcome to experience level 2.'));
    assert.ok(gameLogEvents().some(event => event.text === 'gained experience level 2'));
});
void test('gaining a level heals the monster body without increasing its maximum HP', async () => {
    freshObjectRoom({ hero: { ulevel: 4, uhp: 30, uhpmax: 30 } });
    requireFixtureGame(game);
    installPolymorphedHero('giant ant', { hitPoints: 9, maxHitPoints: 10 });
    pushKeys(' '.repeat(30));
    await gainExperienceLevel();
    assert.equal(game.u.mh, 10);
    assert.equal(game.u.mhmax, 10);
    assert.ok(game.u.uhp > 30);
    assert.equal(game.u.uhp, game.u.uhpmax);
    assert.equal(game.u.ulevel, 5);
});
void test('extra levels at the maximum give capped health and power but no new level', async () => {
    const attributes = [18, 18, 18, 18, 18, 18];
    freshObjectRoom({ role: 'wizard', hero: {
            ulevel: 30, uhp: 1190, uhpmax: 1200, uen: 590, uenmax: 600,
            uexp: 170000000, acurr: { a: attributes },
        } });
    requireFixtureGame(game);
    const messages = [];
    await gainExperienceLevel({ publish: async (message) => messages.push(message) });
    assert.equal(game.u.ulevel, 30);
    assert.equal(game.u.uexp, 170000000);
    assert.equal(game.u.uhp, 1191);
    assert.equal(game.u.uhpmax, 1201);
    assert.equal(game.u.uen, 591);
    assert.equal(game.u.uenmax, 601);
    assert.ok(messages.includes('You feel more experienced.'));
    assert.ok(!messages.some(message => message.startsWith('Welcome')));
    assert.equal(gameLogEvents().length, 0);
});
void test('a new rank is logged once and regaining it logs the experience level', async () => {
    freshObjectRoom({ role: 'archeologist', hero: { ulevel: 2 } });
    const messages = [];
    const publish = async (message) => messages.push(message);
    await gainExperienceLevel({ publish });
    await loseHeroExperience(null, { publish });
    await gainExperienceLevel({ publish });
    const log = gameLogEvents().map(event => event.text);
    assert.equal(log.filter(text => text === 'attained the rank of Field Worker (level 3)').length, 1);
    assert.ok(!log.includes('gained experience level 3'));
    assert.ok(log.includes('regained experience level 3'));
    assert.ok(messages.includes('Welcome back to experience level 3.'));
});
void test('the complete gain owner grants the new role ability and its feedback', async () => {
    freshObjectRoom({ role: 'caveman', hero: { ulevel: 6 } });
    requireFixtureGame(game);
    assert.ok(!game.u.fast);
    const messages = [];
    await gainExperienceLevel({ publish: async (message) => messages.push(message) });
    assert.equal(game.u.ulevel, 7);
    assert.equal(game.u.fast, true);
    assert.ok(messages.includes('You feel quick!'));
});
void test('awful sink water awards score and checks the next experience level', async () => {
    const level = freshObjectRoom({ hero: { ulevel: 1, uexp: 19, urexp: 0 } });
    requireFixtureGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = SINK;
    pushKeys('y' + ' '.repeat(40));
    initRng(16n);
    await rhack('q'.charCodeAt(0));
    assert.equal(game.u.ulevel, 2);
    assert.equal(game.u.uexp, 20);
    assert.equal(game.u.urexp, 4);
});
void test('maximum-level random experience gains add to existing experience', () => {
    freshObjectRoom({ hero: { ulevel: 30, uexp: 170000000 } });
    initRng(1n);
    const gained = randomExperience({ gaining: true });
    const replacement = randomExperience();
    assert.ok(gained >= 170000000 && gained < 180000000);
    assert.ok(replacement >= 100000000 && replacement < 110000000);
});
//# sourceMappingURL=exper.test.js.map