// C mthrowu.c:return_from_mtoss(). A failed catch can hurt the thrower.
import { publishHeardMessage } from './hero_speech.js';
import { heroArmName, monsterFootName, monsterHandName } from './body_parts.js';
import { W_WEP } from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { landFloorObject } from './floor_effects.js';
import { game, requireInitializedGame } from './gstate.js';
import { finishMonsterKilled } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName, monsterPossessive, possessiveName } from './monster_name.js';
import { definiteObjectAction } from './objnam.js';
import { makePlural } from './object_grammar.js';
import { shipObject } from './object_migration.js';
import { objectMaterial } from './object_material.js';
import { OBJECT_PROPERTY, TALLOW_CANDLE, WAN_FIRE, WAX_CANDLE } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';
const LIQUID = 1;
const WOOD = 8;
const PLASTIC = 18;
export async function returnMonsterWeapon(monster, weapon, impactX, impactY, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, animateReturn, dropTether, } = {}) {
    const impaired = monster.mconf || monster.mstun || monster.mblinded;
    const visible = canSeeMonster(monster);
    const name = () => monsterName(monster, { state });
    let x = impactX, y = impactY;
    if (random(100)) {
        await animateReturn?.();
        x = monster.mx;
        y = monster.my;
        if (!impaired && random(100)) {
            const lastMessage = state.lastMonsterWeaponReturnMessage;
            if (!lastMessage || state.moves - lastMessage > 500) {
                await publish(`${definiteObjectAction(weapon, 'return', state)} to ${possessiveName(name())} ${monsterHandName(monster.mnum)}!`);
                state.lastMonsterWeaponReturnMessage = state.moves;
            }
            const carried = await linkObjectToMonsterInventory(monster, weapon, { state });
            if (!carried)
                throw new Error('A caught returning weapon must enter monster inventory');
            monster.mw = carried;
            carried.owornmask = (carried.owornmask ?? 0) | W_WEP;
            carried.worn = true;
            carried.wielded = true;
            if (cansee(x, y))
                newsym(x, y);
            // C return_from_mtoss() then falls through to its closing redraw.
            if (cansee(x, y))
                newsym(x, y);
            return;
        }
        let damage = random(2);
        if (!damage) {
            if (visible) {
                const feet = makePlural(monsterFootName(monster.mnum));
                await publish(`${definiteObjectAction(weapon, 'return', state)} back to ${name()}, landing at ${monsterPossessive(monster, { state })} ${feet}.`);
            }
            else if (!heroIsDeaf(state)) {
                await publishHeardMessage(`Something land near ${name()}.`, publish, state);
            }
        }
        else {
            damage += rollOne(3);
            if (visible) {
                // C uses body_part(ARM), which describes the hero's form.
                await publish(`${definiteObjectAction(weapon, 'fly', state)} back toward ${name()}, hitting ${monsterPossessive(monster, { state })} ${heroArmName(state)}!`);
            }
            else if (!heroIsDeaf(state)) {
                await publishHeardMessage(`something hit ${name()} with a thud!`, publish, state);
            }
            monster.mhp -= damage;
            if (monster.mhp <= 0) {
                await finishMonsterKilled(monster, state, {
                    publish, random, damageType: AD_PHYS,
                    cause: canSpotMonster(monster) ? '' : null,
                });
            }
        }
    }
    else {
        dropTether?.();
        await publishHeardMessage('a loud snap!', publish, state);
    }
    const options = { state: requireInitializedGame(state), publish, random };
    if (!await shipObject(weapon, x, y, options)) {
        const landed = await landFloorObject(weapon, x, y, options);
        if (!landed) {
            if (cansee(x, y))
                newsym(x, y);
            return;
        }
    }
    if (!heroIsDeaf(state) && !state.underwater && !state.u.uinwater) {
        const material = objectMaterial(weapon, state);
        const flammable = ![TALLOW_CANDLE, WAX_CANDLE, WAN_FIRE].includes(weapon.otyp)
            && OBJECT_PROPERTY[weapon.otyp] !== 'fireResistance'
            && (material <= WOOD && material !== LIQUID || material === PLASTIC);
        if (isPoolAt(x, y, state) || isLavaAt(x, y, state) && !flammable)
            await publish(objectWeight(weapon) > 9 ? 'Splash!' : 'Plop!');
    }
    if (cansee(x, y))
        newsym(x, y);
}
//# sourceMappingURL=monster_returning_weapon.js.map