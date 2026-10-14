// C invent.c:look_here(): inspection touches corpses before showing inventory.
import { game } from './gstate.js';
import { CONTAINED_SYM, MGIVENNAME } from './const.js';
import { monsterStomachName } from './body_parts.js';
import { heroDetectsMonsters, heroIsBlind } from './senses.js';
import { consumeHallucinatedMenuObjectGlyph, plineWithContinuation, transientMonsterGlyph, unblindTelepathyRange } from './display.js';
import { feelPetrifyingCorpse } from './stoning.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { inventoryItemDescription } from './invent.js';
import { observeObjectForNaming, simpleObjectName } from './objnam.js';
import { monsterName, possessiveName } from './monster_name.js';
import { monsterDigests, monsterTypeName } from './monster_data.js';
import { GOLD_PIECE } from './object_data.js';
import { heroIsPolymorphed } from './polyself.js';
import { heroSpecies } from './hero_species.js';
import { heroIsPunished } from './ball.js';
import { propertyIsActive } from './properties.js';
import { visibleRegionAt } from './regions.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { showInventoryWindow } from './windows.js';
import type { InventorySection } from './windows.js';
import type { Monster } from './monster_types.js';

export async function lookInsideSwallower(monster: Monster): Promise<void> {
    const blind = heroIsBlind();
    const location = `${possessiveName(monsterName(monster))} ${monsterStomachName(monster.mnum)}`;
    await plineWithContinuation(`You ${blind ? 'try' : 'look around'} to ${blind ? 'feel' : 'see'} what is lying in ${location}.`);
    const objects = monster.minvent ?? monster.inventory ?? [];
    if (!objects.length) {
        await plineWithContinuation(`You ${blind ? 'feel' : 'see'} no objects here.`);
        return;
    }
    for (const object of objects) {
        const contact = await feelPetrifyingCorpse(object);
        if (contact.died) return;
    }
    // display_minventory() builds its default title even when look_here()
    // supplies another title, so the perceived owner still changes.
    monsterName(monster, { article: 'your', suppressIt: true, capitalized: true,
        suppressSaddle: !!MGIVENNAME(monster) });
    const ordered = sortObjects(objects, { mode: lootSortMode() });
    const sections: InventorySection[] = [];
    let letter = 97;
    let first = true;
    for (const oclass of [...inventoryClassOrder(), 17, 0]) {
        const items = ordered.filter(object => object.oclass === oclass);
        if (!items.length) continue;
        sections.push({ heading: objectClassHeading(oclass), items: items.map(object => {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            const key = first && object.otyp === GOLD_PIECE ? '$' : String.fromCharCode(letter++);
            first = false;
            return { key, text: inventoryItemDescription(object) };
        }) });
    }
    // query_objlist() attaches a monster glyph even though tty only shows text.
    transientMonsterGlyph({ mnum: heroSpecies(game),
        female: !!(heroIsPolymorphed(game) ? game.u.mfemale : game.flags.female) });
    sections.push({ heading: `${monsterDigests(monster) ? 'Swallowed' : 'Engulfed'} Creatures`,
        items: [{ key: CONTAINED_SYM, text: withIndefiniteArticle(swallowedHeroDescription()) }] });
    await showInventoryWindow(sections, { title: blind ? 'You feel:'
        : `Contents of ${location}:` });
}

// Swallowing has already dismounted, revealed, and released a trapped hero.
function swallowedHeroDescription(): string {
    const race = heroIsPolymorphed(game) ? '' : `${game.urace?.adj ?? 'human'} `;
    const invisible = propertyIsActive('invisible', game)
        && (!heroIsBlind() || unblindTelepathyRange() >= 0 || heroDetectsMonsters());
    let description = `${invisible ? 'invisible ' : ''}${race}${monsterTypeName(heroSpecies(game),
        !!(heroIsPolymorphed(game) ? game.u.mfemale : game.flags.female))} called ${game.plname}`;
    const region = visibleRegionAt(game, game.u.ux, game.u.uy);
    if (region) description += `, in a cloud of ${region.damage ? 'poison gas' : 'vapor'}`;
    if (heroIsPunished()) {
        const ball = game.uball || game.u.uball;
        description += `, chained to ${ball ? withIndefiniteArticle(simpleObjectName(ball)) : 'nothing?'}`;
    }
    return description;
}
