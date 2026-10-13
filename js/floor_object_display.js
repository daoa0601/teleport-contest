// Looking at floor objects and displaying their prices and pile windows.
// C invent.c:look_here(), pickup.c:check_here(), and objnam.c.
import { game, requireGameDisplay } from './gstate.js';
import { PLNMSG_ONE_ITEM_HERE } from './const.js';
import { nhgetch } from './input.js';
import { clearMessageWindow, flushPendingTopline, flush_screen, pline, plineWithContinuation, } from './display.js';
import { readEngravingAt } from './engrave.js';
import { stopRun } from './runmode.js';
import { snapshotMenuUnderlay, restoreMenuUnderlay } from './windows.js';
import { objectDescription } from './object_description.js';
import { observeObjectForNaming } from './objnam.js';
import { NO_COLOR } from './terminal.js';
import { MONSTER_NAME } from './monster_data.js';
import { objectQuantity } from './object_stack.js';
import { heroIsBlind } from './senses.js';
import { feelPetrifyingCorpse, formCanBecomeStoneGolem, willFeelPetrifyingCorpse, } from './stoning.js';
export async function readFloorEngraving(x, y) {
    const read = await readEngravingAt(x, y, plineWithContinuation);
    if (read && game._runState)
        stopRun();
}
export async function showFloorPile(objects, pickedSome = false, featureDescription = '', { automatic = false } = {}) {
    const first = objects[0];
    if (!first)
        return { died: false };
    const chain = game.uchain || game.u?.uchain;
    const objectCount = automatic ? objects.filter(object => object !== chain).length : 0;
    if (automatic && objectCount === 0) {
        await readFloorEngraving(game.u.ux, game.u.uy);
        return { died: false };
    }
    // C check_here() excludes the punishment chain from the count, but
    // look_here() still uses the complete floor chain for displayed names.
    const configuredLimit = Number(game.flags?.pile_limit ?? 5);
    const pileLimit = Number.isFinite(configuredLimit) && configuredLimit >= 0
        ? Math.trunc(configuredLimit) : 5;
    if (automatic && pileLimit > 0 && objectCount >= pileLimit) {
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
            const species = corpse.corpsenm;
            if (species === undefined)
                throw new Error('A petrifying corpse needs its monster species');
            const noun = `${MONSTER_NAME[species]} corpse${plural ? 's' : ''}`;
            const warning = formCanBecomeStoneGolem(game.u.umonnum) ? '' : ', unfortunately';
            await plineWithContinuation(`${prefix} ${plural ? '' : 'a '}${noun}${warning}.`);
            return await feelPetrifyingCorpse(corpse);
        }
        return { died: false };
    }
    if (objects.length === 1) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        await readFloorEngraving(game.u.ux, game.u.uy);
        observeObjectForNaming(first);
        await plineWithContinuation(`You ${heroIsBlind() ? 'feel' : 'see'} here ${pricedFloorObjectDescription(first)}.`);
        game._lastPlineKind = PLNMSG_ONE_ITEM_HERE;
        return await feelPetrifyingCorpse(first);
    }
    // look_here() displays WIN_MESSAGE first; a corner NHW_MENU then clears
    // that window, including seen text outside the menu's own rectangle.
    await flushPendingTopline();
    clearMessageWindow();
    await flush_screen(1);
    const display = requireGameDisplay();
    const underlay = snapshotMenuUnderlay();
    const pileLocation = heroIsBlind() ? 'you feel here' : 'are here';
    const descriptions = [];
    let touchedCorpse = null;
    for (const object of objects) {
        observeObjectForNaming(object);
        if (willFeelPetrifyingCorpse(object)) {
            descriptions.push(`${floorObjectDescription(object)}...`);
            touchedCorpse = object;
            break;
        }
        descriptions.push(pricedFloorObjectDescription(object));
    }
    const lines = [
        ...(featureDescription ? [featureDescription, ''] : []),
        `${pickedSome ? 'Other things' : 'Things'} that ${pileLocation}:`,
        ...descriptions,
        '--More--',
    ];
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
    // tty's temporary PICK_NONE pile window ignores ordinary command bytes;
    // only a menu-dismissal key destroys it and returns that input boundary
    // to the command loop.
    let key;
    do
        key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    restoreMenuUnderlay(underlay);
    const result = touchedCorpse ? await feelPetrifyingCorpse(touchedCorpse) : { died: false };
    if (!result.died)
        await readFloorEngraving(game.u.ux, game.u.uy);
    return result;
}
export function pricedFloorObjectDescription(object) {
    return objectDescription(object, { withPrice: true });
}
export function floorObjectDescription(object) {
    return objectDescription(object);
}
//# sourceMappingURL=floor_object_display.js.map