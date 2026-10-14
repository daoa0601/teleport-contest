// Wishes from wands, monsters, the Amulet, and debug commands.
// C refs: zap.c makewish(), objnam.c readobjnam(), and
// invent.c hold_another_object().

import { makePlural } from './object_grammar.js';
import { markArtifactFound } from './artifacts.js';
import { ICE, IRONBARS, Is_airlevel, Is_waterlevel, POOL, WATER } from './const.js';
import {
    bot, docrt, flushPendingTopline, flush_screen, newsym, pline,
    plineWithContinuation,
} from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { CORPSE } from './object_data.js';
import type { GameObject } from './object_types.js';
import {
    corpseName, definiteName, objectName, observeObjectForNaming, readObjectName,
} from './objnam.js';
import { getLine } from './query.js';
import { rn2 } from './rng.js';
import { heroResistsStoning, touchPetrifies } from './stoning.js';
import { showTextPages } from './windows.js';

async function showWishHelp(triesLeft: number): Promise<void> {
    const countNames = ['zero', 'one', 'two', 'three', 'four', 'five'];
    const count = countNames[triesLeft] ?? String(triesLeft);
    const retry = triesLeft < 5 ? ' more' : '';
    const lines = [
        'Wish details:',
        '',
        'Enter the name of an object, such as "potion of monster detection",',
        '"scroll labeled README", "elven mithril-coat", or "Grimtooth"',
        '(without the quotes).',
        '',
        'For object types which come in stacks, you may specify a plural name',
        'such as "potions of healing", or specify a count, such as "1000 gold',
        'pieces", although that aspect of your wish might not be granted.',
        '',
        'You may also specify various prefix values which might be used to',
        'modify the item, such as "uncursed" or "rustproof" or "+1".',
        'Most modifiers shown when viewing your inventory can be specified.',
        '',
        "You may specify 'nothing' to explicitly decline this wish.",
    ];
    if (!(game.u?.uconduct?.wishes ?? 0))
        lines.push("Doing so will preserve 'wishless' conduct.");
    lines.push(
        '',
        `If you specify an unrecognized object name ${count}${retry} time${
            triesLeft === 1 ? '' : 's'},`,
        'a randomly chosen item will be granted.',
        '',
    );
    if (game.flags?.cmdassist !== false) {
        lines.push(
            '(Suppress this assistance with !cmdassist in your config file.)',
        );
    }
    await showTextPages([{ lines, cursor: [0, lines.length - 1] }]);
    await docrt();
    await bot();
    await flush_screen(1);
}

export async function makeWish({
    announce = false, allowWizardTerrain = false,
} = {}): Promise<void> {
    requirePlayingGame(game);
    if (announce) {
        await plineWithContinuation('You may wish for an object.');
        await flushPendingTopline();
    }
    let value: string | null = '';
    let result = null;
    let failedAttempts = 0;
    while (failedAttempts < 5) {
        const assistance = failedAttempts > 0
            && game.flags?.cmdassist !== false
            ? " (enter 'help' for assistance)" : '';
        value = await getLine(
            `For what do you wish${assistance}?`,
            (_ch, key) => key >= 32 && key < 127,
        );
        if ((value ?? '').trim().toLowerCase() === 'help') {
            await showWishHelp(5 - failedAttempts);
            continue;
        }
        result = await readObjectName(value ?? '', {
            wizardWish: !!game.flags.debug,
        });
        const wizardTerrain = allowWizardTerrain
            ? (value ?? '').trim().toLowerCase() : '';
        const wizardTerrains: Record<string, { typ: number; message: string }> = {
            'iron bars': { typ: IRONBARS, message: 'Iron bars.' },
            'wall of water': { typ: WATER, message: 'A wall of water.' },
            pool: { typ: POOL, message: 'A pool of water.' },
        };
        const wizardTerrainSpec = wizardTerrains[wizardTerrain];
        if (!result && wizardTerrainSpec) {
            const loc = game.level?.at?.(game.u.ux, game.u.uy);
            if (loc) {
                loc.typ = wizardTerrainSpec.typ;
                loc.flags = 0;
                loc.doormask = 0;
                loc.wall_info = 0;
                loc.ladder = 0;
                newsym(game.u.ux, game.u.uy);
                await pline(wizardTerrainSpec.message);
                game.context.move = 0;
                return;
            }
        }
        if (result) break;
        await pline('Nothing fitting that description exists in the game.');
        failedAttempts++;
    }
    if (!result) {
        await pline("That's enough tries!");
        result = await readObjectName('', { wizardWish: !!game.flags.debug });
        if (!result) {
            game.context.move = 0;
            return;
        }
    }

    if (result.noWish) {
        game.context.move = 0;
        return;
    }
    const object = result.object;
    if (object.oartifact) markArtifactFound(object.oartifact);
    game.u.uconduct.wishes = (game.u.uconduct.wishes || 0) + 1;

    if (object.otyp === CORPSE && !(game.uarmg || game.u.uarmg)
        && touchPetrifies(object.corpsenm) && !heroResistsStoning(game))
        object.wishedfor = true;
    const held = await holdAnotherObject(object, { dropMessage: wishDropMessage(object) });
    if (held.heroDied) return;
    game.u.ublesscnt = (game.u.ublesscnt || 0) + 50 + rn2(100);
    game.context.move = 0;
}

function wishDropMessage(object: GameObject): string {
    const hero = game.u;
    const airLevel = Is_airlevel(hero.uz);
    const slips = airLevel || !!hero.uinwater;
    const dangerous = object.otyp === CORPSE && !!object.wishedfor;
    const verb = slips ? 'slip' : dangerous ? 'materialize' : 'drop';
    observeObjectForNaming(object);
    const quantity = object.quan;
    const noun = object.otyp === CORPSE ? corpseName(object) : objectName(object);
    const plural = object.otyp === CORPSE ? noun : makePlural(noun);
    const subject = definiteName(quantity === 1 ? noun : `${quantity} ${plural}`);
    const action = `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${verb}${quantity === 1 ? 's' : ''}`;
    if (hero.uswallow) return `Oops!  ${action} out of your reach!`;
    const terrain = game.level?.at(hero.ux, hero.uy)?.typ;
    if (airLevel || Is_waterlevel(hero.uz) || terrain !== undefined && (terrain < IRONBARS || terrain >= ICE))
        return `Oops!  ${action} away from you!`;
    return dangerous ? `Careful! ${action} on the floor!` : `Oops!  ${action} to the floor!`;
}

// C allmain.c grants this once, after elapsed monster work and before the
// next player input.
export async function grantAmuletWish(): Promise<boolean> {
    if (!game.u?.uhave?.amulet || game.u?.uevent?.amulet_wish)
        return false;
    if (!game.u.uevent) game.u.uevent = {};
    game.u.uevent.amulet_wish = 1;
    await flushPendingTopline();
    await pline(
        'The Amulet is bestowing a wish upon you!  '
        + 'You may wish for an object.',
    );
    await flushPendingTopline();
    await makeWish();
    return true;
}
