// Hero-credited monster death.
// C refs: mon.c xkilled(), corpse_chance(), and explode.c explode().

import { adjustHeroAlignment } from './alignment.js';
import { exerciseAttribute } from './attrib.js';
import {
    A_STR, COLNO, G_NOCORPSE, Is_rogue_level, ROWNO, TAINT_AGE,
} from './const.js';
import {
    canProjectMonster, docrt, flush_screen, newsym, plineWithContinuation,
    randomDisplayMonsterName, show_glyph_cell, unmap_invisible,
} from './display.js';
import { recordHeroKillConduct, recordVanquished } from './end.js';
import {
    awardMonsterExperience, gainExperienceLevel, gainLevelAbilities,
    newExperienceThreshold,
} from './exper.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import {
    mkcorpstat, mkobj, mksobj, undeadToCorpse,
} from './mklev.js';
import { corpseKeepsMonsterTraits } from './monster_traits.js';
import { markQuestLeaderDead } from './quest.js';
import { wakeMonstersNear } from './monster_wake.js';
import { preventMonsterDeath } from './mondeath.js';
import {
    MONSTER_ALIGNMENT, MONSTER_ATTACKS, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SYMBOL, monsterIsNonliving,
} from './monster_data.js';
import { AT_BOOM } from './monster_attack_types.js';
import {
    addObjectToMonsterInventory, clearMonsterCarriedObjectState,
} from './monster_inventory.js';
import { CORPSE, IRON_CHAIN } from './object_data.js';
import { recordObjectEncounter } from './object_knowledge.js';
import { d, rnd, rn2 } from './rng.js';
import { CLR_GREEN } from './terminal.js';
import { cansee, vision_recalc } from './vision.js';

const PM_IRON_GOLEM = 259;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const PM_LIZARD = 326;
const PM_ARCHEOLOGIST = 331;
const PM_WIZARD = 343;

const S_GOLEM = 55;
const M2_ALWAYS_HOSTILE = 0x00100000;
const M2_ALWAYS_PEACEFUL = 0x00200000;
const A_NONE = -128;

function levelSpecificNoCorpse(monster) {
    if (Is_rogue_level(game.u?.uz)
        || game.level?.flags?.deathdrops === false) return true;
    const isUndead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x2);
    return !!(game.level?.flags?.graveyard && isUndead && rn2(3));
}

function corpseChance(monster) {
    if (levelSpecificNoCorpse(monster)) return false;
    const mnum = monster.mnum;
    const guaranteed = (((MONSTER_SIZE[mnum] ?? 2) >= 3
            || mnum === PM_LIZARD) && !monster.mcloned)
        || MONSTER_SYMBOL[mnum] === S_GOLEM
        || (mnum >= PM_ARCHEOLOGIST && mnum <= PM_WIZARD)
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE)
        || !!monster.isshk;
    if (guaranteed) return true;
    const corpseRange = 2
        + (((MONSTER_GENO[mnum] ?? 0) & 0x7) < 2 ? 1 : 0)
        + ((MONSTER_SIZE[mnum] ?? 2) < 1 ? 1 : 0);
    return rn2(corpseRange) === 0;
}

function rollMonsterAttackDamage(monster, attack) {
    const [, , dice = 0, sides = 0] = attack || [];
    if (dice > 0) return d(dice, sides);
    if (sides > 0) {
        return d(
            (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0) + 1,
            sides,
        );
    }
    return 0;
}

function physicalExplosionInventoryProbe(damage) {
    const remainder = damage % 5;
    const limit = Math.trunc(damage / 5) + (remainder > rn2(5) ? 1 : 0);
    return Math.min(20, Math.max(0, limit));
}

function monsterResistsPhysicalExplosion(monster) {
    const attackLevel = game.u?.ulevel ?? 1;
    const defenseLevel = Math.max(1, Math.min(50, monster.m_lev || 1));
    const range = Math.max(1, 100 + attackLevel - defenseLevel);
    return rn2(range)
        < (MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0);
}

async function captureNoxiousPhysicalExplosion(x, y) {
    const cells = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const tx = x + dx;
            const ty = y + dy;
            if (tx < 1 || tx >= COLNO || ty < 0 || ty >= ROWNO) continue;
            cells.push({ x: tx, y: ty });
        }
    }
    if (!cells.some(cell => cansee(cell.x, cell.y))) return;

    const mask = [
        ['/', false], ['o', true], ['\\', false],
        ['x', true], [' ', false], ['x', true],
        ['\\', false], ['s', true], ['/', false],
    ];
    try {
        for (const cell of cells) {
            const index = (cell.y - (y - 1)) * 3
                + (cell.x - (x - 1));
            const [ch, decgfx] = mask[index];
            show_glyph_cell(cell.x, cell.y, ch, CLR_GREEN, decgfx);
        }
        await flush_screen(1);
        game.nhDisplay?.setCursor(
            (game.u?.ux ?? 1) - 1,
            (game.u?.uy ?? 0) + 1,
        );
        await game.animationFrame?.();
        await game.animationFrame?.();
    } finally {
        for (const cell of cells) newsym(cell.x, cell.y);
    }
}

async function resolvePhysicalMonsterExplosion(
    sourceMonster, x, y, damage,
) {
    const sourceName = MONSTER_NAME[sourceMonster.mnum] || 'monster';
    const explosionName = `${sourceName}'s explosion`;
    await captureNoxiousPhysicalExplosion(x, y);
    await plineWithContinuation('Boom!');

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const tx = x + dx;
            const ty = y + dy;
            const target = game.level?.monsters?.find(monster =>
                (monster.mhp ?? 1) > 0
                && monster.mx === tx && monster.my === ty);
            if (!target) continue;

            if (cansee(tx, ty)) {
                const targetName = MONSTER_NAME[target.mnum] || 'monster';
                await plineWithContinuation(
                    `The ${targetName} is caught in the ${explosionName}!`,
                );
            }
            physicalExplosionInventoryProbe(damage);
            let appliedDamage = damage;
            if (monsterResistsPhysicalExplosion(target)) {
                appliedDamage = Math.trunc((damage + 1) / 2);
                if (cansee(tx, ty)) {
                    const targetName = MONSTER_NAME[target.mnum] || 'monster';
                    await plineWithContinuation(
                        `The ${targetName} resists the ${explosionName}!`,
                    );
                }
            }
            target.mhp = Math.max(0, (target.mhp ?? 1) - appliedDamage);
            if (target.mhp <= 0)
                await finishHeroMonsterKill(target, tx, ty);
        }
    }

    const heroInBlast = Math.abs((game.u?.ux ?? x) - x) <= 1
        && Math.abs((game.u?.uy ?? y) - y) <= 1;
    if (heroInBlast) {
        await plineWithContinuation(
            `You are caught in the ${explosionName}!`,
        );
        physicalExplosionInventoryProbe(damage);
        let appliedDamage = damage;
        if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
            appliedDamage = Math.trunc((appliedDamage + 1) / 2);
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - appliedDamage);
        exerciseAttribute(A_STR, false);
    }

    const wakeDistance = Math.max(50, damage * damage);
    wakeMonstersNear(x, y, wakeDistance);
}

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
        disintegrated: noCorpse,
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

    const permitsDeathDrops = !noCorpse && !levelSpecificNoCorpse(monster);
    if (permitsDeathDrops) {
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

    const generationFlags = MONSTER_GENO[monster.mnum] ?? 0;
    const boomAttack = permitsDeathDrops
        ? MONSTER_ATTACKS[monster.mnum]
            ?.find(attack => attack[0] === AT_BOOM)
        : null;
    let explosion = null;
    let leavesCorpse = false;
    if (boomAttack) {
        const containedDamage = rollMonsterAttackDamage(monster, boomAttack);
        const blastDamage = rollMonsterAttackDamage(monster, boomAttack);
        explosion = { containedDamage, blastDamage };
    } else {
        leavesCorpse = !noCorpse && !wasInside
            && permitsDeathDrops && corpseChance(monster);
    }
    unmap_invisible(x, y, false);
    monster.dead = true;
    markQuestLeaderDead(monster, game);
    game.level.monsters = game.level.monsters.filter(
        candidate => candidate !== monster,
    );
    recordVanquished(monster, monsterName, { weaponHit });
    const corpseForm = undeadToCorpse(monster.mnum);
    const convertedUndeadCorpse = corpseForm !== monster.mnum;
    if (leavesCorpse && monster.mnum === PM_IRON_GOLEM) {
        const chainCount = d(2, 6);
        for (let index = 0; index < chainCount; index++) {
            const chain = mksobj(IRON_CHAIN, true, false);
            place_object(chain, x, y);
        }
        delete monster.name;
    } else if (leavesCorpse
        && (convertedUndeadCorpse || !(generationFlags & G_NOCORPSE))) {
        const leaderId = game.quest_status?.leader_m_id;
        const savedMonster = convertedUndeadCorpse
            || corpseKeepsMonsterTraits(monster, leaderId)
            ? monster : null;
        const corpse = mkcorpstat(
            CORPSE, savedMonster, corpseForm, x, y, 8, {
                zombify: zombifyCorpse,
            },
        );
        Object.assign(corpse, {
            name: `${MONSTER_NAME[corpseForm] || monsterName} corpse`,
            quantity: 1, quan: 1, ox: x, oy: y,
        });
        if (monster.name) corpse.oname = monster.name;
        if (convertedUndeadCorpse)
            corpse.age = (corpse.age ?? game.moves ?? 1) - (TAINT_AGE + 1);
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
    if (!wasInside && explosion) {
        await resolvePhysicalMonsterExplosion(
            monster, x, y, explosion.blastDamage,
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
