import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { MessagePublisher } from './display.js';
// Monster anger, alarm sounds, and peaceful bystander reactions.
// C refs: mon.c setmangry(), wakeup(), peacefuls_respond(), angry_guards(),
// and wizard.c aggravate().

import { adjustHeroAlignment } from './alignment.js';
import {
    M_AP_MONSTER, M_AP_NOTHING, M_AP_TYPE, PLNMSG_GROWL, STRAT_APPEARMSG,
    STRAT_WAITFORU, STRAT_WAITMASK,
} from './const.js';
import {
    canSeeMonster, canSpotMonster, newsym, plineWithContinuation,
} from './display.js';
import { insideWizardTower } from './dungeon.js';
import { deleteEngravingAt, hasCompletedEngraving } from './engrave.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { formatHeardMessage } from './hero_speech.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { makeMonsterFlee } from './monster_flee.js';
import { publishMonsterWake, wakeMonstersNearWithMessages } from './monster_wake.js';
import { monsterName } from './monster_name.js';
import { stopRun } from './runmode.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';

import { revealMonsterAppearance } from './monster_appearance.js';
import { finishMonsterEating } from './monster_eating.js';
import {
    MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SOUND,
    MONSTER_SYMBOL, monsterGrowthFamilyMatch, monsterTypeName,
} from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { ghodHitsu, priestIsCoaligned, templeRoomAt } from './priest.js';
import { rn2, rnd } from './rng.js';
import { hotPursuitShopkeeper } from './shop_damage.js';
import { couldsee } from './vision.js';
import { monsterIsScaredAt } from './monster_fear.js';

const M1_MINDLESS = 0x00010000;
const M1_HUMANOID = 0x00020000;
const M1_SEE_INVIS = 0x01000000;

const MS_BARK = 1;
const MS_MEW = 2;
const MS_ROAR = 3;
const MS_GROWL = 5;
const MS_SQEEK = 6;
const MS_SQAWK = 7;
const MS_WAIL = 14;
const MS_HUMANOID = 25;
const MS_CUSS = 34;
const MS_GUARDIAN = 38;
const MS_PRIEST = 41;

const HALLUCINATED_GROWL_VERBS = [
    'beep', 'boing', 'sing', 'belche', 'creak', 'cough',
    'rattle', 'ululate', 'pop', 'jingle', 'sniffle', 'tinkle',
    'eep', 'clatter', 'hum', 'sizzle', 'twitter', 'wheeze',
    'rustle', 'honk', 'lisp', 'yodel', 'coo', 'burp', 'moo',
    'boom', 'murmur', 'oink', 'quack', 'rumble', 'twang',
    'toot', 'gargle', 'hoot', 'warble',
];

const MONSTER_GROWL_VERBS = new Map([
    [1, 'growl'], [2, 'hiss'], [3, 'roar'], [4, 'bellow'],
    [5, 'growl'], [6, 'squeal'], [7, 'screech'], [9, 'hiss'],
    [10, 'buzz'], [12, 'neigh'], [13, 'low'], [14, 'wail'],
    [44, 'groan'],
]);

const HUMANOID_GASP_SOUNDS = new Set([
    22, // MS_IMITATE
    25, // MS_HUMANOID
    26, // MS_ARREST
    27, // MS_SOLDIER
    28, // MS_GUARD
    30, // MS_NURSE
    31, // MS_SEDUCE
    36, // MS_LEADER
    38, // MS_GUARDIAN
    39, // MS_SELL
    40, // MS_ORACLE
    41, // MS_PRIEST
    43, // MS_BOAST
]);

const CONDITIONAL_GASP_SOUNDS = new Set([
    3,  // MS_ROAR
    4,  // MS_BELLOW
    11, // MS_GRUNT
    20, // MS_LAUGH
    23, // MS_WERE
    24, // MS_ORC
    29, // MS_DJINNI
    32, // MS_VAMPIRE
    42, // MS_SPELL
]);

const HUMANOID_GASP_EXCLAMATIONS = [
    'Gasp!', 'Uh-oh.', 'Oh my!', 'What?', 'Why?',
];

const WATCH_NAMES = new Set(['watchman', 'watch captain']);

export function aggravateMonsters(state: GameState = game, random = rn2): Monster[] {
    const heroInsideTower = insideWizardTower(
        state.u?.ux, state.u?.uy, state,
    );
    const awakened = [];

    for (const monster of state.level?.monsters || []) {
        if (!monster || monster.dead || (monster.mhp ?? 1) <= 0) continue;
        if (insideWizardTower(monster.mx, monster.my, state)
            !== heroInsideTower) continue;

        const wasSleeping = !!monster.msleeping;
        const wasWaiting = !!((monster.mstrategy ?? 0)
            & (STRAT_WAITFORU | STRAT_APPEARMSG));
        monster.mstrategy = (monster.mstrategy ?? 0)
            & ~(STRAT_WAITFORU | STRAT_APPEARMSG);
        monster.msleeping = 0;
        let unfroze = false;
        if (monster.mcanmove === 0 && random(5) === 0) {
            monster.mfrozen = 0;
            monster.mcanmove = 1;
            unfroze = true;
        }
        if (wasSleeping || wasWaiting || unfroze) awakened.push(monster);
    }
    return awakened;
}

export function isWatch(monster: Monster): boolean {
    return WATCH_NAMES.has(MONSTER_NAME[monster?.mnum] || '');
}

function thirdPersonSoundVerb(verb: string) {
    return /(?:s|sh|ch|x|z)$/.test(verb) ? `${verb}es` : `${verb}s`;
}

export async function publishMonsterYelp(monster: Monster) {
    const sound = MONSTER_SOUND[monster.mnum];
    if (monster.msleeping || !monster.mcanmove || !sound) return;

    const deaf = heroIsDeaf();
    const ordinaryVerb = new Map([
        [MS_BARK, deaf ? 'recoil' : 'yelp'],
        [MS_MEW, deaf ? 'arch' : 'yowl'],
        [MS_ROAR, deaf ? 'bluff' : 'snarl'],
        [MS_GROWL, deaf ? 'recoil' : 'yelp'],
        [MS_SQEEK, deaf ? 'quiver' : 'squeal'],
        [MS_SQAWK, deaf ? 'thrash' : 'screak'],
        [MS_WAIL, deaf ? 'cringe' : 'wail'],
    ]).get(sound);
    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : ordinaryVerb;
    if (!verb) return;

    await plineWithContinuation(
        `${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}!`,
    );
    if (game.context.run) stopRun();
    await wakeMonstersNearWithMessages(
        monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 12,
    );
}

export async function publishMonsterWhimper(monster: Monster) {
    const sound = MONSTER_SOUND[monster.mnum];
    if (monster.msleeping || !monster.mcanmove || !sound) return;
    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : sound === MS_MEW || sound === MS_GROWL ? 'whimper'
            : sound === MS_BARK ? 'whine' : sound === MS_SQEEK ? 'squeal' : null;
    if (!verb) return;
    await plineWithContinuation(`${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}.`);
    if (game.context.run) stopRun();
    await wakeMonstersNearWithMessages(monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 6);
}

export async function publishMonsterGrowl(monster: Monster) {
    const sound = MONSTER_SOUND[monster.mnum];
    if (monster.msleeping || !monster.mcanmove || !sound)
        return game._lastPlineKind === PLNMSG_GROWL;

    const verb = heroIsHallucinating()
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : MONSTER_GROWL_VERBS.get(sound) || 'scream';
    if (!verb) throw new Error('Missing hallucinated growl verb.');
    const noticed = canSeeMonster(monster) || !heroIsDeaf();
    if (noticed) {
        await plineWithContinuation(
            `${monsterName(monster, { capitalized: true })} ${thirdPersonSoundVerb(verb)}!`,
        );
        game._lastPlineKind = PLNMSG_GROWL;
        if (game.context.run) stopRun();
    }
    await wakeMonstersNearWithMessages(
        monster.mx, monster.my, (MONSTER_LEVEL[monster.mnum] ?? 0) * 18,
    );
    return game._lastPlineKind === PLNMSG_GROWL;
}

function maybeHumanoidGasp(observer: Monster) {
    requirePlayingGame(game);
    let sound = MONSTER_SOUND[observer.mnum] ?? 0;
    if ((sound === MS_GUARDIAN && observer.mnum !== game.urole.guardnum)
        || (sound === MS_PRIEST && !priestIsCoaligned(observer))) return null;
    const minion = observer.emin || observer.mextra?.emin;
    if (sound === MS_CUSS && minion
        && (priestIsCoaligned(observer) ? !minion.renegade : minion.renegade)) {
        sound = MS_HUMANOID;
    }
    if (CONDITIONAL_GASP_SOUNDS.has(sound)) {
        if (MONSTER_SYMBOL[observer.mnum] !== MONSTER_SYMBOL[game.u.umonnum])
            return null;
    } else if (!HUMANOID_GASP_SOUNDS.has(sound)) {
        return null;
    }

    const exclamation = HUMANOID_GASP_EXCLAMATIONS[rn2(
        HUMANOID_GASP_EXCLAMATIONS.length,
    )];
    const name = monsterName(observer, { capitalized: true });
    return exclamation === 'Gasp!'
        ? { text: `${name} gasps`, needsPeriod: true }
        : { text: `${name} exclaims "${exclamation}"`, needsPeriod: false };
}

async function reactHumanoidBystander(observer: Monster, attackedSpecies: number) {
    requirePlayingGame(game);
    if (isWatch(observer)) {
        await plineWithContinuation('"Halt!  You\'re under arrest!"');
        await angerWatchGuards(heroIsDeaf(game));
        return;
    }

    let exclaimed = false;
    let message = '';
    let needsPeriod = false;
    if (!heroIsDeaf(game) && rn2(5) === 0) {
        const gasp = maybeHumanoidGasp(observer);
        if (gasp) {
            message = gasp.text;
            needsPeriod = gasp.needsPeriod;
            exclaimed = true;
        }
    }

    if (observer.isshk || observer.ispriest
        || (observer.mnum === game.urole.ldrnum
            && attackedSpecies !== game.urole.guardnum)) {
        if (exclaimed) await plineWithContinuation(`${message} then shrugs.`);
        return;
    }

    if ((MONSTER_LEVEL[observer.mnum] ?? 0) < rn2(10)
        && observer.mnum !== game.urole.guardnum) {
        const alreadyFleeing = !!(observer.mflee || observer.mfleetim);
        await makeMonsterFlee(observer, {
            turns: rn2(50) + 25, first: true, announce: !exclaimed,
        });
        if (exclaimed && game.flags?.verbose !== false && !alreadyFleeing) {
            message += ' and then turns to flee.';
            needsPeriod = false;
        } else if (!exclaimed) {
            exclaimed = true;
        }
    }

    if (message) {
        await plineWithContinuation(
            `${message}${needsPeriod ? '.' : ''}`,
        );
    }
    if ((observer.mtame ?? 0) > 0) return;

    observer.mpeaceful = 0;
    observer.mstrategy = (observer.mstrategy ?? 0) & ~STRAT_WAITMASK;
    adjustHeroAlignment(-1);
    if (!exclaimed) {
        await plineWithContinuation(
            `${monsterName(observer, { capitalized: true })} gets angry!`,
        );
    }
}

export async function angerWatchGuards(silent: boolean, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<boolean> {
    requireLiveGame(state);
    let count = 0;
    let adjacentCount = 0;
    let seenCount = 0;
    let sleepingCount = 0;

    for (const guard of Array.from(state.level?.monsters || []).reverse()) {
        if (!guard || guard.dead || (guard.mhp ?? 1) <= 0
            || !guard.mpeaceful || !isWatch(guard)) continue;
        count++;
        if (canSpotMonster(guard) && guard.mcanmove !== 0) {
            const dx = Math.abs((guard.mx ?? 0) - (state.u?.ux ?? 0));
            const dy = Math.abs((guard.my ?? 0) - (state.u?.uy ?? 0));
            if (dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0))
                adjacentCount++;
            else seenCount++;
        }
        if (guard.msleeping || (guard.mfrozen ?? 0) > 0) {
            sleepingCount++;
            guard.msleeping = 0;
            guard.mfrozen = 0;
        }
        guard.mpeaceful = 0;
    }

    if (!count || silent) return count > 0;
    if (sleepingCount) {
        await publish(sleepingCount === 1
            ? 'The guard wakes up.' : 'The guards wake up.');
    }
    if (adjacentCount) {
        await publish(adjacentCount === 1
            ? 'The guard gets angry!' : 'The guards get angry!');
    } else if (seenCount) {
        await publish(seenCount === 1
            ? 'An angry guard is approaching!'
            : 'Angry guards are approaching!');
    } else {
        const message = formatHeardMessage(count === 1
            ? "the shrill sound of a guard's whistle."
            : "the shrill sound of guards' whistles.", state);
        if (message) await publish(message);
    }
    return true;
}

async function reactPeacefulBystanders(attackedMonster: Monster) {
    if (!attackedMonster || game.context?.mon_moving
        || game.underwater || game.u?.uinwater) return;
    const heroInvisible = heroIsInvisible(game);
    const attackedSpecies = attackedMonster.mnum;

    const monsters = Array.from(game.level?.monsters || []).reverse();
    for (const observer of monsters) {
        const flags = MONSTER_FLAGS1[observer?.mnum] ?? 0;
        if (!observer || observer === attackedMonster || observer.dead
            || (observer.mhp ?? 1) <= 0 || !observer.mpeaceful
            || observer.msleeping
            || observer.mcansee === 0 || observer.mcansee === false
            || (flags & M1_MINDLESS)
            || !couldsee(observer.mx, observer.my)) continue;
        if (heroInvisible && !(flags & M1_SEE_INVIS)) continue;

        if ((flags & M1_HUMANOID) || observer.isshk || observer.ispriest) {
            await reactHumanoidBystander(observer, attackedSpecies);
            continue;
        }
        if (!monsterGrowthFamilyMatch(
            attackedMonster.mnum, observer.mnum,
        )) continue;
        if (rn2(3) !== 0) continue;

        let exclaimed = false;
        if (rn2(4) === 0)
            exclaimed = await publishMonsterGrowl(observer);
        if (rn2(6) === 0) continue;

        const alreadyFleeing = !!(observer.mflee || observer.mfleetim);
        await makeMonsterFlee(observer, {
            turns: rn2(25) + 15, first: true, announce: !exclaimed,
        });
        if (exclaimed && !alreadyFleeing)
            await plineWithContinuation('And then starts to flee.');
    }
}

async function angerQuestGuardiansAfterAttack(monster: Monster) {
    requirePlayingGame(game);
    if (monster.mnum !== game.urole?.ldrnum) return;
    const guardians = (game.level?.monsters || []).filter(candidate =>
        !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mnum === game.urole?.guardnum
        && candidate.mpeaceful);
    for (const guardian of guardians) guardian.mpeaceful = 0;

    const visibleCount = guardians.filter(guardian =>
        canSpotMonster(guardian)).length;
    if (!visibleCount || heroIsHallucinating()) return;
    let name = monsterTypeName(game.urole.guardnum);
    if (visibleCount > 1) name = makePlural(name);
    const verb = visibleCount > 1 ? 'appear' : 'appears';
    await plineWithContinuation(
        `The ${name} ${verb} to be angry too...`,
    );
}

export async function angerQuestGuardiansAfterLeaderDeath() {
    for (const guardian of Array.from(game.level?.monsters || []).reverse()) {
        if (!guardian.dead && (guardian.mhp ?? 1) > 0
            && guardian.mnum === game.urole?.guardnum
            && guardian.mpeaceful) {
            await angerMonster(guardian, { attacked: true });
        }
    }
}

export async function angerMonster(monster: Monster | null, { attacked = false }: { attacked?: boolean } = {}): Promise<void> {
    if (!monster) return;
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    if (attacked && hasCompletedEngraving('Elbereth', ux, uy)
        && (monsterIsScaredAt(monster, game, ux, uy) || monster.mpeaceful)) {
        await plineWithContinuation('You feel like a hypocrite.');
        adjustHeroAlignment(game.u.ualign.record > 5 ? -5 : -rnd(5));
        if (!heroIsBlind())
            await plineWithContinuation('The engraving beneath you fades.');
        deleteEngravingAt(ux, uy);
    }

    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!monster.mpeaceful || (monster.mtame ?? 0) > 0) return;

    monster.mpeaceful = 0;
    adjustHeroAlignment(monster.ispriest
        ? (priestIsCoaligned(monster, game) ? -5 : 2)
        : -1);
    const humanoid = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID)
        || monster.isshk || monster.isgd;
    if (humanoid) {
        if (couldsee(monster.mx, monster.my)) {
            await plineWithContinuation(
                `${monsterName(monster, { capitalized: true })} gets angry!`,
            );
        }
    } else {
        await publishMonsterGrowl(monster);
    }

    await angerQuestGuardiansAfterAttack(monster);
    await reactPeacefulBystanders(monster);
}

export function angerAttackedMonster(monster: Monster | null) {
    return angerMonster(monster, { attacked: true });
}

export async function wakeMonster(monster: Monster | null, { attacked = false }: { attacked?: boolean } = {}): Promise<{ heroDied: boolean }> {
    if (!monster) return { heroDied: false };
    const wasSleeping = !!monster.msleeping;
    await publishMonsterWake(monster, attacked);
    monster.msleeping = 0;
    const appearance = M_AP_TYPE(monster);
    if (appearance !== M_AP_NOTHING) {
        if (appearance !== M_AP_MONSTER) revealMonsterAppearance(monster);
    } else if (game.context.forcefight && !game.context.mon_moving
        && monster.mundetected) {
        monster.mundetected = 0;
        newsym(monster.mx, monster.my);
    }
    finishMonsterEating(monster);
    if (!attacked) return { heroDied: false };
    requirePlayingGame(game);
    const wasPeaceful = !!monster.mpeaceful;
    if (wasSleeping) await publishMonsterGrowl(monster);
    await angerMonster(monster, { attacked: true });
    if (wasPeaceful && monster.ispriest
        && templeRoomAt(game, monster.mx, monster.my)) {
        const retaliation = await ghodHitsu(monster);
        if (retaliation.heroDied) return retaliation;
    }
    if (wasPeaceful && monster.isshk && !game.u.ushops.length)
        hotPursuitShopkeeper(monster);
    return { heroDied: false };
}

export function wakeAttackedMonster(monster: Monster | null) {
    return wakeMonster(monster, { attacked: true });
}
