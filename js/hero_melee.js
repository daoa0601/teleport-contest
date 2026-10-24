// Hero melee command and ordinary hitum(). Monster forms own their attack slots.
import { artifactById } from './artifacts.js';
import { moveMonsterForHeroAttack } from './allmain.js';
import { exerciseAttribute } from './attrib.js';
import { doublePunch } from './barehand_combat.js';
import { heroHandName } from './body_parts.js';
import { A_DEX, A_STR, MMOVE_DIED, STRAT_WAITMASK, Upolyd, isok } from './const.js';
import { canSpotMonster, map_invisible, pline, plineWithContinuation, unmap_invisible, } from './display.js';
import { wipeHeroEngraving } from './engrave.js';
import { game, requirePlayingGame } from './gstate.js';
import { findHeroMeleeHitThreshold, maybeUnparalyzeMeleeDefender } from './hero_attack_accuracy.js';
import { attackHeroInMonsterForm } from './hero_form_combat.js';
import { checkHeroAttackOverexertion } from './hero_overexertion.js';
import { heroSpecies } from './hero_species.js';
import { resolveHeroWeaponHit } from './hero_weapon_hit.js';
import { AT_WEAP } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_NAME, MONSTER_SYMBOL, monsterHasNoAttacks, monsterHasNoHands, monsterIsVerySmall, requireMonsterData, } from './monster_data.js';
import { monsterAtPosition } from './monster_location.js';
import { applyHeroContactPassive } from './monster_passive.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { makePlural } from './object_grammar.js';
import { observeObjectForNaming, ownedObjectName } from './objnam.js';
import { rn2, rnd } from './rng.js';
import { canBeginTwoWeaponCombat, stopTwoWeaponCombat } from './two_weapon.js';
import { exceedsActionCapacity } from './weight.js';
const DIRECTIONS = [
    [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1],
];
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const S_LEPRECHAUN = requireMonsterData(MONSTER_SYMBOL, MONSTER_NAME.indexOf('leprechaun'));
export async function attackHostileMonster(monster, x, y, { confirmationOverridden = false, } = {}) {
    requirePlayingGame(game);
    game._heroMeleeThisCommand = true;
    if (Upolyd(game.u) && monsterHasNoAttacks(heroSpecies(game))) {
        await plineWithContinuation('You have no way to attack monsters physically.');
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
        finishAttackDisplay(monster, x, y);
        return true;
    }
    if (exceedsActionCapacity(game)) {
        await plineWithContinuation('You cannot fight while so heavily loaded.');
        finishAttackDisplay(monster, x, y);
        return true;
    }
    if (await checkHeroAttackOverexertion()) {
        finishAttackDisplay(monster, x, y);
        return true;
    }
    if (game.u.twoweap && !await canBeginTwoWeaponCombat(game))
        await stopTwoWeaponCombat(game);
    await announceImprovisedAttack();
    await exerciseAttribute(A_STR, true);
    wipeHeroEngraving(3);
    if (MONSTER_SYMBOL[monster.mnum] === S_LEPRECHAUN && !monster.mfrozen
        && !monsterIsHelpless(monster) && !monster.mconf && monster.mcansee && rn2(7) === 0) {
        const movement = await moveMonsterForHeroAttack(monster, game);
        if (movement.heroDied)
            return true;
        if (movement.status === MMOVE_DIED || monster.mx !== x || monster.my !== y) {
            await plineWithContinuation('You miss wildly and stumble forwards.');
            return false;
        }
    }
    if (Upolyd(game.u)) {
        await attackHeroInMonsterForm(monster, x, y, { confirmationOverridden });
    }
    else {
        const attack = requireMonsterData(MONSTER_ATTACKS, heroSpecies(game))[0];
        if (!attack)
            throw new Error('The hero species is missing its first attack.');
        await attackWithHumanForm(monster, x, y, attack, confirmationOverridden);
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    finishAttackDisplay(monster, x, y);
    return true;
}
async function announceImprovisedAttack() {
    if (!game._unweapon)
        return;
    game._unweapon = false;
    if (game.flags.verbose === false)
        return;
    const weapon = primaryWeapon();
    if (weapon) {
        observeObjectForNaming(weapon);
        await pline(`You begin bashing monsters with ${ownedObjectName(weapon, game, { capitalized: false })}.`);
    }
    else if (!monsterHasNoHands(heroSpecies(game)) && !monsterIsVerySmall(heroSpecies(game))) {
        const action = game.urole?.key === 'monk' ? 'striking' : 'bashing';
        const covered = game.uarmg || game.u.uarmg ? 'gloved' : 'bare';
        await pline(`You begin ${action} monsters with your ${covered} ${makePlural(heroHandName(game))}.`);
    }
}
async function attackWithHumanForm(monster, x, y, attack, confirmationOverridden) {
    requirePlayingGame(game);
    const weaponBefore = primaryWeapon();
    if (artifactById(weaponBefore?.oartifact)?.enumName === 'CLEAVER'
        && !game.u.twoweap && !game.u.uswallow && !game.u.ustuck
        && heroSpecies(game) !== PM_GRID_BUG) {
        await cleaveAroundTarget(x, y, attack);
        return;
    }
    const secondWeapon = game.u.twoweap ? secondaryWeapon() : null;
    const mortality = game.u.umortality ?? 0;
    const twoHits = (weaponBefore ? game.u.twoweap : doublePunch(game)) ? 1 : 0;
    const accuracy = await findHeroMeleeHitThreshold(monster, attack[0], primaryWeapon(), { firstAttack: true });
    maybeUnparalyzeMeleeDefender(monster);
    const dieRoll = rnd(20);
    const hit = accuracy.threshold > dieRoll;
    if (hit)
        await exerciseAttribute(A_DEX, true);
    const first = await resolveHeroWeaponHit(monster, x, y, primaryWeapon(), {
        attack, hit: hit || !!game.u.uswallow, ...accuracy, dieRoll, twoHits, confirmationOverridden,
    });
    if (first.heroDied)
        return;
    const weaponAfter = primaryWeapon();
    const passive = await applyHeroContactPassive(monster, {
        hit: first.hit, defenderSurvived: first.survived, attackType: AT_WEAP,
        weapon: weaponAfter, weaponWasDestroyed: !!weaponBefore && !weaponAfter,
    });
    if (passive.heroDied || !twoHits || confirmationOverridden || heroAttackInterrupted(mortality)
        || !first.survived || monsterAtPosition(game.level, x, y) !== monster)
        return;
    // Accuracy uses the current slot; hmon uses the object saved before the
    // first hit, matching hitum when the primary strike changes equipment.
    const secondAccuracy = await findHeroMeleeHitThreshold(monster, attack[0], secondaryWeapon(), { firstAttack: false });
    maybeUnparalyzeMeleeDefender(monster);
    const secondRoll = rnd(20);
    const second = await resolveHeroWeaponHit(monster, x, y, secondWeapon, {
        attack, hit: secondAccuracy.threshold > secondRoll || !!game.u.uswallow,
        ...secondAccuracy, dieRoll: secondRoll, twoHits: 2,
    });
    if (second.heroDied || !second.hit)
        return;
    await applyHeroContactPassive(monster, {
        hit: second.hit, defenderSurvived: second.survived, attackType: AT_WEAP,
        weapon: secondWeapon, weaponWasDestroyed: !!secondWeapon && !secondaryWeapon(),
    });
}
async function cleaveAroundTarget(targetX, targetY, attack) {
    requirePlayingGame(game);
    const originX = game.u.ux;
    const originY = game.u.uy;
    const direction = DIRECTIONS.findIndex(([dx, dy]) => dx === targetX - originX && dy === targetY - originY);
    if (direction < 0)
        throw new Error('Cleaver requires an adjacent target.');
    const mortality = game.u.umortality ?? 0;
    const clockwise = game._cleaveClockwise ?? false;
    // Native hitum_cleave() sweeps three squares in its xdir[] rotation,
    // which is the reverse of this list's order, so a native counter-
    // clockwise sweep (clockwise FALSE) maps to [-1, 0, 1] here; the
    // alternating static flag keeps mirroring the native one.
    for (const offset of clockwise ? [1, 0, -1] : [-1, 0, 1]) {
        const delta = DIRECTIONS[(direction + offset + DIRECTIONS.length) % DIRECTIONS.length];
        if (!delta)
            throw new Error('Cleaver direction is outside the compass.');
        const x = originX + delta[0];
        const y = originY + delta[1];
        if (!isok(x, y))
            continue;
        const monster = monsterAtPosition(game.level, x, y);
        if (!monster) {
            unmap_invisible(x, y);
            continue;
        }
        const accuracy = await findHeroMeleeHitThreshold(monster, attack[0], primaryWeapon(), { firstAttack: true });
        maybeUnparalyzeMeleeDefender(monster);
        const dieRoll = rnd(20);
        const result = await resolveHeroWeaponHit(monster, x, y, primaryWeapon(), {
            attack, hit: accuracy.threshold > dieRoll, ...accuracy, dieRoll, twoHits: 0,
        });
        if (result.heroDied)
            break;
        const weapon = primaryWeapon();
        const passive = await applyHeroContactPassive(monster, {
            hit: result.hit, defenderSurvived: !monster.dead && monster.mhp > 0,
            weapon, attackType: AT_WEAP, weaponWasDestroyed: !weapon,
        });
        if (passive.heroDied || !primaryWeapon() || heroAttackInterrupted(mortality))
            break;
    }
    game._cleaveClockwise = !clockwise;
}
function heroAttackInterrupted(mortality) {
    return !!game.program_state.gameover || (game.multi ?? 0) < 0
        || (game._helplessTurns ?? 0) > 0 || (game.u.umortality ?? 0) > mortality;
}
function primaryWeapon() {
    return game.uwep || game.u.uwep || null;
}
function secondaryWeapon() {
    return game.uswapwep || game.u.uswapwep || null;
}
function finishAttackDisplay(monster, x, y) {
    if (game.context.forcefight && !monster.dead && monster.mhp > 0
        && !canSpotMonster(monster) && !(game.u.uswallow && game.u.ustuck === monster)
        && game.level?.at(x, y)?.remembered_glyph?.kind !== 'invisible')
        map_invisible(x, y);
}
//# sourceMappingURL=hero_melee.js.map