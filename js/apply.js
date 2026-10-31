// apply.js — Apply/use-tool command and its tool dispatch.
// C ref: apply.c:doapply(), dorub(), dojump(), use_*() dispatch.
// The individual tools live in their own modules (bullwhip.ts, jumping.ts,
// pick_axe.ts, ...); this file owns the command bodies and the switch.
import { applySuggestion } from './apply_selection.js';
import { flipThroughBook } from './book_flip.js';
import { flipCoin } from './coin_flip.js';
import { useGrayStone } from './gray_stone.js';
import { useMirror } from './mirror.js';
import { useCamera } from './camera.js';
import { useTowel } from './towel.js';
import { useBell } from './apply_bell.js';
import { breakWand } from './wand_break.js';
import { speakArtifact } from './artifact_speech.js';
import { lightCocktail, useCandelabrum, useCandle, useLamp } from './apply_light.js';
import { useWhistle } from './whistle.js';
import { retouchHeroObject } from './hero_retouch.js';
import { isGrayStone } from './object_properties.js';
import { attackHostileMonster } from './hero_melee.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { learnObjectType } from './object_knowledge.js';
import { chargeUnpaidUsage } from './shk.js';
import { commandResultCancelled, commandResultFailed, commandResultSpentTime } from './command_state.js';
import { exceedsActionCapacity } from './weight.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { heroMayDisplaceMonster, runSafepetDisplacement } from './hack.js';
import { artifactById } from './artifacts.js';
import { wieldTool } from './wield_tool.js';
import { doswapweapon } from './wield.js';
import { snapshotMenuUnderlay } from './windows.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST } from './const.js';
import { game, requirePlayingGame } from './gstate.js';
import { BULLWHIP, GRAPPLING_HOOK, CREAM_PIE, EGG, LOCK_PICK, CRYSTAL_BALL, STETHOSCOPE, CREDIT_CARD, BAG_OF_TRICKS, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP, BANANA, MIRROR, TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF, BELL, BELL_OF_OPENING, EXPENSIVE_CAMERA, TIN_OPENER, FIGURINE, LEASH, CAN_OF_GREASE, SADDLE, HORN_OF_PLENTY, TINNING_KIT, LAND_MINE, BEARTRAP, TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL, LENSES, BLINDFOLD, TOWEL, MAGIC_MARKER, UNICORN_HORN, SKELETON_KEY, } from './object_data.js';
import { rn2 } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { pline, plineWithContinuation } from './pline.js';
import { heroHasNoHands } from './polyself.js';
import { transformMagicLampToOilLamp } from './light.js';
import { releaseDjinni } from './potion_occupants.js';
import { jumpHero } from './jumping.js';
import { usePickAxe } from './pick_axe.js';
import { usePolearm } from './polearm.js';
import { isPick, isAxe, isPolearm } from './weapon_type.js';
import { dopay } from './shop_pay_command.js';
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
import { useSettableTrap } from './trap_setting.js';
import { useSaddle } from './steed.js';
import { isRoyalJelly, useRoyalJelly } from './royal_jelly.js';
import { useBullwhip } from './bullwhip.js';
import { pickLock } from './lock_pick.js';
import { useCrystalBall } from './crystal_ball.js';
import { isContainer, useContainer } from './container.js';
import { useTinOpener } from './tin.js';
import { useMagicMarker } from './write.js';
import { useUnicornHorn } from './unicorn_horn.js';
import { PLAYABLE_INSTRUMENTS, playInstrument } from './music.js';
import { inventoryCommandLetter } from './invent.js';
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
        await pline("You aren't able to rub anything without hands.");
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
            await plineWithContinuation(heroIsBlind(game)
                ? 'You smell smoke.' : 'You see a puff of smoke.');
        else
            await plineWithContinuation('Nothing happens.');
    }
    else if (object.otyp === BRASS_LANTERN) {
        await plineWithContinuation('Rubbing the electric lamp is not particularly rewarding.');
        await plineWithContinuation('Anyway, nothing exciting happens.');
    }
    else {
        await plineWithContinuation('Nothing happens.');
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
        await pline("You aren't able to use or apply tools in your current form.");
        game.context.move = 0;
        return;
    }
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
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
        await pline("It rings! ... But no-one answers.");
        game.context.move = 1;
        return item;
    }
    await pline("Sorry, I don't know how to use that.");
    // apply.c's default case returns ECMD_FAIL; the rhack seam clears the
    // queues so a later ^A reports nothing to repeat.
    commandResultFailed();
    return null;
}
//# sourceMappingURL=apply.js.map