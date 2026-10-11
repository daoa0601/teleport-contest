// C dothrow.c:thitmonst(). Splash projectiles use Dexterity admission, then
// enter the same hmon object-contact and damage owner as melee attacks.
import { currentAttribute } from './attrib.js';
import { A_DEX } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { hitMonsterWithHeroObject } from './hero_physical_hit.js';
import { reportHeroThrownMiss } from './hero_physical_messages.js';
import { wakeAttackedMonster } from './monster_anger.js';
import { ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EGG } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { prepareHeroThrownTarget } from './thrown_object.js';
import { offerThrownFood } from './thrown_food.js';
const EGG_PIE_AND_VENOM_TYPES = new Set([EGG, CREAM_PIE, BLINDING_VENOM, ACID_VENOM]);
export function isHeroThrownEggPieOrVenom(object) {
    return !!object && EGG_PIE_AND_VENOM_TYPES.has(object.otyp);
}
export async function hitMonsterWithThrownEggPieOrVenom(monster, object, { state = game, mode = 'thrown', target = { x: monster.mx, y: monster.my }, guaranteedHit = false, publish = plineWithContinuation, random = rn2, rollOne = rnd, finishMonsterKill = null, } = {}) {
    if (!isHeroThrownEggPieOrVenom(object))
        return null;
    prepareHeroThrownTarget(monster, random);
    const dieRoll = rollOne(20);
    if (!guaranteedHit && currentAttribute(A_DEX, state) <= rollOne(25)) {
        const food = await offerThrownFood(monster, object, state);
        if (food?.heroDied)
            return food;
        if (food)
            return { heroDied: false, hit: food.handled, consumed: food.handled, result: food.handled };
        await reportHeroThrownMiss(monster, object, { state, publish, target });
        if (!random(3) && (await wakeAttackedMonster(monster)).heroDied)
            return { heroDied: true };
        return { heroDied: false, hit: false, consumed: false, result: false };
    }
    const hit = await hitMonsterWithHeroObject(monster, object, {
        state, mode, target, dieRoll, publish,
        ...(finishMonsterKill ? { finishMonsterDeath: finishMonsterKill } : {}),
    });
    if (hit.heroDied)
        return { heroDied: true };
    // Native thitmonst returns handled even when the egg became a floor rock
    // or an effect spared the target; the flight must not place it again.
    return { heroDied: false, hit: true, consumed: true, result: true };
}
//# sourceMappingURL=hero_thrown_egg_pie_venom.js.map