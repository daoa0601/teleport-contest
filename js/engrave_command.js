// engrave_command.js — The #engrave command and its writing occupation.
// C refs: engrave.c doengrave(), u_can_engrave(), stylus_ok(),
// doengrave_sfx_item(), doengrave_sfx_item_WAN(), doengrave_ctx_verb(),
// engrave(), rloc_engr(), disturb_grave(), blengr(); hacklib.c xcrypt();
// invent.c getobj()'s "write with" flow.
import { plineWithContinuation as pline, newsym } from './display.js';
import { clearCommandKeys, takeCommandKey } from './input.js';
import { getLine, promptYesNoQuit } from './query.js';
import { compactInventoryLetters, inventoryLetterOrder, promptInventoryObject, reassignInventoryLetters, } from './inventory_prompt.js';
import { disturbGrave } from './grave.js';
import { deleteEngraving, engravingAt, makeEngravingAt } from './engrave.js';
import { heroCanReachFloor } from './floor_reach.js';
import { surfaceName, ceilingName } from './terrain_name.js';
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { ACCESSIBLE, ALTAR, BURN, CLOUD, COLNO, DRAWBRIDGE_UP, DUST, ENGRAVE, ENGR_BLOOD, GETOBJ_DOWNPLAY, GETOBJ_SUGGEST, GRAVE, HEADSTONE, IS_AIR, IS_FOUNTAIN, MARK, ROWNO, WAND_BACKFIRE_CHANCE, } from './const.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { heroHasFreeHand, isBlade, isWetTowel } from './weapon_type.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { heroFingerTipName, heroHandName } from './body_parts.js';
import { heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS2, MONSTER_SYMBOL, monsterHasNoHands, monsterIsAnimal, monsterIsVerySmall, monsterIsWhirly, } from './monster_data.js';
import { exceedsActionCapacity } from './weight.js';
import { learnWand, zappable } from './wand_charge.js';
import { explodeWand } from './recharge.js';
import { chargeUnpaidUsage, objectTypeKnown } from './shk.js';
import { zapWithoutDirection } from './wand_effects.js';
import { dryTowel } from './towel.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { inventoryItemDescription, selectInventoryObject } from './invent.js';
import { objectName, objectNameIsPlural, observeObjectForNaming, ownedObjectAction, ownedObjectName, } from './objnam.js';
import { artifactByName } from './artifacts.js';
import { exerciseWisdom } from './attrib.js';
import { addExperience } from './exper.js';
import { recordGameLogEvent } from './gamelog.js';
import { goodPosition } from './teleport_rules.js';
import { altarWrath } from './pray.js';
import { randomEngraving } from './mklev.js';
import { monsterName } from './monster_name.js';
import { unlinkObject } from './object_location.js';
import { splitObjectStack } from './object_stack.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { impossible } from './diagnostics.js';
import { MAGIC_MARKER, TOWEL, WAN_CANCELLATION, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING, WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_NOTHING, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_SECRET_DOOR_DETECTION, WAN_SLEEP, WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS, WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING, WAN_WISHING, } from './object_data.js';
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const FOOD_CLASS = 7;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;
const GEM_CLASS = 13;
const ROCK_CLASS = 14;
const BALL_CLASS = 15;
const VENOM_CLASS = 17;
const TOOL_CLASS = 6;
// object_data.js: an uncursed athame never dulls while carving.
const ATHAME = 38;
// armor.ts: armor types 163..172 are the boots subcategory (oc_armcat
// ARM_BOOTS).
const BOOT_TYPES_FIRST = 163;
const BOOT_TYPES_LAST = 172;
const M2_DEMON = 0x100;
const S_VAMPIRE = 48;
const BUFSZ = 256;
const DRAWBRIDGE_DOWN = 34;
// C engrave.c cant_reach_floor().
async function cantReachFloor(x, y, up, checkPit, wandEngraving, state) {
    const unreachable = up
        ? ceilingName(x, y, state)
        : checkPit && heroCanReachFloor(state)
            ? 'bottom of the pit'
            : surfaceName(x, y, state);
    await pline(`${wandEngraving
        ? 'The wand does nothing more, and the tip of the wand'
        : 'You'} can't reach the ${unreachable}.`);
}
// C engrave.c u_can_engrave().
async function heroCanEngrave(state) {
    const hero = state.u;
    const location = requireGameLevel(state).at(hero.ux, hero.uy);
    if (!location)
        throw new RangeError(`The hero location ${hero.ux},${hero.uy} is off the map`);
    const surfaceType = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    if (hero.uswallow) {
        const engulfer = hero.ustuck;
        if (monsterIsAnimal(engulfer)) {
            await pline('What would you write?  "Jonah was here"?');
            return false;
        }
        else if (monsterIsWhirly(engulfer)) {
            await cantReachFloor(hero.ux, hero.uy, false, false, false, state);
            return false;
        }
        // Amorphous engulfers are admitted here; doengrave() reports the
        // jello result once the writing implement has been chosen.
    }
    else if (isLavaAt(hero.ux, hero.uy, state)
        || isPoolAt(hero.ux, hero.uy, state) || IS_FOUNTAIN(surfaceType)) {
        await pline(`You can't write on the ${surfaceName(hero.ux, hero.uy, state)}!`);
        return false;
    }
    else if (IS_AIR(surfaceType)) {
        await pline(`You can't write in ${surfaceType === CLOUD ? 'cloud vapor' : 'thin air'}!`);
        return false;
    }
    else if (!ACCESSIBLE(surfaceType)) {
        await pline("You can't write here.");
        return false;
    }
    const species = heroSpecies(state);
    // C cantwield(): nohands() || verysmall().
    if (monsterHasNoHands(species) || monsterIsVerySmall(species)) {
        await pline("You can't even hold anything!");
        return false;
    }
    if (exceedsActionCapacity(state)) {
        await pline("You can't do that while carrying so much stuff.");
        return false;
    }
    return true;
}
// C engrave.c stylus_ok(): the getobj() callback classifying each object and
// the bare-hand alternative.
function stylusClass(object) {
    if (object.oclass === WEAPON_CLASS || object.oclass === WAND_CLASS
        || object.oclass === GEM_CLASS || object.oclass === RING_CLASS)
        return GETOBJ_SUGGEST;
    if (object.oclass === TOOL_CLASS
        && (object.otyp === TOWEL || object.otyp === MAGIC_MARKER))
        return GETOBJ_SUGGEST;
    return GETOBJ_DOWNPLAY;
}
// C invent.c getobj("write with", stylus_ok, GETOBJ_PROMPT).  The suggested
// letters follow sortloot(SORTLOOT_INVLET) order ($, a-z, A-Z);
// stylus_ok(NULL) is GETOBJ_SUGGEST, so '-' leads the displayed choices and
// stays selectable even with an otherwise empty suggestion set.
async function chooseStylus(state) {
    // getobj() consumes canned choices before reassigning letters or
    // opening a menu. stylus_ok() admits every carried object and hands.
    const queuedKey = takeCommandKey();
    if (queuedKey !== undefined) {
        if (queuedKey === '-'.charCodeAt(0))
            return 'hands';
        const object = state.inventory.find(candidate => candidate.invlet === String.fromCharCode(queuedKey));
        if (!object)
            clearCommandKeys();
        return object ?? null;
    }
    if (state.flags?.fixinv === false)
        reassignInventoryLetters();
    const inventory = [...(state.inventory || [])]
        .sort((left, right) => inventoryLetterOrder(left.invlet)
        - inventoryLetterOrder(right.invlet));
    const suggested = inventory.filter(object => stylusClass(object) === GETOBJ_SUGGEST);
    // C getobj(): force_invmenu skips the letter prompt and answers the
    // question from the inventory menu, with the fingertip as its '-' entry.
    if (state.flags?.force_invmenu) {
        let showAll = false;
        for (;;) {
            const items = showAll || !suggested.length ? inventory : suggested;
            const menuOptions = showAll
                ? [{ key: '?', text: '(list likely candidates)' }]
                : items.length < inventory.length
                    ? [{ key: '*', text: '(list everything)' }] : [];
            const { key } = await selectInventoryObject({
                items, menuOptions,
                extraChoice: `your ${heroFingerTipName(state)}`,
                title: 'What do you want to write with?',
            });
            if (key === 42 || key === 63) {
                showAll = key === 42;
                continue;
            }
            if (key === 27 && state.flags?.verbose !== false)
                await pline('Never mind.');
            if (key === '-'.charCodeAt(0))
                return 'hands';
            const object = inventory.find(object => object.invlet === String.fromCharCode(key)) ?? null;
            if (object)
                state.context.botl = true;
            return object;
        }
    }
    const letters = compactInventoryLetters(suggested.map(object => object.invlet ?? '').join(''));
    // C getobj(): "- " plus the suggested letters, then the ?* alternatives.
    const choices = letters ? `- ${letters}` : '-';
    const selection = await promptInventoryObject(`What do you want to write with? [${choices} or ?*] `, inventory, {
        verb: 'write with',
        allowMenu: true,
        allowNone: true,
        noneDescription: `your ${heroFingerTipName(state)}`,
        menuItems: suggested.length ? suggested : inventory,
    });
    if (selection.cancelled)
        return null;
    if (selection.none)
        return 'hands';
    return selection.object;
}
// C hacklib.c xcrypt() over the engrave.c blind_writing[] table.
const BLIND_WRITINGS = [
    '\x44\x66\x6d\x69\x62\x65\x22\x45\x7b\x71\x65\x6d\x72',
    '\x51\x67\x60\x7a\x7f\x21\x40\x71\x6b\x71\x6f\x67\x63',
    '\x49\x6d\x73\x69\x62\x65\x22\x4c\x61\x7c\x6d\x67\x24\x42\x7f\x69\x6c\x77\x67\x7e',
    '\x4b\x6d\x6c\x66\x30\x4c\x6b\x68\x7c\x7f\x6f',
    '\x51\x67\x70\x7a\x7f\x6f\x67\x68\x64\x71\x21\x4f\x6b\x6d\x7e\x72',
    '\x4c\x63\x76\x61\x71\x21\x48\x6b\x7b\x75\x67\x63\x24\x45\x65\x6b\x6b\x65',
    '\x4c\x67\x68\x6b\x78\x68\x6d\x76\x7a\x75\x21\x4f\x71\x7a\x75\x6f\x77',
    '\x44\x66\x6d\x7c\x78\x21\x50\x65\x66\x65\x6c',
    '\x44\x66\x73\x69\x62\x65\x22\x56\x7d\x63\x69\x76\x6b\x66',
];
// C engrave.c blengr().
function blindEngraving() {
    const chosen = BLIND_WRITINGS[rn2(BLIND_WRITINGS.length)];
    if (chosen === undefined)
        throw new RangeError('The blind writing table is missing its entry');
    let bitmask = 1;
    let out = '';
    for (const left of chosen) {
        let code = left.charCodeAt(0);
        if (code & (32 | 64))
            code ^= bitmask;
        bitmask <<= 1;
        if (bitmask >= 32)
            bitmask = 1;
        out += String.fromCharCode(code);
    }
    return out;
}
// C engrave.c rloc_engr(): the caller refreshes the old location.
function relocateEngraving(engraving, state) {
    let tries = 200;
    for (;;) {
        if (--tries < 0)
            return;
        const tx = rn2(COLNO - 3) + 2;
        const ty = rn2(ROWNO);
        if (engravingAt(tx, ty, state.level))
            continue;
        if (!goodPosition(tx, ty, null, { state }))
            continue;
        engraving.x = tx;
        engraving.y = ty;
        newsym(tx, ty);
        return;
    }
}
// C engrave.c doengrave_sfx_item_WAN(): the wand-specific engraving effects.
// Returns the post-engraving message and mutates the shared setup flags.
async function wandEngraveEffects(wand, setup, oep, oetype, frosted, state) {
    const hero = state.u;
    const surface = surfaceName(hero.ux, hero.uy, state);
    const blind = heroIsBlind(state);
    switch (wand.otyp) {
        case WAN_LIGHT:
        case WAN_SECRET_DOOR_DETECTION:
        case WAN_STASIS:
        case WAN_CREATE_MONSTER:
        case WAN_WISHING:
        case WAN_ENLIGHTENMENT:
            // zapnodir()
            await zapWithoutDirection(wand, state);
            return '';
        case WAN_STRIKING:
            return 'The wand unsuccessfully fights your attempt to write!';
        case WAN_SLOW_MONSTER:
            return blind ? '' : `The bugs on the ${surface} slow down!`;
        case WAN_SPEED_MONSTER:
            return blind ? '' : `The bugs on the ${surface} speed up!`;
        case WAN_POLYMORPH:
            if (oep) {
                if (!blind) {
                    setup.type = 0; /* random */
                    const engraved = randomEngraving();
                    setup.buf = engraved.text;
                    setup.ebuf = engraved.pristine;
                }
                else {
                    // Keep the felt type so only the text changes.
                    if (oetype)
                        setup.type = oetype;
                    setup.buf = blindEngraving();
                    setup.ebuf = '';
                }
                setup.dengr = true;
            }
            return '';
        case WAN_NOTHING:
        case WAN_UNDEAD_TURNING:
        case WAN_OPENING:
        case WAN_LOCKING:
        case WAN_PROBING:
            return '';
        case WAN_MAGIC_MISSILE:
            setup.ptext = true;
            return blind ? '' : `The ${surface} is riddled by bullet holes!`;
        case WAN_SLEEP:
        case WAN_DEATH:
            // can't tell sleep from death - Eric Backus
            return blind ? '' : `The bugs on the ${surface} stop moving!`;
        case WAN_COLD: {
            // An existing burned engraving is frozen out as well.
            let post = '';
            if (!blind)
                post = 'A few ice cubes drop from the wand.';
            if (oep && oep.engr_type === BURN) {
                if (!blind)
                    await pline(`The engraving on the ${surface} vanishes!`);
                setup.dengr = true;
            }
            return post;
        }
        case WAN_CANCELLATION:
        case WAN_MAKE_INVISIBLE:
            if (oep && oep.engr_type !== HEADSTONE) {
                if (!blind)
                    await pline(`The engraving on the ${surface} vanishes!`);
                setup.dengr = true;
            }
            return '';
        case WAN_TELEPORTATION:
            if (oep && oep.engr_type !== HEADSTONE) {
                if (!blind)
                    await pline(`The engraving on the ${surface} vanishes!`);
                setup.teleengr = true;
            }
            return '';
        case WAN_DIGGING:
            setup.ptext = true;
            setup.type = ENGRAVE;
            if (!objectTypeKnown(wand, state)) {
                if (state.flags?.verbose !== false)
                    await pline(`This ${objectName(wand, state)} is a wand of digging!`);
                setup.doknown = true;
            }
            return blind && !heroIsDeaf(state)
                ? 'You hear drilling!'
                : blind
                    ? 'You feel tremors.'
                    : requireGameLevel(state).at(hero.ux, hero.uy)?.typ === GRAVE
                        ? 'Chips fly out from the headstone.'
                        : frosted
                            ? 'Ice chips fly up from the ice surface!'
                            : requireGameLevel(state).at(hero.ux, hero.uy)?.typ === DRAWBRIDGE_DOWN
                                ? 'Splinters fly up from the bridge.'
                                : 'Gravel flies up from the floor.';
        case WAN_FIRE:
            setup.ptext = true;
            setup.type = BURN;
            if (!objectTypeKnown(wand, state)) {
                if (state.flags?.verbose !== false)
                    await pline(`This ${objectName(wand, state)} is a wand of fire!`);
                setup.doknown = true;
            }
            return blind ? 'You feel the wand heat up.' : 'Flames fly from the wand.';
        case WAN_LIGHTNING:
            setup.ptext = true;
            setup.type = BURN;
            if (!objectTypeKnown(wand, state)) {
                if (state.flags?.verbose !== false)
                    await pline(`This ${objectName(wand, state)} is a wand of lightning!`);
                setup.doknown = true;
            }
            if (!blind) {
                setup.doblind = true;
                return 'Lightning arcs from the wand.';
            }
            return !heroIsDeaf(state) ? 'You hear crackling!' : 'Your hair stands up!';
        default:
            return '';
    }
}
// The #engrave command.  C engrave.c doengrave(); engrave.c:engrave() runs as
// the occupation installed at the end.
export async function doengrave(state = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    if (!await heroCanEngrave(state)) {
        state.context.move = 0;
        return;
    }
    // doengrave_ctx_init()
    const setup = {
        dengr: false, doblind: false, doknown: false, eow: false,
        ptext: true, teleengr: false, zapwand: false, disprefresh: false,
        adding: false, ret: 'ok', type: DUST, buf: '', ebuf: '',
    };
    let oep = engravingAt(hero.ux, hero.uy, state.level);
    const oetype = oep?.engr_type ?? 0;
    const species = heroSpecies(state);
    if (!!((MONSTER_FLAGS2[species] ?? 0) & M2_DEMON)
        || MONSTER_SYMBOL[species] === S_VAMPIRE)
        setup.type = ENGR_BLOOD;
    const jello = !!hero.uswallow
        && !(monsterIsAnimal(hero.ustuck) || monsterIsWhirly(hero.ustuck));
    const frosted = isIceAt(hero.ux, hero.uy, state);
    state.multi = 0; /* moves consumed */
    // C's single doengr_exit label: refresh, then report the time result.
    const exit = () => {
        if (setup.disprefresh)
            newsym(hero.ux, hero.uy);
        state.context.move = setup.ret === 'time' ? 1 : 0;
    };
    const stylus = await chooseStylus(state);
    if (!stylus) {
        setup.ret = 'cancel';
        exit();
        return;
    }
    const usingHands = stylus === 'hands';
    let object = usingHands ? null : stylus;
    // Native yname() observes the implement before its effects can identify it.
    if (object)
        observeObjectForNaming(object, { state });
    const writer = stylus === 'hands'
        ? `your ${heroFingerTipName(state)}`
        : ownedObjectName(stylus, state, { capitalized: false });
    // There's no reason you should be able to write with a wand while both
    // your hands are tied up.
    const wielded = state.uwep || state.u.uwep;
    if (!heroHasFreeHand(state) && stylus !== wielded && !(object && object.owornmask)) {
        await pline(`You have no free ${heroHandName(state)} to write with!`);
        exit();
        return;
    }
    if (jello) {
        const engulfer = hero.ustuck;
        if (!engulfer)
            throw new Error('An amorphous engulfer must be attached to the hero.');
        await pline(`You tickle ${monsterName(engulfer, { state })} with ${writer}.`);
        await pline('Your message dissolves...');
        exit();
        return;
    }
    let initialMsgGiven = false;
    if (!heroCanReachFloor(state, { checkPit: true })) {
        if (!object || object.oclass !== WAND_CLASS) {
            await cantReachFloor(hero.ux, hero.uy, false, true, false, state);
            exit();
            return;
        }
        await pline(`You gesture, with your wand, towards the ${surfaceName(hero.ux, hero.uy, state)} below you.`);
        initialMsgGiven = true;
    }
    const heroLocation = requireGameLevel(state).at(hero.ux, hero.uy);
    if (!heroLocation)
        throw new RangeError('The hero stands outside the map.');
    if (heroLocation.typ === ALTAR) {
        if (!initialMsgGiven)
            await pline(`You make a motion towards the altar with ${writer}.`);
        await altarWrath(hero.ux, hero.uy, state);
        exit();
        return;
    }
    if (heroLocation.typ === GRAVE) {
        if (usingHands) {
            await pline(`You would only make a small smudge on the ${surfaceName(hero.ux, hero.uy, state)}.`);
            exit();
            return;
        }
        else if (!heroLocation.disturbed) {
            // Disturb the grave; the flag keeps this to one ghoul.
            await disturbGrave(hero.ux, hero.uy, state);
            exit();
            return;
        }
    }
    // doengrave_sfx_item()
    let postEngrText = '';
    if (object)
        switch (object.oclass) {
            case RING_CLASS:
            case GEM_CLASS:
                // "diamond" rings and hard gems can carve.
                if (state.objectToughness?.[object.otyp])
                    setup.type = ENGRAVE;
                break;
            case ARMOR_CLASS:
                if (object.otyp >= BOOT_TYPES_FIRST && object.otyp <= BOOT_TYPES_LAST) {
                    setup.type = DUST;
                    break;
                }
                await pline("You can't engrave with such a large object!");
                setup.ptext = false;
                break;
            case BALL_CLASS:
            case ROCK_CLASS:
                await pline("You can't engrave with such a large object!");
                setup.ptext = false;
                break;
            case FOOD_CLASS:
            case SCROLL_CLASS:
            case SPBOOK_CLASS:
                await pline(`${ownedObjectName(object, state)} would get ${frosted ? 'all frosty' : 'too dirty'}.`);
                setup.ptext = false;
                break;
            case WAND_CLASS: {
                if (await zappable(object, { state })) {
                    await chargeUnpaidUsage(object, { state });
                    if (object.cursed && rn2(WAND_BACKFIRE_CHANCE) === 0) {
                        await explodeWand(object, 0, state);
                        setup.ret = 'time';
                        exit();
                        return;
                    }
                    setup.zapwand = true;
                    if (!heroCanReachFloor(state, { checkPit: true }))
                        setup.ptext = false;
                    postEngrText = await wandEngraveEffects(object, setup, oep, oetype, frosted, state);
                    if (state.program_state.gameover)
                        return;
                }
                else {
                    // Failing to wrest one last charge takes time.
                    setup.ptext = false;
                    if (heroCanReachFloor(state, { checkPit: true })) {
                        // A cancelled wand turns to dust.
                        if ((object.spe ?? 0) < 0)
                            setup.zapwand = true;
                        else
                            await pline('The wand is too worn out to engrave.');
                    }
                }
                break;
            }
            case WEAPON_CLASS: {
                const fireBrand = artifactByName('Fire Brand', state)?.id;
                if (fireBrand !== undefined && object.oartifact === fireBrand) {
                    setup.type = BURN; /* doesn't dull weapon */
                }
                else if (isBlade(object)) {
                    // C wield.c welded(): only a wielded cursed blade refuses to
                    // carve, and the attempt reveals its curse (set_bknown).
                    if (isWeldedPrimary(object, state)) {
                        object.bknown = true;
                        await pline(`${ownedObjectName(object, state)} can only scratch the ${surfaceName(hero.ux, hero.uy, state)}.`);
                    }
                    else if ((object.spe ?? 0) <= -3) {
                        await pline(`${ownedObjectAction(object, 'are', state)} too dull for engraving.`);
                    }
                    else {
                        setup.type = ENGRAVE;
                    }
                }
                break;
            }
            case TOOL_CLASS: {
                if (object === (state.ublindf || state.u.ublindf)) {
                    await pline('That is a bit difficult to engrave with, don\'t you think?');
                    setup.ret = 'fail';
                    exit();
                    return;
                }
                if (object.otyp === MAGIC_MARKER) {
                    if ((object.spe ?? 0) <= 0)
                        await pline('Your marker has dried out.');
                    else
                        setup.type = MARK;
                }
                else if (object.otyp === TOWEL) {
                    // Can't really engrave with a towel.
                    setup.ptext = false;
                    const towelVerb = objectNameIsPlural(object, state) ? ' get' : ' gets';
                    if (oep) {
                        if (oep.engr_type === DUST || oep.engr_type === ENGR_BLOOD
                            || oep.engr_type === MARK) {
                            if (isWetTowel(object))
                                await dryTowel(object, -1, { state, verbose: true });
                            if (!heroIsBlind(state))
                                await pline('You wipe out the message here.');
                            else
                                await pline(`${ownedObjectName(object, state)}${towelVerb} ${frosted ? 'frosty' : 'dusty'}.`);
                            setup.dengr = true;
                        }
                        else {
                            await pline(`${ownedObjectName(object, state)} can't wipe out this engraving.`);
                        }
                    }
                    else {
                        await pline(`${ownedObjectName(object, state)}${towelVerb} ${frosted ? 'frosty' : 'dusty'}.`);
                    }
                }
                break;
            }
            case VENOM_CLASS:
                await pline('Writing a poison pen letter?');
                break;
            default:
                // AMULET, CHAIN, POTION, COIN, and RANDOM_CLASS (fingers, which
                // never reach this object branch) engrave without extra effects.
                break;
        }
    // On a grave, the headstone owns the writing type.
    if (heroLocation.typ === GRAVE) {
        if (setup.type === ENGRAVE || setup.type === 0) {
            setup.type = HEADSTONE;
        }
        else {
            // Ensures the "cannot wipe out" case.
            setup.type = DUST;
            setup.dengr = false;
            setup.teleengr = false;
            setup.buf = '';
            setup.ebuf = '';
        }
    }
    // Identify the stylus.
    if (setup.doknown && object) {
        learnWand(object, { state });
        if (objectTypeKnown(object, state))
            addExperience(0, 10, state);
    }
    if (setup.teleengr && oep) {
        relocateEngraving(oep, state);
        oep.eread = false;
        oep.erevealed = false;
        setup.disprefresh = true;
        oep = null;
    }
    if (setup.dengr && oep) {
        deleteEngraving(oep, state.level);
        oep = null;
        setup.disprefresh = true;
    }
    // A polymorphed engraving replaces whatever was here.
    if (setup.buf) {
        makeEngravingAt(hero.ux, hero.uy, setup.buf, setup.ebuf, state.moves, setup.type);
        const changed = engravingAt(hero.ux, hero.uy, state.level);
        if (!heroIsBlind(state) && changed) {
            await pline(`The engraving now reads: "${setup.buf}".`);
            changed.eread = true;
            changed.erevealed = true;
            setup.disprefresh = true;
        }
        setup.ptext = false;
    }
    if (setup.zapwand && object && (object.spe ?? 0) < 0) {
        // C names the spent wand with the definite article: The(xname()).
        await pline(`The ${objectName(object, state)} ${heroIsBlind(state) ? '' : 'glows violently, then '}turns to dust.`);
        if (heroLocation.typ !== GRAVE)
            await pline(`You are not going to get anywhere trying to write in the ${frosted ? 'frost' : 'dust'} with your dust.`);
        await useUpInventoryStack(object, state);
        // The wand is gone; C clears de->otmp so the early exit below cannot
        // report the floor as out of reach for the destroyed stylus.
        object = null;
        setup.ptext = false;
    }
    // Early exit for some implements.
    if (!setup.ptext) {
        if (object && object.oclass === WAND_CLASS
            && !heroCanReachFloor(state, { checkPit: true }))
            await cantReachFloor(hero.ux, hero.uy, false, true, true, state);
        setup.ret = 'time';
        exit();
        return;
    }
    if (oep) {
        let answer = 'n';
        if (setup.type === HEADSTONE) {
            answer = 'y'; /* no choice, only append */
        }
        else if (setup.type === oep.engr_type
            && (!heroIsBlind(state) || oep.engr_type === BURN
                || oep.engr_type === ENGRAVE)) {
            answer = await promptYesNoQuit('Do you want to add to the current engraving?', 'y');
            if (answer === 'q') {
                await pline('Never mind.');
                exit();
                return;
            }
        }
        if (answer === 'n' || heroIsBlind(state)) {
            if (oep.engr_type === DUST || oep.engr_type === ENGR_BLOOD
                || oep.engr_type === MARK) {
                if (!heroIsBlind(state)) {
                    await pline(`You wipe out the message that was ${oep.engr_type === DUST
                        ? frosted ? 'written in the frost' : 'written in the dust'
                        : oep.engr_type === ENGR_BLOOD
                            ? 'scrawled in blood'
                            : 'written'} here.`);
                    deleteEngraving(oep, state.level);
                    oep = null;
                    setup.disprefresh = true;
                }
                else {
                    // Defer deletion until we know we're engraving.
                    setup.eow = true;
                }
            }
            else if (setup.type === DUST || setup.type === MARK
                || setup.type === ENGR_BLOOD) {
                await pline(`You cannot wipe out the message that is ${oep.engr_type === BURN
                    ? frosted ? 'melted into' : 'burned into'
                    : 'engraved in'} the ${surfaceName(hero.ux, hero.uy, state)} here.`);
                setup.ret = 'time';
                exit();
                return;
            }
            else if (setup.type !== oep.engr_type || answer === 'n') {
                if (!heroIsBlind(state)
                    || heroCanReachFloor(state, { checkPit: true }))
                    await pline('You will overwrite the current message.');
                setup.eow = true;
            }
        }
        else if (oep.text.length >= BUFSZ - 1) {
            await pline('There is no room to add anything else here.');
            setup.ret = 'time';
            exit();
            return;
        }
    }
    // doengrave_ctx_verb(): which verb phrasing to use.
    let eloc = surfaceName(hero.ux, hero.uy, state);
    setup.adding = !!oep && !setup.eow;
    let everb;
    switch (setup.type) {
        case DUST:
            everb = setup.adding ? 'add to the writing in' : 'write in';
            eloc = frosted ? 'frost' : 'dust';
            break;
        case HEADSTONE:
            everb = setup.adding ? 'add to the epitaph on' : 'engrave on';
            break;
        case ENGRAVE:
            everb = setup.adding ? 'add to the engraving in' : 'engrave in';
            break;
        case BURN:
            everb = setup.adding
                ? frosted ? 'add to the text melted into' : 'add to the text burned into'
                : frosted ? 'melt into' : 'burn into';
            break;
        case MARK:
            everb = setup.adding ? 'add to the graffiti on' : 'scribble on';
            break;
        case ENGR_BLOOD:
            everb = setup.adding ? 'add to the scrawl on' : 'scrawl on';
            break;
        default:
            everb = setup.adding ? 'add to the weird writing on' : 'write strangely on';
            break;
    }
    // Tell the adventurer what is going on.
    if (!usingHands && object) {
        const quantity = object.quan ?? object.quantity ?? 1;
        await pline(`You ${everb} the ${eloc} with ${setup.type === ENGRAVE && quantity > 1 ? '1 of ' : ''}${inventoryItemDescription(object)}.`);
    }
    else {
        await pline(`You ${everb} the ${eloc} with your ${heroFingerTipName(state)}.`);
    }
    // Prompt for the engraving text.
    const line = await getLine(`What do you want to ${everb} the ${eloc} here?`, (_ch, key) => key >= 32 && key <= 255 && key !== 127);
    const text = line === null
        ? '\x1b'
        : line.replace(/\t/g, ' ').replace(/ +/g, ' ').replace(/^ | $/g, '');
    const length = text.replaceAll(' ', '').length;
    if (length === 0 || text.includes('\x1b')) {
        if (setup.zapwand && object) {
            if (!heroIsBlind(state))
                await pline(`The ${objectName(object, state)} ${objectNameIsPlural(object, state) ? 'glow' : 'glows'}, then ${objectNameIsPlural(object, state) ? 'fade' : 'fades'}.`);
            setup.ret = 'time';
            exit();
            return;
        }
        await pline('Never mind.');
        exit();
        return;
    }
    // A single `x' is the traditional signature of an illiterate person.
    if (length !== 1 || !text.includes('x') && !text.includes('X')) {
        if (!(state.u.uconduct?.literate ?? 0))
            recordGameLogEvent(`became literate by engraving "${text}"`, { state });
        state.u.uconduct.literate = (state.u.uconduct?.literate ?? 0) + 1;
    }
    // Mix up the engraving if the surface or state of mind is unsound.
    // This neither adds nor removes spaces.
    let mixed = '';
    for (const left of text) {
        if (left === ' ') {
            mixed += left;
            continue;
        }
        const unsound = (setup.type === DUST || setup.type === ENGR_BLOOD) && rn2(25) === 0
            || heroIsBlind(state) && rn2(11) === 0
            || (hero.confused || (hero.confusionTurns ?? 0) > 0) && rn2(7) === 0
            || (hero.stunned || (hero.stunnedTurns ?? 0) > 0) && rn2(4) === 0
            || heroIsHallucinating(state) && rn2(2) === 0;
        // ASCII '!' through '~' (excludes ' ' and DEL).
        mixed += unsound ? String.fromCharCode(32 + rnd(94)) : left;
    }
    // A previous engraving is overwritten.
    if (setup.eow && oep) {
        deleteEngraving(oep, state.level);
        oep = null;
        setup.disprefresh = true;
    }
    state._occupation = {
        key: 'engrave',
        text: 'engraving',
        remainingText: mixed,
        nextIndex: 0,
        stylus: object,
        engraveType: setup.type,
        x: hero.ux,
        y: hero.uy,
        actionct: 0,
    };
    if (postEngrText)
        await pline(postEngrText);
    if (setup.doblind && !heroResistsBlindingLight(state)) {
        await pline('You are blinded by the flash!');
        await makeBlinded(rnd(50), { state, talk: false });
        if (!heroIsBlind(state))
            await pline('Your vision clears.');
    }
    // The engraving itself always takes at least one action via the
    // occupation, so this setup pass consumes no game time.
    exit();
}
// C engrave.c engrave(), the occupation callback.  Returns whether another
// engraving action remains.
export async function continueEngraving(state = game) {
    requireLiveGame(state);
    const occupation = state._occupation;
    if (!occupation || occupation.key !== 'engrave')
        throw new Error('Continuing an engraving requires the engrave occupation.');
    const hero = state.u;
    const pos = occupation;
    const firsttime = pos.actionct === 0;
    const neweng = firsttime;
    let rate = 10; /* characters per action */
    let truncate = false;
    if (pos.x !== hero.ux || pos.y !== hero.uy) { /* teleported? */
        await pline('You are unable to continue engraving.');
        return false;
    }
    // The stylus might have left the inventory and been destroyed.
    let stylus = pos.stylus;
    if (stylus !== null && !state.inventory.includes(stylus)) {
        await pline('You are unable to continue engraving.');
        return false;
    }
    const carving = pos.engraveType === ENGRAVE || pos.engraveType === HEADSTONE;
    const dullingWep = !!stylus && carving && stylus.oclass === WEAPON_CLASS
        && (stylus.otyp !== ATHAME || !!stylus.cursed);
    const marker = !!stylus && stylus.otyp === MAGIC_MARKER
        && pos.engraveType === MARK;
    pos.actionct++;
    // Step 1: compute the rate.
    if (carving && stylus
        && (dullingWep || stylus.oclass === RING_CLASS || stylus.oclass === GEM_CLASS)) {
        rate = 1;
    }
    else if (marker && stylus) {
        // One charge per two letters.
        rate = Math.min(rate, (stylus.spe ?? 0) * 2);
    }
    // Step 2: the last character this action can engrave.
    let endIndex = pos.nextIndex;
    for (let budget = rate; endIndex < pos.remainingText.length && budget > 0;) {
        endIndex++;
        if (pos.remainingText[endIndex - 1] !== ' ')
            budget--;
    }
    // Step 3: affect the stylus; it might wear out.
    if (dullingWep && stylus) {
        let splitstack = false;
        let dulled = false;
        if ((stylus.quan ?? stylus.quantity ?? 1) > 1) {
            if (firsttime)
                await pline(`One of ${ownedObjectName(stylus, state, {
                    capitalized: false,
                })} gets dull.`);
            // If the stack is wielded or quivered, the split-off one is not.
            const split = splitObjectStack(stylus, 1, state);
            if (!split)
                throw new Error('Engraving must split one weapon off its stack.');
            stylus = pos.stylus = split;
            stylus.owornmask = 0;
            splitstack = true;
        }
        else if (firsttime) {
            await pline(`${ownedObjectName(stylus, state)} gets dull.`);
        }
        // Dull at one enchantment per two characters, rounding down, but
        // always spend a point on the first action.
        if (pos.actionct % 2 === 1) {
            if ((stylus.spe ?? 0) <= -3) {
                truncate = true;
            }
            else if (endIndex < pos.remainingText.length || pos.actionct === 1) {
                stylus.spe = (stylus.spe ?? 0) - 1;
                dulled = true;
            }
        }
        if (splitstack) {
            unlinkObject(stylus, state);
            await holdAnotherObject(stylus, {
                state,
                dropMessage: `You drop one ${inventoryItemDescription(stylus)}!`,
            });
        }
        else if (dulled && stylus.known) {
            await pline(`${stylus.invlet} - ${inventoryItemDescription(stylus)}.`);
        }
    }
    else if (marker && stylus) {
        const inkCost = Math.max(Math.trunc(rate / 2), 1); /* no infinite graffiti */
        if ((stylus.spe ?? 0) < inkCost) {
            await impossible('overly dry marker valid for graffiti?');
            stylus.spe = 0;
            truncate = true;
        }
        else {
            stylus.spe = (stylus.spe ?? 0) - inkCost;
        }
        if ((stylus.spe ?? 0) === 0) {
            await pline('Your marker dries out.');
            truncate = true;
        }
    }
    let buf = engravingAt(pos.x, pos.y, state.level)?.text ?? '';
    const spaceLeft = BUFSZ - buf.length - 1;
    if (endIndex - pos.nextIndex > spaceLeft) {
        await pline('You run out of room to write.');
        endIndex = pos.nextIndex + spaceLeft;
        truncate = true;
    }
    // A stylus that wore out mid-engraving truncates the input.
    if (truncate && endIndex < pos.remainingText.length) {
        pos.remainingText = pos.remainingText.slice(0, endIndex);
        await pline(`You are only able to write "${pos.remainingText}".`);
    }
    else {
        // Not truncated; the stylus may still have worn out on the last
        // character, which the finished-message branch reports.
        truncate = false;
    }
    buf += pos.remainingText.slice(pos.nextIndex, Math.min(pos.nextIndex + spaceLeft, endIndex));
    const engraving = makeEngravingAt(pos.x, pos.y, buf, null, state.moves - state.multi, pos.engraveType);
    if (engraving) {
        engraving.eread = true;
        engraving.erevealed = true;
    }
    if (endIndex < pos.remainingText.length) {
        pos.nextIndex = endIndex;
        if (neweng)
            newsym(pos.x, pos.y);
        return true; /* not yet finished this turn */
    }
    if (truncate) {
        await pline('You cannot write any more.');
    }
    else if (!firsttime) {
        await pline(`You finish ${engravingFinishVerb(pos.x, pos.y, pos.engraveType, state)}.`);
    }
    // C engrave(): the finished path falls through to the final newsym(), so
    // an engraving completed in a single action still refreshes the map.
    if (neweng)
        newsym(pos.x, pos.y);
    return false;
}
function engravingFinishVerb(x, y, engraveType, state) {
    switch (engraveType) {
        case DUST:
            return isIceAt(x, y, state) ? 'writing in the frost' : 'writing in the dust';
        case HEADSTONE:
        case ENGRAVE:
            return 'engraving';
        case BURN:
            return isIceAt(x, y, state)
                ? 'melting your message into the ice'
                : 'burning your message into the floor';
        case MARK:
            return 'defacing the dungeon';
        case ENGR_BLOOD:
            return 'scrawling';
        default:
            return 'your weird engraving';
    }
}
//# sourceMappingURL=engrave_command.js.map