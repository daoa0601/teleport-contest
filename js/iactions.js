import { monsterName } from './do_name.js';
import { panic } from './end.js';
// iactions.js — the iactions.c owner: the inventory window's per-item
// action menu (itemactions()) and the chosen action's command queueing
// (itemactions_pushkeys(), whose cmdq_add_*() calls come from cmd.ts).
// C ref: iactions.c — itemactions(), itemactions_pushkeys(),
// item_reading_classification().
import { game } from './gstate.js';
import { ALCHEMY_SMOCK, AMULET_OF_YENDOR, BAG_OF_TRICKS, BEARTRAP, BELL, BELL_OF_OPENING, BLINDFOLD, BRASS_LANTERN, BULLWHIP, CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CORPSE, CREAM_PIE, CREDIT_CARD, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, DWARVISH_MATTOCK, EUCALYPTUS_LEAF, EXPENSIVE_CAMERA, FAKE_AMULET_OF_YENDOR, FIGURINE, FORTUNE_COOKIE, GOLD_PIECE, GRAPPLING_HOOK, HAWAIIAN_SHIRT, HEAVY_IRON_BALL, HORN_OF_PLENTY, LAND_MINE, LEASH, LENSES, LOCK_PICK, MAGIC_LAMP, MAGIC_MARKER, MAGIC_WHISTLE, MEAT_RING, MIRROR, OBJECT_NAMES, OIL_LAMP, PICK_AXE, POT_OIL, SADDLE, SCR_BLANK_PAPER, SKELETON_KEY, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, STETHOSCOPE, TALLOW_CANDLE, TIN, TINNING_KIT, TIN_OPENER, TIN_WHISTLE, TOWEL, UNICORN_HORN, WAX_CANDLE, WOODEN_FLUTE, objectUnique, } from './object_data.js';
import { ALTAR, CQ_CANNED, FINGER, HAND, W_ACCESSORY, W_AMUL, W_ARMOR, W_RING, W_TOOL, } from './const.js';
import { AMULET_CLASS, ARMOR_CLASS, COIN_CLASS, GEM_CLASS, POTION_CLASS, RING_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, WEAPON_CLASS, } from './objclass.js';
import { cmdq_add_ec, cmdq_add_key } from './cmd.js';
import { objectTypeKnown } from './o_init.js';
import { checkInventoryGold, objectTypeCallable } from './invent.js';
import { showChoiceWindow } from './windows.js';
import { definiteName, makePlural, objectCombatName, objectLooksUnique, objectNameIsPlural, simpleObjectName, singularObjectName, withIndefiniteArticle, } from './objnam.js';
import { isBimanualObject, isBlade, isGrayStone, isWeaponTool, launcherMatchesAmmo } from './object_properties.js';
import { currentShopResident, shopkeeperInOwnShop } from './shk.js';
import { armorSimpleName, armorSlotFor } from './do_wear.js';
import { isEdibleFood } from './eat.js';
import { isContainer } from './mkobj.js';
import { surfaceName } from './dungeon.js';
import { body_part, heroHasNoHands, heroIsVerySmall } from './polyself.js';
import { heroCanUseTwoWeapons, isTwoWeaponObject } from './wield.js';
import { encyclopediaEntries } from './encyclopedia.js';
// C objclass.h:SCR_MAIL — resolved from the port's name table.
const SCR_MAIL = OBJECT_NAMES.indexOf('mail');
// C iactions.c:item_reading_classification(). Reading advice depends on
// what the hero knows about the type, rather than the object's charges.
export function itemReadingText(item, state) {
    const known = objectTypeKnown(item, state);
    if (item.otyp === FORTUNE_COOKIE)
        return 'Read the message inside this cookie';
    if (item.otyp === OBJECT_NAMES.indexOf('T-shirt'))
        return 'Read the slogan on the shirt';
    if (item.otyp === ALCHEMY_SMOCK)
        return 'Read the slogan on the apron';
    if (item.otyp === HAWAIIAN_SHIRT)
        return 'Look at the pattern on the shirt';
    if (item.oclass === SCROLL_CLASS) {
        const magic = item.dknown && item.otyp !== SCR_MAIL
            && (item.otyp !== SCR_BLANK_PAPER || !known)
            ? ' to activate its magic' : '';
        return `Read this scroll${magic}`;
    }
    if (item.oclass !== SPBOOK_CLASS)
        return null;
    const novel = item.otyp === SPE_NOVEL;
    const blank = item.otyp === SPE_BLANK_PAPER && known;
    const tome = item.otyp === SPE_BOOK_OF_THE_DEAD && known;
    const verb = novel || blank ? 'Read' : tome ? 'Examine' : 'Study';
    const noun = novel ? simpleObjectName(item, state) : tome ? 'tome' : 'spellbook';
    return `${verb} this ${noun}`;
}
// Part of C iactions.c:itemactions(): the action-choice window for one
// item.
async function showItemActionMenu(item) {
    const repairGold = item.oclass === COIN_CLASS && await checkInventoryGold('item-action');
    return showChoiceWindow({
        title: `Do what with ${definiteName(objectCombatName(item))}?`,
        entries: await itemActionEntries(item, game, repairGold),
    });
}
// C iactions.c:itemactions()
// The action-choice entry for one item: the menu window
// (showItemActionMenu()), the contextual rows (itemActionEntries()), and
// the selection the caller replays as queued keys.
export async function inventoryActionForObject(item) {
    const key = await showItemActionMenu(item);
    return key === 0 ? null : { key: inventoryActionKey(key), item };
}
// Part of C iactions.c:itemactions(): the contextual action-menu rows.
// Also C iactions.c:item_naming_classification(): inlined here
// Also C iactions.c:ia_addmenu(): keyed action rows are built inline here
// Also C worn.c:armcat_to_wornmask(): inlined here as armorSlotFor(),
// using a typed slot name instead of an intermediate numeric mask.
// Also C worn.c:wearmask_to_obj(): inlined here as the occupied-slot read
// that supplies the wear action's already-wearing label.
async function itemActionEntries(item, state, repairGold) {
    const itemName = simpleObjectName(item, state);
    const entries = [];
    const alreadyWorn = !!((item.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY));
    const stack = item.quan > 1;
    const plural = objectNameIsPlural(item, state);
    const shoot = launcherMatchesAmmo(item, state.uwep);
    if (item === state.uwep || item === state.uswapwep || item === state.uquiver) {
        const quivered = item === state.uquiver;
        const verb = quivered ? 'Quiver' : 'Wield';
        const action = quivered ? 'un-ready' : 'un-wield';
        const noun = item.oclass === WEAPON_CLASS || isWeaponTool(item) ? 'weapon' : 'item';
        entries.push({ key: '-', text: `${verb} '-' to ${action} ${plural ? `these ${noun}s` : `this ${noun}`}` });
    }
    const apply = await itemApplyText(item, state);
    if (apply)
        entries.push({ key: 'a', text: apply });
    if (item.oclass !== COIN_CLASS && item.dknown && !item.oartifact && item.otyp !== SPE_NOVEL) {
        const named = !!(item.oextra?.oname || item.oname);
        entries.push({ key: 'c', text: `${named ? 'Rename or un-name' : 'Name'} ${objectLooksUnique(item, state) ? 'the' : plural ? 'this stack of' : 'this specific'} ${itemName}` });
    }
    const callName = state._objectCallNames?.[item.otyp];
    if (item.dknown && objectTypeCallable(item, state) && (!objectTypeKnown(item, state) || callName)) {
        const noun = objectLooksUnique(item, state) ? definiteName(itemName, state)
            : plural ? itemName : makePlural(itemName);
        entries.push({ key: 'C', text: `${callName ? 'Re-call or un-call' : 'Call'} the type for ${noun}` });
    }
    if (!alreadyWorn)
        entries.push({ key: 'd', text: `Drop this ${stack ? 'stack' : 'item'}` });
    if (item.otyp === TIN) {
        const opener = state.uwep?.otyp === TIN_OPENER ? ' with your tin opener' : '';
        entries.push({ key: 'e', text: `Open ${stack ? 'one of these tins' : 'this tin'}${opener} and eat the contents` });
    }
    else if (isEdibleFood(item, state)) {
        entries.push({ key: 'e', text: `Eat ${stack ? 'one of these' : 'this'}` });
    }
    if (item.otyp === TOWEL) {
        entries.push({ key: 'E', text: 'Wipe the floor with this towel' });
    }
    else if (item.otyp === MAGIC_MARKER) {
        entries.push({ key: 'E', text: 'Scribble graffiti on the floor' });
    }
    else if ([WEAPON_CLASS, RING_CLASS, WAND_CLASS, GEM_CLASS].includes(item.oclass)) {
        const engraves = isBlade(item) || item.oclass === WAND_CLASS
            || (item.oclass === RING_CLASS || item.oclass === GEM_CLASS) && !!state.objectToughness?.[item.otyp];
        const verb = engraves ? 'Engrave' : 'Write';
        const surface = surfaceName(state.u.ux, state.u.uy, state);
        entries.push({ key: 'E', text: `${verb} on the ${surface} with ${stack ? 'one of these items' : 'this item'}` });
    }
    if (item === state.uquiver) {
        const launcher = shoot && state.uwep
            ? ` with your wielded ${simpleObjectName(state.uwep, state)}` : '';
        entries.push({ key: 'f', text: `${shoot ? 'Shoot' : 'Throw'} ${stack ? 'one of these' : 'this'}${launcher}` });
    }
    if (item.oclass !== COIN_CLASS || repairGold)
        entries.push({ key: 'i', text: 'Adjust inventory by assigning new letter' });
    if (stack && item.oclass !== COIN_CLASS)
        entries.push({ key: 'I', text: 'Adjust inventory by splitting this stack' });
    if (state.level?.at(state.u.ux, state.u.uy)?.typ === ALTAR && !state.u.uswallow) {
        if (item.otyp === CORPSE)
            entries.push({ key: 'O', text: 'Offer this corpse as a sacrifice at this altar' });
        else if ([AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR].includes(item.otyp))
            entries.push({ key: 'O', text: 'Offer this amulet as a sacrifice at this altar' });
    }
    const keeper = item.unpaid ? currentShopResident(state) : null;
    if (keeper && shopkeeperInOwnShop(keeper, state))
        entries.push({ key: 'p', text: `Buy this unpaid ${stack ? 'stack' : 'item'}` });
    if (!alreadyWorn) {
        const wear = accessoryActionText(item, state);
        if (wear)
            entries.push({ key: 'P', text: wear });
    }
    if (item.oclass === POTION_CLASS)
        entries.push({ key: 'q', text: `Quaff (drink) ${stack ? 'one of these potions' : 'this potion'}` });
    if ([WEAPON_CLASS, GEM_CLASS].includes(item.oclass) && item !== state.uquiver)
        entries.push({ key: 'Q', text: `Quiver this ${stack ? 'stack' : 'item'} for easy ${shoot ? 'shooting' : 'throwing'} with 'f'ire` });
    const reading = itemReadingText(item, state);
    if (reading)
        entries.push({ key: 'r', text: reading });
    if ((item.owornmask ?? 0) & W_ACCESSORY) {
        const accessory = (item.owornmask ?? 0) & W_AMUL ? 'amulet'
            : (item.owornmask ?? 0) & W_RING ? 'ring'
                : (item.owornmask ?? 0) & W_TOOL ? 'eyewear' : 'accessory';
        entries.push({ key: 'R', text: `Remove this ${accessory}` });
    }
    if ([OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN].includes(item.otyp))
        entries.push({ key: 'R', text: `Rub this ${itemName}` });
    else if (item.oclass === GEM_CLASS && isGrayStone(item))
        entries.push({ key: 'R', text: 'Rub something on this stone' });
    if (!alreadyWorn) {
        const goldStack = stack && item.otyp === GOLD_PIECE;
        const quantity = stack ? goldStack ? 'them' : 'one of these' : 'this item';
        const fireAlias = item === state.uquiver && !goldStack ? " (same as 'f')" : '';
        entries.push({ key: 't', text: `${shoot ? 'Shoot' : 'Throw'} ${quantity}${fireAlias}` });
    }
    if ((item.owornmask ?? 0) & W_ARMOR)
        entries.push({ key: 'T', text: 'Take off this armor' });
    if ((isContainer(item) || item.otyp === BAG_OF_TRICKS) && (item.contents?.length || !item.cknown)
        || item.otyp === HORN_OF_PLENTY && (item.spe > 0 || !item.known))
        entries.push({ key: 'T', text: 'Tip all the contents out of this container' });
    if (item.otyp === FAKE_AMULET_OF_YENDOR && !item.known
        || item.oartifact || objectUnique(item.otyp) || item.otyp === CRYSTAL_BALL)
        entries.push({ key: 'V', text: 'Try to invoke a unique power of this object' });
    if (item !== state.uwep && !heroHasNoHands(state) && !heroIsVerySmall(state)) {
        const weapon = item.oclass === WEAPON_CLASS || isWeaponTool(item)
            || item.otyp === TOWEL && item.spe > 0 || item.otyp === HEAVY_IRON_BALL;
        if (weapon) {
            entries.push({ key: 'w', text: `Wield this ${stack ? 'stack' : 'item'} as your weapon` });
        }
        else if (item.otyp === TIN_OPENER) {
            entries.push({ key: 'w', text: 'Wield the tin opener to easily open tins' });
        }
        else if (!alreadyWorn) {
            entries.push({ key: 'w', text: `Wield this ${stack ? 'stack' : 'item'} in your ${makePlural(body_part(HAND, state))}` });
        }
    }
    if (!alreadyWorn && item.oclass === ARMOR_CLASS) {
        const slot = armorSlotFor(item.otyp);
        const worn = slot ? state[slot] : null;
        entries.push({ key: 'W', text: worn ? `[already wearing ${withIndefiniteArticle(armorSimpleName(worn, state))}]`
                : 'Wear this armor' });
    }
    if (item === state.uwep)
        entries.push({ key: 'x', text: state.uswapwep
                ? 'Swap this with your alternate weapon' : 'Ready this as an alternate weapon' });
    else if (item === state.uswapwep)
        entries.push({ key: 'x', text: 'Swap this with your main weapon' });
    if ((item === state.uwep || item === state.uswapwep)
        && (state.u.twoweap || heroCanUseTwoWeapons(state) && !state.uarms
            && isTwoWeaponObject(state.uwep) && state.uwep && !isBimanualObject(state.uwep)
            && isTwoWeaponObject(state.uswapwep) && state.uswapwep && !isBimanualObject(state.uswapwep)))
        entries.push({ key: 'X', text: `Toggle two-weapon combat ${state.u.twoweap ? 'off' : 'on'}` });
    if (item.oclass === WAND_CLASS)
        entries.push({ key: 'z', text: 'Zap this wand to release its magic' });
    if (encyclopediaEntries(singularObjectName(item, state), state).length)
        entries.push({ key: '/', text: `Look up information about ${stack ? 'these' : 'this'}` });
    return entries;
}
// Part of C iactions.c:itemactions(): the 'a' apply-row classification.
async function itemApplyText(item, state) {
    const light = item.lamplit ? 'Extinguish' : 'Light';
    if (item.oclass === COIN_CLASS)
        return 'Flip a coin';
    if (item.otyp === CREAM_PIE)
        return 'Hit yourself with this cream pie';
    if (item.otyp === BULLWHIP)
        return 'Lash out with this whip';
    if (item.otyp === GRAPPLING_HOOK)
        return 'Grapple something with this hook';
    if (item.otyp === BAG_OF_TRICKS)
        return objectTypeKnown(item, state) ? 'Reach into this bag' : 'Open this container';
    if (isContainer(item))
        return 'Open this container';
    switch (item.otyp) {
        case CAN_OF_GREASE: return 'Use the can to grease an item';
        case LOCK_PICK:
        case CREDIT_CARD:
        case SKELETON_KEY: return 'Use this tool to pick a lock';
        case TINNING_KIT: return 'Use this kit to tin a corpse';
        case LEASH: {
            if (!item.leashmon)
                return 'Attach this leash to a pet';
            const pet = state.level?.monsters.find(monster => monster.m_id === item.leashmon);
            if (!pet)
                return panic("Can't find leash's monster", { state });
            return `Detach this leash from ${monsterName(pet, { state, augmentIt: true })}`;
        }
        case SADDLE: return 'Place this saddle on a pet';
        case MAGIC_WHISTLE:
        case TIN_WHISTLE: return 'Blow this whistle';
        case EUCALYPTUS_LEAF: return 'Use this leaf as a whistle';
        case STETHOSCOPE: return 'Listen through the stethoscope';
        case MIRROR: return 'Show something its reflection';
        case BELL:
        case BELL_OF_OPENING: return 'Ring the bell';
        case CANDELABRUM_OF_INVOCATION: return `${light} the candelabrum`;
        case TALLOW_CANDLE:
        case WAX_CANDLE: {
            const candelabrum = state.inventory.find(object => object.otyp === CANDELABRUM_OF_INVOCATION);
            const multiple = item.quan !== 1;
            if (candelabrum && candelabrum.spe < 7)
                return `Attach ${multiple ? 'these' : 'this'} to your candelabrum, or ${item.lamplit ? 'extinguish' : 'light'} ${multiple ? 'them' : 'it'}`;
            return `${light} ${multiple ? 'these' : 'this'} ${simpleObjectName(item, state)}`;
        }
        case OIL_LAMP:
        case MAGIC_LAMP:
        case BRASS_LANTERN: return `${light} this light source`;
        case EXPENSIVE_CAMERA: return 'Take a photograph';
        case TOWEL: return 'Clean yourself off with this towel';
        case CRYSTAL_BALL: return 'Peer into this crystal ball';
        case MAGIC_MARKER: return 'Write on something with this marker';
        case FIGURINE: return 'Make this figurine transform';
        case UNICORN_HORN: return 'Use this unicorn horn';
        case LAND_MINE:
        case BEARTRAP: return 'Arm this trap';
        case PICK_AXE:
        case DWARVISH_MATTOCK: return 'Dig with this digging tool';
        default: break;
    }
    if (item.otyp === POT_OIL && objectTypeKnown(item, state))
        return `${light} this oil`;
    if (item.oclass === POTION_CLASS)
        return `Dip something into ${item.quan > 1 ? 'one of these' : 'this'} potion${item.quan === 1 ? '' : 's'}`;
    if (item.otyp === HORN_OF_PLENTY && objectTypeKnown(item, state))
        return 'Blow into the horn of plenty';
    if (item.otyp >= WOODEN_FLUTE && item.otyp <= DRUM_OF_EARTHQUAKE)
        return 'Play this musical instrument';
    return item.oclass === WAND_CLASS ? 'Break this wand' : null;
}
// Part of C iactions.c:itemactions(): the 'P' wear rows for amulet, rings
// and eyewear.
function accessoryActionText(item, state) {
    if (item.oclass === AMULET_CLASS)
        return state.uamul ? '[already wearing an amulet]' : 'Put this amulet on';
    if (item.oclass === RING_CLASS || item.otyp === MEAT_RING)
        return state.uleft && state.uright ? `[both ring ${makePlural(body_part(FINGER, state))} in use]` : 'Put this ring on';
    if ([BLINDFOLD, TOWEL, LENSES].includes(item.otyp)) {
        if (state.ublindf)
            return '[already wearing eyewear]';
        return item.otyp === LENSES ? 'Put these lenses on' : `Put this on${item.otyp === TOWEL ? ' to blindfold yourself' : ''}`;
    }
    return null;
}
// Port only: the action key adapter.
function inventoryActionKey(code) {
    const key = String.fromCharCode(code);
    switch (key) {
        case '-':
        case 'a':
        case 'c':
        case 'C':
        case 'd':
        case 'e':
        case 'E':
        case 'f':
        case 'i':
        case 'I':
        case 'O':
        case 'p':
        case 'P':
        case 'q':
        case 'Q':
        case 'r':
        case 'R':
        case 't':
        case 'T':
        case 'V':
        case 'w':
        case 'W':
        case 'x':
        case 'X':
        case 'z':
        case '/':
        case '\x1b':
        case ' ':
        case '\n':
        case '\r':
            return key;
        default:
            throw new RangeError(`Unexpected inventory action key ${code}`);
    }
}
// C iactions.c:itemactions_pushkeys(): queue the chosen item action's
// command, the m-prefix some actions need in front of it, and the object's
// inventory letter; the command's own prompts pop the letter from the
// shared queue (iactions.c:145-235).  The port dispatches the inventory
// windows from this module's command loop, so the queue helper cannot live
// in an iactions module without an import cycle over the cmdq calls.
export function enqueueInventoryAction(action) {
    if (!action || ['\x1b', ' ', '\n', '\r'].includes(action.key))
        return;
    const { key, item } = action;
    if (!item.invlet)
        return;
    if (key === '-') {
        // IA_UNWIELD: the hands letter answers the wield, swap-weapon, or
        // quiver command's getobj() prompt.
        cmdq_add_ec(CQ_CANNED, item === game.uwep ? 'dowield'
            : item === game.uswapwep ? 'remarm_swapwep'
                : item === game.uquiver ? 'dowieldquiver' : 'donull');
        cmdq_add_key(CQ_CANNED, '-'.charCodeAt(0));
        return;
    }
    let extraKey = null;
    let handler;
    switch (key) {
        case 'a':
            // IA_APPLY_OBJ, or IA_DIP_OBJ for a potion other than known oil.
            handler = item.oclass === POTION_CLASS && !(item.otyp === POT_OIL && objectTypeKnown(item))
                ? 'dip_into' : 'doapply';
            break;
        case 'c':
            handler = 'docallcmd';
            extraKey = 'i'.charCodeAt(0);
            break;
        case 'C':
            handler = 'docallcmd';
            extraKey = 'o'.charCodeAt(0);
            break;
        case 'd':
            handler = 'dodrop';
            break;
        case 'e':
            cmdq_add_ec(CQ_CANNED, 'do_reqmenu');
            handler = 'doeat';
            break;
        case 'E':
            handler = 'doengrave';
            break;
        case 'f':
            cmdq_add_ec(CQ_CANNED, 'dofire');
            return;
        case 'i':
            handler = 'doorganize';
            break;
        case 'I':
            handler = 'adjust_split';
            break;
        case 'O':
            handler = 'dosacrifice';
            break;
        case 'p':
            handler = 'dopay';
            break;
        case 'P':
        case 'W':
            handler = 'dowear';
            break;
        case 'q':
            cmdq_add_ec(CQ_CANNED, 'do_reqmenu');
            handler = 'dodrink';
            break;
        case 'Q':
            handler = 'dowieldquiver';
            break;
        case 'r':
            handler = 'doread';
            break;
        case 'R':
            handler = (item.owornmask ?? 0) & W_ACCESSORY ? 'ia_dotakeoff' : 'dorub';
            break;
        case 't':
            handler = 'dothrow';
            break;
        case 'T':
            if ((item.owornmask ?? 0) & W_ARMOR) {
                handler = 'ia_dotakeoff';
                break;
            }
            cmdq_add_ec(CQ_CANNED, 'do_reqmenu');
            handler = 'dotip';
            break;
        case 'w':
            handler = 'dowield';
            break;
        case 'V':
            handler = 'doinvoke';
            break;
        case 'x':
            cmdq_add_ec(CQ_CANNED, 'doswapweapon');
            return;
        case 'X':
            cmdq_add_ec(CQ_CANNED, 'dotwoweapon');
            return;
        case 'z':
            handler = 'dozap';
            break;
        case '/':
            handler = 'dowhatis';
            extraKey = 'i'.charCodeAt(0);
            break;
        // itemactions() never queues anything for the quit keys.
        case '\x1b':
        case ' ':
        case '\n':
        case '\r': return;
        default: return;
    }
    cmdq_add_ec(CQ_CANNED, handler);
    if (extraKey !== null)
        cmdq_add_key(CQ_CANNED, extraKey);
    cmdq_add_key(CQ_CANNED, item.invlet.charCodeAt(0));
}
//# sourceMappingURL=iactions.js.map