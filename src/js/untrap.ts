// Finding and removing floor, container, and door traps.
// C ref: trap.c dountrap(), could_untrap(), and untrap().

import { monsterHasMapPosition } from './monster_location.js';
import { deleteTrap } from './trap_lifecycle.js';
import { vision_note_blocker_change } from './vision.js';
import { addShopDamage } from './shop_damage.js';
import { roomsAt } from './room.js';
import { SHOPBASE } from './const.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { adjustHeroAlignment } from './alignment.js';
import { artifactById } from './artifacts.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { triggerChestTrap } from './chest_trap.js';
import {
    A_CON, A_DEX, A_STR, A_WIS, ARROW_TRAP, BEAR_TRAP, DART_TRAP,
    DOOR, D_BROKEN, D_ISOPEN, D_NODOOR, D_TRAPPED, LANDMINE,
    MAXULEV, PIT, SPIKED_PIT, SQKY_BOARD, TRAP_EXPLANATIONS,
    WEB, isok,
} from './const.js';
import { newsym, pline, plineWithContinuation } from './display.js';
import { level_difficulty } from './dungeon.js';
import {
    addExperience, checkExperienceLevel,
} from './exper.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { Trap, MapLocation } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { DirectionSelection } from './tty_prompts.js';
import { convertTrapToObject } from './trap_object.js';
import { heroBadRock, heroTightDiagonalReason } from './hack.js';
import { heroHasConflict } from './hero_conflict.js';
import { heroCanSpinWeb } from './hero_web.js';
import { triggerHeroTrap } from './hero_traps.js';
import { compactInventoryLetters, promptInventoryObject } from './inventory_prompt.js';
import { isDoorMimic, isObjectOrFurnitureMimic, revealMimic } from './mimic.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { wakeMonstersNear } from './monster_wake.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { setMonsterMalign } from './monster_alignment.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_GENO, MONSTER_MOVE,
    MONSTER_SYMBOL, monsterIsMindless, monsterTypeName,
} from './monster_data.js';
import {
    ARROW, BEARTRAP, BOULDER, CAN_OF_GREASE, DART, LAND_MINE,
    LARGE_BOX, CHEST, OBJECT_BIMANUAL, OBJECT_NAMES, POT_OIL,
} from './object_data.js';
import { deleteObject } from './object_delete.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import {
    heroHasNoHands,
} from './polyself.js';
import { heroFormSticks } from './hero_species.js';
import { promptYesNoQuit } from './query.js';
import { d, rnd, rn2, rnl } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import {
    resolveImmediatePetrification, touchPetrifies,
} from './stoning.js';
import { promptDirection } from './tty_prompts.js';
import {
    EXT_ENCUMBER, HVY_ENCUMBER, calcCapacity, nearCapacity, objectWeight,
} from './weight.js';
import { isBlade } from './weapon_type.js';
import { cansee } from './vision.js';

const POTION_CLASS = 8;
const M1_WALLWALK = 0x00000008;
const G_UNIQ = 0x1000;
const S_HUMAN = 53;

interface TrapEntryResult {
    entered: boolean;
    died: boolean;
}
type TrapEntry = (trap: Trap) => TrapEntryResult | Promise<TrapEntryResult>;

export interface UntrapOptions {
    state?: GameState;
    force?: boolean;
    enterTrap?: TrapEntry | null;
    chooseDirection?: () => DirectionSelection | null | Promise<DirectionSelection | null>;
    ask?: typeof promptYesNoQuit;
    chooseObject?: typeof promptInventoryObject;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
    rollDice?: (count: number, sides: number) => number;
    luckRandom?: (limit: number) => number;
}

interface FloorTrapOptions {
    state: GameState;
    enterTrap: TrapEntry | null;
    chooseObject: typeof promptInventoryObject;
    publish: MessagePublisher;
    random: (limit: number) => number;
    rollOne: (sides: number) => number;
    rollDice: (count: number, sides: number) => number;
    luckRandom: (limit: number) => number;
}

interface BoxTrapOptions {
    state: GameState;
    force: boolean;
    ask: typeof promptYesNoQuit;
    publish: MessagePublisher;
    random: (limit: number) => number;
    rollOne: (sides: number) => number;
    rollDice: (count: number, sides: number) => number;
}

type RescueOptions = Pick<FloorTrapOptions, 'state' | 'publish' | 'random' | 'rollOne'>;

function heroIsImpaired(state: GameState): boolean {
    const hero = state.u;
    return !!hero.confused || (hero.confusionTurns ?? 0) > 0
        || heroIsHallucinating(state);
}

function heroIsStunned(state: GameState): boolean {
    return !!(state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0);
}

function heroIsFumbling(state: GameState): boolean {
    return !!(state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0);
}

function heroPassesWalls(state: GameState): boolean {
    if (state.u.passesWalls) return true;
    const form = (state.u.mtimedone ?? 0) > 0 ? state.u.umonnum : null;
    return form !== null && form !== undefined && Number.isInteger(form)
        && !!((MONSTER_FLAGS1[form] ?? 0) & M1_WALLWALK);
}

function monsterAt(state: GameState, x: number, y: number): Monster | null {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

function trapAt(state: GameState, x: number, y: number): Trap | null {
    return state.level?.traps?.find(trap =>
        trap.tx === x && trap.ty === y) || null;
}

function boxesAt(state: GameState, x: number, y: number): GameObject[] {
    return (state.level?.objects?.[x]?.[y] || []).filter(object =>
        object.otyp === LARGE_BOX || object.otyp === CHEST);
}

function monsterName(monster: Monster): string {
    return monster?.name
        || `the ${monsterTypeName(monster?.mnum, !!monster?.female)}`;
}

function capitalizedMonsterName(monster: Monster): string {
    const name = monsterName(monster);
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function trapName(trap: Trap): string {
    return TRAP_EXPLANATIONS[trap?.ttyp] || 'trap';
}

function article(noun: string): string {
    return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

function possessiveTrap(trap: Trap): string {
    return trap?.madeby_u ? 'your' : 'the';
}

function hasMagicKey(state: GameState): boolean {
    return (state.inventory || []).some(object =>
        artifactById(object.oartifact, state)?.name
            === 'The Master Key of Thievery');
}

function weldedTwoHandedWeapon(state: GameState): boolean {
    const weapon = state.uwep || state.u?.uwep;
    return !!(weapon?.cursed && (OBJECT_BIMANUAL[weapon.otyp]));
}

export function untrapAbilityProblem(state: GameState = game, { checkFloor = false } = {}): string | null {
    if (nearCapacity(state) >= HVY_ENCUMBER)
        return "You're too strained to do that.";

    const form = (state.u.mtimedone ?? 0) > 0 ? state.u.umonnum : null;
    if ((heroHasNoHands(state) && !heroCanSpinWeb(state))
        || (form !== null && form !== undefined && Number.isInteger(form) && (MONSTER_MOVE[form] ?? 0) === 0)) {
        return 'And just how do you expect to do that?';
    }

    if (state.u?.ustuck && heroFormSticks(state)) {
        return `You'll have to let go of ${monsterName(state.u.ustuck)} first.`;
    }
    if (state.u?.ustuck || weldedTwoHandedWeapon(state))
        return 'Your hands seem to be too busy for that.';
    if (checkFloor && !heroCanReachFloor(state))
        return "You can't reach the floor.";
    return null;
}

export async function doUntrap({
    state = game,
    enterTrap = null,
}: Pick<UntrapOptions, 'state' | 'enterTrap'> = {}): Promise<boolean> {
    const problem = untrapAbilityProblem(state);
    if (problem) {
        await pline(problem);
        state.context.move = 0;
        return false;
    }

    const spentTime = await untrap({ state, enterTrap });
    if (state.program_state.gameover) return spentTime;
    state.context.move = spentTime ? 1 : 0;
    return spentTime;
}

export async function untrap({
    state = game,
    force = false,
    enterTrap = null,
    chooseDirection = promptDirection,
    ask = promptYesNoQuit,
    chooseObject = promptInventoryObject,
    publish = pline,
    random = rn2,
    rollOne = rnd,
    rollDice = d,
    luckRandom = rnl,
}: UntrapOptions = {}): Promise<boolean> {
    if (!force && hasMagicKey(state)) force = true;

    const direction = await chooseDirection();
    if (!direction) {
        state._pending_message = '';
        state._retained_message = '';
        return false;
    }
    const hero = state.u;
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;

    const x = state.u.ux + direction.dx;
    const y = state.u.uy + direction.dy;
    if (!isok(x, y)) {
        await publish('The perils lurking there are beyond your grasp.');
        return false;
    }

    const here = x === state.u.ux && y === state.u.uy;
    let trap = trapAt(state, x, y);
    if (trap && !trap.tseen) trap = null;
    const boxes = here ? boxesAt(state, x, y) : [];
    const canReachFloor = heroCanReachFloor(state);
    let handleTrap = canReachFloor;
    let trapSkipped = false;

    if (!canReachFloor && (trap || boxes.length)) {
        await publish(unreachableTrapMessage(trap, boxes.length, here, state));
        trapSkipped = !!trap;
    } else if (canReachFloor && trap) {
        if (boxes.length) {
            if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
                const position = state.u?.utrap
                    ? " that you're stuck in"
                    : ' while standing on the edge of it';
                await publish(
                    `You can't do much about the ${trapName(trap)}${position}.`,
                );
                handleTrap = false;
                trapSkipped = true;
            } else {
                const choice = await chooseFloorTrapOrBox(
                    trap, boxes.length, ask,
                );
                if (choice === 'q') return false;
                if (choice === 'n') {
                    handleTrap = false;
                    trapSkipped = true;
                }
            }
        }
        if (handleTrap) {
            return handleFloorTrap(trap, {
                state,
                enterTrap,
                chooseObject,
                publish,
                random,
                rollOne,
                rollDice,
                luckRandom,
            });
        }
    }

    if (canReachFloor && boxes.length) {
        const used = await handleBoxes(boxes, {
            state, force, ask, publish, random, rollOne, rollDice,
        });
        if (used !== null) return used;
    }

    const doorMimic = monsterAt(state, x, y);
    if (isDoorMimic(doorMimic, state)) {
        await revealMimic(doorMimic, state, publish);
        return true;
    }

    return handleDoor(x, y, {
        state,
        force,
        trapSkipped,
        ask,
        publish,
        random,
        rollOne,
    });
}

function unreachableTrapMessage(trap: Trap | null, boxCount: number, here: boolean, state: GameState): string {
    const things = [];
    if (trap) things.push(`${article(trapName(trap))} ${trapName(trap)}`);
    if (boxCount) things.push(boxCount === 1 ? 'a container' : 'containers');
    const subject = things.join(' and ');
    const plural = things.length > 1 || boxCount > 1;
    const mounted = state.u?.usteed ? ' while mounted' : '';
    const location = here ? 'here' : 'there';
    const object = plural ? 'them' : 'it';
    return `There ${plural ? 'are' : 'is'} ${subject} ${location} `
        + `but you can't reach ${object}${mounted}.`;
}

async function chooseFloorTrapOrBox(trap: Trap, boxCount: number, ask: typeof promptYesNoQuit) {
    const containers = boxCount === 1 ? 'a container' : 'containers';
    const noun = trapName(trap);
    const verb = trap.ttyp === WEB ? 'Remove' : 'Disarm';
    const subject = `There ${boxCount === 1 ? 'is' : 'are'} ${containers} `
        + `and ${article(noun)} ${noun} here.`;
    return ask(`${subject}  ${verb} the ${noun}?`);
}

async function handleFloorTrap(trap: Trap, options: FloorTrapOptions): Promise<boolean> {
    const { state, publish } = options;
    const here = trap.tx === state.u.ux && trap.ty === state.u.uy;
    if (state.u?.utrap) {
        await publish(
            `You cannot deal with the ${trapName(trap)} while trapped${here ? ' in it' : ''}!`,
        );
        return true;
    }

    const mimic = monsterAt(state, trap.tx, trap.ty);
    if (isObjectOrFurnitureMimic(mimic, state)) {
        await revealMimic(mimic, state, publish);
        return true;
    }

    switch (trap.ttyp) {
    case BEAR_TRAP:
    case WEB:
        return disarmHoldingTrap(trap, options);
    case LANDMINE:
        return disarmLandmine(trap, options);
    case SQKY_BOARD:
        return disarmSqueakyBoard(trap, options);
    case DART_TRAP:
        return disarmShootingTrap(trap, DART, options);
    case ARROW_TRAP:
        return disarmShootingTrap(trap, ARROW, options);
    case PIT:
    case SPIKED_PIT:
        return handlePit(trap, options);
    default:
        await publish(`You cannot disable ${here ? 'this' : 'that'} trap.`);
        return false;
    }
}

function webCuttingWeapon(trap: Trap, state: GameState): GameObject | null {
    if (monsterAt(state, trap.tx, trap.ty)) return null;
    const primary = state.uwep || state.u?.uwep;
    if (primary && isBlade(primary)) return primary;
    const secondary = state.uswapwep || state.u?.uswapwep;
    return state.u.twoweap && secondary && isBlade(secondary) ? secondary : null;
}

function untrapFailureRoll(trap: Trap, state: GameState, random: (limit: number) => number): number {
    let chance = 3;
    if (trap.ttyp === WEB) {
        const blade = webCuttingWeapon(trap, state);
        const artifact = artifactById(blade?.oartifact, state);
        if (blade && (artifact?.name === 'Sting'
            || artifact?.attack?.damageType === 'fire')) chance = 1;
        else if (!blade && !heroCanSpinWeb(state)) chance = 7;
    }
    if (heroIsImpaired(state)) chance++;
    if (heroIsBlind(state)) chance++;
    if (heroIsStunned(state)) chance += 2;
    if (heroIsFumbling(state)) chance *= 2;
    if (trap.madeby_u) chance--;

    const role = state.urole?.key;
    if (role === 'ranger' && trap.ttyp === BEAR_TRAP && chance <= 3)
        return 0;
    if (role === 'rogue') {
        if (random(2 * MAXULEV) < (state.u?.ulevel ?? 1)) chance--;
        if (state.u?.uhave?.questart && chance > 1) chance--;
    } else if (role === 'ranger' && chance > 1) {
        chance--;
    }
    return random(Math.max(1, chance));
}

async function tryDisarm(trap: Trap, {
    state,
    publish,
    random,
    rollOne,
    luckRandom,
    enterTrap,
    forceFailure = false,
}: Pick<FloorTrapOptions, 'state' | 'publish' | 'random' | 'rollOne' | 'luckRandom' | 'enterTrap'> & { forceFailure?: boolean }): Promise<0 | 1 | 2> {
    const monster = monsterAt(state, trap.tx, trap.ty);
    const holdingTrap = trap.ttyp === BEAR_TRAP || trap.ttyp === WEB;
    if (monster && (!monster.mtrapped || !holdingTrap)) {
        await publish(`${capitalizedMonsterName(monster)} is in the way.`);
        return 0;
    }

    const here = trap.tx === state.u.ux && trap.ty === state.u.uy;
    const boulder = (state.level?.objects?.[trap.tx]?.[trap.ty] || [])
        .some(object => object.otyp === BOULDER);
    if (boulder && !heroPassesWalls(state) && !here) {
        await publish('There is a boulder in your way.');
        return 0;
    }
    const dx = trap.tx - state.u.ux;
    const dy = trap.ty - state.u.uy;
    const tightDiagonal = dx && dy
        && heroBadRock(state, state.u.ux, trap.ty)
        && heroBadRock(state, trap.tx, state.u.uy)
        && heroTightDiagonalReason(state);
    if (tightDiagonal) {
        await publish(`You are unable to reach the ${trapName(trap)}!`);
        return 0;
    }
    if (!heroCanReachFloor(state, { checkPit: here })) {
        await publish(`You are unable to reach the ${trapName(trap)}!`);
        return 0;
    }

    if (!forceFailure && untrapFailureRoll(trap, state, random) === 0)
        return 2;

    if (luckRandom(5)) {
        await publish('Whoops...');
        if (monster) {
            await failMonsterRescue(monster, trap, {
                state, publish, random, rollOne,
            });
        } else if (here) {
            const result = await triggerHeroTrap(trap, { failedUntrap: true });
            if (result.died) return 1;
        } else {
            const entered = enterTrap ? await enterTrap(trap) : null;
            if (entered?.died) return 1;
            if (!entered?.entered) {
                const preposition = [BEAR_TRAP, PIT, SPIKED_PIT, WEB]
                    .includes(trap.ttyp) ? 'into' : 'onto';
                await publish(`Fortunately, you don't move ${preposition} it.`);
            }
        }
        if (state.program_state.gameover) return 1;
        await exerciseAttribute(A_DEX, false, state);
    } else {
        const owner = trap.madeby_u ? 'Your' : here ? 'This' : 'That';
        const action = trap.ttyp === WEB ? 'remove' : 'disarm';
        await publish(`${owner} ${trapName(trap)} is difficult to ${action}.`);
    }
    return 1;
}

async function failMonsterRescue(monster: Monster, trap: Trap, {
    state, publish, random, rollOne,
}: RescueOptions): Promise<void> {
    if (trap.ttyp === BEAR_TRAP) {
        if (monster.mtame) {
            monster.mtame = heroHasConflict(state)
                ? Math.trunc(monster.mtame / 2) : monster.mtame - 1;
            if (monster.mtame > 0 && monster.edog)
                monster.edog.abuse = (monster.edog.abuse ?? 0) + 1;
        }
        monster.mhp = (monster.mhp ?? 1) - rollOne(4);
        if (monster.mhp <= 0) {
            await finishEnvironmentalMonsterDeath(monster, state, {
                random, publish,
            });
        }
    } else if (trap.ttyp === WEB && monster.mtrapped) {
        await publish(`${capitalizedMonsterName(monster)} remains entangled.`);
    }
}

async function disarmHoldingTrap(trap: Trap, options: FloorTrapOptions): Promise<boolean> {
    const result = await tryDisarm(trap, options);
    if (result < 2) return result !== 0;

    const { state, publish, random, luckRandom } = options;
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (monster) {
        monster.mtrapped = 0;
        const noun = trap.ttyp === BEAR_TRAP ? 'bear trap' : 'web';
        await publish(
            `You extract ${monsterName(monster)} from ${possessiveTrap(trap)} ${noun}.`,
        );
        await rewardMonsterRescue(trap, monster, {
            state, publish, random, luckRandom,
        });
    } else if (trap.ttyp === BEAR_TRAP) {
        await publish(`You disarm ${possessiveTrap(trap)} bear trap.`);
        await convertTrapToObject(trap, BEARTRAP, 1, state);
        return true;
    } else {
        const blade = webCuttingWeapon(trap, state);
        const artifact = artifactById(blade?.oartifact, state);
        if (artifact?.name === 'Sting')
            await publish(`Sting cuts through ${possessiveTrap(trap)} web!`);
        else if (artifact?.attack?.damageType === 'fire')
            await publish(`${artifact.name} burns through ${possessiveTrap(trap)} web!`);
        else if (blade)
            await publish(`You cut through ${possessiveTrap(trap)} web.`);
        else await publish(`You succeed in removing ${possessiveTrap(trap)} web.`);
        removeTrap(trap, state);
    }
    newsym(trap.tx, trap.ty);
    return true;
}

async function disarmLandmine(trap: Trap, options: FloorTrapOptions): Promise<boolean> {
    const result = await tryDisarm(trap, options);
    if (result < 2) return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} land mine.`);
    await convertTrapToObject(trap, LAND_MINE, 1, options.state);
    return true;
}

async function disarmShootingTrap(trap: Trap, objectType: number, options: FloorTrapOptions): Promise<boolean> {
    const result = await tryDisarm(trap, options);
    if (result < 2) return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} trap.`);
    const count = 50 - options.luckRandom(50);
    await convertTrapToObject(trap, objectType, count, options.state);
    return true;
}

async function disarmSqueakyBoard(trap: Trap, options: FloorTrapOptions): Promise<boolean> {
    const tool = await chooseSqueakyBoardTool(options);
    if (!tool) return false;
    const badTool = tool.cursed
        || ((tool.otyp !== POT_OIL || tool.lamplit)
            && (tool.otyp !== CAN_OF_GREASE || !(tool.spe ?? 0)));
    const result = await tryDisarm(trap, {
        ...options, forceFailure: !!badTool,
    });
    if (result < 2) return result !== 0;

    if (tool.otyp === CAN_OF_GREASE) {
        tool.spe = Math.max(0, (tool.spe ?? 0) - 1);
    } else {
        await consumeOne(tool, options.state);
        recordObjectKnowledge(POT_OIL, options.state);
    }
    await options.publish('You repair the squeaky board.');
    removeTrap(trap, options.state);
    newsym(trap.tx, trap.ty);
    await awardExperience(1, 5, options.state, options.publish);
    return true;
}

async function chooseSqueakyBoardTool({ state, chooseObject, publish }: Pick<FloorTrapOptions, 'state' | 'chooseObject' | 'publish'>): Promise<GameObject | null> {
    const eligible = (state.inventory || []).filter(object =>
        object.otyp === CAN_OF_GREASE || object.oclass === POTION_CLASS);
    if (!eligible.length) {
        await publish("You don't have anything to untrap with.");
        return null;
    }
    const recommended = eligible.filter(object =>
        object.otyp === CAN_OF_GREASE
        || (object.otyp === POT_OIL && object.dknown
            && state._knownObjectTypes?.has(POT_OIL)));
    const letters = compactInventoryLetters(
        recommended.map(object => object.invlet).join(''),
    );
    const choices = letters ? `${letters} or ?*` : '?*';
    const prompt = `What do you want to untrap with? [${choices}] `;
    const selection = await chooseObject(prompt, eligible, { allowMenu: true });
    return selection.cancelled ? null : selection.object;
}

async function consumeOne(object: GameObject, state: GameState): Promise<void> {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) {
        await deleteObject(object, state);
        return;
    }
    object.quan = object.quantity = quantity - 1;
    object.owt = objectWeight(object);
}

function removeTrap(trap: Trap, state: GameState): void {
    deleteTrap(trap, state);
    if (state.u?.utrap && state.u.ux === trap.tx && state.u.uy === trap.ty) {
        state.u.utrap = 0;
        state.u.utraptype = 0;
    }
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (monster?.mtrapped) monster.mtrapped = 0;
}

async function handlePit(trap: Trap, options: FloorTrapOptions): Promise<boolean> {
    const { state, publish } = options;
    const here = trap.tx === state.u.ux && trap.ty === state.u.uy;
    if (here) {
        await publish('You are already on the edge of the pit.');
        return false;
    }
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (!monster) {
        await publish('Try filling the pit instead.');
        return false;
    }
    return helpMonsterOut(monster, trap, options);
}

function monsterIsHelpless(monster: Monster): boolean {
    return !!(monster.msleeping || monster.mfrozen
        || monster.mcanmove === 0);
}

async function helpMonsterOut(monster: Monster, trap: Trap, options: FloorTrapOptions): Promise<boolean> {
    const { state, publish, random, luckRandom } = options;
    if (!monster.mtrapped) {
        await publish(`${capitalizedMonsterName(monster)} isn't trapped.`);
        return false;
    }
    if (nearCapacity(state) >= EXT_ENCUMBER) {
        await publish("You can't do that while carrying so much stuff.");
        return true;
    }

    const failed = untrapFailureRoll(trap, state, random);
    if (failed && !monsterIsHelpless(monster)) {
        await publish(
            `You try to reach out your arms, but ${monsterName(monster)} backs away skeptically.`,
        );
        return true;
    }

    if (touchPetrifies(monster.mnum)
        && !(state.uarmg || state.u?.uarmg)
        && !(state.u.stoneResistance)) {
        const species = monsterTypeName(monster.mnum, !!monster.female);
        await publish(`You grab the trapped ${species} using your bare hands.`);
        await resolveImmediatePetrification({
            state,
            killer: `trying to help ${article(species)} ${species} out of a pit`,
            publish: plineWithContinuation,
        });
        return true;
    }

    if (failed) {
        await publish(
            `You try to grab ${monsterName(monster)}, but cannot get a firm grasp.`,
        );
        if (monster.msleeping) {
            monster.msleeping = 0;
            await publish(`${capitalizedMonsterName(monster)} awakens.`);
        }
        return true;
    }

    await publish(`You reach out your arms and grab ${monsterName(monster)}.`);
    if (monster.msleeping) {
        monster.msleeping = 0;
        await publish(`${capitalizedMonsterName(monster)} awakens.`);
    } else if (monster.mfrozen && random(monster.mfrozen) === 0) {
        monster.mcanmove = 1;
        monster.mfrozen = 0;
        await publish(`${capitalizedMonsterName(monster)} stirs.`);
    }

    const bodyWeight = MONSTER_BODY_META[monster.mnum]?.[0] ?? 0;
    if (!await canLiftMonster(monster, trap, bodyWeight, false, options))
        return true;
    const carriedWeight = (monster.minvent || monster.inventory || [])
        .reduce((total, object) => total + objectWeight(object), 0);
    if (carriedWeight
        && !await canLiftMonster(
            monster, trap, bodyWeight + carriedWeight, true, options,
        )) return true;

    await publish(`You pull ${monsterName(monster)} out of the pit.`);
    monster.mtrapped = 0;
    await rewardMonsterRescue(trap, monster, {
        state, publish, random, luckRandom,
    });
    await fillPitWithBoulder(trap.tx, trap.ty, state, publish);
    return true;
}

async function fillPitWithBoulder(x: number, y: number, state: GameState, publish: MessagePublisher): Promise<boolean> {
    const trap = trapAt(state, x, y);
    if (!trap || (trap.ttyp !== PIT && trap.ttyp !== SPIKED_PIT)) return false;
    const boulder = (state.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER);
    if (!boulder) return false;

    await deleteObject(boulder, state);
    removeTrap(trap, state);
    await buryFloorObjectsAt(x, y, state, { publish });
    if (!heroIsBlind(state) && cansee(x, y)) {
        await publish('The boulder fills a pit.');
    } else if (!heroIsDeaf(state)) {
        await publish('You hear a boulder settle.');
    }
    newsym(x, y);
    return true;
}

async function canLiftMonster(monster: Monster, trap: Trap, weight: number, carrying: boolean, options: FloorTrapOptions): Promise<boolean> {
    const { state, publish, luckRandom } = options;
    if (calcCapacity(state, weight) < HVY_ENCUMBER) return true;
    await publish(
        `${capitalizedMonsterName(monster)} is ${
            carrying ? 'carrying too much' : 'too heavy'
        } for you to lift.`,
    );
    if (!trap.madeby_u && !monster.mpeaceful && monster.mcanmove !== 0
        && !monsterIsMindless(monster.mnum)
        && MONSTER_SYMBOL[monster.mnum] !== S_HUMAN
        && luckRandom(10) < 3) {
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        await publish(
            `${capitalizedMonsterName(monster)} thinks it was nice of you to try.`,
        );
    }
    return false;
}

export async function rewardMonsterRescue(trap: Trap, monster: Monster, {
    state = game, publish = plineWithContinuation, random = rn2, luckRandom = rnl,
}: Pick<UntrapOptions, 'state' | 'publish' | 'random' | 'luckRandom'> = {}): Promise<void> {
    if (trap.madeby_u) return;
    const unique = !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ);
    if (luckRandom(10) < 8 && !monster.mpeaceful
        && !monsterIsHelpless(monster) && !monsterIsMindless(monster.mnum)
        && !unique && MONSTER_SYMBOL[monster.mnum] !== S_HUMAN) {
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        await publish(`${capitalizedMonsterName(monster)} is grateful.`);
    }
    if (random(3) === 0 && luckRandom(8) === 0
        && state.u?.ualign?.type === 1) {
        adjustHeroAlignment(1, state);
        await publish('You feel that you did the right thing.');
    }
}

async function handleBoxes(boxes: GameObject[], {
    state, force, ask, publish, random, rollOne, rollDice,
}: BoxTrapOptions): Promise<boolean | null> {
    for (const box of boxes) {
        const known = box.tknown && box.dknown;
        const name = OBJECT_NAMES[box.otyp] || box.name || 'box';
        const answer = await ask(known
            ? `Disarm this ${name}?`
            : `There is ${article(name)} ${name} here.  Check it for traps?`);
        if (answer === 'q') return false;
        if (answer === 'n') continue;
        if (known) {
            await disarmBox(box, {
                state, force, publish, random, rollOne, rollDice,
            });
        } else {
            await inspectBox(box, {
                state, force, ask, publish, random, rollOne, rollDice,
            });
        }
        return true;
    }
    await publish('There are no other chests or boxes here.');
    return null;
}

async function inspectBox(box: GameObject, options: BoxTrapOptions): Promise<void> {
    const { state, force, ask, publish, random } = options;
    const impaired = heroIsImpaired(state);
    const found = (box.otrapped
        && (force || (!impaired
            && random(MAXULEV + 1 - (state.u?.ulevel ?? 1)) < 10)))
        || box.tknown
        || (!force && impaired && random(3) === 0);
    const name = OBJECT_NAMES[box.otyp] || box.name || 'box';
    if (!found) {
        await publish(`You find no traps on the ${name}.`);
        return;
    }

    await publish(box.tknown && box.dknown
        ? `There's a trap on the ${name}.`
        : `You find a trap on the ${name}!`);
    box.tknown = true;
    box.dknown = true;
    if (!impaired) await exerciseAttribute(A_WIS, true, state);
    if (await ask('Disarm it?') === 'y')
        await disarmBox(box, options);
}

async function disarmBox(box: GameObject, {
    state, force, publish, random, rollOne, rollDice,
}: Omit<BoxTrapOptions, 'ask'>): Promise<void> {
    const name = OBJECT_NAMES[box.otyp] || box.name || 'box';
    if (!box.otrapped) {
        await publish(`That ${name} was not trapped.`);
        box.tknown = false;
        return;
    }

    let chance = currentAttribute(A_DEX, state) + (state.u?.ulevel ?? 1);
    if (state.urole?.key === 'rogue') chance *= 2;
    if (!force && (heroIsImpaired(state) || heroIsFumbling(state)
        || rollOne(75 + Math.trunc(level_difficulty() / 2)) > chance)) {
        const trap = await triggerChestTrap(box, {
            state, disarm: true, publish, random, rollDice,
        });
        if (trap?.died) return;
    } else {
        await publish('You disarm it!');
        box.otrapped = false;
        box.tknown = true;
        await awardExperience(8, 0, state, publish);
    }
    await exerciseAttribute(A_DEX, true, state);
}

async function handleDoor(x: number, y: number, {
    state, force, trapSkipped, ask, publish, random, rollOne,
}: Omit<BoxTrapOptions, 'rollDice'> & { trapSkipped: boolean }): Promise<boolean> {
    const door = state.level?.at?.(x, y);
    if (door?.typ !== DOOR) {
        if (!trapSkipped) await publish('You know of no traps there.');
        return false;
    }
    if (door.doormask === D_NODOOR) {
        await publish(`You ${heroIsBlind(state) ? 'feel' : 'see'} no door there.`);
        return false;
    }
    if (door.doormask === D_ISOPEN) {
        await publish('This door is safely open.');
        return false;
    }
    if (door.doormask === D_BROKEN) {
        await publish('This door is broken.');
        return false;
    }

    const impaired = heroIsImpaired(state);
    const found = ((door.doormask & D_TRAPPED)
        && (force || (!impaired
            && random(MAXULEV - (state.u?.ulevel ?? 1) + 11) < 10)))
        || (!force && impaired && random(3) === 0);
    if (!found) {
        await publish('You find no traps on the door.');
        return true;
    }

    await publish('You find a trap on the door!');
    await exerciseAttribute(A_WIS, true, state);
    if (await ask('Disarm it?') !== 'y') return true;
    if (!(door.doormask & D_TRAPPED)) {
        await publish('This door was not trapped.');
        return true;
    }

    const level = state.u?.ulevel ?? 1;
    const chance = 15 + (state.urole?.key === 'rogue' ? level * 3 : level);
    await exerciseAttribute(A_DEX, true, state);
    if (!force && (impaired || heroIsFumbling(state)
        || rollOne(75 + Math.trunc(level_difficulty() / 2)) > chance)) {
        await publish('You set it off!');
        await triggerDoorTrap(door, x, y, { state, publish, rollOne });
    } else {
        await publish('You disarm it!');
        door.doormask &= ~D_TRAPPED;
        await awardExperience(8, 0, state, publish);
    }
    return true;
}

async function triggerDoorTrap(door: MapLocation, x: number, y: number, { state, publish, rollOne }: Pick<BoxTrapOptions, 'state' | 'publish' | 'rollOne'>): Promise<void> {
    if (await triggerBoobyTrap('door', { bodypart: true, state, publish, rollOne })) return;
    door.doormask = D_NODOOR;
    vision_note_blocker_change(x, y);
    newsym(x, y);
    if (roomsAt(state.level, x, y, SHOPBASE).length) addShopDamage(x, y, 0, state);
}

async function awardExperience(experience: number, scoreBonus: number, state: GameState, publish: MessagePublisher): Promise<void> {
    addExperience(experience, scoreBonus, state);
    if (state === game) await checkExperienceLevel({ publish });
}
