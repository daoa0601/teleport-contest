// C muse.c:munslime(), muse_unslime(), and their item feedback.
import { EXPL_FIERY, FIRE_TRAP, NORMAL_SPEED, STRAT_WAITFORU, isok, } from './const.js';
import { canSeeMonster, displayColorName, newsym, plineWithContinuation, } from './display.js';
import { explode } from './explosion.js';
import { game, requirePlayingGame } from './gstate.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroIsUnaware } from './hero_sleep.js';
import { beginObjectBurn } from './light.js';
import { AD_FIRE, AT_BREA } from './monster_attack_types.js';
import { speciesCanBlow } from './monster_anatomy.js';
import { MONSTER_ATTACKS, MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_NAME, MONSTER_SYMBOL, monsterIsAnimal, monsterIsMindless, monsterIsNoncorporeal, monsterIsNonliving, } from './monster_data.js';
import { finishMonsterKilled } from './monster_death.js';
import { consumeMonsterItem, presentMonsterHornUse, presentMonsterScrollRead, presentMonsterWandUse, } from './monster_item_use.js';
import { monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { monsterName, monsterReflexiveAction, monsterSubjectPronoun, possessiveName } from './monster_name.js';
import { monsterIsHelpless } from './monster_sleep.js';
import { adjustMonsterSpeed } from './monster_speed.js';
import { advanceMonsterWormBody } from './monster_worm.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from './monmove.js';
import { tryCallObjectType } from './object_call.js';
import { FIRE_HORN, POT_OIL, SCR_FIRE, WAN_FIRE } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { splitObjectStack } from './object_stack.js';
import { minimalObjectName } from './objnam.js';
import { hitMonsterWithRay } from './ray_attack.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsHallucinating } from './senses.js';
import { CLR_BRIGHT_GREEN, CLR_GREEN } from './terminal.js';
import { isAccessibleAt } from './terrain_properties.js';
import { cansee } from './vision.js';
const M1_FLY = 0x1, M1_AMORPHOUS = 0x4, M1_NOHANDS = 0x2000;
const M1_NOLIMBS = 0x6000, M1_SLITHY = 0x80000;
const M1_NOEYES = 0x1000;
const S_EYE = 5, S_LIGHT = 25, SCROLL_CLASS = 9;
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const FLAMING_SPECIES = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander']
    .map(name => MONSTER_NAME.indexOf(name)));
export function monsterIsSlimeproof(monster) {
    return monster.mnum === PM_GREEN_SLIME || FLAMING_SPECIES.has(monster.mnum)
        || monsterIsNoncorporeal(monster);
}
export async function tryMonsterUnslime(monster, { state = game, byHero = false, publish = plineWithContinuation, random = rn2, rollDice = d, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    if (monsterIsSlimeproof(monster) || monster.meating || monsterIsHelpless(monster))
        return { cured: false, heroDied: false };
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const cure = selectSlimeCure(monster, state, random);
    if (!cure)
        return { cured: false, heroDied: false };
    const context = { state, byHero, publish, random, rollDice, rollOne };
    let visible = canSeeMonster(monster);
    if (visible) {
        const subject = monsterName(monster, { state, capitalized: true });
        const green = !heroIsHallucinating(state)
            && [CLR_GREEN, CLR_BRIGHT_GREEN].includes(MONSTER_COLOR[monster.mnum] ?? -1);
        await publish(`${subject} starts turning ${green ? 'into ooze' : displayColorName('green', state)}.`);
    }
    adjustMonsterSpeed(monster, -4);
    let damage = 0;
    let cured = true;
    if (cure.kind === 'trap') {
        await triggerCureTrap(monster, cure.trap, visible, context);
    }
    else if (cure.kind === 'breath') {
        if (visible) {
            const name = monsterName(monster, { state, capitalized: true });
            await publish(`${monsterReflexiveAction(monster, name, 'breath', 'fire on', { state })}.`);
        }
        if (random(3) === 0)
            monster.mspec_used = random(10) + 5;
        damage = await hitMonsterWithRay(monster, byHero ? 21 : -21, 1, context);
    }
    else if (cure.object.otyp === SCR_FIRE) {
        await presentMonsterScrollRead(monster, cure.object, context);
        if (monster.mconf) {
            if (cansee(monster.mx, monster.my))
                await publish('Oh, what a pretty fire!');
            if (visible)
                await tryCallObjectType(cure.object, state);
            await consumeMonsterItem(monster, cure.object, state);
            visible = false;
            cured = false;
        }
        else {
            const sign = cure.object.blessed ? 1 : cure.object.cursed ? -1 : 0;
            const blastDamage = Math.trunc((2 * (random(3) + 3 + 2 * sign) + 1) / 3);
            await consumeMonsterItem(monster, cure.object, state);
            const blast = await explode(monster.mx, monster.my, -11, blastDamage, SCROLL_CLASS, byHero ? -EXPL_FIERY : EXPL_FIERY, { state, publish, random, heroCaused: false });
            if (blast.heroDied)
                return { cured, heroDied: true };
        }
    }
    else if (cure.object.otyp === POT_OIL) {
        const oil = splitOilPotion(cure.object, state);
        const wasLit = !!oil.lamplit;
        const sawLighting = visible && !wasLit;
        if (sawLighting) {
            const name = monsterName(monster, { state, capitalized: true });
            await publish(`${name} ignites ${withIndefiniteArticle(minimalObjectName(oil, state))}.`);
        }
        beginObjectBurn(oil, state);
        visible ||= canSeeMonster(monster);
        if (visible) {
            if (!heroIsUnaware(state))
                observeObject(oil, state);
            const subject = sawLighting ? capitalize(monsterSubjectPronoun(monster, { state }))
                : monsterName(monster, { state, capitalized: true });
            await publish(`${subject} quaffs a burning ${minimalObjectName(oil, state)}`);
            learnObjectType(POT_OIL, state);
        }
        // Pinned muse_unslime draws oil damage for feedback without subtracting HP.
        damage = rollDice(3, 4);
        await consumeMonsterItem(monster, oil, state);
    }
    else {
        if (cure.object.otyp === FIRE_HORN)
            await presentMonsterHornUse(monster, cure.object, { ...context, self: true });
        else
            await presentMonsterWandUse(monster, cure.object, { ...context, self: true });
        damage = await hitMonsterWithRay(monster, byHero ? 1 : -1, 2, context);
    }
    if (state.program_state.gameover)
        return { cured, heroDied: true };
    if (damage) {
        if (monster.mhp <= 0) {
            if (byHero) {
                if (visible)
                    await publish(`${monsterName(monster, { state, capitalized: true })} is ${monsterIsNonliving(monster.mnum) ? 'destroyed' : 'killed'} by the fire!`);
                const death = await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
                    showKillMessage: false, recordConduct: false, publish,
                });
                if (death.heroDied)
                    return { cured, heroDied: true };
            }
            else {
                const death = await finishMonsterKilled(monster, state, {
                    damageType: AD_FIRE, cause: 'fire', publish, random, rollDice,
                });
                if (death.heroDied)
                    return { cured, heroDied: true };
            }
        }
        else if (visible) {
            await publish(`${monsterName(monster, { state, capitalized: true })} is burned${damage <= 4 ? '.' : '!'}`);
        }
    }
    if (visible) {
        if (cured && monster.mhp > 0)
            await publish(`${possessiveName(monsterName(monster, { state, capitalized: true }))} slime is burned away!`);
        if (cure.kind === 'item')
            learnObjectType(cure.object.otyp, state);
    }
    monster.movement = (monster.movement ?? 0) - NORMAL_SPEED;
    monster.mlstmv = state.moves;
    return { cured, heroDied: false };
}
function selectSlimeCure(monster, state, random) {
    if (!monster.mcan && !monster.mspec_used
        && MONSTER_ATTACKS[monster.mnum]?.some(([method, damage]) => method === AT_BREA && damage === AD_FIRE))
        return { kind: 'breath' };
    if (monsterIsAnimal(monster) || monsterIsMindless(monster.mnum))
        return null;
    const object = (monster.minvent || monster.inventory || []).find(candidate => itemCuresSliming(monster, candidate));
    if (object)
        return { kind: 'item', object };
    const here = state.level.traps.find(trap => trap.tx === monster.mx && trap.ty === monster.my);
    if (here?.ttyp === FIRE_TRAP)
        return { kind: 'trap', trap: here };
    if (!MONSTER_MOVE[monster.mnum] || monster.mtrapped)
        return null;
    const nearby = [];
    for (let x = monster.mx - 1; x <= monster.mx + 1; x++) {
        for (let y = monster.my - 1; y <= monster.my + 1; y++) {
            if (isok(x, y) && isAccessibleAt(x, y, state)
                && !monsterAtPosition(state.level, x, y)
                && (x !== state.u.ux || y !== state.u.uy))
                nearby.push({ x, y });
        }
    }
    for (let index = 0; index < nearby.length; index++) {
        const picked = index + random(nearby.length - index);
        const point = nearby[picked];
        const previous = nearby[index];
        if (!point || !previous)
            throw new RangeError('Slime-cure trap selection left its candidate range');
        nearby[index] = point;
        nearby[picked] = previous;
        const trap = state.level.traps.find(candidate => candidate.tx === point.x && candidate.ty === point.y);
        if (trap?.ttyp === FIRE_TRAP)
            return { kind: 'trap', trap };
    }
    return null;
}
function itemCuresSliming(monster, object) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (object.otyp === SCR_FIRE)
        return !(flags & (M1_NOEYES | M1_NOHANDS)) && !!monster.mcansee;
    if (object.otyp === POT_OIL)
        return !(flags & M1_NOHANDS);
    return object.spe > 0 && (object.otyp === WAN_FIRE
        || object.otyp === FIRE_HORN && speciesCanBlow(monster.mnum));
}
async function triggerCureTrap(monster, trap, visible, context) {
    const { state, publish, random, rollDice, rollOne } = context;
    const name = visible ? monsterName(monster, { state, capitalized: true }) : '';
    if (monster.mx === trap.tx && monster.my === trap.ty) {
        if (visible)
            await publish(`${name} triggers ${trap.tseen ? 'the' : 'a'} fire trap!`);
    }
    else {
        const oldX = monster.mx, oldY = monster.my;
        placeMonsterAt(monster, trap.tx, trap.ty);
        newsym(oldX, oldY);
        if (monster.wormno)
            advanceMonsterWormBody(monster, { state, random, rollDice, rollOne });
        newsym(monster.mx, monster.my);
        if (visible) {
            const floats = [S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[monster.mnum] ?? -1);
            await publish(`${name} ${monsterLocomotion(monster)} ${floats ? 'over' : 'onto'} ${trap.tseen ? 'the' : 'a'} fire trap!`);
        }
    }
    const action = await triggerImmediateMonsterTrap(monster, state, { force: true, random, rollDice, rollOne });
    await resumeDeferredMonsterTrap(action, state, { publish, random, rollDice, rollOne });
}
function monsterLocomotion(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if ([S_EYE, S_LIGHT].includes(MONSTER_SYMBOL[monster.mnum] ?? -1))
        return 'floats';
    if (flags & M1_FLY)
        return 'flies';
    if (flags & M1_SLITHY)
        return 'slithers';
    if (flags & M1_AMORPHOUS)
        return 'oozes';
    if (!MONSTER_MOVE[monster.mnum])
        return 'wiggles';
    return (flags & M1_NOLIMBS) === M1_NOLIMBS ? 'crawls' : 'moves';
}
function splitOilPotion(oil, state) {
    if (oil.quan <= 1)
        return oil;
    const single = splitObjectStack(oil, 1, state);
    if (!single)
        throw new Error('A slime cure must retain its carried oil stack');
    return single;
}
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
//# sourceMappingURL=monster_unslime.js.map