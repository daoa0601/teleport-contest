// C do_wear.c:canwearobj(). Decisions precede contact and slot changes.
import { armorSimpleName, armorSlotFor } from './armor.js';
import { heroFingerName, heroFootName, heroLegName } from './body_parts.js';
import { P_SHORT_SWORD, P_SABER, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, W_ARMOR } from './const.js';
import { game } from './gstate.js';
import { MONSTER_NAME, MONSTER_SIZE, monsterBreaksArmor, monsterHornCount, monsterIsCentaur, monsterIsSlithy, monsterSlipsArmor, monsterWrappingAllowed, } from './monster_data.js';
import { BATTLE_AXE, MUMMY_WRAPPING, OBJECT_BIMANUAL, OBJECT_NAMES, OBJECT_SUBTYPE } from './object_data.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { isFlimsyObject } from './object_properties.js';
import { heroHasNoHands, heroIsVerySmall, heroMonsterForm } from './polyself.js';
import { surfaceName } from './terrain_name.js';
import { isWeldedPrimary } from './weapon_slots.js';
const MZ_SMALL = 1;
export function armorWearDecision(object, state = game) {
    const slot = armorSlotFor(object.otyp);
    const form = heroMonsterForm(state);
    const weapon = state.uwep ?? null;
    const torso = slot === 'uarm' || slot === 'uarmc' || slot === 'uarmu';
    let checkedWeldedWeapon = null;
    const refuse = (refusal) => ({ refusal, checkedWeldedWeapon });
    if (heroIsVerySmall(state) || heroHasNoHands(state))
        return refuse("You can't wear any armor in your current form.");
    if (torso && form !== null && (monsterBreaksArmor(form) || monsterSlipsArmor(form))
        && !(slot === 'uarmc' && (object.otyp === MUMMY_WRAPPING
            ? monsterWrappingAllowed(form) : MONSTER_SIZE[form] === MZ_SMALL))
        && !(MONSTER_NAME[form] === 'hobbit' && OBJECT_NAMES[object.otyp]?.startsWith('elven '))) {
        const noun = slot === 'uarm' ? 'suit' : slot === 'uarmu' ? 'shirt' : 'cloak';
        return refuse(`The ${noun} will not fit on your body.`);
    }
    if ((object.owornmask ?? 0) & W_ARMOR)
        return refuse('You are already wearing that!');
    if (isWeldedPrimary(weapon, state))
        checkedWeldedWeapon = weapon;
    if (checkedWeldedWeapon && OBJECT_BIMANUAL[checkedWeldedWeapon.otyp]
        && (slot === 'uarm' || slot === 'uarmu'))
        return refuse(`You cannot do that while holding your ${isSword(checkedWeldedWeapon) ? 'sword' : 'weapon'}.`);
    if (!slot)
        return refuse("You can't wear that!");
    if (slot === 'uarm' && state.uarmc)
        return refuse(`You cannot wear armor over a ${armorSimpleName(state.uarmc, state)}.`);
    const worn = state[slot];
    if (worn) {
        const name = slot === 'uarm' ? 'some armor'
            : slot === 'uarmg' ? 'gloves' : slot === 'uarmf' ? 'boots'
                : slot === 'uarms' ? 'a shield' : withIndefiniteArticle(armorSimpleName(worn, state));
        return refuse(`You are already wearing ${name}.`);
    }
    switch (slot) {
        case 'uarmh': {
            const horns = form === null ? 0 : monsterHornCount(form);
            if (horns && !isFlimsyObject(object, state))
                return refuse(`The ${armorSimpleName(object, state)} won't fit over your horn${horns === 1 ? '' : 's'}.`);
            break;
        }
        case 'uarms':
            if (weapon && OBJECT_BIMANUAL[weapon.otyp])
                return refuse(`You cannot wear a shield while wielding a two-handed ${isSword(weapon) ? 'sword' : weapon.otyp === BATTLE_AXE ? 'axe' : 'weapon'}.`);
            if (state.u.twoweap)
                return refuse('You cannot wear a shield while wielding two weapons.');
            break;
        case 'uarmf':
            if (form !== null && monsterIsSlithy(form))
                return refuse('You have no feet...');
            if (form !== null && monsterIsCentaur(form))
                return refuse('You have too many hooves to wear boots.');
            if (!state.u.utrap)
                break;
            if (state.u.utraptype === TT_BEARTRAP)
                return refuse(`Your ${heroFootName(state)} is trapped!`);
            if (state.u.utraptype === TT_INFLOOR || state.u.utraptype === TT_LAVA)
                return refuse(`Your ${makePlural(heroFootName(state))} are stuck in the ${surfaceName(state.u.ux, state.u.uy, state)}!`);
            if (state.u.utraptype === TT_BURIEDBALL)
                return refuse(`Your ${heroLegName(state)} is attached to the buried ball!`);
            break;
        case 'uarmg':
            if (isWeldedPrimary(weapon, state)) {
                checkedWeldedWeapon = weapon;
                return refuse(`You cannot wear gloves over your ${weapon && isSword(weapon) ? 'sword' : 'weapon'}.`);
            }
            if (state.u.glib || (state.u.glibTurns ?? 0) > 0)
                return refuse(`Your ${makePlural(heroFingerName(state))} are too slippery to pull on ${armorSimpleName(object, state)}.`);
            break;
        case 'uarmu':
            if (state.uarm || state.uarmc)
                return refuse(`You can't wear that over your ${state.uarmc ? armorSimpleName(state.uarmc, state) : 'armor'}.`);
            break;
        case 'uarm': break;
        case 'uarmc': break;
    }
    return refuse(null);
}
function isSword(object) {
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return object.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER;
}
//# sourceMappingURL=armor_wear.js.map