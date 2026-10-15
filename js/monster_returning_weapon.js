// C mthrowu.c:return_from_mtoss(). A failed catch can hurt the thrower.
import { publishHeardMessage } from './hero_speech.js';
import { heroArmName, monsterFootName, monsterHandName } from './body_parts.js';
import { IS_POOL, LAVAPOOL, W_WEP } from './const.js';
import { canSeeMonster, canSpotMonster, newsym, plineWithContinuation } from './display.js';
import { landFloorObject } from './floor_effects.js';
import { game, requireInitializedGame } from './gstate.js';
import { finishMonsterKilled } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { linkObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName, monsterPossessive, possessiveName } from './monster_name.js';
import { definiteName, objectCombatName } from './objnam.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { shipObject } from './object_migration.js';
import { rn2, rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';
export async function returnMonsterWeapon(monster, weapon, impactX, impactY, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, animateReturn, } = {}) {
    const impaired = monster.mconf || monster.mstun || monster.mblinded;
    const visible = canSeeMonster(monster);
    const name = () => monsterName(monster, { state });
    const weaponAction = (verb) => {
        const noun = definiteName(objectCombatName(weapon, { state }), state);
        return `${noun.charAt(0).toUpperCase() + noun.slice(1)} ${verbForSubject(noun, verb)}`;
    };
    let x = impactX, y = impactY;
    if (random(100)) {
        await animateReturn?.();
        x = monster.mx;
        y = monster.my;
        if (!impaired && random(100)) {
            const lastMessage = state.lastMonsterWeaponReturnMessage;
            if (!lastMessage || state.moves - lastMessage > 500) {
                await publish(`${weaponAction('return')} to ${possessiveName(name())} ${monsterHandName(monster.mnum)}!`);
                state.lastMonsterWeaponReturnMessage = state.moves;
            }
            const carried = await linkObjectToMonsterInventory(monster, weapon, { state });
            if (!carried)
                throw new Error('A caught returning weapon must enter monster inventory');
            monster.mw = carried;
            carried.owornmask = (carried.owornmask ?? 0) | W_WEP;
            carried.worn = true;
            carried.wielded = true;
            monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_WEP;
            if (cansee(x, y))
                newsym(x, y);
            return;
        }
        let damage = random(2);
        if (!damage) {
            if (visible) {
                const feet = makePlural(monsterFootName(monster.mnum));
                await publish(`${weaponAction('return')} back to ${name()}, landing at ${monsterPossessive(monster, { state })} ${feet}.`);
            }
            else if (!heroIsDeaf(state)) {
                await publishHeardMessage(`something land near ${name()}.`, publish, state);
            }
        }
        else {
            damage += rollOne(3);
            if (visible) {
                // C uses body_part(ARM), which describes the hero's form.
                await publish(`${weaponAction('fly')} back toward ${name()}, hitting ${monsterPossessive(monster, { state })} ${heroArmName(state)}!`);
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
        const terrain = state.level?.at(x, y)?.typ;
        if (terrain === undefined)
            throw new Error('A returning weapon must land on the current level');
        if (IS_POOL(terrain) || terrain === LAVAPOOL)
            await publish(objectWeight(weapon) > 9 ? 'Splash!' : 'Plop!');
    }
    if (cansee(x, y))
        newsym(x, y);
}
//# sourceMappingURL=monster_returning_weapon.js.map