// Native mhitu.c:could_seduce(), mhitm.c:failed_grab(), and weapon.c:silver_sears().
import { W_AMUL, W_RINGL, W_RINGR } from './const.js';
import { plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import { AD_DGST, AD_STCK, AD_WRAP, AT_HUGS } from './monster_attack_types.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { OBJECT_NAMES } from './object_data.js';
import { objectMaterial } from './o_init.js';
import { could_seduce } from './seduction_compatibility.js';
import { monsterHasHead, monsterIsBreathless, monsterIsMindless, monsterIsUnsolid } from './mondata.js';
const SILVER = 14;
const STRANGE_OBJECT = 0;
const AMULET_OF_MAGICAL_BREATHING = OBJECT_NAMES.indexOf('amulet of magical breathing');
// Part of C mhitu.c:could_seduce(): the hero-perspective call (the shared
// port is could_seduce() in seduction_compatibility.ts).
export function heroSeductionCompatibility(monster, attack, state = game) {
    return could_seduce('hero', monster, attack, state);
}
// Part of C mhitm.c:failed_grab(): the magr == &gy.youmonst branch —
// unsolid or notonhead targets defeat hug/wrap/stick/digest grabs.
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
// C weapon.c:silver_sears(): the hero's silver rings searing the target.
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
// Part of C mondata.c:can_be_strangled(): the shared port is in mondata.ts.
export function monsterCanBeStrangled(monster) {
    if (!monsterHasHead(monster))
        return false;
    const nonbreathing = monsterIsBreathless(monster.mnum)
        || (monster.minvent ?? []).some(object => object.otyp === AMULET_OF_MAGICAL_BREATHING
            && !!((object.owornmask ?? 0) & W_AMUL));
    return !monsterIsMindless(monster.mnum) || !nonbreathing;
}
//# sourceMappingURL=hero_form_contact.js.map