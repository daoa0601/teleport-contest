// Hero-credited monster death.
// C refs: mon.c xkilled(), corpse_chance(), and explode.c explode().

import { adjustHeroAlignment } from './alignment.js';
import { G_NOCORPSE, is_pit } from './const.js';
import {
    canProjectMonster, docrt, newsym, plineWithContinuation,
    randomDisplayMonsterName, unmap_invisible,
} from './display.js';
import { recordHeroKillConduct, recordVanquished } from './end.js';
import {
    awardMonsterExperience, gainExperienceLevel, gainLevelAbilities,
    newExperienceThreshold,
} from './exper.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { mkobj } from './mklev.js';
import { markQuestLeaderDead } from './quest.js';
import { preventMonsterDeath } from './mondeath.js';
import {
    MONSTER_ALIGNMENT, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME,
    MONSTER_SIZE, monsterIsNonliving,
} from './monster_data.js';
import {
    createMonsterRemains, levelAllowsMonsterDeathDrops,
    monsterBodyCrumblesMessage, monsterDeathSquareAllowsObjects,
    monsterLeavesCorpse,
} from './monster_death.js';
import {
    createPhysicalMonsterExplosion, rollMonsterDeathExplosionDamage,
} from './monster_explosion.js';
import {
    addObjectToMonsterInventory, clearMonsterCarriedObjectState,
} from './monster_inventory.js';
import { BOULDER } from './object_data.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { rnd, rn2 } from './rng.js';
import { cansee, vision_recalc } from './vision.js';

const M2_ALWAYS_HOSTILE = 0x00100000;
const M2_ALWAYS_PEACEFUL = 0x00200000;
const A_NONE = -128;

function monsterDeathMalign(monster) {
    if (Number.isInteger(monster?.malign)) return monster.malign;
    if (monster?.mnum === game.urole?.ldrnum) return -20;

    const mnum = monster?.mnum ?? -1;
    const speciesAlignment = MONSTER_ALIGNMENT[mnum] ?? 0;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    const peaceful = !!monster?.mpeaceful;
    const coaligned = Math.sign(speciesAlignment)
        === Math.sign(game.u?.ualign?.type ?? 0);
    const absoluteAlignment = Math.abs(speciesAlignment);

    if (speciesAlignment === A_NONE) return peaceful ? 0 : 20;
    if (flags & M2_ALWAYS_PEACEFUL) {
        return (peaceful ? -3 : 3) * Math.max(5, absoluteAlignment);
    }
    if (flags & M2_ALWAYS_HOSTILE) {
        return coaligned ? 0 : Math.max(5, absoluteAlignment);
    }
    if (coaligned) {
        return peaceful
            ? -3 * Math.max(3, absoluteAlignment)
            : Math.max(3, absoluteAlignment);
    }
    return absoluteAlignment;
}

function observeMonsterDropName(object, x, y) {
    if (!object || !cansee(x, y)
        || game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0) return;
    const range = Math.max(game.u?.xray_range ?? -1, 2);
    const dx = x - (game.u?.ux ?? x);
    const dy = y - (game.u?.uy ?? y);
    const closeNameDistance = range * range * 2 - range;
    if (!object.oartifact && !object.artifact
        && dx * dx + dy * dy > closeNameDistance) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
}

function recordKilledPet(monster) {
    if (!monster.mtame || monster.isminion) return;
    const pet = monster.edog || monster.mextra?.edog;
    if (pet) pet.killed_by_u = 1;
}

function pitDeathRemains(monster, x, y) {
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

export async function finishHeroMonsterKill(monster, x, y, {
    wasTame = (monster?.mtame ?? (monster?.pet ? 1 : 0)) > 0,
    hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0),
    nameMonster = () => hallucinating
        ? randomDisplayMonsterName()
        : MONSTER_NAME[monster?.mnum] || 'monster',
    showKillMessage = true,
    weaponHit = !!game.uwep,
    deathContext = null,
    noCorpse = false,
    recordConduct = true,
    zombifyCorpse = false,
} = {}) {
    const wasInside = deathContext?.kind === 'swallowed-projectile'
        || deathContext?.kind === 'swallowed-potion'
        || deathContext?.kind === 'swallowed-breath'
        || deathContext?.kind === 'swallowed-venom';
    if (deathContext && !wasInside) {
        throw new Error(
            `unsupported monster death context ${deathContext.kind}`,
        );
    }
    if (wasInside && !['swallowed-breath', 'swallowed-venom']
        .includes(deathContext.kind)
        && typeof deathContext.finishDestinationEffects !== 'function') {
        throw new TypeError(
            'swallowed monster death requires destination effects',
        );
    }

    monster.mhp = 0;
    const deathLocationVisible = cansee(x, y);
    const deathWasSpotted = wasInside || canProjectMonster(
        monster, monster.mx, monster.my,
    );
    const monsterName = nameMonster();

    if (recordConduct) recordHeroKillConduct();
    if (showKillMessage) {
        const deathVerb = monsterIsNonliving(monster.mnum)
            ? 'destroy' : 'kill';
        const deathTarget = deathWasSpotted
            ? `the ${monster.mtame ? 'poor ' : ''}${monsterName}`
            : 'it';
        await plineWithContinuation(
            `You ${deathVerb} ${deathTarget}!`,
        );
    }

    const pitRemains = pitDeathRemains(monster, x, y);
    const suppressRemains = noCorpse || pitRemains.suppressRemains;
    recordKilledPet(monster);
    if (deathContext?.kind === 'swallowed-projectile') {
        addObjectToMonsterInventory(
            monster, deathContext.projectile, game, { atFront: true },
        );
    }

    const recovery = await preventMonsterDeath(monster, {
        visible: deathLocationVisible,
        spotted: deathWasSpotted,
        petSpotted: deathWasSpotted,
        disintegrated: suppressRemains,
        state: game,
    });
    if (recovery.survived) {
        if (!deathLocationVisible && !recovery.messageShown)
            await plineWithContinuation('Maybe not...');
        return false;
    }

    if (wasInside) {
        game.u.ustuck = null;
        game.u.uswallow = 0;
        game.u.uswldtim = 0;
        game.u.ux = x;
        game.u.uy = y;
        game.vision_full_recalc = 1;
        vision_recalc(0);
        await docrt();
        if (!(monster.mspec_used ?? 0)) monster.mspec_used = rnd(2);
    }

    if (monster.iswiz) {
        game.context.no_of_wizards = (game.context.no_of_wizards || 0) - 1;
        if (!game.u.uevent) game.u.uevent = {};
        if (!game.u.uevent.udemigod) {
            game.u.uevent.udemigod = true;
            game.u.udg_cnt = 50 + rn2(250);
        }
    }

    const carried = monster.minvent || monster.inventory || [];
    for (const object of carried) {
        observeMonsterDropName(object, x, y);
        clearMonsterCarriedObjectState(object);
        place_object(object, x, y);
        stack_object(object, game);
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;

    const levelAllowsDeathDrops = !suppressRemains
        && levelAllowsMonsterDeathDrops(monster, game, rn2);
    const squareAllowsDeathObjects = monsterDeathSquareAllowsObjects(
        x, y, game,
    );
    const canCreateDeathObjects = levelAllowsDeathDrops
        && squareAllowsDeathObjects;
    if (canCreateDeathObjects) {
        const extraObjectRoll = rn2(6);
        if (extraObjectRoll === 0
            && !((MONSTER_GENO[monster.mnum] ?? 0) & G_NOCORPSE)
            && (x !== game.u?.ux || y !== game.u?.uy)) {
            const extra = mkobj(0, true);
            const collectsFood = !!((MONSTER_FLAGS2[monster.mnum] ?? 0)
                & 0x40000000);
            const tooLarge = (MONSTER_SIZE[monster.mnum] ?? 2) < 3
                && ((extra.owt ?? 1) > 30);
            const disposableFood = extra.oclass === 7 && !collectsFood
                && !extra.artifact;
            if (tooLarge || disposableFood) {
                rn2(100);
            } else {
                const mergeCandidate = (game.level?.objects?.[x]?.[y] || [])
                    .some(object => object.otyp === extra.otyp);
                place_object(extra, x, y);
                if (mergeCandidate) rn2(100);
            }
        }
    }

    const explosionDamage = canCreateDeathObjects
        ? rollMonsterDeathExplosionDamage(monster)
        : null;
    let leavesCorpse = false;
    if (explosionDamage === null) {
        const crumbleMessage = canCreateDeathObjects
            ? monsterBodyCrumblesMessage(monster) : null;
        if (crumbleMessage && deathLocationVisible && !wasInside)
            await plineWithContinuation(crumbleMessage);
        leavesCorpse = !wasInside && canCreateDeathObjects
            && monsterLeavesCorpse(monster, rn2);
    }
    unmap_invisible(x, y, false);
    monster.dead = true;
    markQuestLeaderDead(monster, game);
    game.level.monsters = game.level.monsters.filter(
        candidate => candidate !== monster,
    );
    recordVanquished(monster, monsterName, { weaponHit });
    if (leavesCorpse) {
        await createMonsterRemains(monster, game, {
            buried: pitRemains.buryCorpse,
            zombify: zombifyCorpse,
            seen: deathWasSpotted,
            publish: plineWithContinuation,
        });
    }

    if (typeof deathContext?.finishDestinationEffects === 'function') {
        await deathContext.finishDestinationEffects({
            oldx: game.u.ux0 ?? x,
            oldy: game.u.uy0 ?? y,
            newx: x,
            newy: y,
            loc: game.level?.at?.(x, y),
            explicitAttempt: false,
        });
        newsym(x, y);
    }

    if (monster.mpeaceful) {
        rn2(2);
        if (wasTame || monster.mtame)
            game.u.uluck = (game.u.uluck || 0) - 1;
    }
    const killCount = game._vanquishedCounts?.get(monster.mnum)?.count || 1;
    awardMonsterExperience(monster, {
        killCount,
        amphibious: !!game.u?.amphibious,
    });
    if ((game.u?.ulevel ?? 1) < 30
        && (game.u?.uexp ?? 0)
            >= newExperienceThreshold(game.u?.ulevel ?? 1)) {
        const oldLevel = game.u.ulevel;
        const returning = (game.u.ulevelmax ?? oldLevel) >= oldLevel + 1;
        gainExperienceLevel({ incremental: true });
        await plineWithContinuation(
            `Welcome ${returning ? 'back ' : ''}to experience level ${
                game.u.ulevel}.`,
        );
        await gainLevelAbilities(oldLevel, game.u.ulevel);
    }
    if (!wasInside) newsym(x, y);
    if (!wasInside && explosionDamage !== null) {
        await createPhysicalMonsterExplosion(
            monster, x, y, explosionDamage, {
                state: game,
                heroCaused: true,
                finishMonsterDeath: target => finishHeroMonsterKill(
                    target, target.mx, target.my,
                ),
            },
        );
    }
    if (!wasInside) newsym(x, y);

    if (monster.mtame) {
        adjustHeroAlignment(-15);
        await plineWithContinuation(hallucinating
            ? 'You hear the studio audience applaud!'
            : 'You hear the rumble of distant thunder...');
    } else if (monster.mpeaceful) {
        adjustHeroAlignment(-5);
    }
    adjustHeroAlignment(monsterDeathMalign(monster));
    return true;
}

// When the hero creates water under a monster, minliquid() calls xkilled()
// without printing a second kill line.
export async function finishHeroLiquidMonsterDeath(
    monster, {
        leaveCorpse = false,
        hallucinating,
        nameMonster,
    } = {},
) {
    const x = monster.mx;
    const y = monster.my;
    const killed = await finishHeroMonsterKill(monster, x, y, {
        hallucinating,
        nameMonster,
        showKillMessage: false,
        weaponHit: false,
        noCorpse: !leaveCorpse,
    });
    return {
        oldx: x,
        oldy: y,
        x,
        y,
        moved: false,
        dead: killed,
        actionCompleted: killed,
    };
}
