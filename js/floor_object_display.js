// Looking at floor objects and displaying their prices and pile windows.
// C invent.c:look_here(), pickup.c:check_here(), and objnam.c.
import { game, requireGameDisplay, requireGameLevel } from './gstate.js';
import { ICE, Is_airlevel, Is_waterlevel, PLNMSG_ONE_ITEM_HERE, is_pit } from './const.js';
import { dungeonFeatureAt, dungeonFeatureSentence, forceDescribeDecor } from './dungeon_feature.js';
import { heroCanReachFloor } from './floor_reach.js';
import { surfaceName } from './terrain_name.js';
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { nhgetch } from './input.js';
import { clearMessageWindow, displayMessageWindow, flushPendingTopline, flush_screen, pline, plineWithContinuation, } from './display.js';
import { readEngravingAt } from './engrave.js';
import { stopRun } from './runmode.js';
import { showDisclosureOverlay, snapshotMenuUnderlay, restoreMenuUnderlay } from './windows.js';
import { windowOrigin } from './tty_menu.js';
import { objectDescription } from './object_description.js';
import { corpseName, observeObjectForNaming } from './objnam.js';
import { NO_COLOR } from './terminal.js';
import { MONSTER_NAME } from './monster_data.js';
import { objectQuantity } from './object_stack.js';
import { heroIsBlind } from './senses.js';
import { visibleRegionAt } from './regions.js';
import { trapName } from './trap_name.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { feelPetrifyingCorpse, formCanBecomeStoneGolem, willFeelPetrifyingCorpse, } from './stoning.js';
export async function readFloorEngraving(x, y) {
    const read = await readEngravingAt(x, y, plineWithContinuation);
    // engrave.c:read_engr_at() only calls nomul(0) for a real run
    // (context.run > 0); a counted walk keeps moving past the engraving.
    if (read && (game.context.run ?? 0) > 0)
        stopRun();
}
// C invent.c:look_here() outside an engulfer. A positive objectCount is
// autopickup's count, which summarizes a pile at pile_limit; skipFeature
// means describe_decor() already showed the terrain.
export async function lookHere(objectCount = 0, { pickedSome = false, skipFeature = false } = {}) {
    const { ux: x, uy: y } = game.u;
    const level = requireGameLevel();
    const blind = heroIsBlind();
    const limit = configuredPileLimit();
    const skipObjects = limit > 0 && objectCount >= limit;
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!skipObjects) {
        const region = visibleRegionAt(game, x, y);
        const features = [];
        if (region)
            features.push(`a ${region.damage ? 'poison gas' : 'vapor'} cloud`);
        if (trap?.tseen)
            features.push(withIndefiniteArticle(trapName(trap.ttyp)));
        if (features.length)
            await plineWithContinuation(`There is ${features.join(' and ')} here.`);
    }
    const underwater = !!(game.underwater || game.u.uinwater);
    let featureName = dungeonFeatureAt(x, y);
    if (featureName === 'pool of water' && underwater)
        featureName = null;
    let hideFeature = skipFeature;
    if (blind) {
        const drift = Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz);
        const surface = surfaceName(x, y);
        if (featureName?.startsWith('altar ')) {
            await plineWithContinuation('You try to feel what is here.');
        }
        else if (isIceAt(x, y)) {
            if (!game.flags.mention_decor || game._prevDecorType === ICE)
                await forceDescribeDecor();
            await plineWithContinuation('You try to feel what is on it.');
            hideFeature = true;
        }
        else {
            const where = drift ? 'floating here' : heroCanReachFloor(game, { checkPit: true })
                ? `lying here on the ${surface}` : 'lying beneath you';
            await plineWithContinuation(`You try to feel what is ${where}.`);
            if (!drift && featureName === surface)
                hideFeature = true;
        }
        if (!heroCanReachFloor(game, { checkPit: !!trap && is_pit(trap.ttyp) })) {
            await plineWithContinuation("But you can't reach it!");
            return { died: false, tookTime: false };
        }
    }
    const feature = hideFeature ? '' : dungeonFeatureSentence(featureName);
    const objects = isLavaAt(x, y) || (isPoolAt(x, y) && !underwater) ? [] : level.objects[x]?.[y] ?? [];
    if (!objects.length) {
        if (feature)
            await plineWithContinuation(feature);
        await readFloorEngraving(x, y);
        if (!skipObjects && (blind || !featureName))
            await plineWithContinuation(`You ${blind ? 'feel' : 'see'} no objects here.`);
        return { died: false, tookTime: blind };
    }
    const { died } = await showFloorPile(objects, pickedSome, feature, { objectCount });
    return { died, tookTime: blind };
}
function configuredPileLimit() {
    const configured = Number(game.flags?.pile_limit ?? 5);
    return Number.isFinite(configured) && configured >= 0 ? Math.trunc(configured) : 5;
}
// The object part of look_here(). objectCount at or above pile_limit only
// summarizes the pile.
export async function showFloorPile(objects, pickedSome = false, featureDescription = '', { objectCount = 0 } = {}) {
    const first = objects[0];
    if (!first)
        return { died: false };
    const pileLimit = configuredPileLimit();
    if (pileLimit > 0 && objectCount >= pileLimit) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        await readFloorEngraving(game.u.ux, game.u.uy);
        if (objectCount === 1 && objectQuantity(first) === 1) {
            await plineWithContinuation(`There is ${pickedSome ? 'another' : 'an'} object here.`);
        }
        else {
            const quantity = objectCount === 2 ? 'two'
                : objectCount < 5 ? 'a few'
                    : objectCount < 10 ? 'several' : 'many';
            await plineWithContinuation(`There are ${quantity}${pickedSome ? ' more' : ''} objects here.`);
        }
        const corpse = objects.find(object => willFeelPetrifyingCorpse(object));
        if (corpse) {
            const plural = objectQuantity(corpse) > 1;
            const prefix = objectCount > 1 ? 'Including' : plural ? "They're" : "It's";
            const warning = formCanBecomeStoneGolem(game.u.umonnum) ? '' : ', unfortunately';
            await plineWithContinuation(`${prefix} ${corpseName(corpse, { includeArticle: true })}${warning}.`);
            return await feelPetrifyingCorpse(corpse);
        }
        return { died: false };
    }
    if (objects.length === 1) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        await readFloorEngraving(game.u.ux, game.u.uy);
        observeObjectForNaming(first);
        await plineWithContinuation(`You ${heroIsBlind() ? 'feel' : 'see'} here ${await pricedFloorObjectDescription(first)}.`);
        game._lastPlineKind = PLNMSG_ONE_ITEM_HERE;
        return await feelPetrifyingCorpse(first);
    }
    // look_here() displays WIN_MESSAGE first. Unread prose is acknowledged
    // and cleared; seen text stays beneath the corner window.
    const unreadMessage = !!game._pending_message;
    await flushPendingTopline();
    if (unreadMessage)
        clearMessageWindow();
    await flush_screen(1);
    const display = requireGameDisplay();
    const pileLocation = heroIsBlind() ? 'you feel here' : 'are here';
    const descriptions = [];
    let touchedCorpse = null;
    for (const object of objects) {
        observeObjectForNaming(object);
        if (willFeelPetrifyingCorpse(object)) {
            descriptions.push(`${await floorObjectDescription(object)}...`);
            touchedCorpse = object;
            break;
        }
        descriptions.push(await pricedFloorObjectDescription(object));
    }
    if (game._pending_message) {
        await displayMessageWindow();
        // tty_display_nhwindow() clears WIN_MESSAGE before a corner window,
        // even when WIN_STOP prevented acknowledging its remaining text.
        clearMessageWindow();
    }
    const underlay = snapshotMenuUnderlay();
    const content = [
        ...(featureDescription ? [featureDescription, ''] : []),
        `${pickedSome ? 'Other things' : 'Things'} that ${pileLocation}:`,
        ...descriptions,
    ];
    // tty_display_nhwindow() clears the whole screen instead of using a
    // corner when menu_overlay is off or the window is too tall.
    const widest = Math.max(...content.map(line => line.length));
    if (windowOrigin(display.cols, display.rows, widest + 1, content.length, game.flags.menu_overlay !== false) === 0) {
        await showDisclosureOverlay(content);
    }
    else {
        await showFloorPileCorner(display, [...content, '--More--']);
        restoreMenuUnderlay(underlay);
    }
    const result = touchedCorpse ? await feelPetrifyingCorpse(touchedCorpse) : { died: false };
    if (!result.died)
        await readFloorEngraving(game.u.ux, game.u.uy);
    return result;
}
// tty corner placement for a short pile window. Only a menu-dismissal key
// destroys it and returns that input boundary to the command loop.
async function showFloorPileCorner(display, lines) {
    // Tty menus leave one blank column after the widest line and align the
    // window to the right.
    const left = Math.max(0, Math.min(41, display.cols - Math.max(...lines.map(line => line.length)) - 1));
    for (const [row, line] of lines.entries()) {
        for (let col = Math.max(0, left - 1); col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let col = 0; col < line.length; col++)
            display.setCell(left + col, row, line.charAt(col), NO_COLOR, 0);
    }
    display.setCursor(left + 8, lines.length - 1);
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
}
export async function pricedFloorObjectDescription(object) {
    return await objectDescription(object, { withPrice: true });
}
export async function floorObjectDescription(object) {
    return await objectDescription(object);
}
//# sourceMappingURL=floor_object_display.js.map