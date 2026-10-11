// Native mhitu.c:could_seduce(), mhitm.c:failed_grab(), and weapon.c:silver_sears().
import { W_AMUL, W_RINGL, W_RINGR } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { AD_DGST, AD_STCK, AD_WRAP, AT_HUGS } from './monster_attack_types.js';
import { MONSTER_FLAGS1, monsterHasHead, monsterIsMindless, monsterIsUnsolid, } from './monster_data.js';
import { monsterName, possessiveName } from './monster_name.js';
import { OBJECT_NAMES } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { seductionCompatibility } from './seduction_compatibility.js';
const M1_BREATHLESS = 0x00000400;
const SILVER = 14;
const STRANGE_OBJECT = 0;
const AMULET_OF_MAGICAL_BREATHING = OBJECT_NAMES.indexOf('amulet of magical breathing');
export function heroSeductionCompatibility(monster, attack, state = game) {
    return seductionCompatibility('hero', monster, attack, state);
}
export async function heroGrabMisses(monster, attack, target, { state = game, publish = plineWithContinuation } = {}) {
    const tail = monster.mx !== target.x || monster.my !== target.y;
    if ((!tail && !monsterIsUnsolid(monster))
        || !(attack[0] === AT_HUGS || [AD_WRAP, AD_STCK, AD_DGST].includes(attack[1])))
        return false;
    const verb = attack[1] === AD_DGST ? 'gulp' : attack[1] === AD_STCK ? 'adhere' : 'grab';
    const name = monsterName(monster, { state, augmentIt: tail });
    const object = tail ? `${possessiveName(name)} tail` : name;
    await publish(`Your ${verb} attempt ${tail ? 'fails to hold' : 'passes right through'} ${object}!`);
    return true;
}
export async function showHeroSilverContact(monster, silverMask, { state = game, publish = plineWithContinuation } = {}) {
    if (!(silverMask & (W_RINGL | W_RINGR)))
        return;
    const left = state.uleft || state.u.uleft;
    const right = state.uright || state.u.uright;
    const leftType = left && (silverMask & W_RINGL) ? left.otyp : STRANGE_OBJECT;
    const rightType = right && (silverMask & W_RINGR) ? right.otyp : STRANGE_OBJECT;
    const leftKnown = !!left?.dknown;
    const rightKnown = !!right?.dknown;
    const leftSilver = objectMaterial(leftType, state) === SILVER && leftKnown;
    const rightSilver = objectMaterial(rightType, state) === SILVER && rightKnown;
    const both = (leftType === rightType && leftKnown === rightKnown) || (leftSilver && rightSilver);
    const material = leftSilver || rightSilver ? 'silver '
        : both ? '' : silverMask & W_RINGL ? 'left ' : 'right ';
    await publish(`Your ${material}ring${both ? 's sear' : ' sears'} ${monsterName(monster, { state })}!`);
}
export function monsterCanBeStrangled(monster) {
    if (!monsterHasHead(monster))
        return false;
    const nonbreathing = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_BREATHLESS)
        || (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_MAGICAL_BREATHING
            && !!((object.owornmask ?? 0) & W_AMUL));
    return !monsterIsMindless(monster.mnum) || !nonbreathing;
}
//# sourceMappingURL=hero_form_contact.js.map