// Monster anger, alarm sounds, and peaceful bystander reactions.
// C refs: mon.c setmangry(), wakeup(), peacefuls_respond(), angry_guards(),
// and wizard.c aggravate().

import { adjustHeroAlignment } from './alignment.js';
import {
    M_AP_MONSTER, STRAT_APPEARMSG, STRAT_WAITFORU, STRAT_WAITMASK,
} from './const.js';
import {
    canSpotMonster, plineWithContinuation, randomDisplayMonsterSubject,
} from './display.js';
import { insideWizardTower } from './dungeon.js';
import { game } from './gstate.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { nameToMonster } from './mondata.js';
import {
    MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_NAME, MONSTER_SOUND,
    MONSTER_SYMBOL, monsterGrowthFamilyMatch, monsterTypeName,
} from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { priestIsCoaligned, visiblePriestName } from './priest.js';
import { rn2 } from './rng.js';
import { shopkeeperName } from './shk.js';
import { couldsee } from './vision.js';

const M1_MINDLESS = 0x00010000;
const M1_HUMANOID = 0x00020000;
const M1_SEE_INVIS = 0x01000000;
const PM_FLESH_GOLEM = 255;
const PM_GHOST = 287;

const MS_BARK = 1;
const MS_MEW = 2;
const MS_ROAR = 3;
const MS_GROWL = 5;
const MS_SQEEK = 6;
const MS_SQAWK = 7;
const MS_WAIL = 14;

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

export function aggravateMonsters(state = game, random = rn2) {
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

function monsterDisplayName(monster) {
    if (monster?.name && monster.mnum === PM_GHOST) {
        const possessiveName = /s$/i.test(monster.name)
            ? `${monster.name}'`
            : `${monster.name}'s`;
        return `${possessiveName} ghost`;
    }
    return monster?.name
        || monsterTypeName(monster?.mnum, !!monster?.female);
}

function isWatch(monster) {
    return WATCH_NAMES.has(MONSTER_NAME[monster?.mnum] || '');
}

function thirdPersonSoundVerb(verb) {
    return /(?:s|sh|ch|x|z)$/.test(verb) ? `${verb}es` : `${verb}s`;
}

function monsterMessageSubject(monster) {
    if (monster.name) return monster.name;
    const article = monster.mtame > 0 ? 'Your' : 'The';
    return `${article} ${monsterDisplayName(monster)}`;
}

export async function publishKickedPetYelp(monster, sound) {
    const helpless = monster.msleeping || monster.mcanmove === 0
        || (monster.mfrozen ?? 0) > 0;
    if (helpless || !sound) return;

    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
    const deaf = !!(game.deaf || game.u?.deaf);
    const ordinaryVerb = new Map([
        [MS_BARK, deaf ? 'recoil' : 'yelp'],
        [MS_MEW, deaf ? 'arch' : 'yowl'],
        [MS_ROAR, deaf ? 'bluff' : 'snarl'],
        [MS_GROWL, deaf ? 'recoil' : 'yelp'],
        [MS_SQEEK, deaf ? 'quiver' : 'squeal'],
        [MS_SQAWK, deaf ? 'thrash' : 'screak'],
        [MS_WAIL, deaf ? 'cringe' : 'wail'],
    ]).get(sound);
    const verb = hallucinating
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : ordinaryVerb;
    if (!verb) return;

    const subject = !canSpotMonster(monster)
        ? 'It'
        : hallucinating
            ? randomDisplayMonsterSubject()
            : monsterMessageSubject(monster);
    await plineWithContinuation(
        `${subject} ${thirdPersonSoundVerb(verb)}!`,
    );
    await wakeMonstersNearWithMessages(
        monster.mx, monster.my,
        (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0) * 12,
    );
}

export async function publishMonsterGrowl(monster) {
    const helpless = monster.msleeping || monster.mcanmove === 0
        || (monster.mfrozen ?? 0) > 0;
    const sound = MONSTER_SOUND[monster.mnum] ?? 0;
    if (helpless || !sound) return false;

    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
    const verb = hallucinating
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : MONSTER_GROWL_VERBS.get(sound) || 'scream';
    const spotted = canSpotMonster(monster);
    const subject = !spotted
        ? 'It'
        : hallucinating
            ? randomDisplayMonsterSubject()
            : monsterMessageSubject(monster);
    const noticed = spotted || !(game.deaf || game.u?.deaf);
    if (noticed) {
        await plineWithContinuation(
            `${subject} ${thirdPersonSoundVerb(verb)}!`,
        );
    }
    await wakeMonstersNearWithMessages(
        monster.mx, monster.my,
        (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0) * 18,
    );
    return noticed;
}

function observerDisplayName(observer) {
    if (observer.isshk && observer.eshk) return shopkeeperName(observer);
    if (observer.ispriest) return visiblePriestName(observer, game);
    return observer.name || `The ${monsterDisplayName(observer)}`;
}

function canUseGenericHumanoidReaction(observer) {
    if (isWatch(observer) || observer.isshk || observer.ispriest
        || observer.mnum === game.urole?.ldrnum
        || observer.mnum === game.urole?.guardnum) return false;
    return !!((MONSTER_FLAGS1[observer.mnum] ?? 0) & M1_HUMANOID);
}

function maybeHumanoidGasp(observer) {
    const sound = MONSTER_SOUND[observer.mnum] ?? 0;
    if (CONDITIONAL_GASP_SOUNDS.has(sound)) {
        const currentForm = (game.u?.mtimedone ?? 0) > 0
            && Number.isInteger(game.u?.umonnum)
            ? game.u.umonnum
            : nameToMonster(game.urace?.name || 'human');
        if (MONSTER_SYMBOL[observer.mnum] !== MONSTER_SYMBOL[currentForm])
            return null;
    } else if (!HUMANOID_GASP_SOUNDS.has(sound)) {
        return null;
    }

    const exclamation = HUMANOID_GASP_EXCLAMATIONS[rn2(
        HUMANOID_GASP_EXCLAMATIONS.length,
    )];
    const name = observerDisplayName(observer);
    return exclamation === 'Gasp!'
        ? { text: `${name} gasps`, needsPeriod: true }
        : { text: `${name} exclaims "${exclamation}"`, needsPeriod: false };
}

async function reactGenericHumanoid(observer) {
    if (!canUseGenericHumanoidReaction(observer)) return false;

    let exclaimed = false;
    let message = '';
    let needsPeriod = false;
    if (!game.deaf && !game.u?.deaf && rn2(5) === 0) {
        const gasp = maybeHumanoidGasp(observer);
        if (gasp) {
            message = gasp.text;
            needsPeriod = gasp.needsPeriod;
            exclaimed = true;
        }
    }

    const monsterLevel = observer.m_lev ?? MONSTER_LEVEL[observer.mnum] ?? 0;
    if (monsterLevel < rn2(10)) {
        const alreadyFleeing = !!(observer.mflee || observer.mfleetim);
        const fleeTime = rn2(50) + 25;
        if (!observer.mflee) {
            observer.mfleetim = Math.min(
                127, fleeTime + (observer.mfleetim ?? 0),
            );
            observer.mflee = 1;
            if (!exclaimed) {
                await plineWithContinuation(
                    `${observerDisplayName(observer)} turns to flee.`,
                );
            }
        }
        observer._track = [];
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
    if ((observer.mtame ?? 0) > 0) return true;

    observer.mpeaceful = 0;
    observer.mstrategy = (observer.mstrategy ?? 0) & ~STRAT_WAITMASK;
    adjustHeroAlignment(-1);
    if (!exclaimed) {
        await plineWithContinuation(
            `${observerDisplayName(observer)} gets angry!`,
        );
    }
    return true;
}

async function angerWatchGuards(silent) {
    let count = 0;
    let adjacentCount = 0;
    let seenCount = 0;
    let sleepingCount = 0;

    for (const guard of Array.from(game.level?.monsters || []).reverse()) {
        if (!guard || guard.dead || (guard.mhp ?? 1) <= 0
            || !guard.mpeaceful || !isWatch(guard)) continue;
        count++;
        if (canSpotMonster(guard) && guard.mcanmove !== 0) {
            const dx = Math.abs((guard.mx ?? 0) - (game.u?.ux ?? 0));
            const dy = Math.abs((guard.my ?? 0) - (game.u?.uy ?? 0));
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
        await plineWithContinuation(sleepingCount === 1
            ? 'The guard wakes up.' : 'The guards wake up.');
    }
    if (adjacentCount) {
        await plineWithContinuation(adjacentCount === 1
            ? 'The guard gets angry!' : 'The guards get angry!');
    } else if (seenCount) {
        await plineWithContinuation(seenCount === 1
            ? 'An angry guard is approaching!'
            : 'Angry guards are approaching!');
    } else {
        await plineWithContinuation(count === 1
            ? "You hear the shrill sound of a guard's whistle."
            : "You hear the shrill sound of guards' whistles.");
    }
    return true;
}

async function reactWatch(observer) {
    if (!isWatch(observer)) return false;
    await plineWithContinuation('"Halt!  You\'re under arrest!"');
    await angerWatchGuards(!!(game.deaf || game.u?.deaf));
    return true;
}

async function reactShopkeeper(observer) {
    if (!observer.isshk) return false;
    if (game.deaf || game.u?.deaf || rn2(5) !== 0) return true;
    const gasp = maybeHumanoidGasp(observer);
    if (gasp) await plineWithContinuation(`${gasp.text} then shrugs.`);
    return true;
}

async function reactPriest(observer) {
    if (!observer.ispriest) return false;
    if (game.deaf || game.u?.deaf || rn2(5) !== 0) return true;
    if (!priestIsCoaligned(observer, game)) return true;
    const gasp = maybeHumanoidGasp(observer);
    if (gasp) await plineWithContinuation(`${gasp.text} then shrugs.`);
    return true;
}

async function reactPeacefulBystanders(attackedMonster) {
    if (!attackedMonster || game.context?.mon_moving
        || game.underwater || game.u?.uinwater) return;
    const heroInvisible = !!(game.u?.invisible || game.u?.invis
        || (game.u?.invisibleTurns ?? 0) > 0);

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
            if (await reactWatch(observer)) continue;
            if (await reactShopkeeper(observer)) continue;
            if (await reactPriest(observer)) continue;
            await reactGenericHumanoid(observer);
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
        const fleeTime = rn2(25) + 15;
        if (!observer.mflee) {
            observer.mfleetim = Math.min(
                127, fleeTime + (observer.mfleetim ?? 0),
            );
            observer.mflee = 1;
            if (!exclaimed) {
                await plineWithContinuation(
                    `${observerDisplayName(observer)} turns to flee.`,
                );
            }
        }
        observer._track = [];
        if (exclaimed && !alreadyFleeing)
            await plineWithContinuation('And then starts to flee.');
    }
}

function heroIsHallucinating() {
    return !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
}

async function angerQuestGuardiansAfterAttack(monster) {
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

export async function wakeAttackedShopkeeper(monster) {
    if (!monster?.isshk || !monster.mpeaceful || monster.mtame) return;

    monster.msleeping = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    monster.mpeaceful = 0;
    adjustHeroAlignment(-1);
    if (couldsee(monster.mx, monster.my)) {
        await plineWithContinuation(
            `${shopkeeperName(monster)} gets angry!`,
        );
    }

    if (!game._shopRooms?.current) {
        monster.eshk.following = 1;
        monster.eshk.customer = game.plname || monster.eshk.customer;
        monster.eshk.surcharge = true;
    }
}

export async function angerMonster(monster, { attacked = false } = {}) {
    if (!monster) return;
    if (attacked && monster.isshk) {
        await wakeAttackedShopkeeper(monster);
        return;
    }

    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!monster.mpeaceful || (monster.mtame ?? 0) > 0) return;

    monster.mpeaceful = 0;
    adjustHeroAlignment(monster.ispriest
        ? (priestIsCoaligned(monster, game) ? -5 : 2)
        : -1);
    const ordinarySubject = monster.name
        ? monster.name : `The ${monsterDisplayName(monster)}`;
    const humanoid = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID)
        || monster.isshk || monster.isgd;
    if (humanoid) {
        const subject = heroIsHallucinating()
            ? randomDisplayMonsterSubject() : ordinarySubject;
        if (couldsee(monster.mx, monster.my))
            await plineWithContinuation(`${subject} gets angry!`);
    } else {
        await publishMonsterGrowl(monster);
    }

    await angerQuestGuardiansAfterAttack(monster);
    await reactPeacefulBystanders(monster);
}

export function angerAttackedMonster(monster) {
    return angerMonster(monster, { attacked: true });
}

export async function wakeMonster(monster, { attacked = false } = {}) {
    if (!monster) return;
    const wasSleeping = !!monster.msleeping;
    if (wasSleeping && canSpotMonster(monster)) {
        const punctuation = attacked ? '!' : '.';
        const alive = monster.mnum === PM_FLESH_GOLEM
            ? " It's alive!" : '';
        await plineWithContinuation(
            `${monsterMessageSubject(monster)} wakes up${punctuation}${alive}`,
        );
    }
    monster.msleeping = 0;
    if (monster.m_ap_type && monster.m_ap_type !== M_AP_MONSTER) {
        revealMonsterAppearance(monster);
    }
    monster.meating = 0;
    if (!attacked) return;
    if (wasSleeping) await publishMonsterGrowl(monster);
    await angerMonster(monster, { attacked: true });
}

export function wakeAttackedMonster(monster) {
    return wakeMonster(monster, { attacked: true });
}
