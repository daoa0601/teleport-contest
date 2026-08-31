// Wishes from wands, monsters, the Amulet, and debug commands.
// C refs: zap.c makewish(), objnam.c readobjnam(), and
// invent.c hold_another_object().

import { touchArtifactByHero } from './artifacts.js';
import { IRONBARS, POOL, WATER } from './const.js';
import {
    flushPendingTopline, newsym, pline, plineWithContinuation,
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

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

export async function makeWish({
    announce = false, allowWizardTerrain = false,
} = {}) {
    if (announce) {
        await plineWithContinuation('You may wish for an object.');
        await flushPendingTopline();
    }
    const value = await getLine(
        'For what do you wish?',
        (_ch, key) => key >= 32 && key < 127,
    );
    const result = readObjectName(value ?? '', {
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
    if (!result) {
        await pline('Nothing fitting that description exists in the game.');
        game.context.move = 0;
        return;
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
        const touch = touchArtifactByHero(result.object, result.artifact);
        if (touch.blasted) {
            await plineWithContinuation(
                `You are blasted by ${result.artifact.name}'s power!`,
            );
        }
        if (!touch.allowed) {
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
