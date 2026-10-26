// Hero-credited monster death.
// C refs: mon.c xkilled(), corpse_chance(), and explode.c explode().

import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { adjustHeroAlignment } from './alignment.js';
import { changeHeroLuck } from './attrib.js';
import { uncreateArtifact } from './artifacts.js';
import { A_CHAOTIC, A_NONE, G_NOCORPSE, MGIVENNAME, is_pit } from './const.js';
import { monsterName, possessiveName } from './monster_name.js';
import { heroIsHallucinating } from './senses.js';
import {
    canSpotMonster, newsym, plineWithContinuation, see_monsters,
} from './display.js';
import { recordHeroKillConduct } from './end.js';
import { awardMonsterExperience, checkExperienceLevel } from './exper.js';
import { recordGameLogEvent } from './gamelog.js';
import { MONSTER_GENO, monsterTypeName } from './monster_data.js';
import { findMonsterArmorClass } from './monworn.js';
import { heroIsAmphibious } from './hero_species.js';
import { landFloorObject } from './floor_effects.js';
import { game, requirePlayingGame } from './gstate.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';
import type { MonsterLiquidDeathContext } from './mon.js';
import { finishDestinationSpotEffects } from './location_effects.js';
import { mkobj } from './mklev.js';
import { angerQuestGuardiansAfterLeaderDeath } from './monster_anger.js';
import { isQuestLeader } from './quest.js';
import { questMonsterAlignment, questMonsterSound } from './role_monsters.js';
import { delobj } from './object_delete.js';
import { preventMonsterDeath } from './mondeath.js';
import { describeStoneEngulferEscape, prepareMonsterPetrification } from './monster_stoning.js';
import {
    MONSTER_FLAGS2,
    MONSTER_SIZE, monsterIsAlwaysHostile, monsterIsHuman, monsterIsKop,
    monsterIsNonliving, monsterIsPlainHuman, monsterIsPlayerMonster,
    monsterIsQuestGuardian, monsterIsUnicorn,
} from './monster_data.js';
import {
    monsterDeathCount,
} from './monster_vitals.js';
import {
    createMonsterRemains, detachDeadMonster, finishMonsterLiquidDeath, levelAllowsMonsterDeathDrops,
    monsterBodyCrumbles, monsterBodyCrumblesMessage, monsterDeathSquareAllowsObjects,
    monsterLeavesCorpse,
} from './monster_death.js';
import type { MonsterLiquidDeathResult } from './monster_death.js';
import {
    resolveMonsterDeathExplosion, monsterDeathSwallower, rollMonsterDeathExplosion,
} from './monster_explosion.js';
import {
    addObjectToMonsterInventory,
} from './monster_inventory.js';
import {
    BOULDER, FIGURINE, OBJECT_BIMANUAL,
} from './object_data.js';
import { removeIntrinsicProperty } from './properties.js';
import { priestIsCoaligned } from './priest.js';
import { rn2 } from './rng.js';
import { cansee } from './vision.js';

// include/mondata.h:unique_corpstat() — G_UNIQ species never leave a
// pet-murder chronicle entry behind (mon.c:xkilled()).
const G_UNIQ = 0x1000;

export type HeroMonsterDeathContext =
    | { kind: 'swallowed-projectile'; projectile: GameObject }
    | { kind: 'swallowed-potion' | 'swallowed-breath' | 'swallowed-venom' | 'swallowed-egg' };

export interface HeroMonsterKillOptions {
    hallucinating?: boolean;
    showKillMessage?: boolean;
    deathContext?: HeroMonsterDeathContext | null;
    noCorpse?: boolean;
    recordConduct?: boolean;
    zombifyCorpse?: boolean;
    noRevive?: boolean;
    petrified?: boolean;
    stoneRemains?: GameObject | null;
    sadFeeling?: boolean;
    publish?: MessagePublisher;
}

export interface HeroMonsterKillOutcome {
    killed: boolean;
    heroDied: boolean;
}

export type FinishHeroMonsterDeath = (
    monster: Monster, options?: HeroMonsterKillOptions,
) => Promise<HeroMonsterKillOutcome>;

export interface HeroLiquidMonsterDeathOptions extends Pick<HeroMonsterKillOptions,
    'hallucinating' | 'sadFeeling' | 'publish'> {
    leaveCorpse?: boolean;
    cause?: MonsterLiquidDeathContext['cause'];
}

export interface HeroLiquidMonsterDeathOutcome {
    oldx: number;
    oldy: number;
    x: number;
    y: number;
    moved: false;
    dead: boolean;
    actionCompleted: boolean;
    heroDied: boolean;
}

const M2_COLLECT = 0x40000000;
const FOOD_CLASS = 7;
const MZ_HUMAN = 2;

function killingIsMurder(monster: Monster) {
    const mnum = monster?.mnum ?? -1;
    return monsterIsHuman(mnum)
        && !monsterIsAlwaysHostile(mnum)
        && monster.malign <= 0
        && !monsterIsPlayerMonster(mnum)
        && !monsterIsPlainHuman(mnum)
        && (game.u?.ualign?.type ?? 0) !== A_CHAOTIC;
}

async function punishMurder() {
    removeIntrinsicProperty('telepathy', game);
    changeHeroLuck(-2);
    await plineWithContinuation('You murderer!');

    const blind = !!game.blind || (game.u?.blindTurns ?? 0) > 0;
    if (blind && !game.u?.blindTelepathy && !game.u?.telepathy)
        await see_monsters();
}

async function punishQuestLeaderKill() {
    const alignmentLimit = 10 + Math.trunc((game.moves || 0) / 200);
    const alignmentRecord = game.u?.ualign?.record || 0;
    adjustHeroAlignment(-(
        alignmentRecord + Math.trunc(alignmentLimit / 2)
    ));
    game.u.ugangr = (game.u.ugangr || 0) + 7;
    changeHeroLuck(-20);

    const probably = game.u?.uevent?.qcompleted ? 'probably ' : '';
    await plineWithContinuation(`That was ${probably}a bad idea...`);
    if (!game.context?.mon_moving)
        await angerQuestGuardiansAfterLeaderDeath();
}

function rewardQuestNemesisKill() {
    if (game.quest_status?.killed_leader) return;
    const alignmentLimit = 10 + Math.trunc((game.moves || 0) / 200);
    adjustHeroAlignment(Math.trunc(alignmentLimit / 4));
}

async function punishQuestGuardianKill(hallucinating: boolean) {
    const alignmentLimit = 10 + Math.trunc((game.moves || 0) / 200);
    adjustHeroAlignment(-Math.trunc(alignmentLimit / 8));
    game.u.ugangr = (game.u.ugangr || 0) + 1;
    changeHeroLuck(-4);
    await plineWithContinuation(hallucinating
        ? 'Whoopsie-daisy!'
        : 'That was probably a bad idea...');
}

function applyPriestKillConsequences(monster: Monster) {
    const coaligned = priestIsCoaligned(monster, game);
    adjustHeroAlignment(coaligned ? -2 : 2);
    if (coaligned) game.u.ublessed = 0;

    if (questMonsterAlignment(monster.mnum) === A_NONE) {
        const alignmentLimit = 10 + Math.trunc((game.moves || 0) / 200);
        adjustHeroAlignment(Math.trunc(alignmentLimit / 4));
    }
}

function recordKilledPet(monster: Monster) {
    if (!monster.mtame || monster.isminion) return;
    const pet = monster.edog || monster.mextra?.edog;
    if (pet) pet.killed_by_u = 1;
}

function pitDeathRemains(monster: Monster, x: number, y: number) {
    if (!monster.mtrapped) return { buryCorpse: false, suppressRemains: false };
    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (!trap || !is_pit(trap.ttyp))
        return { buryCorpse: false, suppressRemains: false };

    const floorObjects = game.level?.objects?.[x]?.[y] || [];
    const carriedObjects = monster.minvent || monster.inventory || [];
    return {
        buryCorpse: carriedObjects.some(object => object.otyp === BOULDER),
        suppressRemains: floorObjects.some(object => object.otyp === BOULDER),
    };
}

// The boolean records the monster's fate, not the hero's.
export async function finishHeroMonsterKill(
    monster: Monster, x: number, y: number, options: HeroMonsterKillOptions = {},
): Promise<boolean> {
    const outcome = await finishHeroMonsterKillOutcome(monster, x, y, options);
    return outcome.killed;
}

export async function finishHeroMonsterKillOutcome(monster: Monster, x: number, y: number, {
    hallucinating = heroIsHallucinating(game),
    showKillMessage = true,
    deathContext = null,
    noCorpse = false,
    recordConduct = true,
    zombifyCorpse = false,
    noRevive = false,
    petrified = false,
    stoneRemains = null,
    sadFeeling = false,
    publish = plineWithContinuation,
}: HeroMonsterKillOptions = {}): Promise<HeroMonsterKillOutcome> {
    requirePlayingGame(game);
    const wasInside = (game.u.uswallow && game.u.ustuck === monster)
        || deathContext?.kind === 'swallowed-projectile'
        || deathContext?.kind === 'swallowed-potion'
        || deathContext?.kind === 'swallowed-breath'
        || deathContext?.kind === 'swallowed-venom'
        || deathContext?.kind === 'swallowed-egg';
    if (deathContext && !wasInside) {
        throw new Error(
            `unsupported monster death context ${deathContext.kind}`,
        );
    }

    monster.mhp = 0;
    const deathLocationVisible = cansee(x, y);
    const deathWasSpotted = wasInside || canSpotMonster(monster);

    if (recordConduct) recordHeroKillConduct();
    if (showKillMessage) {
        const deathVerb = monsterIsNonliving(monster.mnum)
            ? 'destroy' : 'kill';
        const namedPet = !!MGIVENNAME(monster) && !heroIsHallucinating(game);
        const deathTarget = !deathWasSpotted ? 'it'
            : monster.mtame ? monsterName(monster, {
                article: namedPet ? 'none' : 'the', adjective: 'poor',
                suppressSaddle: namedPet,
            }) : monsterName(monster);
        await publish(`You ${deathVerb} ${deathTarget}!`);
    }

    const pitRemains = pitDeathRemains(monster, x, y);
    const suppressRemains = noCorpse || pitRemains.suppressRemains;
    recordKilledPet(monster);
    if (deathContext?.kind === 'swallowed-projectile') {
        await addObjectToMonsterInventory(
            monster, deathContext.projectile, game, { atFront: true },
        );
    }

    const stone = petrified
        ? await prepareMonsterPetrification(monster, { publish }) : null;
    if (stone?.heroDied) return { killed: false, heroDied: true };
    const recovery = stone?.survived ? stone : await preventMonsterDeath(monster, {
        disintegrated: suppressRemains,
        state: game,
    });
    if (recovery.heroDied) return { killed: !recovery.survived, heroDied: true };
    if (recovery.survived) {
        if (!deathLocationVisible && !recovery.messageShown)
            await plineWithContinuation('Maybe not...');
        return { killed: false, heroDied: false };
    }

    const completedDeath = 'completedDeath' in recovery ? recovery.completedDeath : null;
    if (!completedDeath && await detachDeadMonster(monster, game, rn2, publish))
        return { killed: true, heroDied: true };
    if (wasInside)
        await describeStoneEngulferEscape(monster, stone?.remains ?? stoneRemains, game, publish);

    // xkilled() owns this message after mondead() has released the inventory.
    if (sadFeeling)
        await publish('You have a sad feeling for a moment, then it passes.');

    const levelAllowsDeathDrops = !petrified && !suppressRemains
        && levelAllowsMonsterDeathDrops(monster, game, rn2);
    const squareAllowsDeathObjects = monsterDeathSquareAllowsObjects(
        x, y, game,
    );
    const canCreateDeathObjects = levelAllowsDeathDrops
        && squareAllowsDeathObjects;
    if (canCreateDeathObjects) {
        const extraObjectRoll = rn2(6);
        if (extraObjectRoll === 0
            && !((game.mvitals?.[monster.mnum]?.mvflags ?? 0) & G_NOCORPSE)
            && (x !== game.u?.ux || y !== game.u?.uy)
            && !monsterIsKop(monster.mnum)
            && !monster.mcloned) {
            const extra = await mkobj(0, true);
            const collectsFood = !!((MONSTER_FLAGS2[monster.mnum] ?? 0)
                & M2_COLLECT);
            const tooLarge = (MONSTER_SIZE[monster.mnum] ?? MZ_HUMAN)
                < MZ_HUMAN
                && extra.otyp !== FIGURINE
                && ((extra.owt ?? 1) > 30
                    || OBJECT_BIMANUAL[extra.otyp]);
            const disposableFood = extra.oclass === FOOD_CLASS && !collectsFood
                && !extra.oartifact;
            if (disposableFood) {
                await delobj(extra, game);
            } else if (tooLarge) {
                if (extra.oartifact)
                    uncreateArtifact(extra, game);
                await delobj(extra, game);
            } else {
                await landFloorObject(extra, x, y, {
                    state: game,
                    publish: plineWithContinuation,
                });
            }
        }
    }
    if (game.program_state.gameover) return { killed: true, heroDied: true };

    const deathExplosion = !wasInside && canCreateDeathObjects
        ? rollMonsterDeathExplosion(monster)
        : null;
    let leavesCorpse = false;
    if (deathExplosion === null) {
        if (canCreateDeathObjects && monsterBodyCrumbles(monster)
            && deathLocationVisible && !wasInside && !monsterDeathSwallower(game))
            await plineWithContinuation(monsterBodyCrumblesMessage(monster));
        // corpse_chance() repeats LEVEL_SPECIFIC_NOCORPSE after the crumble
        // check, so graveyard undead roll again here.
        leavesCorpse = !wasInside && canCreateDeathObjects
            && !monsterBodyCrumbles(monster)
            && levelAllowsMonsterDeathDrops(monster, game, rn2)
            && monsterLeavesCorpse(monster, rn2);
    }
    if (deathExplosion !== null) {
        newsym(x, y);
        const explosion = await resolveMonsterDeathExplosion(
            monster, x, y, deathExplosion, {
                state: game,
                heroCaused: !game.context.mon_moving,
            },
        );
        if (explosion.heroDied) return { killed: true, heroDied: true };
    }
    let corpse = null;
    if (leavesCorpse) {
        corpse = await createMonsterRemains(monster, game, {
            buried: pitRemains.buryCorpse,
            zombify: zombifyCorpse,
            noRevive,
            seen: deathWasSpotted,
            publish: plineWithContinuation,
        });
        if (game.program_state.gameover) return { killed: true, heroDied: true };
    }
    if (pitRemains.buryCorpse && corpse?.where === 'buried'
        && cansee(x, y) && !monster.minvis && showKillMessage) {
        const possessive = possessiveName(monsterName(monster, { capitalized: true }));
        await plineWithContinuation(
            `${possessive} corpse ends up buried.`,
        );
    }

    if (wasInside && levelAllowsDeathDrops) {
        const destination = await finishDestinationSpotEffects({
            oldx: game.u.ux0 ?? x,
            oldy: game.u.uy0 ?? y,
            newx: x,
            newy: y,
        });
        if (destination.died) return { killed: true, heroDied: true };
    }
    // Native xkilled jumps over this landing/redraw block when remains are
    // suppressed. Otherwise the map is current before kill-credit messages.
    if (levelAllowsDeathDrops) newsym(x, y);

    if (killingIsMurder(monster)) await punishMurder();
    if ((monster.mpeaceful && rn2(2) === 0) || monster.mtame)
        changeHeroLuck(-1);
    if (monsterIsUnicorn(monster.mnum)
        && Math.sign(game.u?.ualign?.type ?? 0)
            === Math.sign(questMonsterAlignment(monster.mnum))) {
        changeHeroLuck(-5);
        await plineWithContinuation(formatFeltMessage('guilty...'));
    }
    const killCount = monsterDeathCount(monster.mnum);
    awardMonsterExperience(monster, {
        killCount,
        amphibious: heroIsAmphibious(game),
        armorClass: findMonsterArmorClass(monster),
    });
    await checkExperienceLevel();

    if (isQuestLeader(monster, game)) {
        await punishQuestLeaderKill();
    } else if (questMonsterSound(monster.mnum, game) === 37) {
        rewardQuestNemesisKill();
    } else if (monsterIsQuestGuardian(monster.mnum)) {
        await punishQuestGuardianKill(hallucinating);
    } else if (monster.ispriest) {
        applyPriestKillConsequences(monster);
    } else if (monster.mtame) {
        adjustHeroAlignment(-15);
        await publishHeardMessage(hallucinating ? 'the studio audience applaud!' : 'the rumble of distant thunder...', plineWithContinuation);
        // mon.c:xkilled() records the pet murder in the chronicle unless
        // the species never leaves a corpse behind as a unique statue.
        if (!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)) {
            const given = MGIVENNAME(monster);
            recordGameLogEvent(`murdered ${given ? `${given}, ` : ''}${
                game.flags.female ? 'her' : 'his'} faithful ${
                monsterTypeName(monster.mnum, monster.female)}`);
        }
    } else if (monster.mpeaceful) {
        adjustHeroAlignment(-5);
    }
    adjustHeroAlignment(monster.malign);
    return { killed: true, heroDied: false };
}

// C minliquid_core() asks context.mon_moving who owns a liquid death: a
// monster's own move dies by mondead()/mondied(), anything else by xkilled().
export function finishLiquidDeathForCurrentMover(
    monster: Monster, options: MonsterLiquidDeathContext,
): Promise<MonsterLiquidDeathResult | HeroLiquidMonsterDeathOutcome> {
    return options.state.context.mon_moving
        ? finishMonsterLiquidDeath(monster, options)
        : finishHeroLiquidMonsterDeath(monster, options);
}

// Drowning caused by the hero uses xkilled() without a second kill line.
// Rust and fire-resistant scorching retain mon.c's environmental death owner.
export async function finishHeroLiquidMonsterDeath(
    monster: Monster, {
        leaveCorpse = false,
        hallucinating = heroIsHallucinating(game),
        cause,
        sadFeeling = false,
        publish = plineWithContinuation,
    }: HeroLiquidMonsterDeathOptions = {},
): Promise<HeroLiquidMonsterDeathOutcome> {
    if (cause === 'rust' || cause === 'lava-scorch') {
        const death = await finishMonsterLiquidDeath(monster, { leaveCorpse, sadFeeling, publish });
        return { ...death, heroDied: !!death.heroDied };
    }
    const x = monster.mx;
    const y = monster.my;
    const { killed, heroDied } = await finishHeroMonsterKillOutcome(monster, x, y, {
        hallucinating,
        showKillMessage: false,
        noCorpse: !leaveCorpse,
        sadFeeling,
        publish,
    });
    return {
        oldx: x,
        oldy: y,
        x,
        y,
        moved: false,
        dead: killed,
        actionCompleted: killed,
        heroDied,
    };
}
