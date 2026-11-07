// The kick command and its damage helpers.
// C refs: dokick.c dokick()/kick_monster()/kickdmg()/kick_ouch()/kick_dumb()
//     /kick_door()/kick_nondoor().
import { COIN_CLASS, GEM_CLASS } from './objclass.js';
import { objectBaseCost, objectBimanual, BOULDER, KICKING_BOOTS, ROCK, CHEST, CORPSE, LARGE_BOX, EGG, EXPENSIVE_CAMERA, MIRROR, BAG_OF_HOLDING, BAG_OF_TRICKS, APPLE, BANANA, DILITHIUM_CRYSTAL, EUCALYPTUS_LEAF, LUCKSTONE, ORANGE, PEAR, } from './object_data.js';
import { A_CHA, A_CON, A_DEX, A_STR, A_WIS, ALTAR, CORR, DBWALL, D_BROKEN, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, D_WARNED, DOOR, FOUNTAIN, G_GONE, GRAVE, IRONBARS, IS_DRAWBRIDGE, IS_OBSTRUCTED, IS_STWALL, IS_TREE, Is_stronghold, LADDER, LA_DOWN, LAVAWALL, Luck, M_AP_MONSTER, M_AP_TYPE, MM_ANGRY, MM_FEMALE, MM_MALE, MM_NOMSG, NON_PM, ROOM, SCORR, SDOOR, SINK, S_LDWASHER, S_LPUDDING, STAIRS, THRONE, T_LOOTED, TREE_LOOTED, TREE_SWARM, Is_airlevel, Is_waterlevel, SHOPBASE, SHOP_DOOR_COST, STATUE_TRAP, WEB, is_pit, IS_SOFT, MIGR_LADDER_UP, MIGR_NOBREAK, MIGR_NOSCATTER, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_UP, MIGR_TO_SPECIES, MIGR_WITH_HERO, TRAPDOOR, Upolyd, W_ARMF, ZAP_POS, is_hole, FOOT, LEG } from './const.js';
import { isok, commandResultCancelled, promptDirection } from './cmd.js';
import { rn1, rnd, rn2, rnl } from './rng.js';
import { canSeeMonster, canSpotMonster, feel_location, feel_newsym, glyphAt, map_invisible, newsym, show_glyph_cell, unmap_invisible } from './display.js';
import { formatHeardMessage, pline, plineWithContinuation, publishHeardMessage } from './pline.js';
import { heroIsBlind, heroIsHallucinating, heroIsDeaf } from './senses.js';
import { adjustHeroAlignment, changeHeroLuck, currentAttribute, currentStrength, exerciseAttribute } from './attrib.js';
import { findDrawbridgeAt, isPoolAt, isIceAt } from './dbridge.js';
import { wakeMonstersNearWithMessages, angerAttackedMonster, wakeAttackedMonster, maybeUnhideAt, angerWatchGuards, isWatch, revealMonsterAppearance, maybeMnexto, finishHeroMonsterKill, finishHurtleMonsterDeath, } from './mon.js';
import { woundHeroLegs, gotoLevel, scheduleLevelChange, applyFloorEffects } from './do.js';
import { finishTeleportArrival, askTeleportDestination, relocateObjectRandomly, enexto, goodPosition, monsterTeleportRestricted, } from './teleport.js';
import { applyHeroContactPassive, applyCaitiffPenalty, prepareAppliedWeaponAttack } from './uhitm.js';
import { AT_KICK } from './monster_attack_types.js';
import { deleteEngravingAt, wipeHeroEngraving, disturbGrave } from './engrave.js';
import { displayColorName, displayLiquidName, monsterName, nameOrc } from './do_name.js';
import { kickWithMonsterForm } from './hero_form_kick.js';
import { useHeroSkill, specialContactDamage } from './weapon.js';
import { admitHeroKick, kickCanReachTarget } from './kick_admission.js';
import { monsterAtPosition } from './steed.js';
import { game, requireGameLevel, requireInitializedGame, requirePlayingGame, requireLiveGame } from './gstate.js';
import { flyKickedObject } from './thrown_object.js';
import { monsterProjectileDisplay } from './mthrowu.js';
import { killerObjectName, objectNameIsPlural, observeObjectForNaming, corpseName, objectCombatName, objectDescription, makePlural, rndClass, withIndefiniteArticle } from './objnam.js';
import { mksobj, mkgold, unlinkObject, splitObjectStack, objectWeight, placeCreatedObject, placeObject, remove_object, isContainer } from './mkobj.js';
import { vision_recalc, vision_reset, cansee, couldsee, vision_note_blocker_change } from './vision.js';
import { convertSecretDoor, findTrap } from './detect.js';
import { heroPolyGender, heroSpecies, body_part } from './polyself.js';
import { makemonAt } from './makemon.js';
import { altarWrath } from './pray.js';
import { sinkBacksUp } from './fountain.js';
import { bringLeashedFollowers, snuffCandle } from './apply.js';
import { displayMessageWindow } from './topl.js';
import { stairwayAt, stairway_find_from } from './stairs.js';
import { MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL, MONSTER_NAME, MONSTER_BODY_META, MONSTER_FLAGS2 } from './monster_data.js';
import { abusePet } from './dog.js';
import { closedDoor, makeMonsterFlee, setMonsterApparentHeroPosition } from './monmove.js';
import { updateMonsterRegions } from './region.js';
import { trapAt, mintrap, resolveImmediatePetrification, waterDamageObject, activateStatueTrapAt, triggerChestTrap, triggerBoobyTrap, fall_through, } from './trap.js';
import { artifactById } from './artifact.js';
import { impactDisturbsZombies, loseHeroHp, checkHeroAttackOverexertion, invWeight, weightCapacity, roomsAt, inTown, heroGoldAmount, inventoryWeight } from './hack.js';
import { breakChestLock, maybeResetPick } from './lock.js';
import { breakFloorObject, hurtleHero, hitMonsterWithKickedObject } from './dothrow.js';
import { inventoryItemDescription, delobj, currency, stack_object } from './invent.js';
import { costlyAdjacent, costlySpot, addShopObjectToBill, removeObjectAndContentsFromBill, findObjectOwner, stolenValue, costlyGold, donateGold, objectIsUnpaid, pickedContainer, hotPursuitShopkeeper, deleteObject, insideShopRoomAt, makeAngryShopkeeper, containedGold, makeShopkeeperHappy, addShopDamage, payForShopDamage, shopDig } from './shk.js';
import { scatterFloorObjects } from './scatter.js';
import { objectMaterial } from './o_init.js';
import { addObjectToMonsterInventory, removeWornHeroItem } from './steal.js';
import { hasShopkeeperData } from './shop_types.js';
import { hiddenGold } from './vault.js';
import { finishMonsterEating } from './dogmove.js';
import { onQuestStart, okToQuest } from './quest.js';
import { ceilingName, dungeonDepth, surfaceName, canFallThrough } from './dungeon.js';
import { eggHasMonsterSpecies } from './egg_impact.js';
import { shopkeeperName } from './shknam.js';
import { objectResistsDestruction } from './zap.js';
import { is_mercenary, likes_gold, monsterCanTeleport, monsterHasEyes, monsterHasNoHands, monsterHasNoLimbs, monsterIsBig, monsterIsClinger, monsterIsFlyer, monsterIsGiant, monsterIsHider, monsterIsSlithy, monsterIsThickSkinned, touchPetrifies, heroResistsStoning, } from './mondata.js';
// C dokick.c:martial(): the macro combining martial_bonus(),
// is_bigfoot(), and kicking boots.
export function heroHasMartialKick(state = game) {
    return state.urole?.key === 'monk' || state.urole?.key === 'samurai'
        || state.u.umonnum === MONSTER_NAME.indexOf('sasquatch')
        || (state.uarmf || state.u.uarmf)?.otyp === KICKING_BOOTS;
}
// C dokick.c:kick_ouch().
async function kickOuch(x, y, objectName = '') {
    await plineWithContinuation('Ouch!  That hurts!');
    await exerciseAttribute(A_DEX, false);
    await exerciseAttribute(A_STR, false);
    if (isok(x, y)) {
        if (heroIsBlind(game))
            await feel_location(x, y);
        const location = game.level?.at(x, y);
        const bridge = location && (location.typ === DOOR || location.typ === DBWALL)
            ? findDrawbridgeAt(x, y) : null;
        if (bridge) {
            await plineWithContinuation('The drawbridge is unaffected.');
            x = bridge.x;
            y = bridge.y;
        }
        await wakeMonstersNearWithMessages(x, y, 25);
    }
    if (rn2(3) === 0) {
        await woundHeroLegs('right', 5 + rnd(5));
    }
    let damage = rnd(currentAttribute(A_CON) > 15 ? 3 : 5);
    if (game.u?.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    const died = await damageHeroFromKick(damage, x, y, objectName);
    if (!died && kickCausesRecoil())
        await recoilFromKick(4 + rn2(2));
}
// Part of C dokick.c:kick_ouch(): the Is_airlevel()||Levitation recoil gate.
function kickCausesRecoil() {
    return Is_airlevel(game.u?.uz) || game.u?.levitating
        || game.u?.levitation || game.levitating;
}
// C dokick.c:kickstr().
function kickDeathReason(x, y) {
    if (!isok(x, y))
        return 'kicking nothing';
    const location = game.level?.at?.(x, y);
    if (!location)
        return 'kicking nothing';
    if (location.typ === DOOR)
        return 'kicking a door';
    if (IS_TREE(location.typ))
        return 'kicking a tree';
    if (IS_STWALL(location.typ))
        return 'kicking a wall';
    if (IS_OBSTRUCTED(location.typ))
        return 'kicking a rock';
    if (location.typ === THRONE)
        return 'kicking a throne';
    if (location.typ === FOUNTAIN)
        return 'kicking a fountain';
    if (location.typ === GRAVE)
        return 'kicking a headstone';
    if (location.typ === SINK)
        return 'kicking a sink';
    if (location.typ === ALTAR)
        return 'kicking an altar';
    if (IS_DRAWBRIDGE(location.typ))
        return 'kicking a drawbridge';
    if (location.typ === STAIRS)
        return 'kicking the stairs';
    if (location.typ === LADDER)
        return 'kicking a ladder';
    if (location.typ === IRONBARS)
        return 'kicking an iron bar';
    return 'kicking something weird';
}
// Part of C dokick.c:kick_ouch(): the losehp(Maybe_Half_Phys) with
// kickstr().
async function damageHeroFromKick(amount, x, y, objectName) {
    const killer = objectName ? `kicking ${objectName}` : kickDeathReason(x, y);
    return loseHeroHp(amount, killer, { deathCause: `killed by ${killer}` });
}
// C dokick.c:1425-1436 kick recoil: range = (3 * mdat->cwt)
// / (youmonst.data->cwt + (weight_cap() + inv_weight())), floored at 1.
const HUMAN_WEIGHT = 1450;
// Part of C dokick.c:dokick(): the youmonst.data->cwt factor.
function heroBodyWeight(state = game) {
    const form = Upolyd(state.u)
        ? state.u.umonnum
        : state.urace?.mnum;
    return form === undefined ? HUMAN_WEIGHT : MONSTER_BODY_META[form]?.[0] ?? HUMAN_WEIGHT;
}
// Part of C dokick.c:dokick(): the 3*cwt recoil range.
export function kickRecoilRange(monsterMnum, state = game) {
    const targetWeight = MONSTER_BODY_META[monsterMnum]?.[0] ?? 0;
    const movingWeight = Math.max(1, heroBodyWeight(state) + inventoryWeight(state));
    return Math.max(1, Math.trunc(3 * targetWeight / movingWeight));
}
// Part of C dokick.c:kick_ouch(), dokick.c:dokick(): the hurtle() recoil.
async function recoilFromKick(range) {
    const { dx, dy } = game.u;
    if (dx === undefined || dy === undefined)
        throw new Error('Kick recoil requires an attempted direction.');
    return hurtleHero(-dx, -dy, range, {
        verbose: true,
        finishTeleport: finishTeleportArrival,
        gotoLevel,
        chooseTeleportDestination: askTeleportDestination,
        finishMonsterDeath: finishHurtleMonsterDeath,
    });
}
// Part of C dokick.c:kick_monster(): the passive(mon, uarmf) counterattack
// calls.
function applyKickPassive(monster, hit) {
    return applyHeroContactPassive(monster, {
        hit,
        defenderSurvived: monster.mhp > 0,
        attackType: AT_KICK,
        weapon: game.uarmf || game.u?.uarmf || null,
    });
}
// C dokick.c:kick_monster()
// The live-target kick: maybe_kick_monster()'s admission, the levitation
// miss, the hidden-target reveal, the poly'd kick attacks
// (kickWithMonsterForm()), the encumbrance/clumsy roll (prepareKick()),
// the evasion dance (tryKickEvasion()) and kickdmg()'s damage pass.
// Form-specific attacks share the command admission rules. Projection affects only the
// target noun: dokick() still targets m_at(x,y) when the actor is invisible.
async function kickLiveMonster(monster, x, y) {
    const forcefight = game.context.forcefight;
    try {
        if (!monster.mpeaceful || !canSpotMonster(monster))
            game.context.forcefight = true;
        const permission = await prepareAppliedWeaponAttack(monster, null, { struckAt: { x, y } });
        if (!permission.proceed) {
            game.context.move = permission.spentTime ? 1 : 0;
            return false;
        }
        if (await checkHeroAttackOverexertion()) {
            game.context.move = 1;
            return false;
        }
    }
    finally {
        if (forcefight === undefined)
            delete game.context.forcefight;
        else
            game.context.forcefight = forcefight;
    }
    await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20);
    wipeHeroEngraving(2);
    await angerAttackedMonster(monster);
    if (await levitatingKickMisses(monster)) {
        await pline('Floating in the air, you miss wildly!');
        await exerciseAttribute(A_DEX, false);
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return true;
    }
    if (monster.mundetected
        || (M_AP_TYPE(monster) && M_AP_TYPE(monster) !== M_AP_MONSTER)) {
        monster.mundetected = 0;
        await revealMonsterAppearance(monster);
        if (canSpotMonster(monster)) {
            await newsym(x, y);
            const name = monsterName(monster, { article: 'a' });
            await plineWithContinuation(`There is ${name} here.`);
        }
        else {
            await map_invisible(x, y);
            await plineWithContinuation('There is something hidden here.');
        }
    }
    if (await kickWithMonsterForm(monster, x, y)) {
        game.context.move = 1;
        return true;
    }
    const martial = heroHasMartialKick();
    const kick = await prepareKick({
        martial,
        announce: pline,
    });
    if (kick.stopped) {
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return true;
    }
    await plineWithContinuation(`You kick ${monsterName(monster)}.`);
    const evaded = await tryKickEvasion(monster, {
        clumsy: kick.clumsy,
        martial,
        announce: plineWithContinuation,
        nameMonster: actor => monsterName(actor, { capitalized: true }),
    });
    if (evaded) {
        await applyKickPassive(monster, false);
        if (monster.mx === x && monster.my === y
            && !canSpotMonster(monster))
            await map_invisible(x, y);
        game.context.move = 1;
        return true;
    }
    const outcome = await kickdmg(monster, kick.clumsy, martial, x, y);
    if (outcome.heroDied && !outcome.moveTaken)
        return true;
    game.context.move = 1;
    return true;
}
// C dokick.c:kickdmg()
// Damage for a kick that connected when not poly'd into a kicking form:
// the base roll (prepareKickDamage()), the shade pass-through, the
// seemimic()/check_caitiff() reveals (revealMonsterAppearance(),
// applyCaitiffPenalty()), the pet abuse, the martial roll
// (rollKickDamage()), the reel (tryKickReel()), the passive counterattack
// and the kill, then the skill use.  moveTaken records whether C's flow
// still consumed the move after a hero death.
async function kickdmg(monster, clumsy, martial, x, y) {
    const preparedDamage = prepareKickDamage(monster, {
        clumsy,
    });
    if (preparedDamage.passesThroughShade) {
        await plineWithContinuation('The kick passes harmlessly through.');
        return { heroDied: false, moveTaken: true };
    }
    await revealMonsterAppearance(monster);
    await applyCaitiffPenalty(monster);
    const petReaction = await abuseKickedPet(monster, preparedDamage.potentialDamage);
    if (petReaction.heroDied)
        return { heroDied: true, moveTaken: false };
    const damage = await rollKickDamage(preparedDamage, { martial });
    if (damage.damage > 0)
        monster.mhp -= damage.damage;
    const reel = await tryKickReel(monster, x - (game.u?.ux ?? x), y - (game.u?.uy ?? y), {
        martial,
        announce: plineWithContinuation,
        nameMonster: actor => monsterName(actor, { capitalized: true }),
    });
    if (reel?.heroDied)
        return { heroDied: true, moveTaken: false };
    const passive = await applyKickPassive(monster, true);
    if (passive.heroDied) {
        return { heroDied: true, moveTaken: true };
    }
    if ((monster.mhp ?? 1) <= 0 && !reel?.dead) {
        await finishHeroMonsterKill(monster, monster.mx, monster.my, {
            hallucinating: heroIsHallucinating(game),
        });
    }
    else if (monster.mx === x && monster.my === y
        && !canSpotMonster(monster)) {
        await map_invisible(x, y);
    }
    if (damage.trainSkill)
        await useHeroSkill(35);
    return { heroDied: false, moveTaken: true };
}
// ---------------------------------------------------------------------------
// C dokick.c:ghitm(). A thrown or kicked purse a greedy monster catches.
// ---------------------------------------------------------------------------
const PM_SOLDIER = 277;
const PM_SERGEANT = 278;
const PM_LIEUTENANT = 280;
const PM_CAPTAIN = 281;
const MERCENARY_BASE_BRIBE = new Map([
    [PM_SOLDIER, 100],
    [PM_SERGEANT, 250],
    [PM_LIEUTENANT, 500],
    [PM_CAPTAIN, 750],
]);
// Port only: gold object quan accessor.
function goldQuantity(object) {
    return Math.max(0, Math.trunc(object?.quan ?? object?.quantity ?? 0));
}
// Part of C dokick.c:ghitm(): the miss() message.
async function missGold(monster, gold, state) {
    const name = objectCombatName(gold, { state });
    const spotted = cansee(monster.mx, monster.my) || canSpotMonster(monster);
    const target = state.flags.verbose !== false && spotted ? monsterName(monster, { state }) : 'it';
    await pline(`The ${name} ${goldQuantity(gold) === 1 ? 'misses' : 'miss'} ${target}.`);
}
// Part of C dokick.c:ghitm(): the shopkeeper credit/robbed branch.
async function finishShopkeeperCatch(monster, value, state) {
    if (!hasShopkeeperData(monster))
        throw new Error('Shopkeeper gold payment requires shopkeeper data.');
    const robbedBefore = Math.max(0, Math.trunc(monster.eshk.robbed ?? 0));
    if (robbedBefore) {
        const robbedAfter = Math.max(0, robbedBefore - value);
        await pline(`The amount ${robbedAfter ? 'partially ' : ''}covers ${monster.female ? 'her' : 'his'} recent losses.`);
        monster.eshk.robbed = robbedAfter;
        if (!robbedAfter)
            await makeShopkeeperHappy(monster, { state });
        return;
    }
    if (monster.mpeaceful) {
        monster.eshk.credit = Math.max(0, Math.trunc(monster.eshk.credit ?? 0)) + value;
        await pline(`You have ${monster.eshk.credit} ${currency(monster.eshk.credit, { state })} in credit.`);
    }
    else {
        // C ghitm verbalizes this without a Deaf guard; unlike the shk.c
        // call sites, the pinned dokick.c speech prints for deaf heroes.
        await pline('"Thanks, scum!"');
    }
}
// Part of C dokick.c:ghitm(): the watchman gold branch.
async function finishGuardCatch(monster, state) {
    const visible = heroGoldAmount(state);
    const hidden = hiddenGold(state, true);
    const speech = visible ? 'Drop the rest and follow me.'
        : hidden ? 'You still have hidden gold.  Drop it now.'
            : monster.mpeaceful
                ? "I'll take care of that; please move along."
                : "I'll take that; now get moving.";
    // dokick.c ghitm verbalizes guard speech unconditionally.
    await pline(`"${speech}"`);
}
// Part of C dokick.c:ghitm(): the mercenary bribe branch.
async function finishMercenaryCatch(monster, value, state) {
    const wasAngry = !monster.mpeaceful;
    let required = MERCENARY_BASE_BRIBE.get(monster.mnum) ?? 0;
    if (required && rn2(3) !== 0) {
        const charisma = Math.max(3, currentAttribute(A_CHA, state));
        required += Math.trunc((heroGoldAmount(state)
            + (state.u?.ulevel ?? 1) * rn2(5)) / charisma);
        if (value > required)
            monster.mpeaceful = 1;
    }
    // dokick.c ghitm verbalizes mercenary replies unconditionally.
    if (!monster.mpeaceful) {
        await pline(required
            ? '"That\'s not enough, coward!"'
            : '"I don\'t take bribes from scum like you!"');
    }
    else if (wasAngry) {
        await pline('"That should do.  Now beat it!"');
    }
    else {
        await pline(`"Thanks for the tip, ${state.flags?.female ? 'lady' : 'buddy'}."`);
    }
}
// C dokick.c:ghitm(). A thrown or kicked purse a greedy monster catches.
export async function resolveGoldMonsterContact({ state, monster, gold, wakeMonster, angerMonster, }) {
    const greedy = likes_gold(monster?.mnum);
    const mercenary = is_mercenary(monster?.mnum);
    const eligible = greedy || monster?.isshk || monster?.ispriest
        || monster?.isgd || mercenary;
    if (!eligible) {
        await wakeMonster?.(monster);
        await missGold(monster, gold, state);
        return false;
    }
    if (monster.mcanmove === 0 || monster.mcanmove === false) {
        if (canSeeMonster(monster))
            await pline(`The ${objectCombatName(gold, { state })} harmlessly ${goldQuantity(gold) === 1 ? 'hits' : 'hit'} ${monsterName(monster, { state })}.`);
        else
            await missGold(monster, gold, state);
        return false;
    }
    const wasSleeping = !!monster.msleeping;
    const value = goldQuantity(gold) * objectBaseCost(gold.otyp);
    monster.msleeping = 0;
    await finishMonsterEating(monster, state);
    if (!monster.isgd && rn2(4) === 0)
        await angerMonster?.(monster);
    if (cansee(monster.mx, monster.my)) {
        await pline(`${monsterName(monster, { state, capitalized: true })} ${wasSleeping ? 'awakens and ' : ''}catches the gold.`);
    }
    await addObjectToMonsterInventory(monster, gold, state);
    if (monster.isshk) {
        await finishShopkeeperCatch(monster, value, state);
    }
    else if (monster.ispriest) {
        await pline(monster.mpeaceful
            ? '"Thank you for your contribution."' : '"Thanks, scum!"');
    }
    else if (monster.isgd) {
        await finishGuardCatch(monster, state);
    }
    else if (mercenary) {
        await finishMercenaryCatch(monster, value, state);
    }
    return true;
}
// C dokick.c:dokick().
export async function dokick() {
    if (!await admitHeroKick())
        return;
    const direction = await promptDirection();
    if (!direction || (!direction.dx && !direction.dy)) {
        commandResultCancelled(); // dokick() returns ECMD_CANCEL.
        return;
    }
    game.u.dx = direction.dx;
    game.u.dy = direction.dy;
    const x = game.u.ux + game.u.dx;
    const y = game.u.uy + game.u.dy;
    // C dokick() records gk.kickedloc for every valid directed kick before
    // dispatching the target.  Peaceful monsters and pets consult it during
    // this same elapsed turn so they do not step into the square just kicked.
    game._kickedLoc = { x, y };
    if (!await kickCanReachTarget())
        return;
    const average = game.uarmf?.otyp === KICKING_BOOTS ? 99
        : Math.trunc((currentStrength()
            + currentAttribute(A_DEX) + currentAttribute(A_CON)) / 3);
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (monster) {
        const cell = game.level?.at(x, y);
        const oldGlyph = cell ? { ch: cell.disp_ch, color: cell.disp_color,
            decgfx: cell.disp_decgfx, attr: cell.disp_attr, metadata: glyphAt(x, y) } : null;
        const recoilRange = kickRecoilRange(monster.mnum);
        if (!await kickLiveMonster(monster, x, y))
            return;
        const glyph = glyphAt(x, y);
        if (monster.dead || monster.mhp <= 0) {
            if (oldGlyph && glyph?.kind === 'invisible' && oldGlyph.metadata?.kind !== 'invisible')
                await show_glyph_cell(x, y, oldGlyph.ch, oldGlyph.color, oldGlyph.decgfx, oldGlyph.attr, oldGlyph.metadata);
        }
        else if (!canSpotMonster(monster) && monster.mx === x && monster.my === y
            && glyph?.kind !== 'invisible' && !(game.u.uswallow && game.u.ustuck === monster))
            await map_invisible(x, y);
        if (!game.program_state.gameover && kickCausesRecoil() && game.context.move)
            await recoilFromKick(recoilRange);
        return;
    }
    const location = game.level?.at(x, y);
    // dokick() wakes the broad hero-level neighborhood before it dispatches
    // the concrete terrain owner.  kick_ouch() then performs the smaller
    // impact-centered wake after its attribute exercise draws.
    await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20);
    wipeHeroEngraving(2);
    if (!isok(x, y)) {
        await kickOuch(x, y);
        game.context.move = 1;
        return;
    }
    await unmap_invisible(x, y);
    if ((isPoolAt(x, y) || location?.typ === LAVAWALL) !== !!game.u.uinwater) {
        await plineWithContinuation(`You splash some ${displayLiquidName(isPoolAt(x, y) ? 'water' : 'lava')} around.`);
        game.context.move = 1;
        return;
    }
    const kickedObject = game.level?.objects?.[x]?.[y]?.[0];
    const hasBoulder = game.level?.objects?.[x]?.[y]?.some(object => object.otyp === BOULDER);
    if (kickedObject && (!game.u.levitating || Is_airlevel(game.u.uz)
        || Is_waterlevel(game.u.uz) || hasBoulder)) {
        const kicked = await kickFloorObject(x, y, {
            state: game,
            dx: game.u.dx,
            dy: game.u.dy,
            publish: plineWithContinuation,
        });
        if (game.program_state.gameover)
            return;
        if (!kicked)
            await kickOuch(x, y, killerObjectName(kickedObject));
        else if (Is_airlevel(game.u.uz))
            await recoilFromKick(1);
        game.context.move = 1;
        return;
    }
    if (!location || (IS_STWALL(location.typ) && !IS_TREE(location.typ))) {
        await kickOuch(x, y);
        game.context.move = 1;
        return;
    }
    if (location.typ === GRAVE) {
        if (game.u.levitating || game.u.levitation || game.levitating) {
            await kickDumb(x, y);
        }
        else if (rn2(4) !== 0) {
            await kickOuch(x, y);
        }
        else if (!location.disturbed && rn2(2) === 0) {
            await disturbGrave(x, y);
        }
        else {
            await exerciseAttribute(A_WIS, false);
            const alignment = game.u.ualign;
            if (!alignment)
                throw new Error('Breaking a grave requires hero alignment.');
            if (game.urole?.key === 'archeologist' || game.urole?.key === 'samurai'
                || (alignment.type === 1 && alignment.record > -10))
                adjustHeroAlignment(-Math.sign(alignment.type));
            location.typ = ROOM;
            location.emptygrave = 0;
            location.disturbed = 0;
            placeCreatedObject(await mksobj(ROCK, true, false), x, y);
            deleteEngravingAt(x, y);
            if (heroIsBlind(game))
                await pline('Crack!  Something broke!');
            else {
                await pline('The headstone topples over and breaks!');
                await newsym(x, y);
            }
        }
        game.context.move = 1;
        return;
    }
    if (location.typ === DOOR) {
        await kickDoor(x, y, average, { ouch: kickOuch, dumb: kickDumb });
        return;
    }
    if (location.typ === SDOOR) {
        if (!game.u.levitating && rn2(30) < average) {
            convertSecretDoor(location);
            const uncover = (location.doormask & (D_LOCKED | D_TRAPPED)) === D_LOCKED;
            await pline(`Crash!  ${uncover ? 'Your kick uncovers' : 'You kick open'} a secret door!`);
            await exerciseAttribute(A_DEX, true);
            if (location.doormask & D_TRAPPED) {
                location.doormask = D_NODOOR;
                if (await triggerBoobyTrap('door', { bodypart: true }))
                    return;
            }
            else if (location.doormask !== D_NODOOR && !(location.doormask & D_LOCKED)) {
                location.doormask = D_ISOPEN;
            }
            await feel_newsym(x, y);
            vision_reset();
            await vision_recalc(0);
        }
        else {
            await kickOuch(x, y);
        }
        game.context.move = 1;
        return;
    }
    if (await kickNonDoorTerrain(x, y, average, { ouch: kickOuch, dumb: kickDumb }))
        return;
    await kickDumb(x, y);
    game.context.move = 1;
}
// C dokick.c:kick_dumb().
async function kickDumb(x, y) {
    // dokick.c:kick_dumb() always abuses Dexterity before deciding whether
    // an unremarkable floor kick is merely empty or strains a muscle.
    await exerciseAttribute(A_DEX, false);
    const martial = heroHasMartialKick();
    if (martial || currentAttribute(A_DEX) >= 16 || rn2(3) !== 0) {
        await pline('You kick at empty space.');
        if (heroIsBlind(game))
            await feel_location(x, y);
    }
    else {
        await pline('Dumb move!  You strain a muscle.');
        await exerciseAttribute(A_STR, false);
        await woundHeroLegs('right', 5 + rnd(5));
    }
    if (kickCausesRecoil() && rn2(2) !== 0)
        await recoilFromKick(1);
}
// C dokick.c:kick_door().
export async function kickDoor(x, y, average, responses) {
    requirePlayingGame(game);
    const door = game.level.requireAt(x, y);
    game.context.move = 1;
    if (door.doormask === D_ISOPEN || door.doormask === D_BROKEN || door.doormask === D_NODOOR) {
        await responses.dumb(x, y);
        return;
    }
    if (game.u.levitating) {
        await responses.ouch(x, y);
        return;
    }
    await exerciseAttribute(A_DEX, true);
    const giant = Upolyd(game.u) && monsterIsGiant(heroSpecies());
    const breaks = giant || rnl(35) < average + (heroHasMartialKick() ? currentAttribute(A_DEX) : 0);
    if (breaks) {
        const shopDoor = roomsAt(game.level, x, y, SHOPBASE).length > 0;
        if (door.doormask & D_TRAPPED) {
            if (game.flags.verbose)
                await plineWithContinuation('You kick the door.');
            await exerciseAttribute(A_STR, false);
            door.doormask = D_NODOOR;
            if (await triggerBoobyTrap('door', { bodypart: true }))
                return;
        }
        else if (currentAttribute(A_STR) > 18 && rn2(5) === 0 && !shopDoor) {
            await plineWithContinuation('As you kick the door, it shatters to pieces!');
            await exerciseAttribute(A_STR, true);
            door.doormask = D_NODOOR;
        }
        else {
            await plineWithContinuation('As you kick the door, it crashes open!');
            await exerciseAttribute(A_STR, true);
            door.doormask = D_BROKEN;
        }
        await feel_newsym(x, y);
        // Preserve the keeper's pre-break visibility until shop billing.
        vision_note_blocker_change(x, y);
        if (shopDoor) {
            addShopDamage(x, y, SHOP_DOOR_COST);
            await payForShopDamage('break');
        }
        await witnessDoorKick(x, y, true);
    }
    else {
        if (heroIsBlind())
            await feel_location(x, y);
        await exerciseAttribute(A_STR, true);
        await plineWithContinuation(heroIsDeaf() || rn2(3) === 0 ? 'Thwack!!' : 'Whammm!!');
        await witnessDoorKick(x, y, false);
    }
}
// Part of C dokick.c:kick_door(): the watchman response to door damage.
// Also C mon.c:get_iter_mons(), mon.c:get_iter_mons_xy(): the first watch
// witness whose predicate fires; both C walkers stop at the same
// is_watch()+mpeaceful+couldsee() monster.
async function witnessDoorKick(x, y, broken) {
    requirePlayingGame(game);
    if (!inTown(game.level, x, y))
        return;
    const witness = [...game.level.monsters].reverse().find(monster => !monster.dead && monster.mhp > 0 && isWatch(monster)
        && monster.mpeaceful && couldsee(monster.mx, monster.my));
    if (!witness)
        return;
    if (broken)
        await watchmanThiefArrest(witness);
    else
        await watchmanDoorDamage(witness, x, y);
}
// C dokick.c:watchman_thief_arrest()
async function watchmanThiefArrest(monster) {
    if (!isWatch(monster) || !couldsee(monster.mx, monster.my)
        || !monster.mpeaceful)
        return false;
    await watchmanYells(monster, "Halt, thief!  You're under arrest!");
    await angerWatchGuards(false);
    return true;
}
// C dokick.c:watchman_door_damage()
async function watchmanDoorDamage(monster, x, y) {
    if (!isWatch(monster) || !monster.mpeaceful
        || !couldsee(monster.mx, monster.my))
        return false;
    const door = requireGameLevel(game).requireAt(x, y);
    if ((door.looted ?? 0) & D_WARNED) {
        await watchmanYells(monster, "Halt, vandal!  You're under arrest!");
        await angerWatchGuards(false);
    }
    else {
        await watchmanYells(monster, 'Hey, stop damaging that door!');
        door.looted = (door.looted ?? 0) | D_WARNED;
    }
    return true;
}
// Part of C dokick.c:watchman_thief_arrest(), dokick.c:watchman_door_damage():
// the watchman's yell (mon_yells()/verbalize()).
async function watchmanYells(monster, shout) {
    const name = monsterName(monster, { article: 'a', capitalized: true });
    if (heroIsDeaf()) {
        if (canSpotMonster(monster))
            await plineWithContinuation(`${name} angrily waves ${monster.female ? 'her' : 'his'} arms!`);
        return;
    }
    if (canSpotMonster(monster))
        await plineWithContinuation(`${name} yells:`);
    else
        await publishHeardMessage('someone yell:', plineWithContinuation);
    await plineWithContinuation(`"${shout}"`);
}
// C dokick.c:kick_nondoor().
export async function kickNonDoorTerrain(x, y, average, responses) {
    requirePlayingGame(game);
    const location = game.level.requireAt(x, y);
    if (location.typ === SCORR) {
        if (!game.u.levitating && rn2(30) < average) {
            await plineWithContinuation('Crash!  You kick open a secret passage!');
            await exerciseAttribute(A_DEX, true);
            location.typ = CORR;
            await feel_newsym(x, y);
            vision_note_blocker_change(x, y);
        }
        else
            await responses.ouch(x, y);
    }
    else if (location.typ === THRONE) {
        await kickThrone(x, y, location, responses);
    }
    else if (location.typ === ALTAR || location.typ === FOUNTAIN) {
        await kickAltarOrFountain(x, y, location, responses);
    }
    else if (IS_TREE(location.typ)) {
        await kickTree(x, y, location, responses);
    }
    else if (location.typ === SINK) {
        await kickSink(x, y, location, responses);
    }
    else if (location.typ === IRONBARS || location.typ === STAIRS || location.typ === LADDER) {
        if (location.typ !== IRONBARS && location.ladder === LA_DOWN)
            await responses.dumb(x, y);
        else
            await responses.ouch(x, y);
    }
    else
        return false;
    game.context.move = 1;
    return true;
}
// Part of C dokick.c:kick_nondoor(): the throne cases.
async function kickThrone(x, y, location, responses) {
    requirePlayingGame(game);
    if (game.u.levitating) {
        await responses.dumb(x, y);
        return;
    }
    const luck = Luck(game.u);
    if ((luck < 0 || location.looted) && rn2(3) === 0) {
        location.looted = 0;
        location.typ = ROOM;
        await mkgold(rnd(200), x, y);
        await plineWithContinuation(heroIsBlind() ? 'CRASH!  You destroy it.' : 'CRASH!  You destroy the throne.');
        if (!heroIsBlind())
            await newsym(x, y);
        await exerciseAttribute(A_DEX, true);
        return;
    }
    if (luck > 0 && rn2(3) === 0 && !location.looted) {
        await mkgold(rn1(201, 300), x, y);
        for (let gems = Math.min(luck + 1, 6); gems > 0; gems--)
            placeCreatedObject(await mksobj(rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1), false, true), x, y);
        await plineWithContinuation(heroIsBlind() ? 'You kick something loose!' : 'You kick loose some ornamental coins and gems!');
        if (!heroIsBlind())
            await newsym(x, y);
        location.looted = T_LOOTED;
        return;
    }
    if (rn2(4) === 0) {
        const current = game.u.uz;
        const dungeon = game.dungeons[current.dnum];
        if (dungeon && current.dlevel < dungeon.num_dunlevs) {
            await fall_through(false);
            return;
        }
    }
    await responses.ouch(x, y);
}
// Part of C dokick.c:kick_nondoor(): the altar and fountain cases.
async function kickAltarOrFountain(x, y, location, responses) {
    if (game.u.levitating) {
        await responses.dumb(x, y);
        return;
    }
    const altar = location.typ === ALTAR;
    await plineWithContinuation(`You kick ${heroIsBlind() ? 'something' : altar ? 'the altar' : 'the fountain'}.`);
    if (altar)
        await altarWrath(x, y);
    if (rn2(3) === 0) {
        await responses.ouch(x, y);
        return;
    }
    if (!altar && game.uarmf && rn2(3) !== 0) {
        if (await waterDamageObject(game.uarmf, [], game, { force: true, description: 'metal boots', publish: plineWithContinuation }) === 'nothing')
            await plineWithContinuation('Your boots get wet.');
    }
    await exerciseAttribute(A_DEX, true);
}
// Part of C dokick.c:kick_nondoor(): the G_GONE species check.
function speciesGone(species) {
    return !!((game.mvitals?.[species]?.mvflags ?? 0) & G_GONE);
}
// Part of C dokick.c:kick_nondoor(): the tree case (fruit, bees).
async function kickTree(x, y, location, responses) {
    const bee = MONSTER_NAME.indexOf('killer bee');
    if (rn2(3) !== 0) {
        if (rn2(6) === 0 && !speciesGone(bee))
            await publishHeardMessage('a low buzzing.', plineWithContinuation);
        await responses.ouch(x, y);
        return;
    }
    if (rn2(15) !== 0 && !((location.looted ?? 0) & TREE_LOOTED)) {
        const fruits = [APPLE, ORANGE, PEAR, BANANA, EUCALYPTUS_LEAF];
        const type = fruits[rn2(fruits.length)];
        if (type === undefined)
            throw new Error('Tree fruit selection requires an object type.');
        const fruit = placeCreatedObject(await mksobj(type, true, false), x, y);
        const count = 8 - rnl(7);
        fruit.quan = fruit.quantity = count;
        fruit.owt = objectWeight(fruit);
        const name = objectCombatName(fruit);
        await plineWithContinuation(count > 1 ? `Some ${name} fall from the tree!` : `${withIndefiniteArticle(name).replace(/^./u, letter => letter.toUpperCase())} falls from the tree!`);
        const fallen = await scatterFloorObjects(x, y, 2, { onlyObject: fruit, mayDestroy: false, mayFracture: false,
            mayHitHero: true, mayHitMonsters: true, heroCaused: true, publish: plineWithContinuation });
        if (fallen !== count) {
            const caught = await mksobj(type, true, false);
            caught.quan = caught.quantity = count - fallen;
            await plineWithContinuation(`${count - fallen} ${objectCombatName(caught)} got caught in the branches.`);
        }
        await exerciseAttribute(A_DEX, true);
        await exerciseAttribute(A_WIS, true);
        await newsym(x, y);
        location.looted = (location.looted ?? 0) | TREE_LOOTED;
        return;
    }
    if (!((location.looted ?? 0) & TREE_SWARM)) {
        let made = 0;
        let position = { x, y };
        for (let count = rnl(4) + 2; count > 0; count--) {
            const next = enexto(bee, position.x, position.y);
            if (!next)
                continue;
            position = next;
            if (await makemonAt(bee, position.x, position.y, MM_ANGRY | MM_NOMSG))
                made++;
        }
        await plineWithContinuation(made ? "You've attracted the tree's former occupants!" : 'You smell stale honey.');
        location.looted = (location.looted ?? 0) | TREE_SWARM;
        return;
    }
    await responses.ouch(x, y);
}
// Part of C dokick.c:kick_nondoor(): the sink cases.
async function kickSink(x, y, location, responses) {
    const gender = heroPolyGender();
    if (game.u.levitating) {
        await responses.dumb(x, y);
        return;
    }
    if (rn2(5) !== 0) {
        await plineWithContinuation(heroIsDeaf() ? 'Klunk!' : 'Klunk!  The pipes vibrate noisily.');
        await exerciseAttribute(A_DEX, true);
        return;
    }
    const pudding = MONSTER_NAME.indexOf('black pudding');
    const demon = MONSTER_NAME.indexOf('amorous demon');
    if (!((location.looted ?? 0) & S_LPUDDING) && rn2(3) === 0 && !speciesGone(pudding)) {
        if (!heroIsBlind())
            await plineWithContinuation(`A ${displayColorName('black')} ooze gushes up from the drain!`);
        else if (!heroIsDeaf())
            await publishHeardMessage('a gushing sound.', plineWithContinuation);
        await makemonAt(pudding, x, y, MM_NOMSG);
        await exerciseAttribute(A_DEX, true);
        await newsym(x, y);
        location.looted = (location.looted ?? 0) | S_LPUDDING;
    }
    else if (!((location.looted ?? 0) & S_LDWASHER) && rn2(3) === 0 && !speciesGone(demon)) {
        await plineWithContinuation(`${heroIsBlind() ? 'Something' : 'The dish washer'} returns!`);
        if (await makemonAt(demon, x, y, MM_NOMSG | (gender === 1 || gender === 2 && rn2(2) ? MM_MALE : MM_FEMALE)))
            await newsym(x, y);
        location.looted = (location.looted ?? 0) | S_LDWASHER;
        await exerciseAttribute(A_DEX, true);
    }
    else if (rn2(3) === 0)
        await sinkBacksUp(x, y);
    else
        await responses.ouch(x, y);
}
const S_EYE = 5;
const S_LIGHT = 25;
const S_EEL = 57;
const PM_SHADE = 288;
// Part of C dokick.c:kick_monster(): the teleports/floats/swoops/slides/
// jumps evasion verb chain.
function evasionVerb(monster, state) {
    const symbol = MONSTER_SYMBOL[monster.mnum];
    if (monsterCanTeleport(monster.mnum) && !monsterTeleportRestricted(monster, state))
        return 'teleports';
    if (symbol === S_EYE || symbol === S_LIGHT)
        return 'floats';
    if (monsterIsFlyer(monster.mnum))
        return 'swoops';
    if (monsterHasNoLimbs(monster.mnum) || monsterIsSlithy(monster.mnum))
        return 'slides';
    return 'jumps';
}
// Part of C dokick.c:kickdmg(): the pet abuse and flee.
export async function abuseKickedPet(monster, potentialDamage, { state = game, } = {}) {
    if (!await abusePet(monster, state))
        return { heroDied: false };
    if (!monster.mtame) {
        monster.mflee = 0;
        return { heroDied: false };
    }
    const turns = potentialDamage > 0 ? rnd(potentialDamage) : 1;
    return makeMonsterFlee(monster, { state, turns, announce: false });
}
// Part of C dokick.c:kick_monster(): the clumsy-kick encumbrance and armor
// checks.
export async function prepareKick({ martial = false, state = game, announce = async () => { }, } = {}) {
    let clumsy = false;
    const capacity = weightCapacity(state);
    const unusedCapacity = -invWeight(state);
    if (unusedCapacity < Math.trunc((capacity * 3) / 10)) {
        const noDamageRange = unusedCapacity < Math.trunc(capacity / 10) ? 2
            : unusedCapacity < Math.trunc(capacity / 5) ? 3 : 4;
        if (rn2(noDamageRange) === 0) {
            if (martial)
                return { stopped: false, clumsy: false };
            await announce('Your clumsy kick does no damage.');
            return { stopped: true, clumsy: false };
        }
        if (unusedCapacity < Math.trunc(capacity / 10)) {
            clumsy = true;
        }
        else if (rn2(unusedCapacity < Math.trunc(capacity / 5) ? 2 : 3) === 0) {
            clumsy = true;
        }
    }
    const fumbling = !!(state.u?.fumbling
        || (state.u?.fumblingTurns ?? 0) > 0);
    if (fumbling) {
        clumsy = true;
    }
    else {
        const armor = state.uarm || state.u?.uarm;
        // C dokick.c:253 reads objects[uarm->otyp].oc_bulky raw; the
        // oc_bulky armor flag shares the oc_big bit with oc_bimanual.
        const bulky = armor && objectBimanual(armor.otyp);
        if (bulky && currentAttribute(A_DEX, state) < rnd(25))
            clumsy = true;
    }
    return { stopped: false, clumsy };
}
// Part of C dokick.c:kick_monster(): the "Floating in the air, you miss
// wildly!" check.
export async function levitatingKickMisses(monster, state = game) {
    const levitating = !!(state.u?.levitating || state.u?.levitation
        || state.levitating);
    if (!levitating || rn2(3) !== 0)
        return false;
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 1
        || monsterIsFlyer(monster.mnum))
        return false;
    return true;
}
// Part of C dokick.c:kick_monster(): the block-or-evade branch.
export async function tryKickEvasion(monster, { clumsy = false, martial = false, state = game, announce = async () => { }, nameMonster = target => monsterName(target, { state, capitalized: true }), } = {}) {
    if (rn2(clumsy ? 3 : 4) !== 0)
        return false;
    const canEvade = (clumsy || (MONSTER_SIZE[monster.mnum] ?? 2) < 3)
        && monster.mcansee !== 0 && !monster.mtrapped
        && !monsterIsThickSkinned({ mnum: monster.mnum })
        && MONSTER_SYMBOL[monster.mnum] !== S_EEL
        && monsterHasEyes(monster.mnum)
        && monster.mcanmove !== 0 && !monster.mstun && !monster.mconf
        && !monster.msleeping && (MONSTER_MOVE[monster.mnum] ?? 0) >= 12;
    if (!canEvade)
        return false;
    if (!monsterHasNoHands(monster.mnum) && rn2(martial ? 5 : 3) === 0) {
        await announce(`${nameMonster(monster)} blocks your ${clumsy ? 'clumsy ' : ''}kick.`);
        return true;
    }
    const relocation = await maybeMnexto(monster, state);
    if (!relocation?.moved)
        return false;
    await unmap_invisible(relocation.oldx, relocation.oldy);
    await announce(`${nameMonster(monster)} ${evasionVerb(monster, state)}, ${clumsy ? 'easily' : 'nimbly'} evading your ${clumsy ? 'clumsy ' : ''}kick.`);
    return true;
}
// Part of C dokick.c:kickdmg(): base damage, shade, and special_dmgval()
// setup.
export function prepareKickDamage(monster, { clumsy = false, state = game, } = {}) {
    const boots = state.uarmf || state.u?.uarmf;
    let damage = Math.trunc((currentStrength(state) + currentAttribute(A_DEX, state)
        + currentAttribute(A_CON, state)) / 15);
    if (boots?.otyp === KICKING_BOOTS)
        damage += 5;
    if (clumsy)
        damage = Math.trunc(damage / 2);
    const thickSkinned = monsterIsThickSkinned({ mnum: monster.mnum });
    if (thickSkinned || monster.mnum === PM_SHADE)
        damage = 0;
    const specialDamage = specialContactDamage(state.u, monster, W_ARMF, { state }).damage;
    if (monster.mnum === PM_SHADE && specialDamage === 0) {
        return {
            potentialDamage: 0,
            specialDamage: 0,
            passesThroughShade: true,
        };
    }
    return { potentialDamage: damage, specialDamage, passesThroughShade: false };
}
// Part of C dokick.c:kickdmg(): the rnd(dmg) roll with martial and boot
// bonuses.
export async function rollKickDamage(prepared, { martial = false, state = game, } = {}) {
    const boots = state.uarmf || state.u?.uarmf;
    let damage = prepared.potentialDamage;
    let trainSkill = false;
    if (damage > 0) {
        damage = rnd(damage);
        if (martial) {
            trainSkill = damage > 1;
            damage += rn2(Math.trunc(currentAttribute(A_DEX, state) / 2) + 1);
        }
        await exerciseAttribute(A_DEX, true, state);
    }
    damage += prepared.specialDamage + (boots?.spe ?? 0)
        + (state.u?.udaminc ?? state.udaminc ?? 0);
    return { damage: Math.max(0, damage), trainSkill };
}
// Part of C dokick.c:kickdmg(): the martial reel (knock-back) with mintrap().
export async function tryKickReel(monster, dx, dy, { martial = false, state = game, announce = async () => { }, nameMonster = target => monsterName(target, { state, capitalized: true }), } = {}) {
    requirePlayingGame(state);
    if ((monster.mhp ?? 1) <= 0 || !martial
        || monsterIsBig(monster.mnum))
        return null;
    if (rn2(3) !== 0 || monster.mcanmove === 0
        || monster === state.u?.ustuck || monster.mtrapped)
        return null;
    const x = monster.mx + Math.sign(dx);
    const y = monster.my + Math.sign(dy);
    if (!goodPosition(x, y, { kind: 'monster', monster }, { state }))
        return null;
    await announce(`${nameMonster(monster)} reels from the blow.`);
    const oldx = monster.mx;
    const oldy = monster.my;
    updateMonsterRegions(monster, state, { x, y });
    monster.mx = x;
    monster.my = y;
    await newsym(oldx, oldy);
    await newsym(x, y);
    setMonsterApparentHeroPosition(monster, state, rn2);
    const trap = await mintrap(monster, state, {
        publish: announce, describeMonster: nameMonster,
    });
    const event = trap.event;
    return {
        oldx, oldy, x, y,
        trap: event,
        dead: !!monster.dead || (monster.mhp ?? 1) <= 0,
        heroDied: !!event && 'heroDied' in event && !!event.heroDied,
    };
}
// C dokick.c:container_impact_dmg().  A kicked, dropped, or thrown
// container may lose fragile contents.  Callers own placement and pass the
// object's PRE-impact coordinates for shop-room attribution.
const GLASS = 19;
// Part of C dokick.c:container_impact_dmg(): the charge for each destroyed item.
// dokick.c:443-450 per-item adapter: mark no_charge for the hero's own
// contents, then charge the item at its pre-destruction value.  Called by
// the container-impact owner immediately before each deletion.
export async function chargeDestroyedShopContent(object, x, y, fromInventory, { publish = plineWithContinuation, state = game } = {}) {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot)
        return 0;
    if (fromInventory && !object.unpaid)
        object.no_charge = true;
    return stolenValue(object, x, y, !!spot.resident.mpeaceful, { silent: true, publish, state });
}
// Part of C dokick.c:container_impact_dmg(): the shop-debt and anger summary after destruction.
// dokick.c:476-484 summary: insider debt or outsider damage and anger.
export async function settleDestroyedShopCharges({ loss, x, y, publish = plineWithContinuation, state = game }) {
    requireLiveGame(state);
    const spot = costlySpot(x, y, state);
    if (!spot || !loss)
        return { loss, settled: false };
    const objectRooms = roomsAt(state.level, x, y, SHOPBASE);
    // C inside_shop(): a boundary hero is an outsider; the decode is the
    // shared shk helper, and the first-room equality stays separate.
    const heroRoom = insideShopRoomAt(state, state.u.ux, state.u.uy);
    const insider = heroRoom != null && objectRooms[0] === heroRoom.roomno;
    if (!insider) {
        await publish(`You caused ${loss} ${currency(loss)} worth of damage!`);
        await makeAngryShopkeeper(spot.resident, state);
    }
    else {
        await publish(`You owe ${shopkeeperName(spot.resident)} ${loss} ${currency(loss)} for objects destroyed.`);
    }
    return { loss, settled: true };
}
// C dokick.c:container_impact_dmg().
export async function containerImpactDamage(container, x, y, { state = game, publish = plineWithContinuation, random = rn2, fromInventory = true, } = {}) {
    // Contents breakage mutates live floor state, shop billing, and the
    // topline.
    requireLiveGame(state);
    /* only consider normal containers */
    if (!isContainer(container)
        || container.otyp === BAG_OF_HOLDING
        || container.otyp === BAG_OF_TRICKS
        || !(container.contents?.length))
        return;
    let loss = 0;
    let weightChanged = false;
    // C walks the cobj chain head to tail; add_to_container() prepends
    // (mkobj.c:2692-2693), so the chain is newest-first and the per-item
    // RNG outcomes land on the same objects in this iteration order.
    for (const content of [...container.contents]) {
        let result = null;
        if (objectMaterial(content.otyp) === GLASS
            && content.oclass !== GEM_CLASS
            && !objectResistsDestruction(content, 33, 100, random)) {
            result = 'shatter';
        }
        else if (content.otyp === EGG && random(3) === 0) {
            result = 'cracking';
        }
        if (!result)
            continue;
        if (content.otyp === MIRROR)
            changeHeroLuck(-2, state);
        /* eggs laid by you: always exactly 1 breaks (dokick.c:447-450) */
        if (content.otyp === EGG && content.spe
            && eggHasMonsterSpecies(content))
            changeHeroLuck(-1, state);
        // C You_hear(): suppression and prefixes without skipping the
        // destruction itself.
        const heard = formatHeardMessage(`a muffled ${result}.`, state);
        if (heard !== null)
            await publish(heard);
        /* per-item billing marks and values the live object before its
         * deletion (dokick.c:457-462 precede useup/obfree at 463-468) */
        loss += await chargeDestroyedShopContent(content, x, y, fromInventory, { state, publish });
        const quantity = content.quan ?? content.quantity ?? 1;
        if (quantity > 1) {
            content.quan = quantity - 1;
            content.quantity = quantity - 1;
        }
        else {
            await deleteObject(content, state);
        }
        /* contents of this container are no longer known */
        container.cknown = false;
        weightChanged = true;
    }
    if (weightChanged)
        container.owt = objectWeight(container);
    await settleDestroyedShopCharges({ loss, x, y, publish, state });
}
// Port only: object quan accessor.
function quantity(object) {
    return object.quan ?? object.quantity ?? 1;
}
// Port only: per-unit weight of a stacked object.
function unitWeight(object) {
    if (quantity(object) === 1)
        return objectWeight(object);
    return objectWeight({ ...object, quan: 1, quantity: 1 });
}
// Part of C dokick.c:really_kick_object(): the object-range and sliding calculation.
// Also C artifact.c:is_art(): inlined here as the oartifact name test that
// pins Mjollnir's kick range to 1.
function kickRange(object, state, dx, dy, martial, rollOne) {
    let slide = false;
    let range = Math.trunc(currentStrength(state) / 2)
        - Math.trunc((object.oclass === COIN_CLASS ? objectWeight(object) : unitWeight(object)) / 40);
    if (martial)
        range += rollOne(3);
    if (isPoolAt(object.ox, object.oy, state)) {
        range = Math.trunc(range / 3) + 1;
    }
    else if (Is_airlevel(state.u?.uz) || Is_waterlevel(state.u?.uz)) {
        range += rollOne(3);
    }
    else {
        if (isIceAt(object.ox, object.oy, state)) {
            range += rollOne(3);
            slide = true;
        }
        if (object.greased) {
            range += rollOne(3);
            slide = true;
        }
    }
    if (artifactById(object.oartifact ?? 0, state)?.name === 'Mjollnir')
        range = 1;
    const nextX = object.ox + dx;
    const nextY = object.oy + dy;
    const next = state.level?.at?.(nextX, nextY);
    if (!isok(nextX, nextY) || !next || !ZAP_POS(next.typ)
        || closedDoor(state, nextX, nextY))
        range = 1;
    return { range, slide };
}
// C dokick.c:really_kick_object().
// Also C dokick.c:kick_object(): inlined here as the top-of-pile selection
// and the object name used if the kick hurts the hero.
export async function kickFloorObject(x, y, { state = game, dx = state.u?.dx ?? 0, dy = state.u?.dy ?? 0, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object)
        return false;
    if (object.otyp === BOULDER || object === state.uball || object === state.u.uball
        || object === state.uchain || object === state.u.uchain)
        return false;
    const trap = trapAt(state, x, y);
    const passesWalls = state.u.passesWalls;
    if (trap && ((is_pit(trap.ttyp) && !passesWalls)
        || trap.ttyp === WEB)) {
        if (!trap.tseen)
            await findTrap(trap);
        await publish(`You can't kick something that's in a ${heroIsHallucinating(state) ? 'tizzy' : trap.ttyp === WEB ? 'web' : 'pit'}!`);
        return true;
    }
    if (trap?.ttyp === STATUE_TRAP) {
        await activateStatueTrapAt(x, y, { state });
        return true;
    }
    if ((state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0)
        && random(3) === 0) {
        await publish('Your clumsy kick missed.');
        return true;
    }
    if (!(state.uarmf || state.u.uarmf) && object.otyp === CORPSE
        && touchPetrifies(object.corpsenm) && !heroResistsStoning(state)) {
        await publish(`You kick ${corpseName(object, { definite: true })} with your bare ${makePlural(body_part(FOOT, state))}.`);
        const result = await resolveImmediatePetrification({ state, publish,
            killer: `kicking ${killerObjectName(object, state)} barefoot` });
        if (result.died || state.program_state.gameover)
            return true;
    }
    const martial = heroHasMartialKick(state);
    const { range, slide } = kickRange(object, state, dx, dy, martial, rollOne);
    const owner = findObjectOwner(object, x, y, state);
    let costly = !!owner && !!(costlySpot(x, y, state)
        || costlyAdjacent(owner, x, y, state) && object.unpaid);
    const isGold = object.oclass === COIN_CLASS;
    observeObjectForNaming(object, { state });
    await publish(`You kick ${await objectDescription(isGold ? object
        : { ...object, quan: 1, quantity: 1 }, { state })}.`, { noRepeat: true });
    const source = state.level?.at(x, y);
    const heroSquare = state.level?.at(state.u.ux, state.u.uy);
    if (source && (IS_OBSTRUCTED(source.typ) || closedDoor(state, x, y))) {
        const stuck = !martial && random(20) > currentAttribute(A_DEX, state)
            || heroSquare && (IS_OBSTRUCTED(heroSquare.typ)
                || closedDoor(state, state.u.ux, state.u.uy));
        const subject = heroIsBlind(state) ? 'It'
            : `The ${objectCombatName(object, { state })}`;
        const plural = !heroIsBlind(state) && objectNameIsPlural(object, state);
        if (stuck) {
            await publish(`${subject} ${plural ? "don't" : "doesn't"} come loose.`);
            return random(3) === 0 || martial;
        }
        await publish(`${subject} ${plural ? 'come' : 'comes'} loose.`);
        remove_object(object, state);
        await newsym(x, y);
        const shop = roomsAt(state.level, x, y, SHOPBASE)[0];
        if (costly && (!costlySpot(state.u.ux, state.u.uy, state)
            || shop === undefined || !state.u.urooms?.includes(shop))) {
            if (object.no_charge)
                object.no_charge = false;
            else
                await addShopObjectToBill(object, state, { ininv: false, publish });
        }
        const effects = await applyFloorEffects(object, state.u.ux, state.u.uy, { state, publish, random, verb: 'fall' });
        if (!effects.finished) {
            await placeObject(object, state.u.ux, state.u.uy, state);
            impactDisturbsZombies(object, true, state);
            await stack_object(object, state);
        }
        await newsym(state.u.ux, state.u.uy);
        return true;
    }
    const box = object.otyp === CHEST || object.otyp === LARGE_BOX;
    if (box) {
        const trapped = object.otrapped;
        if (range < 2)
            await publish('THUD!');
        await containerImpactDamage(object, x, y, { state, publish, random, fromInventory: false });
        const opens = random(object.olocked ? 5 : 3) === 0
            || martial && random(2) === 0;
        if (opens) {
            if (object.olocked) {
                await publish('You break open the lock!');
                await breakChestLock(object, false, state);
            }
            else {
                await publish('The lid slams open, then falls shut.');
                object.lknown = true;
            }
            if (trapped)
                await triggerChestTrap(object, { state, publish, random, bodyPart: body_part(LEG, state) });
            return true;
        }
        if (range < 2)
            return true;
    }
    const { destroyed } = await breakFloorObject(object, {
        state,
        publish,
        random,
    });
    // A fatal vapor or oil blast ends the action even though the bottle
    // itself reports not destroyed.
    if (destroyed || state.program_state?.gameover)
        return true;
    if (range < 2) {
        if (!box)
            await publish('Thump!');
        return random(3) === 0 || martial;
    }
    if (object.oclass === COIN_CLASS && quantity(object) > 1) {
        if (random(20) !== 0) {
            if (!heroIsDeaf(state))
                await publish('Thwwpingg!');
            const messages = ['scatter the coins', 'knock coins all over the place',
                'send coins flying in all directions'];
            await publish(`You ${messages[random(messages.length)]}!`);
            await scatterFloorObjects(x, y, rollOne(3), {
                state, onlyObject: object, mayDestroy: false, mayFracture: false,
                mayHitHero: true, mayHitMonsters: true, heroCaused: true,
                publish, random, rollOne,
            });
            await newsym(x, y);
            return true;
        }
        if (quantity(object) > 300) {
            await publish('Thump!');
            return random(3) === 0 || martial;
        }
    }
    const moving = object.oclass !== COIN_CLASS && quantity(object) > 1
        ? splitObjectStack(object, 1, state)
        : object;
    if (!moving)
        throw new Error('A kicked stack must yield an object.');
    if (slide && !heroIsBlind(state)) {
        const name = await inventoryItemDescription(moving);
        await publish(`Whee!  ${name.charAt(0).toUpperCase() + name.slice(1)} ${quantity(moving) === 1 ? 'slides' : 'slide'} across the ${surfaceName(x, y, state)}.`);
    }
    remove_object(moving, state);
    state._kickedObject = moving;
    try {
        await snuffCandle(moving, state, publish);
        await newsym(x, y);
        requirePlayingGame(state);
        const flight = await flyKickedObject({
            state,
            object: moving,
            dx,
            dy,
            range,
            display: monsterProjectileDisplay(moving, state),
            publish,
            random,
        });
        if (flight.destroyed || flight.migrated)
            return true;
        if (flight.contact?.isshk && moving.where === 'minvent'
            && moving.ocarry === flight.contact)
            return true; /* really_kick_object(): the alert shk caught it */
        if (flight.contact) {
            if (isGold) {
                if (await resolveGoldMonsterContact({ state, monster: flight.contact, gold: moving,
                    wakeMonster: actor => wakeAttackedMonster(actor),
                    angerMonster: actor => angerAttackedMonster(actor) }))
                    return true;
            }
            else {
                const contact = await hitMonsterWithKickedObject(flight.contact, moving, { state, target: { x: flight.x, y: flight.y } });
                if (contact.heroDied || contact.consumed)
                    return true;
            }
        }
        const destinationShop = roomsAt(state.level, flight.x, flight.y, SHOPBASE)[0];
        const sourceShop = roomsAt(state.level, x, y, SHOPBASE)[0];
        if (costly && owner && (!costlySpot(flight.x, flight.y, state) || sourceShop !== destinationShop)) {
            if (isGold)
                await costlyGold(x, y, quantity(moving), { state, publish });
            else
                await stolenValue(moving, x, y, !!owner.mpeaceful, { state, publish, silent: false });
            costly = false;
        }
        const effects = await applyFloorEffects(moving, flight.x, flight.y, { state, publish, random, verb: 'fall' });
        if (effects.finished)
            return true;
        if (costly && owner) {
            if (moving.unpaid)
                removeObjectAndContentsFromBill(moving, state, { resident: owner });
            const gold = containedGold(moving, true);
            if (gold > 0)
                await donateGold(gold, owner, { selling: false, publish });
        }
        await placeObject(moving, flight.x, flight.y, state);
        impactDisturbsZombies(moving, true, state);
        await stack_object(moving, state);
        await newsym(flight.x, flight.y);
        return true;
    }
    finally {
        if (state._kickedObject === moving)
            state._kickedObject = null;
    }
}
// Part of C dungeon.c:on_level(): local d_level comparison (full port in
// dungeon.ts).
function sameLevel(first, second) {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}
// Part of C dokick.c:drop_to(): the next-level-down destination.
function levelBelow(state) {
    const current = state.u?.uz || { dnum: 0, dlevel: 1 };
    return { ...current, dlevel: (current.dlevel ?? 1) + 1 };
}
// Part of C dokick.c:drop_to(): the bottom-level check.
function onBottomLevel(state) {
    const current = state.u?.uz;
    const dungeon = state.dungeons?.[current?.dnum];
    return !!current && !!dungeon
        && current.dlevel === dungeon.num_dunlevs;
}
// Part of C dokick.c:drop_to(): the In_endgame() check.
function inEndgame(state) {
    const current = state.u?.uz;
    return !!current && !!state.astral_level
        && current.dnum === state.astral_level.dnum;
}
// Part of C dokick.c:drop_to(): the Is_stronghold() check.
function onStronghold(state) {
    return sameLevel(state.u?.uz, state.stronghold_level);
}
// C dokick.c:drop_to()
// Destination for the MIGR_xxx choice down_gate() produced: the stronghold
// drops into the valley, the endgame and bottom levels go nowhere (null),
// stairs and ladders follow their stairway, and MIGR_NOWHERE is null.
function dropTo(loc, x, y, state) {
    if (loc === MIGR_RANDOM) {
        // trap door or hole
        if (onStronghold(state))
            return state.valley_level || null;
        if (inEndgame(state) || onBottomLevel(state))
            return null;
        return levelBelow(state);
    }
    if (loc === MIGR_STAIRS_UP || loc === MIGR_LADDER_UP || loc === MIGR_SSTAIRS) {
        const stair = stairwayAt(state, x, y);
        return stair?.tolev || levelBelow(state);
    }
    // MIGR_NOWHERE: y==0 means "nowhere", in which case x doesn't matter.
    return null;
}
// C dokick.c:down_gate().
// Also C dokick.c:drop_to(): each gate kind resolves its destination
// through dropTo(); gate_str is the port's text.
function downwardGate(state, x, y) {
    if (onQuestStart(state) && !okToQuest(state))
        return null;
    const stair = stairwayAt(state, x, y);
    if (stair && !stair.up) {
        // down_gate() distinguishes MIGR_STAIRS_UP from MIGR_SSTAIRS by the
        // stair's target dnum.
        const toDnum = stair.tolev?.dnum ?? state.u?.uz?.dnum;
        const loc = stair.isladder ? MIGR_LADDER_UP
            : toDnum === state.u?.uz?.dnum ? MIGR_STAIRS_UP : MIGR_SSTAIRS;
        const destination = dropTo(loc, x, y, state);
        if (!destination)
            return null;
        if (stair.isladder) {
            return {
                arrival: MIGR_LADDER_UP,
                destination,
                text: 'down the ladder',
            };
        }
        return {
            arrival: loc,
            destination,
            text: 'down the stairs',
        };
    }
    const trap = trapAt(state, x, y);
    if (!trap || !trap.tseen || !is_hole(trap.ttyp))
        return null;
    const destination = dropTo(MIGR_RANDOM, x, y, state);
    if (!destination)
        return null;
    return {
        arrival: MIGR_RANDOM,
        destination,
        text: trap.ttyp === TRAPDOOR
            ? 'through the trap door' : 'through the hole',
    };
}
// Part of C dokick.c:otransit_msg(): the subject name (the(xname())).
function transitSubject(object, state) {
    const subject = object.otyp === CORPSE ? corpseName(object, { definite: true })
        : `the ${objectCombatName(object, { state })}`;
    return subject.charAt(0).toUpperCase() + subject.slice(1);
}
// Part of C dokick.c:impact_drop(): the cansee() test.
// C cansee() reads only the vision array.  A hero blinded by polymorph keeps
// the old sight until the next vision_recalc(), so the shed equipment's
// transit messages still show.
function squareIsVisible(state, x, y) {
    if (state === game)
        return cansee(x, y);
    return !state.viz_array || !!((state.viz_array[y]?.[x] ?? 0) & 0x2);
}
// Part of C dokick.c:impact_drop(): the level.objects[x][y] pile access.
function pileAt(state, x, y) {
    return state.level?.objects?.[x]?.[y] || [];
}
// Part of C dokick.c:impact_drop(): the pile scan for the chain and the
// object count.
function pileImpact(state, object, x, y) {
    let count = 0;
    let chainThere = false;
    for (const candidate of pileAt(state, x, y)) {
        if (candidate === state.uchain || candidate === state.u?.uchain) {
            chainThere = true;
        }
        else if (candidate !== object) {
            count += quantity(candidate);
        }
    }
    return { count, chainThere };
}
// C mkobj.c:add_to_migration(). The destination codes are dokick.c's
// drop_to() overloads.
function addToMigration(object, gate, state) {
    object.no_charge = false;
    if (isContainer(object))
        maybeResetPick(object, state);
    object.where = 'migrating';
    object.migration = {
        destination: { ...gate.destination },
        source: { ...(state.u?.uz || { dnum: 0, dlevel: 1 }) },
        arrival: gate.arrival,
    };
    object.ox = gate.destination.dnum;
    object.oy = gate.destination.dlevel;
    state.migratingObjects ||= [];
    state.migratingObjects.unshift(object);
}
// C dokick.c:otransit_msg().
async function publishTransitMessage(object, gate, stays, impact, publish, state) {
    const plural = objectNameIsPlural(object, state);
    if (!impact.count && !impact.chainThere) {
        if (!stays)
            await publish(`${transitSubject(object, state)} ${plural ? 'fall' : 'falls'} ${gate.text}.`);
        return;
    }
    const verb = impact.count ? (plural ? 'hit' : 'hits')
        : (plural ? 'rattle' : 'rattles');
    const target = impact.count
        ? `${impact.count === 1 ? 'another' : 'other'} object${impact.count === 1 ? '' : 's'}`
        : 'your chain';
    const fall = stays ? '.'
        : ` and ${plural ? 'fall' : 'falls'} ${gate.text}.`;
    await publish(`${transitSubject(object, state)} ${verb} ${target}${fall}`);
}
// Part of C dokick.c:impact_drop(): breakage with the luck loss and the
// muffled crash/splat.
async function breaksInTransit(object, state, publish, random) {
    const { objectBreaksOnImpact } = await import('./dothrow.js');
    if (!objectBreaksOnImpact(object, random))
        return false;
    if (object.otyp === MIRROR)
        changeHeroLuck(-2, state);
    if (object.otyp === EGG && object.spe
        && object.corpsenm !== undefined && Number.isInteger(object.corpsenm) && object.corpsenm >= 0) {
        changeHeroLuck(-Math.min(quantity(object), 5), state);
    }
    const crash = objectMaterial(object.otyp) === GLASS
        || object.otyp === EXPENSIVE_CAMERA;
    await publishHeardMessage(`a muffled ${crash ? 'crash' : 'splat'}.`, publish, state);
    await deleteObject(object, state);
    return true;
}
// C dokick.c:impact_drop().
export async function impactDrop(missile, x, y, { state = requireInitializedGame(), publish = async () => { }, random = rn2, destinationLevel = 0, } = {}) {
    const gate = downwardGate(state, x, y);
    if (!gate)
        return 0;
    if (destinationLevel) {
        gate.arrival = MIGR_WITH_HERO;
        gate.destination = { ...gate.destination, dlevel: destinationLevel };
    }
    const pile = [...pileAt(state, x, y)];
    const shop = costlySpot(x, y, state);
    const owner = shop?.resident;
    const debit = owner?.eshk.debit ?? 0;
    const robbed = owner?.eshk.robbed ?? 0;
    const angry = owner && !owner.mpeaceful;
    let price = 0;
    const total = pile.reduce((count, object) => count + (object === missile ? 0 : quantity(object)), 0);
    let fallen = 0;
    for (const object of pile) {
        if (object === missile
            || object === state.uball || object === state.u?.uball
            || object === state.uchain || object === state.u?.uchain)
            continue;
        if (missile?.otyp === ROCK && object.otyp === BOULDER)
            continue;
        if (random(object.otyp === BOULDER ? 30 : 3) !== 0)
            continue;
        remove_object(object, state);
        if (shop) {
            const sameShop = !!costlySpot(state.u.ux, state.u.uy, state)
                && state.u.urooms.includes(shop.roomno);
            price += await stolenValue(object, x, y, sameShop, { state, publish, silent: true });
            if (object.contents?.length)
                pickedContainer(object);
            if (object.oclass !== COIN_CLASS)
                object.no_charge = false;
        }
        addToMigration(object, gate, state);
        fallen += quantity(object);
    }
    if (fallen && squareIsVisible(state, x, y)) {
        const all = fallen === total;
        const what = fallen === 1 ? 'object falls' : 'objects fall';
        if (missile) {
            const article = all ? 'the '
                : fallen === 1 ? 'an' : '';
            await publish(`From the impact, ${article}other ${what}.`);
        }
        else {
            const subject = all
                ? (fallen === 1
                    ? 'The adjacent object' : 'All the adjacent objects')
                : (fallen === 1
                    ? 'One of the adjacent objects'
                    : 'Some of the adjacent objects');
            await publish(`${subject} ${fallen === 1
                ? 'falls' : 'fall'} ${gate.text}.`);
        }
    }
    if (owner && price > 0) {
        if ((owner.eshk.robbed ?? 0) > robbed) {
            await publish(`You removed ${price} ${currency(price)} worth of goods!`);
            if (squareIsVisible(state, owner.mx, owner.my)) {
                owner.eshk.customer ||= state.plname || 'player';
                await publish(angry ? `${shopkeeperName(owner, { state, capitalized: true })} is infuriated!`
                    : `"${state.plname || 'player'}, you are a thief!"`);
            }
            else
                await publishHeardMessage('a scream, "Thief!"', publish, state);
            hotPursuitShopkeeper(owner, state);
            await angerWatchGuards(false, { state, publish });
        }
        else if ((owner.eshk.debit ?? 0) > debit) {
            const amount = (owner.eshk.debit ?? 0) - debit;
            await publish(`You owe ${shopkeeperName(owner, { state })} ${amount} ${currency(amount)} for goods lost.`);
        }
    }
    return fallen;
}
// C dokick.c:ship_object().
export async function shipObject(object, x, y, { state = requireInitializedGame(), publish = async () => { }, random = rn2, shopFloorObject = false, } = {}) {
    if (!object)
        return false;
    const gate = downwardGate(state, x, y);
    if (!gate)
        return false;
    const attached = object === state.uball || object === state.u?.uball
        || object === state.uchain || object === state.u?.uchain;
    const stays = attached
        || (gate.arrival !== MIGR_LADDER_UP && random(3) !== 0);
    const unpaid = objectIsUnpaid(object);
    const container = !!object.contents?.length;
    const impact = pileImpact(state, object, x, y);
    const hole = gate.arrival === MIGR_RANDOM;
    if (object.otyp === BOULDER && hole) {
        if (impact.count) {
            await impactDrop(object, x, y, { state, publish, random });
        }
        return false;
    }
    if (squareIsVisible(state, x, y)) {
        await publishTransitMessage(object, gate, stays, impact, publish, state);
    }
    if (stays) {
        if (impact.count) {
            await impactDrop(object, x, y, { state, publish, random });
            await maybeUnhideAt(x, y, state);
        }
        return false;
    }
    if (unpaid || shopFloorObject) {
        if (unpaid) {
            await stolenValue(object, state.u.ux, state.u.uy, true, {
                state, publish, silent: false,
            });
        }
        else {
            const { ox, oy } = object;
            const room = roomsAt(state.level, ox, oy, SHOPBASE)[0];
            const sameShop = !!costlySpot(state.u.ux, state.u.uy, state)
                && room !== undefined && state.u.urooms.includes(room);
            await stolenValue(object, ox, oy, sameShop, {
                state, publish, silent: false,
            });
        }
        if (container)
            pickedContainer(object);
        if (object.oclass !== COIN_CLASS)
            object.no_charge = false;
    }
    if (object.owornmask) {
        await removeWornHeroItem(object, state);
        if (state.program_state.gameover)
            return true;
    }
    if (await breaksInTransit(object, state, publish, random))
        return true;
    addToMigration(object, gate, state);
    if (object.otyp === BOULDER)
        object.otrapped = false;
    if (impact.count) {
        await impactDrop(object, x, y, { state, publish, random });
        await newsym(x, y);
    }
    return true;
}
// Part of C dokick.c:obj_delivery(): the arrival breakage check.
async function breaksOnArrival(object, state, x, y, random, noBreak, withHero, publish) {
    const location = state.level.at(x, y);
    if (noBreak || (location !== null && IS_SOFT(location.typ)))
        return false;
    const { objectBreaksOnImpact, breakFloorObject } = await import('./dothrow.js');
    if (withHero) {
        const result = await breakFloorObject(object, { state, x, y, publish, random, heroCaused: false });
        return result.destroyed || !!state.program_state.gameover;
    }
    if (!objectBreaksOnImpact(object, random))
        return false;
    await delobj(object, state);
    return true;
}
// Part of C dokick.c:obj_delivery(): the random-position arrival (rloco()).
async function deliverAtRandomPosition(object, state, random, publish, noBreak) {
    object.ox = object.oy = 0;
    if (!await relocateObjectRandomly(object, { state, random, publish })
        || noBreak)
        return;
    const { objectBreaksOnImpact } = await import('./dothrow.js');
    if (objectBreaksOnImpact(object, random))
        await delobj(object, state);
}
// Part of C dokick.c:obj_delivery(): the passage arrival with stack_object()
// and scatter().
async function deliverAtPassage(object, migration, state, position, publish, random, rollOne, noBreak) {
    const arrival = migration.arrival & ~(MIGR_NOBREAK | MIGR_NOSCATTER);
    await placeObject(object, position.x, position.y, state);
    if (await breaksOnArrival(object, state, position.x, position.y, random, noBreak, arrival === MIGR_WITH_HERO, publish))
        return;
    const landed = await stack_object(object, state);
    // The pinned C tests this mask before removing migration flags. Its
    // stair and ladder codes share a bit with MIGR_WITH_HERO too.
    if (migration.arrival & MIGR_WITH_HERO) {
        await newsym(position.x, position.y);
        return;
    }
    const { scatterFloorObjects } = await import('./scatter.js');
    await scatterFloorObjects(position.x, position.y, rollOne(2), {
        state,
        onlyObject: landed,
        mayDestroy: false,
        mayFracture: false,
        mayHitHero: false,
        mayHitMonsters: false,
        publish,
        random,
        rollOne,
    });
}
// C dokick.c:obj_delivery().
export async function deliverMigratingObjects(state = requireInitializedGame(), { nearHero = false, publish = async () => { }, random = rn2, rollOne = rnd, } = {}) {
    let delivered = 0;
    let position = null;
    for (const object of [...(state.migratingObjects || [])]) {
        const migration = object.migration;
        if (!migration || !sameLevel(migration.destination, state.u?.uz))
            continue;
        if (migration.arrival & MIGR_TO_SPECIES)
            continue;
        const arrival = migration.arrival
            & ~(MIGR_NOBREAK | MIGR_NOSCATTER);
        if (nearHero !== (arrival === MIGR_WITH_HERO))
            continue;
        unlinkObject(object, state);
        object.owornmask = 0;
        delete object.migration;
        let passage = null;
        if ([MIGR_STAIRS_UP, MIGR_SSTAIRS].includes(arrival))
            passage = stairway_find_from(state, migration.source, false);
        else if (arrival === MIGR_LADDER_UP)
            passage = stairway_find_from(state, migration.source, true);
        else if (arrival === MIGR_WITH_HERO) {
            passage = { x: state.u.ux, y: state.u.uy };
        }
        else
            position = null;
        if (passage)
            position = 'sx' in passage ? { x: passage.sx, y: passage.sy } : passage;
        const noBreak = !!(migration.arrival & MIGR_NOBREAK);
        if (position) {
            await deliverAtPassage(object, migration, state, position, publish, random, rollOne, noBreak);
        }
        else {
            await deliverAtRandomPosition(object, state, random, publish, noBreak);
        }
        delivered++;
    }
    return delivered;
}
const DELIVER_SPECIES = 0x21fe; // undead, were, human, elf, dwarf, gnome, orc, demon, giant
const M2_ORC = 0x80;
// C dokick.c:deliver_obj_to_mon()
// Migrated MIGR_TO_SPECIES booty from dog.c is
// handed to the first matching monster that is created or arrives.  The
// species flags ride the object's overloaded owornmask/corpsenm fields,
// which is why the food filters above exclude them.
export async function deliverOrcRaidLoot(monster, state, all = false) {
    for (const object of [...(state.migratingObjects ?? [])]) {
        const migration = object.migration;
        if (!migration || !(migration.arrival & MIGR_TO_SPECIES)
            || migration.speciesFlags === undefined || migration.speciesFlags === NON_PM
            || ((MONSTER_FLAGS2[monster.mnum] ?? 0) & DELIVER_SPECIES) !== migration.speciesFlags)
            continue;
        const index = state.migratingObjects?.indexOf(object) ?? -1;
        if (index >= 0)
            state.migratingObjects?.splice(index, 1);
        object.where = 'free';
        object.owornmask = 0;
        object.ox = object.oy = 0;
        if ((migration.speciesFlags & M2_ORC) && object.oextra?.oname) {
            if (!monster.name) {
                const inMines = state.u.uz?.dnum === state.mines_dnum;
                if (inMines || rn2(2) === 0)
                    nameOrc(monster, inMines ? object.oextra.oname : null, ' the Fence');
            }
            delete object.oextra.oname;
        }
        object.corpsenm = NON_PM;
        delete object.migration;
        await addObjectToMonsterInventory(monster, object, state);
        if (!all)
            break;
    }
}
//# sourceMappingURL=dokick.js.map