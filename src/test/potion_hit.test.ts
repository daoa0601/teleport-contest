import { roles } from '../js/roles.js';
import type { AttributeValues } from '../js/roles.js';
import type { Monster } from '../js/monster_types.js';
import type { InitializedHero } from '../js/hero_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { A_CON, A_DEX, A_INT, W_ARMF } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    POT_BOOZE, POT_CONFUSION, POT_FRUIT_JUICE, POT_FULL_HEALING,
    POT_GAIN_LEVEL, POT_HEALING, POT_RESTORE_ABILITY, POT_SICKNESS, TOWEL,
    LENSES, POT_BLINDNESS, POT_PARALYSIS, POT_SLEEPING, POT_SPEED,
    POT_INVISIBILITY, POT_WATER, SPEED_BOOTS,
} from '../js/object_data.js';
import {
    applySupportedPotionVapor, hitMonsterWithSupportedPotion,
} from '../js/potion_hit.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { pushKey, pushKeys } from '../js/input.js';
import { parseNethackrc } from '../js/options.js';
import { initRng } from '../js/rng.js';
import {
    addInventoryObject, artifactObject, knownObject,
} from './support/game-objects.js';
import {
    installHumanWerewolfHero, installPolymorphedHero, wearPolymorphControlRing,
} from './support/hero-state.js';
import { freshGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

const PM_ENERGY_VORTEX = 109;
const PM_PURPLE_WORM = 115;

async function potionObject(otyp: number) {
    return await knownObject(otyp, {
        initialize: false,
        dknown: true,
        typeKnown: true,
    });
}

type PotionTargetOptions = Partial<Pick<Monster,
    'mhp' | 'mcansee' | 'msleeping' | 'mconf' | 'mfrozen' | 'meating'
    | 'mstrategy' | 'mcanmove' | 'permspeed' | 'mspeed' | 'mblinded' | 'minvis'
    | 'perminvis' | 'invis_blkd' | 'mpeaceful' | 'minvent'>> & {
        hitPoints?: number; maxHitPoints?: number; level?: number;
    };

async function potionTarget(mnum: number, {
    hitPoints = 20,
    maxHitPoints = hitPoints,
    level,
    minvent = [],
    ...state
}: PotionTargetOptions = {}) {
    const monster = await createMonsterAt(mnum, 12, 10);
    monster.mhp = hitPoints;
    monster.mhpmax = maxHitPoints;
    if (level !== undefined) monster.m_lev = level;
    if (state.mhp !== undefined) monster.mhp = state.mhp;
    if (state.mcansee !== undefined) monster.mcansee = state.mcansee;
    if (state.msleeping !== undefined) monster.msleeping = state.msleeping;
    if (state.mconf !== undefined) monster.mconf = state.mconf;
    if (state.mfrozen !== undefined) monster.mfrozen = state.mfrozen;
    if (state.meating !== undefined) monster.meating = state.meating;
    if (state.mstrategy !== undefined) monster.mstrategy = state.mstrategy;
    if (state.mcanmove !== undefined) monster.mcanmove = state.mcanmove;
    if (state.permspeed !== undefined) monster.permspeed = state.permspeed;
    if (state.mspeed !== undefined) monster.mspeed = state.mspeed;
    if (state.mblinded !== undefined) monster.mblinded = state.mblinded;
    if (state.minvis !== undefined) monster.minvis = state.minvis;
    if (state.perminvis !== undefined) monster.perminvis = state.perminvis;
    if (state.invis_blkd !== undefined) monster.invis_blkd = state.invis_blkd;
    if (state.mpeaceful !== undefined) monster.mpeaceful = state.mpeaceful;
    for (const object of minvent)
        await addObjectToMonsterInventory(monster, object, game);
    return monster;
}

function freshPotionState(hero: Partial<InitializedHero> = { hallucinationTurns: 0 }) {
    freshGame({ hero });
    requirePlayingGame(game);
    initRng(1n);
}

function installDirectWereHero({ beast = false } = {}) {
    freshPlayableRoom({ role: 'archeologist', seed: 1n });
    requirePlayingGame(game);
    installHumanWerewolfHero({ beast });
}

void test('visible inert potion impact names a headed monster and evaporates',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, { hitPoints: 8 });
        const potion = await potionObject(POT_FRUIT_JUICE);
        const messages: string[] = [];

        initRng(2601n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, [
            'The jar crashes on the purple worm\'s head and breaks into shards.',
            'The potion of fruit juice evaporates.',
        ]);
        assert.equal(result?.impactDamage, 1);
        assert.equal(monster.mhp, 7);
        assert.equal(potion.where, 'gone');
        assert.deepEqual(potion.objectTimers, []);
    });

void test('an existing potion call name suppresses trycall and remains visible',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        game._knownObjectTypes = new Set();
        game._objectCallNames = { [POT_FRUIT_JUICE]: 'mystery' };
        const monster = await potionTarget(PM_PURPLE_WORM, { hitPoints: 8 });
        const potion = await potionObject(POT_FRUIT_JUICE);
        potion.typeKnown = false;
        const messages: string[] = [];

        initRng(2601n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });

        assert.match(messages[1] ?? '', /potion called mystery evaporates\.$/);
        assert.equal(result?.typeCall?.prompted, false);
        assert.equal(game._objectCallNames?.[POT_FRUIT_JUICE], 'mystery');
        assert.equal(potion.where, 'gone');
    });

void test('hallucinated inert potion impact names a visible headless monster',
    async () => {
        freshPotionState({ hallucinationTurns: 4 });
        requirePlayingGame(game);
        const monster = await potionTarget(PM_ENERGY_VORTEX, { hitPoints: 8 });
        setMonsterGivenName(monster, 'Named Headless Friend');
        const potion = await potionObject(POT_GAIN_LEVEL);
        const messages: string[] = [];

        initRng(2602n);
        await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        const impact = messages.find(message => message.includes('crashes on'));
        assert.ok(impact, 'A visible impact should name its hallucinated target');
        assert.match(impact, /^The .+ crashes on .+ and breaks into shards\.$/);
        assert.doesNotMatch(impact, /Named Headless Friend/);
        assert.doesNotMatch(impact, /(?:'s|s') (?:head|body|saddle) and breaks into shards/,
            'The actual headless anatomy must control impact location despite hallucination');
        assert.ok(messages.includes('The potion of gain level evaporates.'));
        assert.ok(monster.mhp === 7 || monster.mhp === 8,
            'An inert potion may cause one point of bottle damage, with no further damage');
        assert.equal(potion.where, 'gone');
    });

void test('healing potion makes Pestilence ill and retains hostile wake policy',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(312, {
            hitPoints: 40,
            mhp: 20,
            mcansee: 1,
            msleeping: 1,
        });
        const potion = await potionObject(POT_HEALING);
        const messages: string[] = [];

        initRng(2830n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The flagon crashes on Pestilence's head and breaks into shards.",
            'The potion of healing evaporates.',
            'Pestilence looks rather ill.',
        ]);
        assert.equal(monster.mhp, 9);
        assert.equal(result?.directEffect?.angered, true);
        assert.equal(potion.where, 'gone');
    });

void test('sickness halves a susceptible monster after the common impact chip',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, {
            hitPoints: 40,
            mhp: 20,
            msleeping: 1,
        });
        const potion = await potionObject(POT_SICKNESS);
        const messages: string[] = [];

        initRng(2860n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The bottle crashes on the purple worm's head and breaks into shards.",
            'The potion of sickness evaporates.',
            'The purple worm looks rather ill.',
        ]);
        assert.equal(monster.mhp, 9);
        assert.equal(result?.directEffect?.angered, true);
        assert.equal(potion.where, 'gone');
    });

void test('sickness leaves poison-resistant monsters unharmed after impact',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(1);
        const potion = await potionObject(POT_SICKNESS);
        const messages: string[] = [];

        initRng(2861n);
        await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
            wakeMonster: async () => {},
        });
        assert.deepEqual(messages, [
            "The carafe crashes on the killer bee's head and breaks into shards.",
            'The potion of sickness evaporates.',
            'The killer bee looks unharmed.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(potion.where, 'gone');
    });

void test('sickness heals Pestilence and clears sleep without anger', async () => {
    freshPotionState();
    requirePlayingGame(game);
    const monster = await potionTarget(312, {
        hitPoints: 40,
        mhp: 20,
        msleeping: 1,
    });
    const potion = await potionObject(POT_SICKNESS);
    const messages: string[] = [];

    initRng(2862n);
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: true,
        publish: async (message: string) => messages.push(message),
    });
    assert.deepEqual(messages, [
        "The phial crashes on Pestilence's head and breaks into shards.",
        'The potion of sickness evaporates.',
        'Pestilence looks sound and hale again.',
    ]);
    assert.equal(monster.mhp, 40);
    assert.equal(monster.msleeping, 0);
    assert.equal(result?.directEffect?.angered, false);
    assert.equal(potion.where, 'gone');
});

void test('confusion potion leaves a susceptible monster confused',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(1, {
            level: 1,
            mconf: 0,
        });
        const potion = await potionObject(POT_CONFUSION);
        const messages: string[] = [];

        initRng(2950n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The flagon crashes on the killer bee's head and breaks into shards.",
            'The potion of confusion evaporates.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(monster.mconf, 1);
        assert.equal(result?.directEffect?.resisted, false);
        assert.equal(potion.where, 'gone');
    });

void test('booze leaves a magic-resistant monster unconfused but hostile',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(312, {
            level: 30,
            mconf: 0,
        });
        const potion = await potionObject(POT_BOOZE);
        const messages: string[] = [];

        initRng(2951n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, [
            "The phial crashes on Pestilence's head and breaks into shards.",
            'The potion of booze evaporates.',
        ]);
        assert.equal(monster.mhp, 19);
        assert.equal(monster.mconf, 0);
        assert.equal(result?.directEffect?.resisted, true);
        assert.equal(result?.directEffect?.angered, true);
        assert.equal(potion.where, 'gone');
    });

void test('paralysis freezes a moving monster and clears its wait strategy',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(1, {
            mfrozen: 0,
            meating: 3,
            mstrategy: 0x20000020,
        });

        const potion = await potionObject(POT_PARALYSIS);
        initRng(3002n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async () => {},
        });
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 18);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0x20);
        assert.equal(result?.directEffect?.paralyzed, true);
    });

void test('paralysis does not reroll or replace an existing frozen duration',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(1, {
            mcanmove: 0,
            mfrozen: 9,
            meating: 2,
            mstrategy: 0x20000020,
        });

        const potion = await potionObject(POT_PARALYSIS);
        initRng(3003n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 9);
        assert.equal(monster.meating, 2);
        assert.equal(monster.mstrategy, 0x20000020);
        assert.equal(result?.directEffect?.paralyzed, false);
    });

void test('sleeping potion pays duration then resistance and freezes a target',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(1, {
            level: 1,
            mfrozen: 2,
            meating: 4,
            mstrategy: 0x20000020,
        });
        const messages: string[] = [];

        const potion = await potionObject(POT_SLEEPING);
        initRng(3050n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 9);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0x20000020);
        assert.equal(result?.directEffect?.slept, true);
        assert.equal(messages.at(-1), 'The killer bee falls asleep.');
    });

void test('sleep-resistant monster shields and remains awake',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_ENERGY_VORTEX, {
            level: 6,
            mfrozen: 0,
        });
        let shieldCount = 0;

        const potion = await potionObject(POT_SLEEPING);
        initRng(3051n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async () => {},
            wakeMonster: async () => {},
            showShield: async (target: Monster) => {
                shieldCount++;
                assert.equal(target, monster);
            },
        });
        assert.equal(monster.mcanmove, 1);
        assert.equal(monster.mfrozen, 0);
        assert.equal(shieldCount, 1);
        assert.equal(result?.directEffect?.resisted, true);
        assert.equal(result?.directEffect?.slept, false);
    });

void test('magic-resistant sleep target shields and remains awake',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(48, {
            level: 9,
            mfrozen: 0,
        });
        let shieldCount = 0;

        const potion = await potionObject(POT_SLEEPING);
        initRng(3050n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async () => {},
            wakeMonster: async () => {},
            showShield: async () => { shieldCount++; },
        });
        assert.equal(monster.mcanmove, 1);
        assert.equal(monster.mfrozen, 0);
        assert.equal(shieldCount, 1);
        assert.equal(result?.directEffect?.resisted, true);
        assert.equal(result?.directEffect?.slept, false);
    });

void test('successful sleeping potion releases a non-engulfing monster grip',
    async () => {
        freshPotionState({
            hallucinationTurns: 0,
            uswallow: 0,
        });
        requirePlayingGame(game);
        const monster = await potionTarget(1, {
            level: 1,
            mfrozen: 0,
        });
        game.u.ustuck = monster;
        const messages: string[] = [];

        const potion = await potionObject(POT_SLEEPING);
        initRng(3050n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(result?.directEffect?.slept, true);
        assert.equal(game.u.ustuck, null);
        assert.deepEqual(messages.slice(-2), [
            'The killer bee falls asleep.',
            "The killer bee's grip relaxes.",
        ]);
    });

void test('speed potion makes an active normal-speed monster permanently fast',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, {
            mfrozen: 0,
            permspeed: 0,
            mspeed: 0,
        });
        const messages: string[] = [];

        const potion = await potionObject(POT_SPEED);
        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            targetSpotted: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(monster.permspeed, 2);
        assert.equal(monster.mspeed, 2);
        assert.equal(result?.directEffect?.angered, false);
        assert.deepEqual(messages.slice(-1), [
            'The purple worm is suddenly moving faster.',
        ]);
    });

void test('worn speed boots keep effective speed fast while potion removes slow',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, {
            mfrozen: 0,
            permspeed: 1,
            mspeed: 2,
            minvent: [await knownObject(SPEED_BOOTS, {
                initialize: false,
                owornmask: W_ARMF,
            })],
        });
        const messages: string[] = [];

        const potion = await potionObject(POT_SPEED);
        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            targetSpotted: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(monster.permspeed, 0);
        assert.equal(monster.mspeed, 2);
        assert.equal(result?.directEffect?.speedChanged, false);
        assert.deepEqual(messages.slice(-1), [
            'The potion of speed evaporates.',
        ]);
    });

void test('speed potion silently wakes a sleeping monster without hostile wakeup',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, {
            msleeping: 1,
            mfrozen: 0,
            permspeed: 0,
            mspeed: 0,
        });
        const messages: string[] = [];

        const potion = await potionObject(POT_SPEED);
        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            targetSpotted: true,
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(monster.msleeping, 0);
        assert.equal(monster.mspeed, 2);
        assert.equal(result?.directEffect?.speedMessage, null);
        assert.deepEqual(messages.slice(-1), [
            'The potion of speed evaporates.',
        ]);
    });

void test('a resistant monster remains sighted after blindness impact',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(1, {
            level: 1,
            mblinded: 10,
        });

        const potion = await potionObject(POT_BLINDNESS);
        initRng(3202n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });
        assert.equal(monster.mcansee, 0);
        assert.equal(monster.mblinded, 98);
        assert.equal(result?.directEffect?.resisted, false);
        assert.equal(result?.directEffect?.blindnessAdded, 88);
    });

void test('resisted blindness excludes only the second already-consumed duration',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(48, {
            level: 9,
            mblinded: 5,
        });

        const potion = await potionObject(POT_BLINDNESS);
        initRng(3210n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: false,
            publish: async () => {},
            wakeMonster: async () => {},
        });
        assert.equal(monster.mcansee, 0);
        assert.equal(monster.mblinded, 70);
        assert.equal(result?.directEffect?.resisted, true);
        assert.equal(result?.directEffect?.blindnessAdded, 65);
    });

void test('eyeless and permanently blind monsters retain their sight state',
    async () => {
        for (const [mnum, mcansee, mblinded] of [
            [PM_ENERGY_VORTEX, 1, 0],
            [1, 0, 0],
        ] satisfies [number, 0 | 1, number][]) {
            freshPotionState();
            requirePlayingGame(game);
            const monster = await potionTarget(mnum, { mcansee, mblinded });
            const potion = await potionObject(POT_BLINDNESS);
            initRng(3202n);
            const result = await hitMonsterWithSupportedPotion({
                state: game,
                monster,
                potion,
                targetVisible: false,
                publish: async () => {},
                wakeMonster: async () => {},
            });
            assert.equal(result?.directEffect?.blinded, false);
        }
    });

void test('uncursed invisibility hides a spotted monster without anger',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, {
            minvis: 0,
            perminvis: 0,
            invis_blkd: 0,
            msleeping: 1,
        });
        const messages: string[] = [];

        const potion = await potionObject(POT_INVISIBILITY);
        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            spotMonster: (target: Monster) => !target.minvis,
            repaintMonster: async () => {},
            rememberInvisible: async () => {},
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(monster.perminvis, 1);
        assert.equal(monster.minvis, 1);
        assert.equal(monster.msleeping, 0);
        assert.equal(result?.directEffect?.angered, false);
        assert.deepEqual(messages, [
            "The jar crashes on the purple worm's head and breaks into shards.",
            'The potion of invisibility evaporates.',
        ]);
    });

void test('cursed invisibility reveals an unseen invisible monster and angers it',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, {
            minvis: 1,
            perminvis: 1,
            invis_blkd: 0,
            msleeping: 1,
        });
        const potion = await potionObject(POT_INVISIBILITY);
        potion.cursed = true;
        const messages: string[] = [];

        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            spotMonster: (target: Monster) => !target.minvis,
            repaintMonster: async () => {},
            rememberInvisible: async () => {},
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(monster.perminvis, 0);
        assert.equal(monster.minvis, 0);
        assert.equal(result?.directEffect?.angered, true);
        assert.deepEqual(messages.slice(-1), ['The purple worm appears!']);
    });

void test('cursed invisibility uses sensor-spotted transparency presentation',
    async () => {
        freshPotionState();
        requirePlayingGame(game);
        const monster = await potionTarget(PM_PURPLE_WORM, {
            minvis: 1,
            perminvis: 1,
            invis_blkd: 0,
        });
        const potion = await potionObject(POT_INVISIBILITY);
        potion.cursed = true;
        const messages: string[] = [];

        initRng(3200n);
        const result = await hitMonsterWithSupportedPotion({
            state: game,
            monster,
            potion,
            targetVisible: true,
            spotMonster: () => true,
            repaintMonster: async () => {},
            rememberInvisible: async () => {},
            publish: async (message: string) => messages.push(message),
        });
        assert.equal(monster.minvis, 0);
        assert.equal(result?.directEffect?.angered, true);
        assert.deepEqual(messages.slice(-1), [
            'The purple worm briefly seems to be transparent.',
        ]);
    });

void test('blocked invisibility changes only the permanent property', async () => {
    freshPotionState();
    requirePlayingGame(game);
    const monster = await potionTarget(PM_PURPLE_WORM, {
        minvis: 0,
        perminvis: 0,
        invis_blkd: 1,
        msleeping: 1,
    });

    const potion = await potionObject(POT_INVISIBILITY);
    initRng(3200n);
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: true,
        spotMonster: () => true,
        repaintMonster: async () => {},
        rememberInvisible: async () => {},
        publish: async () => {},
    });
    assert.equal(monster.perminvis, 1);
    assert.equal(monster.minvis, 0);
    assert.equal(monster.msleeping, 0);
    assert.equal(result?.directEffect?.angered, false);
});

void test('zero-level player monsters defend with the hero level', async () => {
    freshPotionState({ hallucinationTurns: 0, ulevel: 20 });
    requirePlayingGame(game);
    const monster = await potionTarget(343, {
        level: 0,
        mconf: 0,
    });
    const potion = await potionObject(POT_CONFUSION);

    initRng(3004n);
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: false,
        publish: async () => {},
        wakeMonster: async () => {},
    });
    assert.equal(monster.mhp, 20);
    assert.equal(monster.mconf, 0);
    assert.equal(result?.directEffect?.resisted, true);
    assert.equal(potion.where, 'gone');
});

void test('ability potion heals a peaceful monster without angering it', async () => {
    freshPotionState();
    requirePlayingGame(game);
    const monster = await potionTarget(PM_PURPLE_WORM, {
        hitPoints: 12,
        mhp: 3,
        msleeping: 1,
        mpeaceful: 1,
    });
    const potion = await potionObject(POT_RESTORE_ABILITY);
    const messages: string[] = [];

    initRng(2831n);
    const result = await hitMonsterWithSupportedPotion({
        state: game,
        monster,
        potion,
        targetVisible: true,
        publish: async (message: string) => messages.push(message),
    });
    assert.deepEqual(messages, [
        "The jar crashes on the purple worm's head and breaks into shards.",
        'The potion of restore ability evaporates.',
        'The purple worm looks sound and hale again.',
    ]);
    assert.equal(monster.mhp, 12);
    assert.equal(monster.msleeping, 0);
    assert.equal(monster.mpeaceful, 1);
    assert.equal(result?.directEffect?.angered, false);
    assert.equal(potion.where, 'gone');
});

void test('uncursed restore-ability vapor repairs only the first reduced attribute',
    async () => {
        const current: AttributeValues = [12, 12, 12, 12, 12, 12];
        current[A_INT] = 10;
        current[A_CON] = 8;
        freshPotionState({
            acurr: { a: current },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        });
        requirePlayingGame(game);
        const potion = await potionObject(POT_RESTORE_ABILITY);

        initRng(2845n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => {},
        });
        assert.equal(result?.abilityStart, A_CON);
        assert.equal(game.u.acurr.a[A_INT], 10);
        assert.equal(game.u.acurr.a[A_CON], 9);
    });

void test('full-healing vapor heals both HP pools without exercising a temporary body',
    async () => {
        freshPotionState({
            uhp: 20,
            uhpmax: 30,
            blindTurns: 4,
            deafTurns: 5,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        });
        requirePlayingGame(game);
        installPolymorphedHero('wolf', { turns: 10, hitPoints: 1, maxHitPoints: 10 });
        const potion = await potionObject(POT_FULL_HEALING);
        potion.cursed = true;

        initRng(2847n);
        await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => {},
        });
        assert.equal(game.u.mh, 4);
        assert.equal(game.u.uhp, 23);
        assert.equal(game.u.blindTurns, 0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(game.u._exercise, undefined);
    });

void test('sickness vapor damages a temporary form without exercising Constitution',
    async () => {
        freshPotionState({
            uhp: 30,
            uhpmax: 30,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        });
        requirePlayingGame(game);
        installPolymorphedHero('wolf', { turns: 10, hitPoints: 12, maxHitPoints: 20 });
        const role = roles.find(role => role.key === 'tourist');
        assert.ok(role);
        game.urole = role;

        const potion = await potionObject(POT_SICKNESS);
        initRng(2864n);
        await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => {},
        });
        assert.equal(game.u.mh, 7);
        assert.equal(game.u.uhp, 30);
        assert.equal(game.u._exercise, undefined);
    });

void test('Healer role is immune to sickness vapor', async () => {
    freshPotionState({
        uhp: 12,
        uhpmax: 30,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    });
    requirePlayingGame(game);
    const role = roles.find(role => role.key === 'healer');
    assert.ok(role);
    game.urole = role;

    const potion = await potionObject(POT_SICKNESS);
    initRng(2864n);
    const result = await applySupportedPotionVapor({
        state: game,
        potion,
        publish: async () => {},
    });
    assert.equal(result?.received, true);
    assert.equal(game.u.uhp, 12);
    assert.equal(game.u._exercise, undefined);
});

void test('sickness vapor cannot reduce base HP below one', async () => {
    freshPotionState({
        uhp: 4,
        uhpmax: 30,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    });
    requirePlayingGame(game);
    const role = roles.find(role => role.key === 'tourist');
    assert.ok(role);
    game.urole = role;

    const potion = await potionObject(POT_SICKNESS);
    initRng(2864n);
    await applySupportedPotionVapor({
        state: game,
        potion,
        publish: async () => {},
    });
    assert.equal(game.u.uhp, 1);
    assert.equal(game.u._exercise?.[A_CON], -1);
});

void test('confusion vapor announces and increments a clear hero timeout',
    async () => {
        freshPotionState({ confusionTurns: 0 });
        requirePlayingGame(game);
        const messages: string[] = [];

        const potion = await potionObject(POT_CONFUSION);
        initRng(2954n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, ['You feel somewhat dizzy.']);
        assert.equal(game.u.confusionTurns, 3);
        assert.equal(result?.confusionDuration, 3);
    });

void test('booze vapor silently extends and caps an existing confusion timeout',
    async () => {
        freshPotionState({ confusionTurns: 0x00fffffe });
        requirePlayingGame(game);
        const messages: string[] = [];

        const potion = await potionObject(POT_BOOZE);
        initRng(2957n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, []);
        assert.equal(game.u.confusionTurns, 0x00ffffff);
        assert.equal(result?.confusionDuration, 4);
    });

void test('paralysis vapor installs live helpless state and Dexterity exercise',
    async () => {
        freshPotionState({
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        });
        requirePlayingGame(game);
        const messages: string[] = [];

        const potion = await potionObject(POT_PARALYSIS);
        initRng(3011n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, ['Something seems to be holding you.']);
        assert.equal(game._helplessTurns, 5);
        assert.equal(game._helplessReason, 'frozen by a potion');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.equal(game.u._exercise?.[A_DEX], -1);
        assert.equal(result?.helplessDuration, 5);
    });

void test('paralysis vapor identifies an unknown type instead of asking to call it',
    async () => {
        freshPotionState({
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        });
        requirePlayingGame(game);
        game._knownObjectTypes = new Set();
        game._encounteredObjectTypes = new Set();
        game._objectDiscoveryOrder = [];
        game._objectCallNames = {};
        const potion = await potionObject(POT_PARALYSIS);
        potion.typeKnown = false;
        const messages: string[] = [];

        initRng(3011n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
        });

        assert.deepEqual(messages, ['Something seems to be holding you.']);
        assert.equal(result?.identifiesType, true);
        assert.equal(result?.typeCall?.prompted, false);
        assert.equal(game._knownObjectTypes.has(POT_PARALYSIS), true);
        assert.equal(game._encounteredObjectTypes.has(POT_PARALYSIS), true);
        assert.equal(game._objectCallNames?.[POT_PARALYSIS], undefined);
    });

void test('free action converts paralysis vapor into a momentary stiffen',
    async () => {
        freshPotionState({ freeAction: true });
        requirePlayingGame(game);
        const messages: string[] = [];

        const potion = await potionObject(POT_PARALYSIS);
        initRng(3002n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, ['You stiffen momentarily.']);
        assert.equal(game._helplessTurns, undefined);
        assert.equal(result?.resisted, true);
    });

void test('sleeping vapor installs its distinct helpless reason', async () => {
    freshPotionState({
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    });
    requirePlayingGame(game);
    const messages: string[] = [];

    const potion = await potionObject(POT_SLEEPING);
    initRng(3001n);
    const result = await applySupportedPotionVapor({
        state: game,
        potion,
        publish: async (message: string) => messages.push(message),
    });
    assert.deepEqual(messages, ['You feel rather tired.']);
    assert.equal(game._helplessTurns, 5);
    assert.equal(game._helplessReason, 'sleeping off a magical draught');
    assert.equal(game._helplessDoneMessage, 'You can move again.');
    assert.equal(game.u._exercise?.[A_DEX], 0);
    assert.equal(result?.helplessDuration, 5);
});

void test('sleep resistance teaches only eligible observers on the yawn path',
    async () => {
        freshPotionState({
            ux: 10, uy: 10, sleepResistance: true,
        });
        requirePlayingGame(game);
        const awakeObserver = await createMonsterAt('killer bee', 11, 10);
        awakeObserver.mhp = awakeObserver.mhpmax = 4;
        awakeObserver.seen_resistance = 1;
        const deadObserver = await createMonsterAt('killer bee', 12, 10);
        deadObserver.mhp = 0;
        deadObserver.mhpmax = 4;
        deadObserver.seen_resistance = 2;
        const messages: string[] = [];

        const potion = await potionObject(POT_SLEEPING);
        initRng(3001n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
            monsterCanSeeHero: (monster: Monster) => monster.mhp > 0,
        });
        assert.deepEqual(messages, ['You yawn.']);
        assert.equal(game._helplessTurns, undefined);
        assert.equal(awakeObserver.seen_resistance, 0x0009);
        assert.equal(deadObserver.seen_resistance, 2);
        assert.equal(result?.resisted, true);
    });

void test('speed vapor installs timed very-fast movement and exercises Dexterity',
    async () => {
        freshPotionState({
            fast: false,
            veryFast: false,
            veryFastTurns: 0,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        });
        requirePlayingGame(game);
        const messages: string[] = [];

        const potion = await potionObject(POT_SPEED);
        initRng(3220n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, ['Your knees seem more flexible now.']);
        assert.equal(game.u.veryFast, true);
        assert.equal(game.u.veryFastTurns, 1);
        assert.equal(game.u._exercise?.[A_DEX], 1);
        assert.equal(result?.speedDuration, 1);
    });

void test('existing intrinsic speed suppresses prose but not duration or exercise',
    async () => {
        freshPotionState({
            fast: true,
            veryFast: false,
            veryFastTurns: 3,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            amax: { a: [12, 12, 12, 12, 12, 12] },
        });
        requirePlayingGame(game);
        const messages: string[] = [];

        const potion = await potionObject(POT_SPEED);
        initRng(3220n);
        await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
        });
        assert.deepEqual(messages, []);
        assert.equal(game.u.veryFast, true);
        assert.equal(game.u.veryFastTurns, 4);
        assert.equal(game.u._exercise?.[A_DEX], 1);
    });

void test('speed vapor saturates the timed very-fast counter', async () => {
    freshPotionState({
        fast: true,
        veryFast: true,
        veryFastTurns: 0x00fffffe,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    });
    requirePlayingGame(game);

    const potion = await potionObject(POT_SPEED);
    initRng(3222n);
    await applySupportedPotionVapor({
        state: game,
        potion,
        publish: async () => {},
    });
    assert.equal(game.u.veryFastTurns, 0x00ffffff);
    assert.equal(game.u._exercise?.[A_DEX], 1);
});

void test('blindness vapor darkens sight immediately and extends the live timeout',
    async () => {
        freshPotionState({ blindTurns: 0 });
        requirePlayingGame(game);
        game.blind = false;
        const messages: string[] = [];

        const potion = await potionObject(POT_BLINDNESS);
        initRng(3222n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
            recalculateVision: () => {},
        });
        assert.deepEqual(messages, ['It suddenly gets dark.']);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, true);
        assert.equal(game.vision_full_recalc, 1);
        assert.equal(result?.blindnessDuration, 4);
        assert.equal(result?.sightToggled, true);
    });

void test('Eyes-blocked blindness vapor brackets the timeout with vision prose',
    async () => {
        freshPotionState({ blindTurns: 0 });
        requirePlayingGame(game);
        game.ublindf = await artifactObject('The Eyes of the Overworld');
        const messages: string[] = [];

        const potion = await potionObject(POT_BLINDNESS);
        initRng(3222n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async (message: string) => messages.push(message),
            recalculateVision: () => {},
        });
        assert.deepEqual(messages, [
            'It suddenly gets dark.', 'Your vision clears.',
        ]);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, false);
        assert.equal(result?.sightToggled, false);
    });

void test('blindness vapor saturates an already-blind timeout without repaint',
    async () => {
        freshPotionState({ blindTurns: 0x00fffffe });
        requirePlayingGame(game);
        game.blind = true;

        const potion = await potionObject(POT_BLINDNESS);
        initRng(3222n);
        const result = await applySupportedPotionVapor({
            state: game,
            potion,
            publish: async () => assert.fail('active blindness announced'),
            recalculateVision: () => {},
        });
        assert.equal(game.u.blindTurns, 0x00ffffff);
        assert.equal(game.blind, true);
        assert.equal(result?.sightToggled, false);
    });

void test('invisibility vapor reports only the clear visible-self glimpse',
    async () => {
        const cases = [
            {
                hero: {},
                messages: ["For an instant you couldn't see yourself!"],
                glimpse: 'unseen',
            },
            {
                hero: { seeInvisible: true },
                messages: ['For an instant you could see right through yourself!'],
                glimpse: 'transparent',
            },
            { hero: { blindTurns: 1 }, messages: [], glimpse: null },
            { hero: { invisibleTurns: 1 }, messages: [], glimpse: null },
        ];

        for (const witness of cases) {
            freshPotionState(witness.hero);
            requirePlayingGame(game);
            const messages: string[] = [];
            const potion = await potionObject(POT_INVISIBILITY);
            initRng(3200n);
            const result = await applySupportedPotionVapor({
                state: game,
                potion,
                publish: async (message: string) => messages.push(message),
            });
            assert.deepEqual(messages, witness.messages);
            assert.equal(result?.invisibilityGlimpse, witness.glimpse);
        }
    });

void test('water vapor leaves an ordinary non-lycanthrope hero unchanged',
    async () => {
    freshPotionState({ uhp: 7, uhpmax: 12 });
    requirePlayingGame(game);
    const messages: string[] = [];

    const potion = await potionObject(POT_WATER);
    initRng(3400n);
    const result = await applySupportedPotionVapor({
        state: game,
        potion,
        publish: async (message: string) => messages.push(message),
    });
    assert.deepEqual(messages, []);
    assert.equal(game.u.uhp, 7);
    assert.equal(result?.received, true);
    assert.deepEqual(result?.waterEffect, {
        kind: 'ordinary', changed: false,
    });
});

void test('blessed water vapor returns a werewolf hero to human form', async () => {
    installDirectWereHero({ beast: true });
    requirePlayingGame(game);
    const potion = await potionObject(POT_WATER);
    potion.blessed = true;
    const messages: string[] = [];

    initRng(3401n);
    const result = await applySupportedPotionVapor({
        state: game,
        potion,
        publish: async (message: string) => messages.push(message),
    });
    assert.deepEqual(messages, ['You return to human form!']);
    assert.equal(result?.waterEffect?.kind, 'rehumanized');
    assert.equal(result?.waterEffect?.changed, true);
    assert.equal(game.u.umonnum, 331);
    assert.equal(game.u.mtimedone, 0);
    assert.equal(game.u.mh, 0);
    assert.equal(game.u.mhmax, 0);
});

void test('controlled cursed vapor accepts change despite a nearby threat',
    async () => {
        installDirectWereHero();
        requirePlayingGame(game);
        await wearPolymorphControlRing();
        game.u.detectMonsters = true;
        await createMonsterAt('purple worm', 11, 10);
        const potion = await potionObject(POT_WATER);
        potion.cursed = true;

        pushKey('y');
        initRng(3410n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });

        assert.equal(result?.waterEffect?.kind, 'transformed');
        assert.equal(game.u.umonnum, 21);
        assert.equal(game.u.uconduct?.polyselfs, 1);
    });

void test('controlled cursed vapor rejection preserves the human form',
    async () => {
        installDirectWereHero();
        requirePlayingGame(game);
        await wearPolymorphControlRing();
        const potion = await potionObject(POT_WATER);
        potion.cursed = true;

        pushKey('n');
        initRng(3411n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result?.waterEffect?.kind, 'declined');
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.were_changes ?? 0, 0);
        assert.equal(game.u.uconduct?.polyselfs ?? 0, 0);
    });

void test('controlled blessed vapor keeps or leaves beast form by answer polarity',
    async () => {
        for (const witness of [
            { answer: 'y', kind: 'remained', mnum: 21, messages: [] },
            {
                answer: 'n', kind: 'rehumanized', mnum: 331,
                messages: ['You return to human form!'],
            },
        ]) {
            installDirectWereHero({ beast: true });
            requirePlayingGame(game);
            await wearPolymorphControlRing();
            const potion = await potionObject(POT_WATER);
            potion.blessed = true;
            const messages: string[] = [];

            pushKey(witness.answer);
            initRng(3412n);
            const result = await applySupportedPotionVapor({
                state: game,
                potion,
                publish: async (message: string) => messages.push(message),
            });
            assert.equal(result?.waterEffect?.kind, witness.kind);
            assert.equal(game.u.umonnum, witness.mnum);
            assert.deepEqual(messages, witness.messages);
        }
    });

void test('a nearby threat blocks controlled blessed vapor before prompting',
    async () => {
        installDirectWereHero({ beast: true });
        requirePlayingGame(game);
        await wearPolymorphControlRing();
        game.u.mtimedone = 0;
        game.u.detectMonsters = true;
        await createMonsterAt('purple worm', 11, 10);
        const potion = await potionObject(POT_WATER);
        potion.blessed = true;

        initRng(3414n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result?.waterEffect?.kind, 'duration-restored');
        assert.equal(game.u.umonnum, 21);
        assert.ok(game.u.mtimedone >= 200 && game.u.mtimedone <= 399);
    });

void test('were-change paranoia rejects y but accepts a committed yes line',
    async () => {
        const outcomes = [
            { keys: ['y', '\n'], kind: 'declined', mnum: 331 },
            { keys: ['y', 'e', 's', '\n'], kind: 'transformed', mnum: 21 },
        ];
        for (const witness of outcomes) {
            installDirectWereHero();
            requirePlayingGame(game);
            await wearPolymorphControlRing();
            game.flags = {
                ...game.flags,
                ...parseNethackrc(
                    'OPTIONS=paranoid_confirmation:Were-change',
                ).flags,
            };
            const potion = await potionObject(POT_WATER);
            potion.cursed = true;

            pushKeys(witness.keys);
            initRng(3413n);
            const result = await applySupportedPotionVapor({
                state: game, potion, publish: async () => {},
            });

            assert.equal(result?.waterEffect?.kind, witness.kind);
            assert.equal(game.u.umonnum, witness.mnum);
        }
    });

void test('global paranoia rejects a short n and repeats until committed no',
    async () => {
        installDirectWereHero();
        requirePlayingGame(game);
        await wearPolymorphControlRing();
        game.flags = {
            ...game.flags,
            ...parseNethackrc(
                'OPTIONS=paranoid_confirmation:Confirm Were-change',
            ).flags,
        };
        const potion = await potionObject(POT_WATER);
        potion.cursed = true;

        pushKeys(['n', '\n', 'n', 'o', '\n']);
        initRng(3415n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result?.waterEffect?.kind, 'declined');
        assert.equal(game.u.umonnum, 331);
    });

void test('a spotted adjacent threat suppresses cursed-water were change',
    async () => {
        installDirectWereHero();
        requirePlayingGame(game);
        game.u.detectMonsters = true;
        await createMonsterAt('purple worm', 11, 10);
        const potion = await potionObject(POT_WATER);
        potion.cursed = true;

        initRng(3402n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result?.waterEffect?.kind, 'blocked');
        assert.equal(result?.waterEffect?.changed, false);
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.u.mtimedone, 0);
        assert.equal(game.u.uconduct?.polyselfs ?? 0, 0);
    });

void test('Unchanging restores a zero were-form duration instead of rehumanizing',
    async () => {
        installDirectWereHero({ beast: true });
        requirePlayingGame(game);
        game.u.mtimedone = 0;
        game.u.unchanging = true;
        const potion = await potionObject(POT_WATER);
        potion.blessed = true;

        initRng(3403n);
        const result = await applySupportedPotionVapor({
            state: game, potion, publish: async () => {},
        });
        assert.equal(result?.waterEffect?.kind, 'duration-restored');
        assert.ok(game.u.mtimedone >= 200 && game.u.mtimedone <= 399);
        assert.equal(game.u.umonnum, 21);
    });

void test('vapor respects breathless forms with and without eyes', async () => {
    freshPotionState({
        umonnum: 109,
        uhp: 10,
        uhpmax: 20,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        amax: { a: [12, 12, 12, 12, 12, 12] },
    });
    requirePlayingGame(game);
    const healing = await potionObject(POT_FULL_HEALING);
    const silentMessages: string[] = [];
    const blocked = await applySupportedPotionVapor({
        state: game,
        potion: healing,
        publish: async (message: string) => silentMessages.push(message),
    });

    assert.equal(blocked?.received, false);
    assert.equal(game.u.uhp, 10);
    assert.deepEqual(silentMessages, []);

    game.u.umonnum = 29;
    const restore = await potionObject(POT_RESTORE_ABILITY);
    restore.cursed = true;
    const eyeMessages: string[] = [];
    const received = await applySupportedPotionVapor({
        state: game,
        potion: restore,
        publish: async (message: string) => eyeMessages.push(message),
    });

    assert.equal(received?.received, true);
    assert.deepEqual(eyeMessages, ['Your eyes sting!']);

    game.u.umonnum = game.u.umonster;
    game.ublindf = await knownObject(TOWEL, { spe: 1 });
    const shieldedMessages: string[] = [];
    const shielded = await applySupportedPotionVapor({
        state: game,
        potion: healing,
        publish: async (message: string) => shieldedMessages.push(message),
    });

    assert.equal(shielded?.shielded, true);
    assert.equal(game.u.uhp, 10);
    assert.deepEqual(shieldedMessages,
        ['Some vapor passes harmlessly around you.']);
});
