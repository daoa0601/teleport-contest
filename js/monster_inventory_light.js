import { endObjectBurn } from './light.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, MAGIC_LAMP, OIL_LAMP, POT_OIL, TALLOW_CANDLE, WAX_CANDLE, } from './object_data.js';
import { objectNameIsPlural, ownedObjectName } from './objnam.js';
import { carriedObjectOwner } from './shk.js';
import { cansee } from './vision.js';
export async function snuffMonsterInventoryLights(defender, state, publish) {
    for (const object of defender.minvent || defender.inventory || []) {
        if (!object.lamplit)
            continue;
        const lamp = [OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL].includes(object.otyp);
        const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
        const candelabrum = object.otyp === CANDELABRUM_OF_INVOCATION;
        if (!lamp && !candle && !candelabrum)
            continue;
        if (cansee(defender.mx, defender.my)) {
            if (lamp)
                await publish(`${ownedObjectName(object, state)} ${objectNameIsPlural(object, state) ? 'go' : 'goes'} out!`);
            else {
                const many = candle ? object.quan > 1 : object.spe > 1;
                await publish(`${carriedObjectOwner(object, state)} ${candelabrum ? "candelabrum's " : ''}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
            }
        }
        endObjectBurn(object, state);
    }
}
//# sourceMappingURL=monster_inventory_light.js.map