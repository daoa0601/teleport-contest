// C apply.c:use_tinning_kit(), tinnable(); eat.c:floorfood("tin", 2).
import { GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, HOMEMADE_TIN } from './const.js';
import { isRider } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { plineWithContinuation as pline } from './display.js';
import { useUpFloorObject } from './floor_consumption.js';
import { heroCanReachFloor } from './floor_reach.js';
import { game, requirePlayingGame } from './gstate.js';
import { holdAnotherObject } from './hero_hold_object.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { mksobj } from './mklev.js';
import { MONSTER_FLAGS1, MONSTER_NUTRITION } from './monster_data.js';
import { consumeObjectCharge } from './object_charge.js';
import { CORPSE, TIN } from './object_data.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { corpseName, observeObjectForNaming } from './objnam.js';
import { heroIsBreathless, heroSpecies } from './hero_species.js';
import { propertyIsActive } from './properties.js';
import { promptChoice } from './query.js';
import { costlySpot } from './shk.js';
import { feelPetrifyingCorpse, formCanBecomeStoneGolem, heroResistsStoning, resolveImmediatePetrification, touchPetrifies, willFeelPetrifyingCorpse } from './stoning.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { setTinVariety } from './tin.js';
import { objectWeight } from './weight.js';
export async function useTinningKit(kit) {
    requirePlayingGame(game);
    if (kit.spe <= 0) {
        await pline('You seem to be out of tins.');
        return;
    }
    const corpse = await chooseTinningCorpse();
    if (!corpse)
        return;
    if (corpse.oeaten) {
        await pline('You cannot tin something which is partly eaten.');
        return;
    }
    if (corpse.corpsenm === undefined)
        throw new Error('Tinning requires a corpse species.');
    if (touchPetrifies(corpse.corpsenm) && !heroResistsStoning(game) && !game.uarmg) {
        const name = withIndefiniteArticle(corpseName(corpse));
        const transform = formCanBecomeStoneGolem(game.u.umonnum, game);
        await pline(transform ? `You tin ${name} without wearing gloves.`
            : `Tinning ${name} without wearing gloves is a fatal mistake...`);
        await resolveImmediatePetrification({ killer: transform ? '' : `trying to tin ${name} without gloves` });
        if (game.program_state.gameover)
            return;
    }
    if (isRider(corpse.corpsenm)) {
        const revival = await reviveCorpseImmediately(corpse);
        for (const message of revival?.messages ?? [])
            await pline(message);
        await pline(revival?.monster ? '"Yes...  But War does not preserve its enemies..."' : 'The corpse evades your grasp.');
        return;
    }
    if (!MONSTER_NUTRITION[corpse.corpsenm]) {
        await pline("That's too insubstantial to tin.");
        return;
    }
    await consumeObjectCharge(kit);
    const tin = await mksobj(TIN, false, false);
    tin.corpsenm = corpse.corpsenm;
    tin.cursed = kit.cursed;
    tin.blessed = kit.blessed;
    tin.owt = objectWeight(tin);
    tin.known = true;
    setTinVariety(tin, HOMEMADE_TIN);
    if (corpse.where === 'inventory') {
        if (corpse.unpaid)
            await pline('"You tin it, you bought it!"');
        await consumeInventoryItem(corpse);
    }
    else {
        if (costlySpot(corpse.ox, corpse.oy, game) && !corpse.no_charge)
            await pline('"You tin it, you bought it!"');
        await useUpFloorObject(corpse, 1);
    }
    observeObjectForNaming(tin);
    await holdAnotherObject(tin, { dropMessage: `You make, but cannot pick up, ${await inventoryItemDescription(tin)}.` });
}
function tinnable(corpse) {
    return corpse.otyp === CORPSE && !corpse.oeaten && !!MONSTER_NUTRITION[corpse.corpsenm ?? -1];
}
async function chooseTinningCorpse() {
    requirePlayingGame(game);
    const hero = game.u;
    let declinedFloorCorpse = false;
    const flags = MONSTER_FLAGS1[heroSpecies(game)] ?? 0;
    const aboveLiquid = (isPoolAt(hero.ux, hero.uy) || isLavaAt(hero.ux, hero.uy))
        && (propertyIsActive('waterWalking', game) || (flags & 0x10)
            || propertyIsActive('flying', game) && !heroIsBreathless(game));
    if (!game.iflags.menu_requested && heroCanReachFloor(game, { checkPit: true }) && !aboveLiquid) {
        for (const corpse of game.level.objects[hero.ux]?.[hero.uy] ?? []) {
            if (!tinnable(corpse))
                continue;
            if (willFeelPetrifyingCorpse(corpse)) {
                await feelPetrifyingCorpse(corpse);
                return null;
            }
            const one = corpse.quan === 1;
            observeObjectForNaming(corpse);
            const answer = await promptChoice(`There ${one ? 'is' : 'are'} ${await inventoryItemDescription(corpse)} here; tin ${one ? 'it' : 'one'}?`, ['y', 'n', 'q'], 'n');
            if (answer === 'y')
                return corpse;
            if (answer === 'q')
                return null;
            declinedFloorCorpse = true;
        }
    }
    const corpse = await chooseInventoryObject('tin', object => {
        if (!object || object.oclass !== 7)
            return GETOBJ_EXCLUDE;
        return tinnable(object) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE_SELECTABLE;
    }, { hands: declinedFloorCorpse ? GETOBJ_EXCLUDE_NONINVENT : GETOBJ_EXCLUDE });
    if (corpse && !tinnable(corpse)) {
        await pline("You can't tin that!");
        return null;
    }
    return corpse;
}
//# sourceMappingURL=tinning_kit.js.map