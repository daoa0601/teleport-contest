import { trapName } from './trap_name.js';
// Finding and removing floor, container, and door traps.
// C ref: trap.c dountrap(), could_untrap(), and untrap().
import { formatFeltMessage } from './hero_speech.js';
import { monsterHasMapPosition } from './monster_location.js';
import { deleteTrap } from './trap_lifecycle.js';
import { vision_note_blocker_change } from './vision.js';
import { addShopDamage } from './shop_damage.js';
import { roomsAt } from './room.js';
import { SHOPBASE } from './const.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { adjustHeroAlignment } from './alignment.js';
import { artifactById } from './artifacts.js';
import { heroHasMagicKey } from './monster_key.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { triggerChestTrap } from './chest_trap.js';
import { heroFingerName } from './body_parts.js';
import { A_CON, A_DEX, A_STR, A_WIS, ARROW_TRAP, BEAR_TRAP, DART_TRAP, DISMOUNT_FELL, DOOR, D_BROKEN, D_ISOPEN, D_NODOOR, D_TRAPPED, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, LANDMINE, MAXULEV, PIT, SPIKED_PIT, SQKY_BOARD, WEB, WT_TOOMUCH_DIAGONAL, isok, } from './const.js';
import { displayMessageWindow, newsym, pline, plineWithContinuation } from './display.js';
import { level_difficulty } from './dungeon.js';
import { addExperience, checkExperienceLevel, } from './exper.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game } from './gstate.js';
import { convertTrapToObject } from './trap_object.js';
import { heroBadRock } from './hack.js';
import { consumeObjectCharge } from './object_charge.js';
import { heroHasConflict } from './hero_conflict.js';
import { heroCanSpinWeb } from './hero_web.js';
import { triggerHeroTrap } from './hero_traps.js';
import { maketrap } from './mklev.js';
import { dismountHero } from './steed.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { objectTypeKnown } from './shk.js';
import { isDoorMimic, isObjectOrFurnitureMimic, revealMimic } from './mimic.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { finishEnvironmentalMonsterDeath } from './monster_death.js';
import { setMonsterMalign } from './monster_alignment.js';
import { MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_GENO, MONSTER_MOVE, MONSTER_SYMBOL, monsterIsMindless, monsterTypeName, } from './monster_data.js';
import { MONSTER_SIZE } from './monster_data.js';
import { propertyIsActive } from './properties.js';
import { ARROW, BEARTRAP, BOULDER, CAN_OF_GREASE, DART, LAND_MINE, LARGE_BOX, CHEST, OBJECT_BIMANUAL, POT_OIL, } from './object_data.js';
import { deleteObject } from './object_delete.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import { heroHasNoHands, } from './polyself.js';
import { heroFormSticks, heroSpecies } from './hero_species.js';
import { promptYesNoQuit } from './query.js';
import { d, rnd, rn2, rnl } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { resolveImmediatePetrification, touchPetrifies, } from './stoning.js';
import { promptDirection } from './tty_prompts.js';
import { EXT_ENCUMBER, HVY_ENCUMBER, calcCapacity, inventoryWeight, nearCapacity, objectWeight, } from './weight.js';
import { isBlade } from './weapon_type.js';
import { cansee } from './vision.js';
import { observeObjectForNaming, definiteName, objectCombatName, objectQuestion, simpleObjectName, simpleObjectNameWithArticle, } from './objnam.js';
import { objectDescription } from './object_description.js';
import { monsterName as canonicalMonsterName } from './monster_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
const POTION_CLASS = 8;
const M1_WALLWALK = 0x00000008;
const G_UNIQ = 0x1000;
const S_HUMAN = 53;
const MZ_LARGE = 3;
function heroIsImpaired(state) {
    const hero = state.u;
    return !!hero.confused || (hero.confusionTurns ?? 0) > 0
        || heroIsHallucinating(state);
}
function heroIsStunned(state) {
    return !!(state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0);
}
function heroIsFumbling(state) {
    return !!(state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0);
}
function heroPassesWalls(state) {
    if (state.u.passesWalls)
        return true;
    const form = (state.u.mtimedone ?? 0) > 0 ? state.u.umonnum : null;
    return form !== null && form !== undefined && Number.isInteger(form)
        && !!((MONSTER_FLAGS1[form] ?? 0) & M1_WALLWALK);
}
function monsterAt(state, x, y) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
function trapAt(state, x, y) {
    return state.level?.traps?.find(trap => trap.tx === x && trap.ty === y) || null;
}
function boxesAt(state, x, y) {
    return (state.level?.objects?.[x]?.[y] || []).filter(object => object.otyp === LARGE_BOX || object.otyp === CHEST);
}
function possessiveTrap(trap) {
    return trap?.madeby_u ? 'your' : 'the';
}
function weldedTwoHandedWeapon(state) {
    const weapon = state.uwep || state.u?.uwep;
    return !!(weapon?.cursed && (OBJECT_BIMANUAL[weapon.otyp]));
}
export function untrapAbilityProblem(state = game, { checkFloor = false } = {}) {
    if (nearCapacity(state) >= HVY_ENCUMBER)
        return "You're too strained to do that.";
    const form = (state.u.mtimedone ?? 0) > 0 ? state.u.umonnum : null;
    if ((heroHasNoHands(state) && !heroCanSpinWeb(state))
        || (form !== null && form !== undefined && Number.isInteger(form) && (MONSTER_MOVE[form] ?? 0) === 0)) {
        return 'And just how do you expect to do that?';
    }
    if (state.u?.ustuck && heroFormSticks(state)) {
        return `You'll have to let go of ${canonicalMonsterName(state.u.ustuck, { state })} first.`;
    }
    if (state.u?.ustuck || weldedTwoHandedWeapon(state))
        return 'Your hands seem to be too busy for that.';
    if (checkFloor && !heroCanReachFloor(state))
        return "You can't reach the floor.";
    return null;
}
export async function doUntrap({ state = game, enterTrap = null, } = {}) {
    const problem = untrapAbilityProblem(state);
    if (problem) {
        await pline(problem);
        state.context.move = 0;
        return false;
    }
    const spentTime = await untrap({ state, enterTrap });
    if (state.program_state.gameover)
        return spentTime;
    state.context.move = spentTime ? 1 : 0;
    return spentTime;
}
export async function untrap({ state = game, container = null, door = null, force = false, enterTrap = null, chooseDirection = promptDirection, ask = promptYesNoQuit, chooseObject = chooseInventoryObject, publish = pline, random = rn2, rollOne = rnd, rollDice = d, luckRandom = rnl, } = {}) {
    if (!force && heroHasMagicKey(state))
        force = true;
    if (container) {
        await inspectBox(container, { state, force, ask, publish, random, rollOne, rollDice });
        return true;
    }
    if (door) {
        if (!isok(door.x, door.y)) {
            await publish('The perils lurking there are beyond your grasp.');
            return false;
        }
        const trap = trapAt(state, door.x, door.y);
        // C chooses the floor-trap name even when only the door is discussed.
        if (trap?.tseen)
            trapName(trap.ttyp, { state });
        return handleDoor(door.x, door.y, {
            state, force, trapSkipped: false, ask, publish, random, rollOne,
        });
    }
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
    if (trap && !trap.tseen)
        trap = null;
    // C untrap() chooses once, including attempts which never name the trap.
    const description = trap ? trapName(trap.ttyp, { state }) : '';
    const boxes = here ? boxesAt(state, x, y) : [];
    const canReachFloor = heroCanReachFloor(state);
    let handleTrap = canReachFloor;
    let trapSkipped = false;
    if (!canReachFloor && (trap || boxes.length)) {
        await publish(unreachableTrapMessage(description, boxes.length, here, state));
        trapSkipped = !!trap;
    }
    else if (canReachFloor && trap) {
        if (boxes.length) {
            if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
                const position = state.u?.utrap
                    ? " that you're stuck in"
                    : ' while standing on the edge of it';
                await publish(`You can't do much about the ${description}${position}.`);
                handleTrap = false;
                trapSkipped = true;
            }
            else {
                const choice = await chooseFloorTrapOrBox(trap, description, boxes.length, ask);
                if (choice === 'q')
                    return false;
                if (choice === 'n') {
                    handleTrap = false;
                    trapSkipped = true;
                }
            }
        }
        if (handleTrap) {
            return handleFloorTrap(trap, description, {
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
        if (used !== null)
            return used;
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
function unreachableTrapMessage(description, boxCount, here, state) {
    const things = [];
    if (description)
        things.push(withIndefiniteArticle(description));
    if (boxCount)
        things.push(boxCount === 1 ? 'a container' : 'containers');
    const subject = things.join(' and ');
    const plural = things.length > 1 || boxCount > 1;
    const mounted = state.u?.usteed ? ' while mounted' : '';
    const location = here ? 'here' : 'there';
    const object = plural ? 'them' : 'it';
    return `There ${plural ? 'are' : 'is'} ${subject} ${location} `
        + `but you can't reach ${object}${mounted}.`;
}
async function chooseFloorTrapOrBox(trap, noun, boxCount, ask) {
    const containers = boxCount === 1 ? 'a container' : 'containers';
    const verb = trap.ttyp === WEB ? 'Remove' : 'Disarm';
    const subject = `There ${boxCount === 1 ? 'is' : 'are'} ${containers} `
        + `and ${withIndefiniteArticle(noun)} here.`;
    return ask(`${subject}  ${verb} the ${noun}?`);
}
async function handleFloorTrap(trap, description, options) {
    const { state, publish } = options;
    const here = trap.tx === state.u.ux && trap.ty === state.u.uy;
    if (state.u?.utrap) {
        await publish(`You cannot deal with the ${description} while trapped${here ? ' in it' : ''}!`);
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
function webCuttingWeapon(trap, state) {
    if (monsterAt(state, trap.tx, trap.ty))
        return null;
    const primary = state.uwep || state.u?.uwep;
    if (primary && isBlade(primary))
        return primary;
    const secondary = state.uswapwep || state.u?.uswapwep;
    return state.u.twoweap && secondary && isBlade(secondary) ? secondary : null;
}
// C objnam.c:bare_artifactname(uwep): the primary weapon's artifact name
// with a lowercased leading "The ", or its plain xname() when it is no
// artifact (trap.c:5581 names the primary even for a fiery secondary).
function bareArtifactOrPlainName(weapon, state) {
    const artifact = artifactById(weapon?.oartifact, state);
    if (artifact)
        return artifact.name.replace(/^The /, 'the ');
    return weapon ? simpleObjectName(weapon, state) : '';
}
function untrapFailureRoll(trap, state, random) {
    let chance = 3;
    if (trap.ttyp === WEB) {
        const blade = webCuttingWeapon(trap, state);
        const artifact = artifactById(blade?.oartifact, state);
        if (blade && (artifact?.name === 'Sting'
            || artifact?.attack?.damageType === 'fire'))
            chance = 1;
        else if (!blade && !heroCanSpinWeb(state))
            chance = 7;
    }
    if (heroIsImpaired(state))
        chance++;
    if (heroIsBlind(state))
        chance++;
    if (heroIsStunned(state))
        chance += 2;
    if (heroIsFumbling(state))
        chance *= 2;
    if (trap.madeby_u)
        chance--;
    const role = state.urole?.key;
    if (role === 'ranger' && trap.ttyp === BEAR_TRAP && chance <= 3)
        return 0;
    if (role === 'rogue') {
        if (random(2 * MAXULEV) < (state.u?.ulevel ?? 1))
            chance--;
        if (state.u?.uhave?.questart && chance > 1)
            chance--;
    }
    else if (role === 'ranger' && chance > 1) {
        chance--;
    }
    return random(Math.max(1, chance));
}
async function tryDisarm(trap, { state, publish, random, rollOne, luckRandom, enterTrap, forceFailure = false, }) {
    const monster = monsterAt(state, trap.tx, trap.ty);
    const holdingTrap = trap.ttyp === BEAR_TRAP || trap.ttyp === WEB;
    if (monster && (!monster.mtrapped || !holdingTrap)) {
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} is in the way.`);
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
    // C trap.c:5461-5469 duplicates only the tight-space core of
    // test_move(): bad rock in both orthogonal squares plus overencumbrance
    // or a big form.  cant_squeeze_thru()'s extra exemptions do not apply.
    const tooTight = !!(dx && dy
        && heroBadRock(state, state.u.ux, trap.ty)
        && heroBadRock(state, trap.tx, state.u.uy)
        && (((state.inventory || []).length > 0
            && inventoryWeight(state) > WT_TOOMUCH_DIAGONAL)
            || (MONSTER_SIZE[heroSpecies(state)] ?? 2) >= MZ_LARGE));
    if (tooTight) {
        await publish(`You are unable to reach the ${trapName(trap.ttyp, { state })}!`);
        return 0;
    }
    // C trap.c:5471-5477 splits this refusal into an unskilled-rider
    // rider_cant_reach() case and a generic one, but can_reach_floor()'s
    // rider check (engrave.c:197-198) precedes anything reachable from
    // untrap(), so a mounted hero is always refused by the main flow and
    // only the generic message is reachable here.
    if (!heroCanReachFloor(state, { checkPit: here })) {
        await publish(`You are unable to reach the ${trapName(trap.ttyp, { state })}!`);
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
        }
        else if (here) {
            const result = await triggerHeroTrap(trap, { failedUntrap: true });
            if (result.died)
                return 1;
        }
        else {
            const entered = enterTrap ? await enterTrap(trap) : null;
            if (entered?.died)
                return 1;
            if (!entered?.entered) {
                const preposition = [BEAR_TRAP, PIT, SPIKED_PIT, WEB]
                    .includes(trap.ttyp) ? 'into' : 'onto';
                await publish(`Fortunately, you don't move ${preposition} it.`);
            }
        }
    }
    else {
        const owner = trap.madeby_u ? 'Your' : here ? 'This' : 'That';
        const action = trap.ttyp === WEB ? 'remove' : 'disarm';
        await publish(`${owner} ${trapName(trap.ttyp, { state })} is difficult to ${action}.`);
    }
    return 1;
}
async function failMonsterRescue(monster, trap, { state, publish, random, rollOne, }) {
    if (trap.ttyp === BEAR_TRAP) {
        if (monster.mtame) {
            // C trap.c:5485-5486 -> abuse_dog(): Aggravate_monster or
            // Conflict halves tameness instead of the single-point hit.
            monster.mtame = heroHasConflict(state)
                || propertyIsActive('aggravateMonster', state)
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
    }
    else if (trap.ttyp === WEB) {
        if (!heroCanSpinWeb(state) && random(3) === 0) {
            const existing = trapAt(state, state.u.ux, state.u.uy);
            const web = existing ?? await maketrap(state.u.ux, state.u.uy, WEB);
            if (web?.ttyp === WEB) {
                await publish("The web sticks to you.  You're caught too!");
                await triggerHeroTrap(web, { noWebMessage: true });
                if (state.u.usteed && state.u.utrap) {
                    const dismount = await dismountHero(DISMOUNT_FELL);
                    if (dismount.died)
                        return;
                }
            }
        }
        if (monster.mtrapped)
            await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} remains entangled.`);
    }
}
async function disarmHoldingTrap(trap, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    const { state, publish, random, luckRandom } = options;
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (monster) {
        monster.mtrapped = 0;
        const noun = trap.ttyp === BEAR_TRAP ? 'bear trap' : 'web';
        await publish(`You extract ${canonicalMonsterName(monster, { state })} from ${possessiveTrap(trap)} ${noun}.`);
        await rewardMonsterRescue(trap, monster, {
            state, publish, random, luckRandom,
        });
    }
    else if (trap.ttyp === BEAR_TRAP) {
        await publish(`You disarm ${possessiveTrap(trap)} bear trap.`);
        await convertTrapToObject(trap, BEARTRAP, 1, state);
        return true;
    }
    else {
        // C trap.c:5575-5586 picks the blade without regard to the monster
        // that was just extracted, and names the primary weapon's artifact
        // (bare_artifactname(uwep)) for the fiery-blade message.
        const primary = state.uwep || state.u?.uwep;
        const secondary = state.uswapwep || state.u?.uswapwep;
        const blade = primary && isBlade(primary) ? primary
            : state.u.twoweap && secondary && isBlade(secondary)
                ? secondary : null;
        const artifact = artifactById(blade?.oartifact, state);
        if (blade && artifact && blade === primary && artifact.name === 'Sting')
            await publish(`Sting cuts through ${possessiveTrap(trap)} web!`);
        else if (blade && artifact && artifact.attack?.damageType === 'fire')
            await publish(`${bareArtifactOrPlainName(primary, state)} burns through ${possessiveTrap(trap)} web!`);
        else if (blade)
            await publish(`You cut through ${possessiveTrap(trap)} web.`);
        else
            await publish(`You succeed in removing ${possessiveTrap(trap)} web.`);
        removeTrap(trap, state);
    }
    newsym(trap.tx, trap.ty);
    return true;
}
async function disarmLandmine(trap, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} land mine.`);
    await convertTrapToObject(trap, LAND_MINE, 1, options.state);
    return true;
}
async function disarmShootingTrap(trap, objectType, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} trap.`);
    const count = 50 - options.luckRandom(50);
    await convertTrapToObject(trap, objectType, count, options.state);
    return true;
}
async function disarmSqueakyBoard(trap, options) {
    const tool = await chooseSqueakyBoardTool(options);
    if (!tool)
        return false;
    const badTool = tool.cursed
        || ((tool.otyp !== POT_OIL || tool.lamplit)
            && (tool.otyp !== CAN_OF_GREASE || !(tool.spe ?? 0)));
    const result = await tryDisarm(trap, {
        ...options, forceFailure: !!badTool,
    });
    if (result < 2)
        return result !== 0;
    if (tool.otyp === CAN_OF_GREASE) {
        await consumeObjectCharge(tool, { state: options.state });
    }
    else {
        await consumeOne(tool, options.state);
        recordObjectKnowledge(POT_OIL, options.state);
    }
    await options.publish('You repair the squeaky board.');
    removeTrap(trap, options.state);
    newsym(trap.tx, trap.ty);
    await awardExperience(1, 5, options.state, options.publish);
    return true;
}
// C trap.c:disarm_squeaky_board(): getobj("untrap with", unsqueak_ok,
// GETOBJ_PROMPT).  unsqueak_ok() downplays potions other than known oil.
async function chooseSqueakyBoardTool({ state, chooseObject }) {
    return chooseObject('untrap with', object => {
        if (object.otyp === CAN_OF_GREASE)
            return GETOBJ_SUGGEST;
        if (object.otyp === POT_OIL && object.dknown && objectTypeKnown(object, state))
            return GETOBJ_SUGGEST;
        return object.oclass === POTION_CLASS ? GETOBJ_DOWNPLAY : GETOBJ_EXCLUDE;
    }, { forcePrompt: true });
}
async function consumeOne(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) {
        await deleteObject(object, state);
        return;
    }
    object.quan = object.quantity = quantity - 1;
    object.owt = objectWeight(object);
}
function removeTrap(trap, state) {
    deleteTrap(trap, state);
    if (state.u?.utrap && state.u.ux === trap.tx && state.u.uy === trap.ty) {
        state.u.utrap = 0;
        state.u.utraptype = 0;
    }
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (monster?.mtrapped)
        monster.mtrapped = 0;
}
async function handlePit(trap, options) {
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
function monsterIsHelpless(monster) {
    return !!(monster.msleeping || monster.mfrozen
        || monster.mcanmove === 0);
}
async function helpMonsterOut(monster, trap, options) {
    const { state, publish, random, luckRandom } = options;
    if (!monster.mtrapped) {
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} isn't trapped.`);
        return false;
    }
    if (nearCapacity(state) >= EXT_ENCUMBER) {
        await publish("You can't do that while carrying so much stuff.");
        return true;
    }
    const failed = untrapFailureRoll(trap, state, random);
    if (failed && !monsterIsHelpless(monster)) {
        await publish(`You try to reach out your arms, but ${canonicalMonsterName(monster, { state })} backs away skeptically.`);
        return true;
    }
    if (touchPetrifies(monster.mnum)
        && !(state.uarmg || state.u?.uarmg)
        && !(state.u.stoneResistance)) {
        const species = monsterTypeName(monster.mnum, !!monster.female);
        await publish(`You grab the trapped ${species} using your bare hands.`);
        const contact = await resolveImmediatePetrification({
            state,
            killer: `trying to help ${withIndefiniteArticle(species)} out of a pit`,
            publish: plineWithContinuation,
        });
        if (contact.died || !contact.transformed)
            return true;
        await displayMessageWindow();
    }
    if (failed) {
        await publish(`You try to grab ${canonicalMonsterName(monster, { state })}, but cannot get a firm grasp.`);
        if (monster.msleeping) {
            monster.msleeping = 0;
            await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} awakens.`);
        }
        return true;
    }
    await publish(`You reach out your arms and grab ${canonicalMonsterName(monster, { state })}.`);
    if (monster.msleeping) {
        monster.msleeping = 0;
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} awakens.`);
    }
    else if (monster.mfrozen && random(monster.mfrozen) === 0) {
        monster.mcanmove = 1;
        monster.mfrozen = 0;
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} stirs.`);
    }
    const bodyWeight = MONSTER_BODY_META[monster.mnum]?.[0] ?? 0;
    if (!await canLiftMonster(monster, trap, bodyWeight, false, options))
        return true;
    const carriedWeight = (monster.minvent || monster.inventory || [])
        .reduce((total, object) => total + objectWeight(object), 0);
    if (carriedWeight
        && !await canLiftMonster(monster, trap, bodyWeight + carriedWeight, true, options))
        return true;
    await publish(`You pull ${canonicalMonsterName(monster, { state })} out of the pit.`);
    monster.mtrapped = 0;
    await rewardMonsterRescue(trap, monster, {
        state, publish, random, luckRandom,
    });
    await fillPitWithBoulder(trap.tx, trap.ty, state, publish);
    return true;
}
async function fillPitWithBoulder(x, y, state, publish) {
    const trap = trapAt(state, x, y);
    if (!trap || (trap.ttyp !== PIT && trap.ttyp !== SPIKED_PIT))
        return false;
    const boulder = (state.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER);
    if (!boulder)
        return false;
    await deleteObject(boulder, state);
    removeTrap(trap, state);
    await buryFloorObjectsAt(x, y, state, { publish });
    if (!heroIsBlind(state) && cansee(x, y)) {
        await publish('The boulder fills a pit.');
    }
    else if (!heroIsDeaf(state)) {
        await publish('You hear a boulder settle.');
    }
    newsym(x, y);
    return true;
}
async function canLiftMonster(monster, trap, weight, carrying, options) {
    const { state, publish, luckRandom } = options;
    if (calcCapacity(state, weight) < HVY_ENCUMBER)
        return true;
    await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} is ${carrying ? 'carrying too much' : 'too heavy'} for you to lift.`);
    if (!trap.madeby_u && !monster.mpeaceful && monster.mcanmove !== 0
        && !monsterIsMindless(monster.mnum)
        && MONSTER_SYMBOL[monster.mnum] !== S_HUMAN
        && luckRandom(10) < 3) {
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} thinks it was nice of you to try.`);
    }
    return false;
}
export async function rewardMonsterRescue(trap, monster, { state = game, publish = plineWithContinuation, random = rn2, luckRandom = rnl, } = {}) {
    if (trap.madeby_u)
        return;
    const unique = !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ);
    if (luckRandom(10) < 8 && !monster.mpeaceful
        && !monsterIsHelpless(monster) && !monsterIsMindless(monster.mnum)
        && !unique && MONSTER_SYMBOL[monster.mnum] !== S_HUMAN) {
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} is grateful.`);
    }
    if (random(3) === 0 && luckRandom(8) === 0
        && state.u?.ualign?.type === 1) {
        adjustHeroAlignment(1, state);
        await publish(formatFeltMessage('that you did the right thing.', state));
    }
}
async function handleBoxes(boxes, { state, force, ask, publish, random, rollOne, rollDice, }) {
    for (const box of boxes) {
        const known = box.tknown && box.dknown;
        if (!known)
            observeObjectForNaming(box, { state });
        const answer = await ask(await objectQuestion(box, {
            prefix: known ? 'Disarm this ' : 'There is ',
            suffix: known ? '' : ' here.  Check it for traps?',
            fallback: 'a box',
            format: async (object, nameState) => known
                ? objectCombatName(object, { state: nameState, includeCorpseSpecies: false })
                : await objectDescription(object, { state: nameState }),
            shortFormat: simpleObjectNameWithArticle,
        }, state));
        if (answer === 'q')
            return false;
        if (answer === 'n')
            continue;
        if (known) {
            await disarmBox(box, {
                state, force, publish, random, rollOne, rollDice,
            });
        }
        else {
            await inspectBox(box, {
                state, force, ask, publish, random, rollOne, rollDice,
            });
        }
        return true;
    }
    await publish('There are no other chests or boxes here.');
    return null;
}
async function inspectBox(box, options) {
    const { state, force, ask, publish, random } = options;
    const impaired = heroIsImpaired(state);
    const found = (box.otrapped
        && (force || (!impaired
            && random(MAXULEV + 1 - (state.u?.ulevel ?? 1)) < 10)))
        || box.tknown
        || (!force && impaired && random(3) === 0);
    const alreadyKnown = box.tknown && box.dknown;
    const name = definiteName(objectCombatName(box, { state, includeCorpseSpecies: false }), state);
    if (!found) {
        await publish(`You find no traps on ${name}.`);
        return;
    }
    await publish(alreadyKnown
        ? `There's a trap on ${name}.`
        : `You find a trap on ${name}!`);
    box.tknown = true;
    box.dknown = true;
    if (!impaired)
        await exerciseAttribute(A_WIS, true, state);
    if (await ask('Disarm it?') === 'y')
        await disarmBox(box, options);
}
async function disarmBox(box, { state, force, publish, random, rollOne, rollDice, }) {
    if (!box.otrapped) {
        await publish(`That ${objectCombatName(box, { state, includeCorpseSpecies: false })} was not trapped.`);
        box.tknown = false;
        return;
    }
    let chance = currentAttribute(A_DEX, state) + (state.u?.ulevel ?? 1);
    if (state.urole?.key === 'rogue')
        chance *= 2;
    if (!force && (heroIsImpaired(state) || heroIsFumbling(state)
        || rollOne(75 + Math.trunc(level_difficulty() / 2)) > chance)) {
        const trap = await triggerChestTrap(box, {
            state, disarm: true, bodyPart: heroFingerName(state), publish, random, rollDice,
        });
        if (trap?.died)
            return;
    }
    else {
        await publish('You disarm it!');
        box.otrapped = false;
        box.tknown = true;
        await awardExperience(8, 0, state, publish);
    }
    await exerciseAttribute(A_DEX, true, state);
}
async function handleDoor(x, y, { state, force, trapSkipped, ask, publish, random, rollOne, }) {
    const door = state.level?.at?.(x, y);
    if (door?.typ !== DOOR) {
        if (!trapSkipped)
            await publish('You know of no traps there.');
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
    if (await ask('Disarm it?') !== 'y')
        return true;
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
    }
    else {
        await publish('You disarm it!');
        door.doormask &= ~D_TRAPPED;
        await awardExperience(8, 0, state, publish);
    }
    return true;
}
async function triggerDoorTrap(door, x, y, { state, publish, rollOne }) {
    if (await triggerBoobyTrap('door', { bodypart: true, state, publish, rollOne }))
        return;
    door.doormask = D_NODOOR;
    vision_note_blocker_change(x, y);
    newsym(x, y);
    if (roomsAt(state.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0, state);
}
async function awardExperience(experience, scoreBonus, state, publish) {
    addExperience(experience, scoreBonus, state);
    if (state === game)
        await checkExperienceLevel({ publish });
}
//# sourceMappingURL=untrap.js.map