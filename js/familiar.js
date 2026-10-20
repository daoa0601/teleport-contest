// C dog.c:pick_familiar_pm() and make_familiar().
import { G_EXTINCT, MM_EDOG, MM_FEMALE, MM_IGNOREWATER, MM_MALE, MM_NOMSG, NEED_HTH_WEAPON, NO_MINVENT, } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { initializePet } from './dog.js';
import { game, requireLiveGame } from './gstate.js';
import { isPoolAt } from './terrain_properties.js';
import { makemonAt, makemonNear, rndmonstAdj } from './mklev.js';
import { resolveMonsterLiquid } from './mon.js';
import { setMonsterMalign } from './monster_alignment.js';
import { finishLiquidDeathForCurrentMover } from './hero_monster_death.js';
import { MONSTER_HAS_WEAPON_ATTACK, MONSTER_NAME } from './monster_data.js';
import { setMonsterGivenName } from './monster_given_name.js';
import { monsterBirthLimit } from './monster_population.js';
import { wieldMonsterWeapon } from './monster_weapon.js';
import { ensureHeroSkills } from './skills.js';
import { rn2 } from './rng.js';
function familiarSpecies(object, state) {
    if (object) {
        const species = object.corpsenm;
        if (species === undefined)
            throw new Error('Figurine requires a monster species');
        const specialLimit = monsterBirthLimit(species) !== 120;
        return specialLimit && (state.mvitals?.[species]?.mvflags ?? 0) & G_EXTINCT
            ? null
            : species;
    }
    if (!rn2(3)) {
        const rolePet = state.urole?.petnum;
        if (rolePet != null && rolePet >= 0)
            return rolePet;
        if (state.preferred_pet === 'c')
            return MONSTER_NAME.indexOf('kitten');
        if (state.preferred_pet === 'd')
            return MONSTER_NAME.indexOf('little dog');
        return MONSTER_NAME.indexOf(rn2(2) ? 'kitten' : 'little dog');
    }
    const clerical = ensureHeroSkills(state)?.[32]; // clerical spells
    if (!clerical)
        throw new Error('Familiar creation requires clerical skill state');
    const skill = clerical.skill;
    return rndmonstAdj(0, 3 * skill);
}
export async function makeFamiliar(object = null, x = game.u.ux, y = game.u.uy, quietly = false, { state = game, announce = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    let monster = null;
    for (let attempts = 100; attempts > 0; attempts--) {
        const species = familiarSpecies(object, state);
        if (species == null) {
            if (!quietly)
                await announce(object
                    ? '... into a pile of dust.'
                    : 'There seems to be nothing available for a familiar.');
            break;
        }
        let flags = MM_EDOG | MM_IGNOREWATER | NO_MINVENT | MM_NOMSG;
        const gender = object ? (object.spe ?? 0) & 3 : 0;
        if (gender === 1)
            flags |= MM_FEMALE;
        else if (gender === 2)
            flags |= MM_MALE;
        monster =
            x === state.u.ux && y === state.u.uy
                ? await makemonNear(species, x, y, flags, true)
                : await makemonAt(species, x, y, flags);
        if (monster || object) {
            if (!monster && !quietly)
                await announce('The figurine writhes and then shatters into pieces!');
            break;
        }
    }
    if (!monster)
        return null;
    monster.mtame ??= 0;
    monster.pet = false;
    if (object && monster.isminion) {
        monster.isminion = 0;
        delete monster.emin;
        if (monster.mextra)
            delete monster.mextra.emin;
    }
    if (isPoolAt(monster.mx, monster.my, state)) {
        const result = await resolveMonsterLiquid(monster, state, {
            announce,
            finishDeath: finishLiquidDeathForCurrentMover,
            monsterMoving: !!state.context.mon_moving,
        });
        if (result?.dead)
            return null;
    }
    let tame = true;
    if (object) {
        let disposition = rn2(10);
        if (disposition > 2)
            disposition = object.blessed ? 0 : !object.cursed ? 1 : 2;
        tame = disposition === 0;
        if (disposition === 2) {
            if (!quietly)
                await announce('You get a bad feeling about this.');
            monster.mpeaceful = 0;
            setMonsterMalign(monster, state);
        }
        const name = object.oextra?.oname || object.oname;
        if (name)
            setMonsterGivenName(monster, name);
    }
    if (tame)
        initializePet(monster, { state, everything: true });
    monster.msleeping = 0;
    setMonsterMalign(monster, state);
    newsym(monster.mx, monster.my);
    if (monster.mtame && MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum)) {
        monster.weaponCheck = NEED_HTH_WEAPON;
        await wieldMonsterWeapon(monster, state, { publish: announce });
    }
    return monster;
}
//# sourceMappingURL=familiar.js.map