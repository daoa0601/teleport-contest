// C dothrow.c:thitmonst()'s unicorn catch and gem_accept().
import { P_SLING, RLOC_MSG } from './const.js';
import { plineWithContinuation } from './display.js';
import { reportHeroThrownMiss } from './hero_physical_messages.js';
import { MONSTER_ALIGNMENT, monsterIsUnicorn } from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import { OBJECT_SUBTYPE } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { definiteName, objectName } from './objnam.js';
import { rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { objectTypeKnown, settleThrownShopObject } from './shk.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
const GEM_CLASS = 13;
const GEMSTONE = 20;
const MINERAL = 21;
// Null means ordinary combat; false means caught or missed but still free.
export async function offerUnicornGem(monster, object, state) {
    if (object.oclass !== GEM_CLASS || !monsterIsUnicorn(monster.mnum)
        || objectMaterial(object, state) === MINERAL
        || state.uwep && OBJECT_SUBTYPE[state.uwep.otyp] === P_SLING)
        return null;
    if (!monster.mcanmove || monster.msleeping) {
        await reportHeroThrownMiss(monster, object, { state });
        return false;
    }
    const subject = monsterName(monster, { state, capitalized: true });
    const gem = definiteName(objectName(object, state), state);
    await plineWithContinuation(`${subject} catches${monster.mtame ? ' and drops' : ''} ${gem}.`);
    if (monster.mtame)
        return false;
    const reactionSubject = monsterName(monster, { state, capitalized: true });
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    const aligned = Math.sign(MONSTER_ALIGNMENT[monster.mnum] ?? 0)
        === Math.sign(state.u.ualign?.type ?? 0);
    const realGem = objectMaterial(object, state) === GEMSTONE;
    const identified = object.dknown && objectTypeKnown(object, state);
    const guessed = !!(object.oextra?.oname || object.oname
        || state._objectCallNames?.[object.otyp]);
    const accepted = realGem || !(identified || guessed);
    let reaction = ' is not interested in your junk.';
    if (accepted) {
        let appreciation = 'graciously';
        if (realGem) {
            let luck;
            if (aligned) {
                luck = 1;
                if (guessed)
                    luck = 2;
                if (identified)
                    luck = 5;
            }
            else {
                luck = identified ? rn2(7) - 3 : rn2(3) - 1;
            }
            state.u.uluck = Math.max(-13, Math.min(13, (state.u.uluck ?? 0) + luck));
            appreciation = aligned ? 'gratefully' : 'hesitatingly';
        }
        reaction = ` ${appreciation} accepts your gift.`;
        if (state.u.ushops.length || object.unpaid)
            await settleThrownShopObject(object, monster.mx, monster.my, state, plineWithContinuation, { broken: true });
        await addObjectToMonsterInventory(monster, object, state);
    }
    if (!heroIsBlind(state))
        await plineWithContinuation(reactionSubject + reaction);
    if (!await reportMonsterTeleportRestriction(monster, { state }))
        await randomMonsterRelocation(monster, { state, flags: RLOC_MSG });
    return accepted;
}
//# sourceMappingURL=unicorn_gift.js.map