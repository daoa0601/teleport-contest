import { game, requirePlayingGame } from './gstate.js';
import { map_trap, newsym, plineWithContinuation, shieldeff } from './display.js';
import { inventoryItemDescription } from './invent.js';
import { heroSpecies } from './hero_species.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { monsterName } from './monster_name.js';
import { ownedObjectName } from './objnam.js';
import { heroIsHallucinating } from './senses.js';
import { heroIsUnchanging, polymorphHero } from './polyself.js';
import { propertyIsActive } from './properties.js';
import { IRON_SHOES, KICKING_BOOTS, OBJECT_MATERIAL } from './object_data.js';
import { poly_obj } from './object_polymorph.js';
import { deleteTrap } from './trap_lifecycle.js';
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { monsterResistsEffect } from './monster_resistance.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { rn2 } from './rng.js';
const IRON = 11;
const WAND_CLASS = 12;
export async function triggerHeroPolymorphTrap(trap, viaSitting) {
    requirePlayingGame(game);
    trap.tseen = true;
    map_trap(trap);
    const steed = game.u.usteed;
    const locomotion = game.u.levitating ? 'float' : game.u.flying ? 'fly'
        : monsterLocomotion(heroSpecies(game), 'step');
    const verb = viaSitting ? 'trigger' : steed
        ? `lead ${monsterName(steed, {
            article: steed.name && !heroIsHallucinating(game) ? 'none' : 'the',
            suppressSaddle: true,
        })} onto` : `${locomotion} onto`;
    await plineWithContinuation(`You ${verb} a polymorph trap!`);
    const shoes = game.uarmf || game.u.uarmf;
    if (shoes && OBJECT_MATERIAL[shoes.otyp] === IRON) {
        deleteTrap(trap);
        await plineWithContinuation(`${ownedObjectName(shoes)} warps strangely.`);
        await poly_obj(shoes, shoes.otyp === IRON_SHOES ? KICKING_BOOTS : IRON_SHOES);
        const replacement = game.uarmf || game.u.uarmf;
        if (replacement)
            await plineWithContinuation(`${replacement.invlet} - ${inventoryItemDescription(replacement)}.`);
        return;
    }
    if (propertyIsActive('antimagic', game) || heroIsUnchanging(game)) {
        await shieldeff(game.u.ux, game.u.uy);
        await plineWithContinuation('You feel momentarily different.');
        return;
    }
    if (steed) {
        steed.mx = game.u.ux;
        steed.my = game.u.uy;
        if (!monsterHasMagicResistance(steed) && !monsterResistsEffect(steed, WAND_CLASS, rn2))
            await changeMonsterForm(steed, null, game, {
                showMessage: true, publish: plineWithContinuation,
            });
        if (game.program_state.gameover)
            return;
    }
    deleteTrap(trap);
    newsym(game.u.ux, game.u.uy);
    await plineWithContinuation('You feel a change coming over you.');
    await polymorphHero();
}
//# sourceMappingURL=hero_polymorph_trap.js.map