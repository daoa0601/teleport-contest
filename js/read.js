// Reading scrolls and spellbooks.
// C refs: read.c doread(), seffects(), and their helpers.

import { exerciseAttribute } from './attrib.js';
import { BCPOS_CHAIN, heroIsPunished } from './ball.js';
import {
    A_CON, A_DEX, A_STR, A_WIS, TT_BURIEDBALL,
    W_ART, W_ARTI, W_BALL, W_CHAIN,
    WT_IRON_BALL_INCR,
} from './const.js';
import {
    flush_screen, newsym, pline, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import {
    consumeInventoryItem, identifyPack, inventoryItemDescription,
} from './invent.js';
import { nhgetch } from './input.js';
import { readLightScroll } from './light.js';
import { place_object, stack_object } from './floor_object.js';
import { mkobj } from './mklev.js';
import { doClassGenocide, doGenocide } from './genocide.js';
import {
    HEAVY_IRON_BALL, LEASH, LOADSTONE, OBJECT_MERGE, SLING,
    SCR_BLANK_PAPER, SCR_DESTROY_ARMOR,
    SCR_ENCHANT_WEAPON, SCR_GENOCIDE, SCR_IDENTIFY, SCR_LIGHT,
    SCR_PUNISHMENT, SCR_REMOVE_CURSE, SCR_TELEPORTATION,
    SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD,
} from './object_data.js';
import {
    blessObjectState, curseObjectState, uncurseObjectState,
} from './object_state.js';
import { recordObjectCall, recordObjectKnowledge } from './object_knowledge.js';
import { getLine } from './query.js';
import { rnd, rn2, rnl } from './rng.js';
import { studyBook } from './spell.js';
import {
    moveHeroByTeleport, safeTeleportDestination,
} from './teleport.js';
import { heroTeleportRestricted } from './teleport_rules.js';
import { moreUntilDismissed, promptKey } from './tty_prompts.js';
import { vision_recalc, vision_reset } from './vision.js';
import {
    destroyWornArmor, findArmorClass, objectErosionKind,
    objectErosionMessage, wornArmorInDestroyOrder,
} from './armor.js';
import { exceedsActionCapacity } from './weight.js';
import { monsterSaddle } from './steed.js';
import { unpunishHero } from './punishment.js';

const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WEAPON_CLASS = 2;

export async function doread({
    gotoLevel, finishHeroDeath, finishMonsterKill,
} = {}) {
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    const books = (game.inventory || []).filter(item =>
        item.oclass === SCROLL_CLASS || item.oclass === SPBOOK_CLASS
        || item.class === 'Scrolls' || item.class === 'Spellbooks');
    const letters = books.map(item => item.invlet).join('');
    const objectPrompt = `What do you want to read? [${letters} or ?*] `;
    let key = await promptKey(objectPrompt);
    for (;;) {
        if ([27, 32, 10, 13].includes(key)) {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        const selected = books.find(item =>
            item.invlet === String.fromCharCode(key));
        if (selected || key === 63 || key === 42) break;
        // After showing the error, ask for an object again.
        await moreUntilDismissed("You don't have that object.--More--");
        game._pending_message = '';
        key = await promptKey(objectPrompt);
    }
    if (String.fromCharCode(key) === '?' && books.length === 1) {
        const only = books[0];
        const description = only.otyp === SCR_TELEPORTATION
            ? 'a scroll labeled STRC PRST SKRZ KRK'
            : `a ${only.name || 'readable object'}`;
        key = await promptKey(
            `${only.invlet} - ${description}.--More--`,
        );
    }
    const book = books.find(item => item.invlet === String.fromCharCode(key));
    game._pending_message = '';
    // read.c counts literacy before applying the effect. Blank paper and the
    // Book of the Dead are exceptions.
    if (book && book.otyp !== SCR_BLANK_PAPER
        && book.otyp !== SPE_BLANK_PAPER
        && book.otyp !== SPE_BOOK_OF_THE_DEAD) {
        if (!game.u.uconduct) game.u.uconduct = {};
        game.u.uconduct.literate = (game.u.uconduct.literate || 0) + 1;
    }
    if (book?.otyp === SCR_TELEPORTATION) {
        await readTeleportationScroll(book, { gotoLevel });
        return;
    }
    if (book?.otyp === SCR_LIGHT) {
        await readLightScroll(book, {
            finishHeroDeath,
            finishMonsterKill,
        });
        return;
    }
    if (book?.otyp === SCR_REMOVE_CURSE) {
        await readRemoveCurseScroll(book);
        return;
    }
    if (book?.otyp === SCR_ENCHANT_WEAPON) {
        await readEnchantWeaponScroll(book);
        return;
    }
    if (book?.otyp === SCR_DESTROY_ARMOR) {
        await readDestroyArmorScroll(book);
        return;
    }
    if (book?.otyp === SCR_PUNISHMENT) {
        await readPunishmentScroll(book);
        return;
    }
    if (book?.otyp === SCR_IDENTIFY) {
        await readIdentifyScroll(book);
        return;
    }
    if (book?.otyp === SCR_GENOCIDE) {
        await readGenocideScroll(book, { finishHeroDeath });
        return;
    }
    await studyBook(book);
}

function attachBallAndChain() {
    // read.c:punish() creates and wears the chain first, then the ball.
    // ball.c:placebc_core() places the ball followed by the chain, leaving
    // the chain as the visible top object at their shared square.
    const chain = mkobj(CHAIN_CLASS, true);
    const ball = mkobj(BALL_CLASS, true);
    chain.quantity = chain.quan ?? 1;
    ball.quantity = ball.quan ?? 1;
    chain.owornmask = W_CHAIN;
    ball.owornmask = W_BALL;
    game.uchain = chain;
    game.uball = ball;
    game.u.uchain = chain;
    game.u.uball = ball;
    game.u.punished = true;
    place_object(ball, game.u.ux, game.u.uy);
    place_object(chain, game.u.ux, game.u.uy);
    game.u.bc_order = BCPOS_CHAIN;
    newsym(game.u.ux, game.u.uy);
}

async function readPunishmentScroll(scroll) {
    const disappearance = 'As you read the scroll, it disappears.';
    const punishment = 'You are being punished for your misbehavior!';
    const alreadyKnown = game._knownObjectTypes?.has(scroll.otyp);

    await pline(disappearance);
    exerciseAttribute(A_WIS, true); // seffects(): exercise(A_WIS, TRUE)

    // Show the disappearance before creating the ball and chain.
    await plineWithContinuation(punishment);
    if (heroIsPunished()) {
        // A second punishment makes the existing ball heavier.
        await plineWithContinuation('Your iron ball gets heavier.');
        game.uball.owt = (game.uball.owt ?? 480) + WT_IRON_BALL_INCR;
    } else {
        attachBallAndChain();
    }

    if (!alreadyKnown) {
        exerciseAttribute(A_WIS, true); // learnscroll() -> makeknown()
        recordObjectKnowledge(scroll.otyp);
    }
    consumeInventoryItem(scroll);
    game.context.move = 1;
}

async function readIdentifyScroll(scroll) {
    const alreadyKnown = game._knownObjectTypes?.has(scroll.otyp);
    await pline('As you read the scroll, it disappears.');
    exerciseAttribute(A_WIS, true); // seffects(): exercise(A_WIS, TRUE)

    // seffect_identify() removes a scroll before learning its type and before
    // counting the remaining unidentified inventory.
    consumeInventoryItem(scroll);
    await plineWithContinuation('This is an identify scroll.');
    if (!alreadyKnown) {
        exerciseAttribute(A_WIS, true); // learnscrolltyp() -> makeknown()
        recordObjectKnowledge(scroll.otyp);
    }

    let identifyLimit = 1;
    if (scroll.blessed || (!scroll.cursed && rn2(5) === 0)) {
        identifyLimit = rn2(5);
        if (identifyLimit === 1 && scroll.blessed && (game.u?.uluck ?? 0) > 0)
            identifyLimit++;
    }

    const selected = await identifyPack(identifyLimit, !alreadyKnown);
    for (const object of selected) {
        await plineWithContinuation(
            `${object.invlet} - ${inventoryItemDescription(object)}.`,
        );
    }
    game.context.move = 1;
}

async function readGenocideScroll(scroll, { finishHeroDeath } = {}) {
    const alreadyKnown = game._knownObjectTypes?.has(scroll.otyp);
    await pline('As you read the scroll, it disappears.');
    exerciseAttribute(A_WIS, true);

    if (!alreadyKnown) {
        await plineWithContinuation(
            'You have found a scroll of genocide!',
        );
        await moreUntilDismissed(
            'You have found a scroll of genocide!--More--',
        );
    }

    if (scroll.blessed) await doClassGenocide({ finishHeroDeath });
    else {
        const confused = (game.u?.confusionTurns ?? 0) > 0;
        await doGenocide(
            Number(!scroll.cursed) | (2 * Number(confused)),
            { finishHeroDeath },
        );
    }

    if (!alreadyKnown) {
        exerciseAttribute(A_WIS, true);
        recordObjectKnowledge(scroll.otyp);
    }
    consumeInventoryItem(scroll);
    game.context.move = 1;
}

function removeCurseWornMask(object) {
    let mask = (object.owornmask ?? 0) & ~(W_BALL | W_ART | W_ARTI);
    const swapWeapon = game.uswapwep || game.u?.uswapwep;
    const quiver = game.uquiver || game.u?.uquiver;
    if (object === swapWeapon && !(game.u?.twoweap || game.twoweap)) {
        mask = 0;
    } else if (object === quiver) {
        if (object.oclass === WEAPON_CLASS) {
            if (!OBJECT_MERGE[object.otyp]) mask = 0;
        } else if (object.oclass === GEM_CLASS) {
            if ((game.uwep || game.u?.uwep)?.otyp !== SLING) mask = 0;
        } else {
            mask = 0;
        }
    }
    return mask;
}

function removeCurseAppliesTo(object, blessed) {
    return blessed || removeCurseWornMask(object)
        || object.otyp === LOADSTONE
        || (object.otyp === LEASH && object.leashmon);
}

function randomlyBlessOrCurse(object) {
    if (object.blessed || object.cursed || rn2(2)) return false;
    return rn2(2) ? blessObjectState(object) : curseObjectState(object);
}

function removeCurseFeeling(confused) {
    const hallucinating = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0;
    if (hallucinating) {
        return confused
            ? 'the power of the Force against you!'
            : 'in touch with the Universal Oneness.';
    }
    return confused ? 'like you need some help.'
        : 'like someone is helping you.';
}

async function releaseBuriedBall(publish) {
    const u = game.u;
    if (!u?.utrap || u.utraptype !== TT_BURIEDBALL) return;
    const buried = game.level?.buriedObjects || [];
    const ball = buried.find(object => object.otyp === HEAVY_IRON_BALL
        && object.ox === u.ux && object.oy === u.uy);
    if (ball) {
        buried.splice(buried.indexOf(ball), 1);
        place_object(ball, u.ux, u.uy);
        stack_object(ball);
        game.level.engravings = (game.level.engravings || []).filter(
            engraving => engraving.x !== u.ux || engraving.y !== u.uy,
        );
        newsym(u.ux, u.uy);
    }
    u.utrap = 0;
    u.utraptype = 0;
    await publish('The clasp on your leg vanishes.');
}

// C read.c:seffect_remove_curse().  The caller owns scroll consumption and
// its reading message; this function owns the effect on carried equipment.
export async function removeCurseEffect({
    source = null,
    blessed = !!source?.blessed,
    cursed = !!source?.cursed,
    confused = (game.u?.confusionTurns ?? 0) > 0,
    publish = pline,
    announce = true,
} = {}) {
    if (announce) await publish(`You feel ${removeCurseFeeling(confused)}`);
    if (cursed && announce) await publish('The scroll disintegrates.');
    if (cursed) return [];

    const changed = [];
    for (const object of [...(game.inventory || [])]) {
        const quantity = object.quan ?? object.quantity ?? 1;
        if (object.oclass === COIN_CLASS
            || (object === source && quantity === 1)
            || !removeCurseAppliesTo(object, blessed)) continue;
        if (confused) {
            if (randomlyBlessOrCurse(object)) changed.push(object);
            object.bknown = false;
        } else if (object.cursed) {
            if (object.bknown && source?.otyp === SCR_REMOVE_CURSE
                && !game._knownObjectTypes?.has(SCR_REMOVE_CURSE)) {
                exerciseAttribute(A_WIS, true);
                recordObjectKnowledge(SCR_REMOVE_CURSE);
            }
            uncurseObjectState(object);
            changed.push(object);
        }
    }

    const saddle = monsterSaddle(game.u?.usteed);
    if (saddle && confused) {
        if (randomlyBlessOrCurse(saddle)) changed.push(saddle);
        saddle.bknown = false;
    } else if (saddle?.cursed) {
        uncurseObjectState(saddle);
        changed.push(saddle);
        if (!(game.blind || game.u?.blind)) {
            await publish('The saddle glows amber.');
            saddle.bknown = !(
                game.u?.hallucinating
                || (game.u?.hallucinationTurns ?? 0) > 0
            );
        } else {
            saddle.bknown = false;
        }
    }

    if (heroIsPunished() && !confused) unpunishHero();
    await releaseBuriedBall(publish);
    return changed;
}

async function readRemoveCurseScroll(scroll) {
    // read.c:doread()/seffects() retains a cursed scroll long enough for the
    // effect prose, then prints the curse-specific disintegration message.
    // The call-name prompt finishes before the reading turn ends.
    exerciseAttribute(A_WIS, true);

    const confused = (game.u?.confusionTurns ?? 0) > 0;
    const feeling = removeCurseFeeling(confused);
    if (scroll.cursed) {
        await moreUntilDismissed(
            `You read the scroll.  You feel ${feeling}--More--`,
        );
        await moreUntilDismissed('The scroll disintegrates.--More--');
    } else {
        await pline(
            `As you read the scroll, it disappears.  You feel ${feeling}`,
        );
    }

    await removeCurseEffect({
        source: scroll, confused, announce: false,
    });

    if (!game._knownObjectTypes?.has(scroll.otyp)
        && !game._objectCallNames?.[scroll.otyp]) {
        const description = scroll.name || 'scroll';
        const callName = await getLine(
            `Call a ${description}:`,
            (_ch, key) => key >= 32 && key < 127,
        );
        if (callName?.trim()) {
            recordObjectCall(scroll.otyp, callName.trim());
        }
        game._pending_message = '';
    }

    consumeInventoryItem(scroll);
    game.context.move = 1;
}

async function readEnchantWeaponScroll(scroll) {
    // doread() announces an ordinary disappearing scroll before seffects().
    // chwepon() and its possible makeknown() resume only after that pager.
    exerciseAttribute(A_WIS, true);
    await moreUntilDismissed('As you read the scroll, it disappears.--More--');

    const weapon = game.uwep || game.u?.uwep;
    if (!weapon || (weapon.oclass !== WEAPON_CLASS
        && weapon.class !== 'Weapons')) {
        await pline('Your hands twitch.');
        exerciseAttribute(A_DEX, true);
    } else {
        const amount = scroll.cursed ? -1 : scroll.blessed
            ? rnd(Math.max(1, 3 - Math.trunc((weapon.spe ?? 0) / 3))) : 1;
        const color = amount < 0 ? 'black' : 'blue';
        const duration = amount * amount === 1 ? 'moment' : 'while';
        await pline(`Your ${weapon.name} glows ${color} for a ${duration}.`);
        weapon.spe = (weapon.spe ?? weapon.enchantment ?? 0) + amount;
        weapon.enchantment = weapon.spe;
        if (amount > 0 && weapon.cursed) {
            weapon.cursed = false;
            weapon.buc = 'uncursed';
        }

        if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
        if (!game._knownObjectTypes.has(scroll.otyp)
            && weapon.known !== false && amount > 0) {
            exerciseAttribute(A_WIS, true);
            game._knownObjectTypes.add(scroll.otyp);
            game.u.urexp = (game.u.urexp || 0) + 10;
        }
    }

    consumeInventoryItem(scroll);
    game.context.move = 1;
}

async function appendReadEffectMessage(messageState, message, commit) {
    const columns = game.nhDisplay?.cols ?? 80;
    if (!messageState.pending) {
        messageState.pending = message;
        commit();
        return;
    }
    if (message.length + messageState.pending.length + 3 < columns - 8) {
        messageState.pending = `${messageState.pending}  ${message}`;
        commit();
        return;
    }

    // tty update_topl() calls more() before installing the new message.
    // Apply the armor damage only after the player dismisses the old line.
    await promptKey(`${messageState.pending}--More--`);
    messageState.pending = message;
    commit();
}

async function readDestroyArmorScroll(scroll) {
    const messageState = {
        pending: 'As you read the scroll, it disappears.',
    };

    // Every magical scroll exercises Wisdom before its effect.
    exerciseAttribute(A_WIS, true);

    const armors = wornArmorInDestroyOrder();
    const hits = rn2(4) + 1;
    let damaged = false;
    for (let hit = 0; hit < hits && armors.length; hit++) {
        const armor = armors[rn2(armors.length)];
        const kind = objectErosionKind(armor);
        if (!kind || armor.oerodeproof) continue;
        const message = objectErosionMessage(armor, kind);
        await appendReadEffectMessage(messageState, message, () => {
            if ((armor[kind.field] || 0) >= 3) destroyWornArmor(armor);
            else armor[kind.field] = (armor[kind.field] || 0) + 1;
        });
        damaged = true;
    }

    if (!damaged) {
        messageState.pending = `${messageState.pending}  Your skin itches.`;
        exerciseAttribute(A_STR, false);
        exerciseAttribute(A_CON, false);
    } else {
        if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
        if (!game._knownObjectTypes.has(scroll.otyp)) {
            // Learning the scroll exercises Wisdom after the armor damage.
            exerciseAttribute(A_WIS, true);
            game.u.urexp = (game.u.urexp || 0) + 10;
        }
        game._knownObjectTypes.add(scroll.otyp);
    }
    game.inventory = (game.inventory || []).filter(item => item !== scroll);
    findArmorClass(game);
    await pline(messageState.pending);
    game.context.move = 1;
}

async function readTeleportationScroll(scroll, { gotoLevel } = {}) {
    const disappearance = 'As you read the scroll, it disappears.--More--';
    const confused = (game.u?.confusionTurns || 0) > 0;

    if (confused) {
        // Each full line is dismissed before the level prompt opens.
        await promptKey(disappearance);
        exerciseAttribute(A_WIS, true);
        await promptKey(
            'Being confused, you mispronounce the magic words...--More--',
        );

        const requested = await getLine('To what level do you want to teleport?');
        if (requested === null) {
            learnTeleportationScroll(scroll);
            removeTeleportationScroll(scroll);
            game.context.move = 1;
            return;
        }

        let target = Number.parseInt(requested, 10);
        if (rnl(5)) {
            // teleport.c:random_teleport_level().  Main-dungeon depth starts
            // at one; choose from [1, current+3] while excluding current.
            const current = game.u?.uz?.dlevel ?? 1;
            if (!rn2(5)) target = current;
            else {
                target = rn2(current + 2) + 1;
                if (target >= current) target++;
            }
        }

        learnTeleportationScroll(scroll);
        removeTeleportationScroll(scroll);

        if (target === (game.u?.uz?.dlevel ?? 1)) {
            await pline('You shudder for a moment.');
            game.context.move = 1;
            return;
        }

        if (typeof gotoLevel !== 'function')
            throw new TypeError('level teleport needs gotoLevel');
        await gotoLevel(
            { dlevel: Math.max(1, target) },
            {
                arrival: 'random',
                preArrivalPager: 'Oops...--More--',
                postMessage: 'You materialize on a different level!',
            },
        );
        game._liveQuietTurnRequested = true;
        game.context.move = 1;
        return;
    }

    await pline(disappearance);

    // read.c:seffects() credits trying a magical scroll before scrolltele().
    exerciseAttribute(A_WIS, true);

    if (heroTeleportRestricted() && !game.flags?.debug) {
        await promptKey(disappearance);
        await pline('A mysterious force prevents you from teleporting!');
        learnTeleportationScroll(scroll);
        removeTeleportationScroll(scroll);
        game.context.move = 1;
        return;
    }

    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? -1];
    const inWizardTower = currentDungeon?.dname === "Vlad's Tower";
    if ((game.u?.uhave?.amulet || inWizardTower) && rn2(3) === 0) {
        await promptKey(disappearance);
        await pline('You feel disoriented for a moment.');
        removeTeleportationScroll(scroll);
        game.context.move = 1;
        return;
    }

    learnTeleportationScroll(scroll);

    const destination = safeTeleportDestination();
    if (destination) {
        const movement = moveHeroByTeleport(destination.x, destination.y);
        newsym(movement.oldx, movement.oldy);
        vision_reset();
        vision_recalc(0);
        newsym(destination.x, destination.y);
    }

    // C moves the hero before waiting for the teleport message to be
    // dismissed. The turn continues only after that input.
    await flush_screen(1);
    game.nhDisplay?.setCursor(disappearance.length, 0);
    await nhgetch();

    removeTeleportationScroll(scroll);
    await pline('You materialize in a different location!');
    game.context.move = 1;
}

function learnTeleportationScroll(scroll) {
    if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
    if (game._knownObjectTypes.has(scroll.otyp)) return;
    exerciseAttribute(A_WIS, true);
    game._knownObjectTypes.add(scroll.otyp);
    game.u.urexp = (game.u.urexp || 0) + 10;
}

function removeTeleportationScroll(scroll) {
    game.inventory = (game.inventory || []).filter(item => item !== scroll);
}
