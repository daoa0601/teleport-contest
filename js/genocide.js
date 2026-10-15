// C read.c:do_genocide() and do_class_genocide().
import { formatFeltMessage } from './hero_speech.js';
import { adjustHeroAlignment } from './alignment.js';
import { G_EXTINCT, G_GENOD, G_NOCORPSE, MM_NOMSG, NO_MINVENT, POLY_REVERT, Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { listGenocided, finishHeroDeath as finishNativeHeroDeath } from './end.js';
import { recordGameLogEvent } from './gamelog.js';
import { game, requireInitializedGame } from './gstate.js';
import { feelingAfterSelfGenocide, genocideDeathOptions, rememberPolymorphGenocide, } from './hero_genocide.js';
import { heroSpecies } from './hero_species.js';
import { killGenocidedMonsters } from './mon.js';
import { MONSTER_CLASS_SYMBOLS, nameToMonster, nameToMonsterClass } from './mondata.js';
import { makemonNear, rndmonstAdj } from './mklev.js';
import { MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL, monsterIsHuman, monsterIsVampire, monsterTypeName, requireMonsterData, } from './monster_data.js';
import { removeMonsterFromGame } from './monster_departure.js';
import { makePlural, withIndefiniteArticle } from './object_grammar.js';
import { heroIsUnchanging, polymorphHero, returnHeroToHumanForm } from './polyself.js';
import { getLine } from './query.js';
import { rn1 } from './rng.js';
import { heroIsDeaf, heroIsHallucinating } from './senses.js';
const GENOCIDE_REALLY = 1, GENOCIDE_PLAYER = 2;
export const GENOCIDE_ON_THRONE = 4;
const G_GENO = 0x0020, G_UNIQ = 0x1000;
const M2_DEMON = 0x00000100, M2_PNAME = 0x00080000;
const MS_LEADER = 36, MS_NEMESIS = 37, MS_GUARDIAN = 38;
const S_INVISIBLE = 35;
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const PM_NINJA = MONSTER_NAME.indexOf('ninja');
export async function doGenocide(how, { finishHeroDeath = finishNativeHeroDeath, } = {}) {
    const state = requireInitializedGame();
    const really = !!(how & GENOCIDE_REALLY);
    const playerSelected = !!(how & GENOCIDE_PLAYER);
    const species = playerSelected ? state.u.umonster : await requestGenocideSpecies(really);
    if (state.program_state.gameover)
        return true;
    if (species === null)
        return false;
    const presentation = genocidePresentation(species);
    if (!really)
        return sendInMonsters(species, presentation.name);
    const firstGenocide = !MONSTER_NAME.some((_, index) => speciesWasGenocided(index));
    const realName = makePlural(requireMonsterData(MONSTER_NAME, species));
    recordGameLogEvent(firstGenocide
        ? `performed ${state.flags.female ? 'her' : 'his'} first genocide (${realName})`
        : `genocided ${realName}`, { state });
    recordGenocide(species);
    await plineWithContinuation(`Wiped out ${presentation.prefix}${presentation.prefix === 'all ' ? makePlural(presentation.name) : presentation.name}.`);
    const killPlayer = playerSelected || heroOwnSpecies(species)
        || heroIsUnchanging(state) && species === heroSpecies(state);
    if (killPlayer) {
        state.u.uhp = -1;
        const cause = playerSelected ? 'confusion'
            : how & GENOCIDE_ON_THRONE ? 'throne' : 'scroll';
        if (Upolyd(state.u) && species !== heroSpecies(state)) {
            rememberPolymorphGenocide(cause, state);
            await plineWithContinuation(formatFeltMessage(`${feelingAfterSelfGenocide(state)} inside.`, state));
        }
        else {
            await finishHeroDeath(genocideDeathOptions(cause));
            if (state.program_state.gameover)
                return true;
        }
    }
    else if (species === heroSpecies(state)) {
        const outcome = await returnHeroToHumanForm(state, { die: finishHeroDeath });
        if (outcome.died || state.program_state.gameover)
            return true;
    }
    await killGenocidedMonsters();
    return true;
}
export async function doClassGenocide({ finishHeroDeath = finishNativeHeroDeath, } = {}) {
    const state = requireInitializedGame();
    const monsterClass = await requestGenocideClass();
    if (monsterClass === null)
        return false;
    let doomed = false;
    let feltDead = false;
    let loggedClass = false;
    for (let species = 0; species < MONSTER_NAME.length; species++) {
        if (MONSTER_SYMBOL[species] !== monsterClass)
            continue;
        const name = requireMonsterData(MONSTER_NAME, species);
        const plural = makePlural(name);
        if (heroOwnSpecies(species)
            || ((MONSTER_GENO[species] ?? 0) & G_GENO) && !speciesWasGenocided(species)) {
            if (!loggedClass) {
                const symbol = MONSTER_CLASS_SYMBOLS[monsterClass];
                if (!symbol)
                    throw new RangeError(`Genocide class ${monsterClass} has no symbol`);
                const firstGenocide = !MONSTER_NAME.some((_, index) => speciesWasGenocided(index));
                recordGameLogEvent(firstGenocide
                    ? `performed ${state.flags.female ? 'her' : 'his'} first genocide (class ${symbol})`
                    : `genocided class ${symbol}`, { state });
                loggedClass = true;
            }
            recordGenocide(species);
            const removal = await killGenocidedMonsters();
            if (removal.heroDied || state.program_state.gameover)
                return true;
            await plineWithContinuation(`Wiped out all ${plural}.`);
            await revertTargetedVampireForm(species);
            if (state.program_state.gameover)
                return true;
            if (Upolyd(state.u) && species === state.u.umonnum) {
                state.u.mh = -1;
                if (heroIsUnchanging(state)) {
                    if (!feltDead)
                        await plineWithContinuation('You die.', { urgent: true });
                    feltDead = true;
                    doomed = true;
                }
                else {
                    const outcome = await returnHeroToHumanForm(state, { die: finishHeroDeath });
                    if (outcome.died || state.program_state.gameover)
                        return true;
                }
            }
            if (heroOwnSpecies(species)) {
                state.u.uhp = -1;
                if (Upolyd(state.u)) {
                    if (!feltDead)
                        await plineWithContinuation(formatFeltMessage(`${feelingAfterSelfGenocide(state)} inside.`, state));
                }
                else {
                    if (!feltDead)
                        await plineWithContinuation('You die.', { urgent: true });
                    doomed = true;
                }
                feltDead = true;
            }
        }
        else if (!doomed && speciesWasGenocided(species)) {
            await plineWithContinuation(`${capitalize(plural)} are already nonexistent.`);
        }
        else if (!doomed && canAnnounceImmuneSpecies(species)) {
            const named = !!((MONSTER_FLAGS2[species] ?? 0) & M2_PNAME);
            const unique = !!((MONSTER_GENO[species] ?? 0) & G_UNIQ) && species !== PM_HIGH_CLERIC;
            await plineWithContinuation(`You aren't permitted to genocide ${unique && !named ? 'the ' : ''}${unique || named ? name : plural}.`);
        }
    }
    // Unlike single-species genocide, C does not install a delayed killer here.
    if (doomed)
        await finishHeroDeath(genocideDeathOptions('scroll'));
    return true;
}
function heroOwnSpecies(species) {
    const state = requireInitializedGame();
    return species === state.u.umonster || species === state.urace.mnum;
}
function genocideVital(species) {
    const vital = game.mvitals?.[species];
    if (!vital)
        throw new Error(`Genocide requires initialized history for species ${species}`);
    return vital;
}
function speciesWasGenocided(species) {
    return !!(genocideVital(species).mvflags & G_GENOD);
}
function recordGenocide(species) {
    const state = requireInitializedGame();
    const vital = genocideVital(species);
    const alreadyGenocided = !!(vital.mvflags & G_GENOD);
    vital.mvflags |= G_GENOD | G_NOCORPSE;
    if (alreadyGenocided)
        return;
    state.u.uconduct.genocides = (state.u.uconduct.genocides ?? 0) + 1;
}
function genocidePresentation(species) {
    const state = requireInitializedGame();
    if (heroIsHallucinating(state)) {
        const role = state.flags.female && state.urole.name.f
            ? state.urole.name.f : state.urole.name.m;
        const name = Upolyd(state.u) ? monsterTypeName(heroSpecies(state), !!state.flags.female)
            : role.charAt(0).toLowerCase() + role.slice(1);
        return { name, prefix: 'all ' };
    }
    const unique = !!((MONSTER_GENO[species] ?? 0) & G_UNIQ) && species !== PM_HIGH_CLERIC;
    const named = !!((MONSTER_FLAGS2[species] ?? 0) & M2_PNAME);
    return { name: requireMonsterData(MONSTER_NAME, species), prefix: unique ? named ? '' : 'the ' : 'all ' };
}
async function revertTargetedVampireForm(species) {
    const state = requireInitializedGame();
    const base = state.u.mcham;
    if (Upolyd(state.u) && base !== undefined && monsterIsVampire(base)
        && !monsterIsVampire(state.u.umonnum)
        && (species === state.u.umonnum || species === base))
        await polymorphHero(POLY_REVERT);
}
async function sendInMonsters(species, name) {
    const state = requireInitializedGame();
    const census = () => state.level.monsters.filter(monster => monster.mhp > 0 && !(monster.isgd && monster.mx === 0)).length;
    const before = census();
    let created = 0;
    if (!((MONSTER_GENO[species] ?? 0) & G_UNIQ)
        && !(genocideVital(species).mvflags & (G_GENOD | G_EXTINCT))) {
        for (let count = rn1(3, 4); count > 0; count--) {
            const monster = await makemonNear(species, state.u.ux, state.u.uy, NO_MINVENT | MM_NOMSG);
            if (!monster)
                break;
            created++;
            if (genocideVital(species).mvflags & G_EXTINCT)
                break;
        }
    }
    if (created) {
        const total = census() - before;
        const subject = total > 1 ? `some ${makePlural(name)}` : withIndefiniteArticle(name);
        await plineWithContinuation(`Sent in ${subject}.`);
    }
    else {
        await plineWithContinuation('Nothing happens.');
    }
    return true;
}
async function requestGenocideSpecies(really) {
    const state = requireInitializedGame();
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await genocideInput('species', attempt);
        if (!response) {
            await plineWithContinuation(attempt < 4
                ? "Type the name of a type of monster or 'none'." : 'No type of monster specified.');
            continue;
        }
        if (declinedGenocide(response)) {
            const species = really ? null : rndmonstAdj();
            if (species !== null)
                return species;
            recordGameLogEvent('declined to perform genocide', { state });
            return null;
        }
        if (response === '?' || response === "'?'") {
            await listGenocided('g');
            attempt--;
            continue;
        }
        const species = nameToMonster(response);
        if (species < 0 || speciesWasGenocided(species)) {
            await plineWithContinuation(`Such creatures ${species < 0 ? 'do not' : 'no longer'} exist in this world.`);
            continue;
        }
        await revertTargetedVampireForm(species);
        if (state.program_state.gameover)
            return null;
        if (heroOwnSpecies(species))
            return species;
        if (monsterIsHuman(species))
            adjustHeroAlignment(-Math.sign(state.u.ualign.type), state);
        if ((MONSTER_FLAGS2[species] ?? 0) & M2_DEMON)
            adjustHeroAlignment(Math.sign(state.u.ualign.type), state);
        if (!((MONSTER_GENO[species] ?? 0) & G_GENO)) {
            if (!heroIsDeaf(state)) {
                if (state.flags.verbose)
                    await plineWithContinuation('A thunderous voice booms through the caverns:');
                await plineWithContinuation('"No, mortal!  That will not be done."');
            }
            continue;
        }
        return species;
    }
    if (!really) {
        const species = rndmonstAdj();
        if (species !== null)
            return species;
    }
    await plineWithContinuation("That's enough tries!");
    return null;
}
async function requestGenocideClass() {
    const state = requireInitializedGame();
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await genocideInput('class', attempt);
        if (!response) {
            await plineWithContinuation(attempt < 4
                ? "Type letter (or punctuation) or name used for a class of monsters or 'none'."
                : 'No class of monsters specified.');
            continue;
        }
        if (declinedGenocide(response)) {
            recordGameLogEvent('declined to perform class genocide', { state });
            return null;
        }
        if (response === '?' || response === "'?'") {
            await listGenocided('g');
            attempt--;
            continue;
        }
        const monsterClass = nameToMonsterClass(response);
        let immune = 0, gone = 0, available = 0;
        for (let species = 0; species < MONSTER_NAME.length; species++) {
            if (MONSTER_SYMBOL[species] !== monsterClass)
                continue;
            if (!((MONSTER_GENO[species] ?? 0) & G_GENO))
                immune++;
            else if (speciesWasGenocided(species))
                gone++;
            else
                available++;
        }
        if (available || monsterClass === MONSTER_SYMBOL[state.u.umonster]
            || monsterClass === MONSTER_SYMBOL[state.urace.mnum])
            return monsterClass;
        if (gone)
            await plineWithContinuation('All such monsters are already nonexistent.');
        else if (immune || monsterClass === S_INVISIBLE)
            await plineWithContinuation("You aren't permitted to genocide such monsters.");
        else if (state.flags.debug && response.startsWith('*')) {
            let removed = 0;
            for (const monster of [...state.level.monsters].reverse()) {
                if (monster.mhp <= 0)
                    continue;
                await removeMonsterFromGame(monster);
                removed++;
                if (state.program_state.gameover)
                    return null;
            }
            await plineWithContinuation(`Eliminated ${removed} monster${removed === 1 ? '' : 's'}.`);
            return null;
        }
        else {
            await plineWithContinuation(`That ${response.length === 1 ? 'symbol' : 'response'} does not represent any monster.`);
        }
    }
    await plineWithContinuation("That's enough tries!");
    return null;
}
async function genocideInput(kind, attempt) {
    const state = requireInitializedGame();
    const subject = kind === 'class' ? 'class of monsters' : 'type of monster';
    const assisted = kind === 'class' ? "the symbol or name representing a class, or '?'"
        : "the name of a type of monster, or '?'";
    const suffix = attempt ? ` [enter ${(state.flags.cmdassist ?? true) ? assisted : "'?' to see previous genocides"}]` : '';
    const response = await getLine(`What ${subject} do you want to genocide?${suffix}`, (_ch, key) => key >= 32 && key < 127);
    return response === null ? '\u001b' : response.trim().replace(/\s+/g, ' ');
}
function declinedGenocide(response) {
    return response.startsWith('\u001b') || ['none', "'none'", 'nothing'].includes(response.toLowerCase());
}
function canAnnounceImmuneSpecies(species) {
    const role = requireInitializedGame().urole;
    const sound = MONSTER_SOUND[species];
    return (sound !== MS_LEADER || species === role.ldrnum)
        && (sound !== MS_NEMESIS || species === role.neminum)
        && (sound !== MS_GUARDIAN || species === role.guardnum)
        && (species !== PM_NINJA || role.key === 'samurai');
}
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
//# sourceMappingURL=genocide.js.map