// apply.js — Apply/use-tool command and its tool dispatch.
// C ref: apply.c:doapply(), dorub(), dojump(), do_break_wand(), and the
// use_*() dispatch. The individual tools live in their own modules
// (bullwhip.ts, jumping.ts, pick_axe.ts, ...); this file owns the command
// bodies and the switch.
import { applySuggestion } from './apply_selection.js';
import { flipThroughBook } from './book_flip.js';
import { flipCoin } from './coin_flip.js';
import { useGrayStone } from './gray_stone.js';
import { useMirror } from './mirror.js';
import { useCamera } from './camera.js';
import { useTowel } from './towel.js';
import { useBell } from './apply_bell.js';
import { speakArtifact } from './artifacts.js';
import { lightCocktail, useCandelabrum, useCandle, useLamp } from './apply_light.js';
import { useWhistle } from './whistle.js';
import { retouchHeroObject } from './hero_retouch.js';
import { isGrayStone } from './object_properties.js';
import { attackHostileMonster } from './hero_melee.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { learnObjectType } from './o_init.js';
import { makePlural } from './objnam.js';
import { dopay } from './shk.js';
import { commandResultCancelled, commandResultFailed, commandResultSpentTime } from './cmd.js';
import { endVoluntaryMultiTurn } from './hack.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { heroMayDisplaceMonster, runSafepetDisplacement } from './hack.js';
import { artifactById } from './artifacts.js';
import { wieldTool } from './wield_tool.js';
import { doswapweapon } from './wield.js';
import { snapshotMenuUnderlay } from './windows.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { BULLWHIP, GRAPPLING_HOOK, CREAM_PIE, EGG, LOCK_PICK, CRYSTAL_BALL, STETHOSCOPE, CREDIT_CARD, BAG_OF_TRICKS, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP, BANANA, MIRROR, TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF, BELL, BELL_OF_OPENING, EXPENSIVE_CAMERA, TIN_OPENER, FIGURINE, LEASH, CAN_OF_GREASE, SADDLE, HORN_OF_PLENTY, TINNING_KIT, LAND_MINE, BEARTRAP, TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL, LENSES, BLINDFOLD, TOWEL, MAGIC_MARKER, UNICORN_HORN, SKELETON_KEY, } from './object_data.js';
import { d, rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { pline as syncPline, plineWithContinuation as pline } from './pline.js';
import { heroHasNoHands } from './polyself.js';
import { lightRoom, transformMagicLampToOilLamp } from './light.js';
import { releaseDjinni } from './potion.js';
import { jumpHero } from './jumping.js';
import { usePickAxe } from './pick_axe.js';
import { usePolearm } from './polearm.js';
import { isPick, isAxe, isPolearm } from './object_properties.js';
import { heroHasFreeHand } from './engrave.js';
import { promptDirection, readDirectionKey } from './tty_prompts.js';
import { useGrapplingHook } from './grappling_hook.js';
import { hurtleHero } from './hero_hurtle.js';
import { finishTeleportArrival } from './location_effects.js';
import { gotoLevel } from './level_change.js';
import { finishHeroMonsterKill, finishHurtleMonsterDeath } from './hero_monster_death.js';
import { askTeleportDestination } from './teleport.js';
import { applyEyewear } from './eyewear.js';
import { useCreamPie } from './cream_pie.js';
import { useFigurine } from './figurine_apply.js';
import { useLeash } from './leash_apply.js';
import { useGrease } from './grease_apply.js';
import { useStethoscope } from './stethoscope.js';
import { useBagOfTricks } from './bag_of_tricks.js';
import { useHornOfPlenty } from './horn_of_plenty.js';
import { useTinningKit } from './tinning_kit.js';
import { useSaddle, monsterAtPosition } from './steed.js';
import { isRoyalJelly, useRoyalJelly } from './royal_jelly.js';
import { useBullwhip } from './bullwhip.js';
import { pickLock } from './lock_pick.js';
import { useCrystalBall } from './crystal_ball.js';
import { isContainer, useContainer } from './container.js';
import { useTinOpener } from './tin.js';
import { useMagicMarker } from './write.js';
import { useUnicornHorn } from './unicorn_horn.js';
import { PLAYABLE_INSTRUMENTS, playInstrument } from './music.js';
import { inventoryCommandLetter, delobj } from './invent.js';
import { currentAttribute } from './attrib.js';
import { heroHandName, heroHeadName } from './body_parts.js';
import { dropBoulderIntoLiquid } from './boulder_pool.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, A_STR, DIGCHECK_FAILED, DIGCHECK_FAIL_BOULDER, EXPL_FIERY, EXPL_FROSTY, EXPL_MAGICAL, HOLE, ICE, IS_DOOR, IS_WALL, NO_KILLER_PREFIX, PARANOID_BREAKWAND, PIT, ROOM, SHOPBASE, isok, xdir, ydir, LEVEL_TIMER_KIND } from './const.js';
import { digActualHole, digCheck, liquidFlow, watchDigging } from './dig.js';
import { bot } from './botl.js';
import { explode } from './explosion.js';
import { loseHeroHp } from './hero_damage.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { releaseHold } from './hero_expulsion.js';
import { freeInventoryObject } from './hero_inventory.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { liquidForHole } from './dig.js';
import { beginImmediateZap, finishImmediateZap, hitFloorPileWithWand, hitMonsterWithWand, } from './immediate_zap.js';
import { canDigDown } from './mklev.js';
import { makemonAt } from './makemon.js';
import { BOULDER, OBJECT_DESCRIPTIONS, WAN_CANCELLATION, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING, WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_NOTHING, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_SECRET_DOOR_DETECTION, WAN_STASIS, WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING, WAN_WISHING, } from './object_data.js';
import { unlinkObject } from './mkobj.js';
import { stopLevelTimer } from './timeout.js';
import { observeObjectForNaming, ownedObjectName } from './objnam.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { paranoidQuery } from './query.js';
import { roomsAt } from './room.js';
import { chargeAlteredUnpaidObject, chargeUnpaidUsage, payForShopDamage } from './shk.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { vision_note_blocker_change } from './vision.js';
import { exceedsActionCapacity } from './weight.js';
import { zappable } from './zap.js';
import { feelTrap, trapName } from './trap.js';
import { A_DEX, AIR, BEAR_TRAP, CLOUD, D_CLOSED, D_LOCKED, DOOR, IS_FURNITURE, IS_OBSTRUCTED, Is_airlevel, Is_waterlevel, LANDMINE, P_BASIC, P_RIDING, } from './const.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { triggerHeroTrap } from './hero_traps.js';
import { consumeInventoryItem } from './invent.js';
import { heroIsOnStairs } from './invocation_position.js';
import { maketrap } from './mklev.js';
import { monsterDigests } from './monster_data.js';
import { monsterName } from './do_name.js';
import { propertyIsActive } from './properties.js';
import { promptYesNo } from './query.js';
import { rnl } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { billDummyObject, objectOwnershipPrefix, findObjectOwner, shopkeeperIsMuted, addShopDamage, } from './shk.js';
// C apply.c:rub_ok().
function rubEligibleObject(object) {
    return object?.otyp === OIL_LAMP || object?.otyp === MAGIC_LAMP
        || object?.otyp === BRASS_LANTERN || isGrayStone(object) || isRoyalJelly(object);
}
// C apply.c:jelly_ok().
async function rubRoyalJelly(jelly) {
    const used = await useRoyalJelly(jelly, async () => {
        const egg = await chooseInventoryObject('rub the royal jelly on', object => object.otyp === EGG ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
        if (egg)
            game._pending_message = '';
        // apply.c:use_royal_jelly() returns ECMD_CANCEL when getobj() for
        // the egg target is declined.
        else
            commandResultCancelled();
        return egg;
    });
    game.context.move = used ? 1 : 0;
    return used;
}
// C refs: apply.c:dorub(), invent.c:getobj(), wield.c:wield_tool(), and
// cmd.c:CQ_CANNED.  Selecting an unwielded lamp does not rub it immediately:
// wield_tool() installs it, consumes one action, and queues dorub plus the
// inventory letter for the next hero command boundary.
export async function dorub(cannedInvlet = null) {
    if (heroHasNoHands(game)) {
        await syncPline("You aren't able to rub anything without hands.");
        game.context.move = 0;
        return;
    }
    const object = cannedInvlet === null
        ? await chooseInventoryObject('rub', candidate => rubEligibleObject(candidate) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE)
        : game.inventory.find(candidate => candidate.invlet === cannedInvlet
            && rubEligibleObject(candidate));
    if (!object) {
        // apply.c:dorub() returns ECMD_CANCEL without an object; the
        // rhack seam clears the queues so ^A cannot replay the rub.
        commandResultCancelled();
        return;
    }
    // Interactive entry owns a getobj prompt which selection replaces.
    // Canned re-entry happens before the next physical key and inherits the
    // wield/scheduler topline, so its result must append to that message.
    if (cannedInvlet === null)
        game._pending_message = '';
    if (isGrayStone(object)) {
        const result = await useGrayStone(object);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (isRoyalJelly(object)) {
        await rubRoyalJelly(object);
        return;
    }
    const wielded = await wieldTool(object, 'rub', { swapWeapons: doswapweapon }, game);
    if (!wielded.ready) {
        game.context.move = 0;
        return;
    }
    if (wielded.newlyWielded) {
        if (!object.invlet)
            throw new Error('A wielded inventory object must have an inventory letter.');
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'rub', invlet: object.invlet });
        game.context.move = 1;
        return;
    }
    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe || 0) > 0 && rn2(3) === 0) {
            await chargeUnpaidUsage(object, { alternate: true });
            // C performs the bones-safe lamp transformation before the
            // released monster can grant a fatal artifact wish.
            transformMagicLampToOilLamp(object, 1000 + rn2(500), game, game.moves ?? 0);
            requirePlayingGame(game);
            await releaseDjinni(object, game);
            learnObjectType(MAGIC_LAMP);
            game.context.move = 1;
            return;
        }
        if (rn2(2))
            await pline(heroIsBlind(game)
                ? 'You smell smoke.' : 'You see a puff of smoke.');
        else
            await pline('Nothing happens.');
    }
    else if (object.otyp === BRASS_LANTERN) {
        await pline('Rubbing the electric lamp is not particularly rewarding.');
        await pline('Anyway, nothing exciting happens.');
    }
    else {
        await pline('Nothing happens.');
    }
    game.context.move = 1;
}
// C apply.c:dojump(): the physical command shares the spell's jump owner.
export async function dojump() {
    const result = await jumpHero(0);
    game.context.move = result.spentTime ? 1 : 0;
}
async function pickAxeDirection(prompt) {
    return promptDirection((_message, retry) => readDirectionKey(`${prompt} `, retry));
}
async function applyPickAxe(item) {
    const result = await usePickAxe(item, {
        state: game,
        ensureWielded: () => wieldTool(item, 'swing', { swapWeapons: doswapweapon }, game),
        readDirection: pickAxeDirection,
        payShopkeeper: dopay,
        attackMonster: (monster, struckAt) => attackHostileMonster(monster, struckAt.x, struckAt.y),
    });
    if ('died' in result && result.died)
        return;
    if (result.cancelled)
        commandResultCancelled(); // dig.c:use_pick_axe() res|ECMD_CANCEL.
    if ('resume' in result && result.resume) {
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'apply', invlet: inventoryCommandLetter(item) });
    }
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}
export async function applyPolearm(item, autohit = false) {
    const result = await usePolearm(item, {
        state: game,
        autohit,
        ensureWielded: () => wieldTool(item, 'swing', { swapWeapons: doswapweapon }, game),
    });
    if ('heroDied' in result && result.heroDied)
        return;
    if ('resume' in result && result.resume) {
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'apply', invlet: inventoryCommandLetter(item) });
    }
    // use_pole() returns ECMD_CANCEL for a refused target prompt and
    // ECMD_FAIL for an out-of-range or unseen one (apply.c:3474-3505).
    if ('cancelled' in result && result.cancelled)
        commandResultCancelled();
    if ('failure' in result && result.failure)
        commandResultFailed();
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}
export async function doapply(cannedInvlet = null) {
    // apply.c:doapply() rejects the current body and excessive load before
    // choosing an object through getobj().
    if (heroHasNoHands(game)) {
        await syncPline("You aren't able to use or apply tools in your current form.");
        game.context.move = 0;
        return;
    }
    if (exceedsActionCapacity(game)) {
        await syncPline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    const underlay = snapshotMenuUnderlay();
    const item = cannedInvlet === null
        ? await chooseInventoryObject('use or apply', applySuggestion)
        : game.inventory.find(object => object.invlet === cannedInvlet
            && [GETOBJ_SUGGEST, GETOBJ_DOWNPLAY].includes(applySuggestion(object)));
    if (!item) {
        commandResultCancelled(); // doapply() returns ECMD_CANCEL without an object.
        return;
    }
    const touch = await retouchHeroObject(item);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    if (item.oclass === 11) {
        const result = await breakWand(item);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (item.oclass === 10 || item.oclass === 12) {
        const result = item.oclass === 10
            ? await flipThroughBook(item) : await flipCoin(item);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    game.context.move = 0;
    const appliedObject = await applyTool(item, underlay);
    if (!game.program_state.gameover && appliedObject
        && await speakArtifact(appliedObject)) {
        // doapply() ORs arti_speak()'s ECMD_TIME into the tool result, so
        // a cancelled tool use still spends its turn when it speaks.
        commandResultSpentTime();
        game.context.move = 1;
    }
}
// Return the surviving object for the native talking-artifact tail. Applied
// stacks can split or disappear, so each destructive owner returns its object.
export async function applyTool(item, underlay) {
    if (item.otyp === CRYSTAL_BALL) {
        const object = await useCrystalBall(item);
        game.context.move = 1;
        return object;
    }
    if (item.otyp === LAND_MINE || item.otyp === BEARTRAP) {
        const object = await useSettableTrap(item);
        game.context.move = 1;
        return object;
    }
    if (item.otyp === TINNING_KIT) {
        await useTinningKit(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === HORN_OF_PLENTY) {
        await useHornOfPlenty(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === BAG_OF_TRICKS) {
        await useBagOfTricks(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === SADDLE) {
        game.context.move = await useSaddle(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === CAN_OF_GREASE) {
        game.context.move = await useGrease(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === LEASH) {
        game.context.move = await useLeash(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === FIGURINE) {
        const result = await useFigurine(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (item.otyp === EXPENSIVE_CAMERA || item.otyp === TOWEL
        || item.otyp === BELL || item.otyp === BELL_OF_OPENING) {
        const result = item.otyp === EXPENSIVE_CAMERA ? await useCamera(item)
            : item.otyp === TOWEL ? await useTowel(item) : await useBell(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (item.otyp === MIRROR) {
        const result = await useMirror(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if ([TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF].includes(item.otyp)) {
        const result = await useWhistle(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if ([TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL,
        OIL_LAMP, BRASS_LANTERN, MAGIC_LAMP].includes(item.otyp)) {
        let result;
        if (item.otyp === CANDELABRUM_OF_INVOCATION)
            result = await useCandelabrum(item);
        else if (item.otyp === POT_OIL)
            result = await lightCocktail(item);
        else if ([TALLOW_CANDLE, WAX_CANDLE].includes(item.otyp))
            result = await useCandle(item);
        else
            result = await useLamp(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (isGrayStone(item)) {
        const result = await useGrayStone(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (item.otyp === BULLWHIP) {
        const wielded = await wieldTool(item, 'lash', { swapWeapons: doswapweapon }, game);
        if (!wielded.ready) {
            game.context.move = 0;
            return item;
        }
        if (wielded.newlyWielded) {
            game._cannedCommands ||= [];
            game._cannedCommands.push({
                kind: 'apply', invlet: inventoryCommandLetter(item),
            });
            game.context.move = 1;
            return item;
        }
        const direction = await promptDirection();
        if (!direction) {
            // use_whip() reports ECMD_CANCEL when getdir() is refused;
            // the rhack seam clears both command queues for that.
            commandResultCancelled();
            game.context.move = 0;
            return item;
        }
        game._pending_message = '';
        const result = await useBullwhip(item, direction, {
            // C apply.c:use_whip() reaches do_attack() through
            // uhitm.c:force_attack(): anything that is not a pet is
            // struck with forcefight forced on, while a pet keeps
            // do_attack()'s safepet displacement block.
            attackMonster: async (monster, x, y) => {
                if (monster.mtame && !game.context.forcefight
                    && heroMayDisplaceMonster(monster)
                    && artifactById(game.uwep?.oartifact, game)?.name
                        !== 'Stormbringer') {
                    return await runSafepetDisplacement(monster) !== 'evaded';
                }
                const savedForcefight = game.context.forcefight ?? false;
                if (!monster.mtame)
                    game.context.forcefight = true;
                try {
                    const verdict = await prepareAppliedWeaponAttack(monster, game.uwep ?? null, { state: game, struckAt: { x, y } });
                    if (!verdict.proceed)
                        return verdict.spentTime;
                    return await attackHostileMonster(monster, x, y, {
                        confirmationOverridden: verdict.confirmationOverridden ?? false,
                    });
                }
                finally {
                    game.context.forcefight = savedForcefight;
                }
            },
        });
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (isPick(item) || isAxe(item)) {
        await applyPickAxe(item);
        return item;
    }
    if (isPolearm(item)) {
        await applyPolearm(item);
        return item;
    }
    if (item.otyp === GRAPPLING_HOOK) {
        const result = await useGrapplingHook(item, {
            state: game,
            ensureWielded: () => wieldTool(item, 'cast', { swapWeapons: doswapweapon }, game),
            hurtle: (dx, dy) => hurtleHero(dx, dy, 1, {
                finishTeleport: finishTeleportArrival,
                gotoLevel,
                chooseTeleportDestination: askTeleportDestination,
                finishMonsterDeath: finishHurtleMonsterDeath,
            }),
        });
        if (result.resume) {
            game._cannedCommands ||= [];
            game._cannedCommands.push({
                kind: 'apply', invlet: inventoryCommandLetter(item),
            });
        }
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if ([BLINDFOLD, LENSES].includes(item.otyp)) {
        game._pending_message = '';
        await applyEyewear(item);
        if (game.program_state.gameover)
            return item;
        game.context.move = 1;
        return item;
    }
    if (isContainer(item)) {
        const result = await useContainer(item, {
            held: true,
            underlay,
        });
        if (result.heroDied)
            return item;
        game.context.move = result.spentTime ? 1 : 0;
        return result.container;
    }
    if (item.otyp === STETHOSCOPE) {
        game.context.move = await useStethoscope(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === TIN_OPENER) {
        const result = await useTinOpener(item, { state: game, swapWeapons: doswapweapon });
        if (!result.heroDied)
            game.context.move = Number(result.usedTime);
        return item;
    }
    if (item.otyp === MAGIC_MARKER) {
        game.context.move = Number(await useMagicMarker(item));
        return item;
    }
    if (item.otyp === UNICORN_HORN) {
        const result = await useUnicornHorn({
            object: item,
            state: game,
        });
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (PLAYABLE_INSTRUMENTS.has(item.otyp)) {
        game._pending_message = '';
        game._retained_message = '';
        await playInstrument(item, {
            finishMonsterKill: finishHeroMonsterKill,
        });
        return item;
    }
    if (item.otyp === CREAM_PIE) {
        game._pending_message = '';
        await useCreamPie(item);
        game.context.move = 0;
        return null;
    }
    if (isRoyalJelly(item)) {
        const used = await rubRoyalJelly(item);
        return used ? null : item;
    }
    if ([SKELETON_KEY, LOCK_PICK, CREDIT_CARD].includes(item.otyp)) {
        game.context.move = Number(await pickLock(item));
        return item;
    }
    if (item.otyp === BANANA && heroIsHallucinating(game)) {
        await syncPline("It rings! ... But no-one answers.");
        game.context.move = 1;
        return item;
    }
    await syncPline("Sorry, I don't know how to use that.");
    // apply.c's default case returns ECMD_FAIL; the rhack seam clears the
    // queues so a later ^A reports nothing to repeat.
    commandResultFailed();
    return null;
}
// Native apply.c:do_break_wand(). The discarded wand remains a free object
// during its explosion, so inventory destruction cannot consume it twice.
const WAND_CLASS = 11;
const inertBreaks = new Set([
    WAN_WISHING, WAN_NOTHING, WAN_LOCKING, WAN_PROBING, WAN_ENLIGHTENMENT,
    WAN_SECRET_DOOR_DETECTION, WAN_STASIS, WAN_OPENING,
]);
const affectsObjects = new Set([
    WAN_STRIKING, WAN_CANCELLATION, WAN_POLYMORPH, WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
]);
export async function breakWand(wand, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const description = state.objectDescriptions?.[wand.otyp] ?? OBJECT_DESCRIPTIONS[wand.otyp];
    const fragile = description === 'balsa' || description === 'glass';
    if (heroHasNoHands(state)) {
        observeObjectForNaming(wand, { state });
        const name = ownedObjectName(wand, state, { capitalized: false });
        await pline(`You can't break ${name} without hands!`);
        return { spentTime: false, heroDied: false };
    }
    if (!heroHasFreeHand(state)) {
        await pline(`Your ${makePlural(heroHandName(state))} are occupied!`);
        return { spentTime: false, heroDied: false };
    }
    // Native names the wand in the weakness denial or confirmation.
    // The occupied-hands denial above names only the hands.
    observeObjectForNaming(wand, { state });
    const name = ownedObjectName(wand, state, { capitalized: false });
    if (currentAttribute(A_STR, state) < (fragile ? 5 : 10)) {
        await pline(`You don't have the strength to break ${name}!`);
        return { spentTime: false, heroDied: false };
    }
    const paranoid = !!((state.flags.paranoia_bits ?? 0) & PARANOID_BREAKWAND);
    if (!await paranoidQuery(paranoid, `Are you really sure you want to break ${name}?`))
        return { spentTime: false, heroDied: false };
    await pline(`Raising ${name} high above your ${heroHeadName(state)}, you ${fragile ? 'snap' : 'break'} it in two!`);
    if (wand.unpaid) {
        await chargeUnpaidUsage(wand, { state });
        await chargeAlteredUnpaidObject(wand, 'destroy', state);
    }
    state._currentWand = wand;
    await freeInventoryObject(wand, state);
    if (state.program_state.gameover)
        return { spentTime: true, heroDied: true };
    await removeWornHeroItem(wand, state);
    if (state.program_state.gameover)
        return { spentTime: true, heroDied: true };
    if (!await zappable(wand, { state })) {
        await pline('But nothing else happens...');
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    // zappable consumed one charge; breakage uses the original charge total.
    // A wrested last charge becomes 1..3 for the explosion.
    wand.spe++;
    if (!wand.spe)
        wand.spe = rnd(3);
    wand.ox = state.u.ux;
    wand.oy = state.u.uy;
    if (wand.otyp === WAN_OPENING && state.u.ustuck) {
        await releaseHold(state);
        if (state.program_state.gameover)
            return { spentTime: true, heroDied: true };
        if (wand.dknown)
            learnObjectType(WAN_OPENING, state);
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    if (inertBreaks.has(wand.otyp)) {
        await pline('But nothing else happens...');
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    let damage = wand.spe * 4;
    const rayBreak = [WAN_DEATH, WAN_LIGHTNING, WAN_FIRE, WAN_COLD, WAN_MAGIC_MISSILE].includes(wand.otyp);
    if (rayBreak) {
        if (wand.otyp === WAN_DEATH || wand.otyp === WAN_LIGHTNING)
            damage *= 4;
        else if (wand.otyp === WAN_FIRE || wand.otyp === WAN_COLD)
            damage *= 2;
        const style = wand.otyp === WAN_FIRE ? EXPL_FIERY
            : wand.otyp === WAN_COLD ? EXPL_FROSTY : EXPL_MAGICAL;
        await explode(wand.ox, wand.oy, -wand.otyp, damage, WAND_CLASS, style, { state });
        if (state.program_state.gameover)
            return { spentTime: true, heroDied: true };
        learnObjectType(wand.otyp, state);
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    if (wand.otyp === WAN_STRIKING) {
        await pline('A wall of force smashes down around you!');
        damage = d(1 + wand.spe, 6);
    }
    await explode(wand.ox, wand.oy, -wand.otyp, rnd(damage), WAND_CLASS, EXPL_MAGICAL, { state });
    if (state.program_state.gameover)
        return { spentTime: true, heroDied: true };
    beginImmediateZap(state);
    let shopDamage = false, fillMessageShown = false;
    for (let direction = 0; direction <= 8; direction++) {
        const dx = xdir[direction], dy = ydir[direction];
        if (dx === undefined || dy === undefined)
            throw new Error(`Missing wand break direction ${direction}.`);
        const x = wand.ox + dx, y = wand.oy + dy;
        state.bhitpos = { x, y };
        if (!isok(x, y))
            continue;
        if (wand.otyp === WAN_DIGGING) {
            const dug = await digWithBrokenWand(wand, x, y, fillMessageShown, state);
            shopDamage ||= dug.shopDamage;
            fillMessageShown ||= dug.filledWithLiquid;
        }
        else if (wand.otyp === WAN_CREATE_MONSTER) {
            await makemonAt(null, state.u.ux, state.u.uy);
        }
        else if (x !== state.u.ux || y !== state.u.uy) {
            const monster = monsterAtPosition(state.level, x, y);
            if (monster)
                await hitMonsterWithWand(monster, wand, { state, x, y });
            if (state.program_state.gameover)
                return { spentTime: true, heroDied: true };
            if (affectsObjects.has(wand.otyp))
                await affectPile(wand, x, y, state);
        }
        else {
            if (affectsObjects.has(wand.otyp))
                await affectPile(wand, x, y, state);
            if (state.program_state.gameover)
                return { spentTime: true, heroDied: true };
            const effect = await zapHeroWithObject(wand, { state, ordinary: false });
            if (effect.heroDied)
                return { spentTime: true, heroDied: true };
            if (effect.damage) {
                const injury = state.u.halfPhysicalDamage ? Math.ceil(effect.damage / 2) : effect.damage;
                const killer = `killed ${state.flags.female ? 'herself' : 'himself'} by breaking a wand`;
                if (await loseHeroHp(injury, killer, { state, killerFormat: NO_KILLER_PREFIX }))
                    return { spentTime: true, heroDied: true };
            }
            await bot();
        }
        if (state.program_state.gameover)
            return { spentTime: true, heroDied: true };
    }
    await finishImmediateZap(state);
    if (shopDamage)
        await payForShopDamage('dig into', { state });
    if (wand.otyp === WAN_LIGHT)
        await lightRoom(true, { finishMonsterKill: finishHeroMonsterKill });
    if (state.program_state.gameover)
        return { spentTime: true, heroDied: true };
    await discardBrokenWand(state);
    return { spentTime: true, heroDied: false };
}
async function discardBrokenWand(state) {
    const wand = state._currentWand;
    state._currentWand = null;
    if (wand)
        await delobj(wand, state);
    endVoluntaryMultiTurn(state);
}
async function affectPile(wand, x, y, state) {
    if (!state.level.objects[x]?.[y]?.length)
        return;
    await hitFloorPileWithWand(wand, x, y, { state });
    if (!state.program_state.gameover)
        await bot();
}
async function digWithBrokenWand(wand, x, y, fillMessageShown, state) {
    const result = { shopDamage: false, filledWithLiquid: false };
    const check = digCheck('object', x, y, state);
    if (check < DIGCHECK_FAILED || check === DIGCHECK_FAIL_BOULDER) {
        const location = state.level.at(x, y);
        if (!location)
            throw new Error(`No map location at ${x},${y}`);
        if (IS_WALL(location.typ) || IS_DOOR(location.typ)) {
            await watchDigging(x, y, { state, magic: true });
            result.shopDamage = roomsAt(state.level, x, y, SHOPBASE).length > 0;
        }
        if (location.typ === ICE)
            stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
        const liquid = liquidForHole(x, y, state);
        if (liquid !== ROOM) {
            location.typ = liquid;
            location.flags = 0;
            const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
            await liquidFlow(x, y, liquid, trap ?? null, fillMessageShown ? null : 'Some holes are quickly filled with %s!', { state });
            result.filledWithLiquid = true;
        }
        else {
            const pit = rn2(wand.spe) < 3 || (!canDigDown(state.u.uz) && !location.candig);
            await digActualHole(x, y, 'object', pit ? PIT : HOLE, { state });
        }
    }
    if (state.program_state.gameover)
        return result;
    await fillPitWithBoulderAt(x, y, state);
    if (state.program_state.gameover)
        return result;
    while (isPoolAt(x, y, state) || isLavaAt(x, y, state)) {
        const boulder = state.level.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
        if (!boulder)
            break;
        unlinkObject(boulder, state);
        await dropBoulderIntoLiquid(boulder, x, y, state);
        if (state.program_state.gameover)
            return result;
    }
    vision_note_blocker_change(x, y);
    return result;
}
// C apply.c:use_trap(), set_trap(), reset_trapset().
// C apply.c:reset_trapset().
export function resetTrapSetting(state = game) {
    state._trapSetting = null;
}
// C apply.c:use_trap().
export async function useSettableTrap(object) {
    requirePlayingGame(game);
    const hero = game.u;
    const refusal = trapSettingRefusal();
    if (refusal) {
        await pline(`You can't set a trap ${refusal}!`);
        resetTrapSetting();
        return object;
    }
    const type = object.otyp === LAND_MINE ? LANDMINE : BEAR_TRAP;
    const old = game._trapSetting;
    if (old && old.object === object && old.level === game.level && old.x === hero.ux && old.y === hero.uy) {
        await pline(`You resume setting ${objectOwnershipPrefix(object, game, { capitalized: false })}${trapName(type)}.`);
        game._occupation = { key: 'set-trap', text: 'setting the trap' };
        return null;
    }
    const remaining = trapPreparationTime(type, currentAttribute(A_DEX, game), currentAttribute(A_STR, game), heroIsBlind(game));
    // C use_trap() preserves a pending bungle until reset_trapset().
    const progress = { object, level: game.level, x: hero.ux, y: hero.uy, remaining, forceBungle: old?.forceBungle ?? false };
    game._trapSetting = progress;
    if (hero.usteed && (hero.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
        const bungle = rnl(10) > (propertyIsActive('fumbling', game) || object.cursed ? 3 : 5);
        await pline(`You aren't very skilled at reaching from ${monsterName(hero.usteed)}.`);
        if (await promptYesNo(`Continue your attempt to set the ${trapName(type)}?`) !== 'y') {
            resetTrapSetting();
            return object;
        }
        if (bungle) {
            if (type === LANDMINE) {
                progress.remaining = 0;
                progress.forceBungle = true;
            }
            else {
                resetTrapSetting();
                await pline(`You drop the ${trapName(type)}!`);
                await dropInventoryObjectAtHero(object);
                return object;
            }
        }
    }
    await pline(`You begin setting ${objectOwnershipPrefix(object, game, { capitalized: false })}${trapName(type)}.`);
    if (object.unpaid) {
        const keeper = findObjectOwner(object, hero.ux, hero.uy, game);
        if (!heroIsDeaf(game) && keeper && !shopkeeperIsMuted(keeper))
            await pline('"You set it, you buy it!"');
        await billDummyObject(object);
    }
    game._occupation = { key: 'set-trap', text: 'setting the trap' };
    return null;
}
// C apply.c:set_trap().
export async function continueTrapSetting(state = game) {
    requirePlayingGame(state);
    const progress = state._trapSetting;
    if (!progress || progress.object.where !== 'inventory' || !state.inventory.includes(progress.object)
        || progress.level !== state.level || progress.x !== state.u.ux || progress.y !== state.u.uy) {
        resetTrapSetting(state);
        return false;
    }
    if (--progress.remaining > 0)
        return true;
    const object = progress.object;
    const type = object.otyp === LAND_MINE ? LANDMINE : BEAR_TRAP;
    const trap = await maketrap(state.u.ux, state.u.uy, type);
    if (trap) {
        trap.madeby_u = true;
        await feelTrap(trap, state);
        if (roomsAt(state.level, trap.tx, trap.ty, SHOPBASE).length)
            addShopDamage(trap.tx, trap.ty, 0, state);
        if (!progress.forceBungle)
            await pline(`You finish arming the ${trapName(type)}.`);
        // C evaluates this luck roll before checking force_bungle too.
        const bungle = (object.cursed || propertyIsActive('fumbling', state)) && rnl(10) > 5;
        if (bungle || progress.forceBungle) {
            await triggerHeroTrap(trap, { forceBungle: progress.forceBungle, gotoLevel, finishTeleport: finishTeleportArrival });
            if (state.program_state.gameover)
                return false;
        }
    }
    else
        await pline('Your trap setting attempt fails.');
    await consumeInventoryItem(object, state);
    resetTrapSetting(state);
    return false;
}
function trapPreparationTime(type, dexterity, strength, blind) {
    let turns = 5;
    if (dexterity > 17)
        turns = 2;
    else if (dexterity > 12)
        turns = 3;
    else if (dexterity > 7)
        turns = 4;
    if (blind)
        turns *= 2;
    if (type !== BEAR_TRAP || strength >= 18)
        return turns;
    if (strength > 12)
        return turns + 1;
    return turns + (strength > 7 ? 2 : 4);
}
function trapSettingRefusal() {
    requirePlayingGame(game);
    const hero = game.u, level = game.level;
    const location = level.requireAt(hero.ux, hero.uy);
    if (heroHasNoHands(game))
        return 'without hands';
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0)
        return 'while stunned';
    if (hero.uswallow)
        return hero.ustuck && monsterDigests(hero.ustuck) ? 'while swallowed' : 'while engulfed';
    if (hero.uinwater || game.underwater)
        return 'underwater';
    if (propertyIsActive('levitation', game))
        return 'while levitating';
    if (isPoolAt(hero.ux, hero.uy))
        return 'in water';
    if (isLavaAt(hero.ux, hero.uy))
        return 'in lava';
    if (heroIsOnStairs(game)) {
        for (let stair = game.stairs; stair; stair = stair.next)
            if (stair.sx === hero.ux && stair.sy === hero.uy)
                return stair.isladder ? 'on the ladder' : 'on the stairs';
        return 'on the stairs';
    }
    if (IS_FURNITURE(location.typ) || IS_OBSTRUCTED(location.typ)
        || location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))
        || level.traps.some(trap => trap.tx === hero.ux && trap.ty === hero.uy))
        return 'here';
    if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        if (location.typ === AIR)
            return 'in midair';
        return location.typ === CLOUD ? 'in a cloud' : 'in this place';
    }
    return null;
}
//# sourceMappingURL=apply.js.map