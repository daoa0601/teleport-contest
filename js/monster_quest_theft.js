// C steal.c:stealamulet() and worn_item_removal().
import { artifactById } from './artifacts.js';
import { stopDonning } from './armor.js';
import { reportHeroEncumbrance } from './attrib.js';
import { RLOC_MSG, W_ACCESSORY, W_WEAPONS } from './const.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { inventoryItemDescription } from './invent.js';
import { MONSTER_FLAGS1 } from './monster_data.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterName } from './monster_name.js';
import { AMULET_OF_YENDOR, BELL, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, FAKE_AMULET_OF_YENDOR, SPE_BOOK_OF_THE_DEAD } from './object_data.js';
import { unlinkObject } from './object_location.js';
import { observeObjectForNaming } from './objnam.js';
import { currentShopResident, removeObjectAndContentsFromBill } from './shk.js';
import { randomMonsterRelocation } from './teleport.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
export async function stealHeroQuestObject(monster, state, publish, random, rollOne) {
    const object = chooseQuestTheftTarget(monster, state, rollOne);
    if (!object)
        return;
    if ((object === state.uarm || object === state.uarmu) && state.uarmc)
        await removeForQuestTheft(monster, state.uarmc, state, publish);
    if (object === state.uarmu && state.uarm)
        await removeForQuestTheft(monster, state.uarm, state, publish);
    if ((object === state.uarmg || (object === state.uright || object === state.uleft) && state.uarmg)
        && state.uwep) {
        if (state.u.twoweap && state.uswapwep)
            await removeForQuestTheft(monster, state.uswapwep, state, publish);
        if (state.uwep)
            await removeForQuestTheft(monster, state.uwep, state, publish);
    }
    if ((object === state.uright || object === state.uleft) && state.uarmg)
        await removeForQuestTheft(monster, state.uarmg, state, publish);
    if (object.owornmask)
        await removeForQuestTheft(monster, object, state, publish);
    if (state.program_state.gameover)
        return;
    if (object.unpaid)
        removeObjectAndContentsFromBill(object, state, { resident: currentShopResident(state) });
    unlinkObject(object, state);
    await finishInventoryRemoval(object, state);
    if (state.program_state.gameover)
        return;
    observeObjectForNaming(object, { state });
    const name = inventoryItemDescription(object);
    await addObjectToMonsterInventory(monster, object, state);
    await publish(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} steals ${name}!`);
    if (((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x02000000)
        && !await reportMonsterTeleportRestriction(monster, { state, publish }))
        await randomMonsterRelocation(monster, { state, flags: RLOC_MSG, random, rollOne });
    await reportHeroEncumbrance(state);
}
function chooseQuestTheftTarget(monster, state, rollOne) {
    let candidates = state.inventory.filter(object => artifactById(object.oartifact, state)?.questArtifact);
    if (!candidates.length) {
        const possessions = state.u.uhave;
        const [real, fake] = possessions.amulet ? [AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR]
            : possessions.bell ? [BELL_OF_OPENING, BELL]
                : possessions.book ? [SPE_BOOK_OF_THE_DEAD, 0]
                    : possessions.menorah ? [CANDELABRUM_OF_INVOCATION, 0] : [0, 0];
        if (!real)
            return undefined;
        candidates = state.inventory.filter(object => object.otyp === real
            || object.otyp === fake && !monster.iswiz);
    }
    return candidates[candidates.length > 1 ? rollOne(candidates.length) - 1 : 0];
}
async function removeForQuestTheft(monster, object, state, publish) {
    observeObjectForNaming(object, { state });
    const description = inventoryItemDescription(object)
        .replace(/^(?:the|an|a) /, object === state.uchain ? 'the ' : 'your ')
        .replace(' (being worn)', '').replace(' (alternate weapon; not wielded)', '')
        .replace(/ \(on (left|right) hand\)/, ' (from $1 hand)');
    const mask = object.owornmask ?? 0;
    const verb = mask & W_WEAPONS ? 'disarms' : mask & W_ACCESSORY ? 'removes' : 'takes off';
    await publish(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} ${verb} ${description}.`);
    await stopDonning(object, state);
    await removeWornHeroItem(object, state);
}
//# sourceMappingURL=monster_quest_theft.js.map