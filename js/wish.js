// Wishes from wands, monsters, the Amulet, and debug commands.
// C refs: zap.c makewish(), objnam.c readobjnam(), and
// invent.c hold_another_object().

import { touchArtifactByHero } from './artifact_touch.js';
import { IRONBARS, POOL, WATER } from './const.js';
import {
    bot, docrtRecalc, flushPendingTopline, flush_screen, newsym, pline,
    plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { addHeroGoldObject, heroGoldAmount } from './hero_gold.js';
import { recordObjectEncounter } from './object_knowledge.js';
import {
    objectStatePrefix, readObjectName, unseenObjectNoun,
    wishedObjectPresentation,
} from './objnam.js';
import { getLine } from './query.js';
import { rn2 } from './rng.js';
import { addInventoryItem } from './u_init.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';
import { showTextPages } from './windows.js';

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

async function showWishHelp(triesLeft) {
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
    await docrtRecalc();
    await bot();
    await flush_screen(1);
}

export async function makeWish({
    announce = false, allowWizardTerrain = false,
} = {}) {
    if (announce) {
        await plineWithContinuation('You may wish for an object.');
        await flushPendingTopline();
    }
    let value = '';
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
        result = readObjectName(value ?? '', {
            wizardWish: allowWizardTerrain,
        });
        const wizardTerrain = allowWizardTerrain
            ? (value ?? '').trim().toLowerCase() : '';
        const wizardTerrainSpec = {
            'iron bars': { typ: IRONBARS, message: 'Iron bars.' },
            'wall of water': { typ: WATER, message: 'A wall of water.' },
            pool: { typ: POOL, message: 'A pool of water.' },
        }[wizardTerrain];
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
        if (result?.noWish) {
            game.context.move = 0;
            return;
        }
        if (result) break;
        await pline('Nothing fitting that description exists in the game.');
        failedAttempts++;
    }
    if (!result) {
        await pline("That's enough tries!");
        result = readObjectName('');
        if (!result) {
            game.context.move = 0;
            return;
        }
    }

    if (!game.u.uconduct) game.u.uconduct = {};
    game.u.uconduct.wishes = (game.u.uconduct.wishes || 0) + 1;

    if (result.isGold) {
        const quantity = result.object.quan ?? 1;
        const previousGold = heroGoldAmount(game);
        addHeroGoldObject(game, result.object);
        const goldName = quantity === 1
            ? 'a gold piece' : `${quantity} gold pieces`;
        await pline(`$ - ${goldName}${previousGold > 0 ? '' : '.'}`);
        game.u.ublesscnt = (game.u.ublesscnt || 0) + 50 + rn2(100);
        game.context.move = 0;
        return;
    }

    const clericBucKnowledge = game.urole?.key === 'priest';
    if (clericBucKnowledge) result.object.bknown = true;
    if (result.artifact) {
        const touch = await touchArtifactByHero(
            result.object, result.artifact,
        );
        if (!touch.allowed || touch.died) {
            game.context.move = 0;
            return;
        }
    }
    const presentation = {
        ...wishedObjectPresentation(result.object.otyp),
        showBuc: clericBucKnowledge,
    };
    const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
    const canObserveWishedObject = !game.blind
        && !game.u?.hallucinating
        && !((game.u?.hallucinationTurns ?? 0) > 0);
    const item = addInventoryItem(
        result.object, presentation, canObserveWishedObject,
    );
    if (!result.object.known && [2, 3].includes(result.object.oclass))
        item.enchantment = undefined;
    if (canObserveWishedObject && item.dknown)
        recordObjectEncounter(item.otyp);
    const statePrefix = objectStatePrefix(item);
    const perceivedName = `${statePrefix}${
        item.dknown ? item.name : unseenObjectNoun(item)
    }`;
    const individualName = item.oextra?.oname || item.oname;
    const namedObject = individualName
        ? `${perceivedName} named ${individualName}` : perceivedName;
    const visibleName = item.buc
        ? `${item.buc} ${namedObject}` : namedObject;
    const quantity = item.quantity ?? item.quan ?? 1;
    const heldDescription = quantity > 1
        ? `${quantity} ${item.buc ? `${item.buc} ` : ''}${
            statePrefix
        }${item.plural}`
        : `${indefiniteArticle(visibleName)} ${visibleName}`;
    await pline(`${item.invlet} - ${heldDescription}.`);

    const currentCapacity = nearCapacity(game);
    const capacityMessage = encumbranceMessage(
        previousCapacity, currentCapacity,
    );
    if (capacityMessage) await plineWithContinuation(capacityMessage);
    game._encumbranceLevel = currentCapacity;
    game.u._encumbrance = encumbranceLabel(currentCapacity);
    game.u.ublesscnt = (game.u.ublesscnt || 0) + 50 + rn2(100);
    game.context.move = 0;
}

// C allmain.c grants this once, after elapsed monster work and before the
// next player input.
export async function grantAmuletWish() {
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
