// Genocide selection and effects.
// C ref: read.c do_genocide() and do_class_genocide().

import {
    G_GENOD, G_NOCORPSE, MM_NOMSG, NO_MINVENT,
} from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { killGenocidedMonsters } from './mon.js';
import {
    makemonNear, rndmonnum,
} from './mklev.js';
import {
    MONSTER_FLAGS2, MONSTER_GENO, MONSTER_NAME, MONSTER_SYMBOL,
    monsterIsHuman,
} from './monster_data.js';
import { nameToMonster, nameToMonsterClass } from './mondata.js';
import { makePlural } from './object_grammar.js';
import { returnHeroToHumanForm } from './polyself.js';
import { getLine } from './query.js';
import { rn1 } from './rng.js';

const GENOCIDE_REALLY = 1;
const GENOCIDE_PLAYER = 2;
export const GENOCIDE_ON_THRONE = 4;
const G_GENO = 0x0020;
const G_UNIQ = 0x1000;
const M2_DEMON = 0x00000100;
function heroRoleMonster() {
    if (Number.isInteger(game.u?.umonster)) return game.u.umonster;
    return nameToMonster(game.urole?.key || game.urole?.name || '');
}

function heroRaceMonster() {
    const raceNumber = game.urace?.mnum;
    if (Number.isInteger(raceNumber)) return raceNumber;
    return nameToMonster(game.urace?.noun || game.urace?.name || 'human');
}

function heroOwnSpecies(mnum) {
    return mnum === heroRoleMonster() || mnum === heroRaceMonster();
}

function genocideVital(mnum) {
    if (!Array.isArray(game.mvitals)) game.mvitals = [];
    return game.mvitals[mnum]
        || (game.mvitals[mnum] = { mvflags: 0, born: 0 });
}

function speciesWasGenocided(mnum) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD);
}

function genocideDisplayName(mnum) {
    const hallucinating = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0;
    if (!hallucinating) return MONSTER_NAME[mnum] || 'monster';
    const polymorphed = Number.isInteger(game.u?.umonnum)
        && Number.isInteger(game.u?.umonster)
        && game.u.umonnum !== game.u.umonster;
    if (polymorphed)
        return MONSTER_NAME[game.u.umonnum] || 'monster';
    return String(game.urole?.name?.m || game.urole?.key || 'adventurer')
        .toLowerCase();
}

function recordGenocide(mnum) {
    const vital = genocideVital(mnum);
    if (vital.mvflags & G_GENOD) return false;
    vital.mvflags = (vital.mvflags ?? 0) | G_GENOD | G_NOCORPSE;
    if (!game.u.uconduct) game.u.uconduct = {};
    game.u.uconduct.genocides = (game.u.uconduct.genocides ?? 0) + 1;
    if (!Array.isArray(game._genocidedMonsters))
        game._genocidedMonsters = [];
    const name = makePlural(MONSTER_NAME[mnum] || 'monster');
    if (!game._genocidedMonsters.includes(name))
        game._genocidedMonsters.push(name);
    return true;
}

async function listGenocidedSpecies() {
    const names = [];
    for (let mnum = 0; mnum < MONSTER_NAME.length; mnum++) {
        if (speciesWasGenocided(mnum))
            names.push(makePlural(MONSTER_NAME[mnum]));
    }
    if (!names.length) {
        await plineWithContinuation('No creatures have been genocided.');
        return;
    }
    await plineWithContinuation(`Genocided species: ${names.join(', ')}.`);
}

function declinedGenocide(response) {
    const answer = String(response || '').trim().toLowerCase();
    return response == null || ['none', "'none'", 'nothing'].includes(answer);
}

async function requestGenocideClass() {
    let attempt = 0;
    while (attempt < 5) {
        const suffix = attempt
            ? " [enter the symbol or name representing a class, or '?']"
            : '';
        const response = await getLine(
            `What class of monsters do you want to genocide?${suffix}`,
            (_ch, key) => key >= 32 && key < 127,
        );
        const answer = String(response || '').trim();
        if (declinedGenocide(response)) return 0;
        if (answer === '?' || answer === "'?'") {
            await listGenocidedSpecies();
            continue;
        }
        attempt++;
        if (!answer) {
            await plineWithContinuation(attempt < 5
                ? "Type a monster-class name or symbol, or 'none'."
                : 'No class of monsters specified.');
            continue;
        }
        const monsterClass = nameToMonsterClass(answer);
        if (monsterClass) return monsterClass;
        await plineWithContinuation(
            `That ${answer.length === 1 ? 'symbol' : 'response'} does not represent any monster.`,
        );
    }
    await plineWithContinuation("That's enough tries!");
    return 0;
}

async function finishGenocidedHero(mnum, killer, finishHeroDeath) {
    const u = game.u;
    const polymorphed = Number.isInteger(u?.umonnum)
        && Number.isInteger(u?.umonster) && u.umonnum !== u.umonster;
    const ownBaseSpecies = heroOwnSpecies(mnum);
    const currentSpecies = u?.umonnum;
    if (ownBaseSpecies) u.uhp = -1;

    if (polymorphed && currentSpecies === mnum
        && !(u.unchanging || game.unchanging)) {
        await returnHeroToHumanForm(game, { die: finishHeroDeath });
        return;
    } else if (polymorphed && ownBaseSpecies && currentSpecies !== mnum) {
        await plineWithContinuation('You feel dead inside.');
        return;
    }

    if (!finishHeroDeath)
        throw new TypeError('self-genocide needs a hero death handler');
    await finishHeroDeath({
        killer,
        deathCause: `genocided by ${killer}`,
    });
}

async function applySpeciesGenocide(mnum, {
    killer = 'scroll of genocide', finishHeroDeath,
} = {}) {
    const ownSpecies = heroOwnSpecies(mnum);
    const currentSpecies = game.u?.umonnum;
    const killsCurrentForm = currentSpecies === mnum
        && (game.u?.unchanging || game.unchanging);
    recordGenocide(mnum);
    const flags = MONSTER_GENO[mnum] ?? 0;
    const name = genocideDisplayName(mnum);
    const prefix = (flags & G_UNIQ) ? 'the ' : 'all ';
    await plineWithContinuation(
        `Wiped out ${prefix}${prefix === 'all ' ? makePlural(name) : name}.`,
    );
    if (ownSpecies || killsCurrentForm) {
        await finishGenocidedHero(mnum, killer, finishHeroDeath);
    } else if (currentSpecies === mnum) {
        await returnHeroToHumanForm(game, { die: finishHeroDeath });
    }
    await killGenocidedMonsters();
}

export async function doClassGenocide({ finishHeroDeath } = {}) {
    const monsterClass = await requestGenocideClass();
    if (!monsterClass) return false;
    const members = MONSTER_SYMBOL.map((symbol, mnum) => ({ symbol, mnum }))
        .filter(candidate => candidate.symbol === monsterClass);
    const available = members.filter(({ mnum }) =>
        heroOwnSpecies(mnum)
        || ((MONSTER_GENO[mnum] ?? 0) & G_GENO)
            && !speciesWasGenocided(mnum));
    if (!available.length) {
        const alreadyGone = members.some(({ mnum }) =>
            speciesWasGenocided(mnum));
        await plineWithContinuation(alreadyGone
            ? 'All such monsters are already nonexistent.'
            : "You aren't permitted to genocide such monsters.");
        return false;
    }

    let heroTarget = null;
    for (const { mnum } of members) {
        const name = MONSTER_NAME[mnum] || 'monster';
        if (heroOwnSpecies(mnum)
            || ((MONSTER_GENO[mnum] ?? 0) & G_GENO)
                && !speciesWasGenocided(mnum)) {
            recordGenocide(mnum);
            await killGenocidedMonsters();
            await plineWithContinuation(
                `Wiped out all ${makePlural(name)}.`,
            );
            if (heroOwnSpecies(mnum)) heroTarget = mnum;
            else if (game.u?.umonnum === mnum) {
                const cannotChange = game.u?.unchanging || game.unchanging;
                if (cannotChange && heroTarget == null) heroTarget = mnum;
                else if (!cannotChange) {
                    await finishGenocidedHero(
                        mnum, 'scroll of genocide', finishHeroDeath,
                    );
                }
            }
        } else if (speciesWasGenocided(mnum)) {
            await plineWithContinuation(
                `${makePlural(name)} are already nonexistent.`,
            );
        } else {
            await plineWithContinuation(
                `You aren't permitted to genocide ${makePlural(name)}.`,
            );
        }
    }
    if (heroTarget != null)
        await finishGenocidedHero(
            heroTarget, 'scroll of genocide', finishHeroDeath,
        );
    return true;
}

async function requestGenocideSpecies(really) {
    let attempt = 0;
    while (attempt < 5) {
        const suffix = attempt
            ? " [enter the name of a type of monster, or '?']" : '';
        const response = await getLine(
            `What type of monster do you want to genocide?${suffix}`,
            (_ch, key) => key >= 32 && key < 127,
        );
        const answer = String(response || '').trim();
        if (declinedGenocide(response))
            return really ? -1 : rndmonnum();
        if (answer === '?' || answer === "'?'") {
            await listGenocidedSpecies();
            continue;
        }
        attempt++;
        if (!answer) {
            await plineWithContinuation(attempt < 5
                ? "Type the name of a monster or 'none'."
                : 'No type of monster specified.');
            continue;
        }
        const mnum = nameToMonster(answer);
        if (mnum < 0 || speciesWasGenocided(mnum)) {
            await plineWithContinuation(
                `Such creatures ${mnum < 0 ? 'do not' : 'no longer'} exist in this world.`,
            );
            continue;
        }
        if (heroOwnSpecies(mnum)) return mnum;
        const alignment = game.u?.ualign?.type ?? 0;
        if (monsterIsHuman(mnum))
            game.u.ualign.record = (game.u.ualign.record ?? 0)
                - Math.sign(alignment);
        if ((MONSTER_FLAGS2[mnum] ?? 0) & M2_DEMON)
            game.u.ualign.record = (game.u.ualign.record ?? 0)
                + Math.sign(alignment);
        if (!((MONSTER_GENO[mnum] ?? 0) & G_GENO)) {
            if (!(game.deaf || game.u?.deaf)) {
                await plineWithContinuation(
                    'A thunderous voice booms through the caverns: '
                    + '"No, mortal!  That will not be done."',
                );
            }
            continue;
        }
        return mnum;
    }
    if (!really) return rndmonnum();
    await plineWithContinuation("That's enough tries!");
    return -1;
}

export async function doGenocide(how, { finishHeroDeath } = {}) {
    const really = !!(how & GENOCIDE_REALLY);
    const playerSelected = !!(how & GENOCIDE_PLAYER);
    const mnum = playerSelected
        ? heroRoleMonster() : await requestGenocideSpecies(really);
    if (mnum < 0) return false;

    if (really) {
        const killer = playerSelected ? 'genocidal confusion'
            : (how & GENOCIDE_ON_THRONE) ? 'imperious order'
                : 'scroll of genocide';
        await applySpeciesGenocide(mnum, { killer, finishHeroDeath });
        return true;
    }

    const before = game.level?.monsters?.length ?? 0;
    for (let count = rn1(3, 4); count > 0; count--) {
        const monster = await makemonNear(
            mnum, game.u.ux, game.u.uy, NO_MINVENT | MM_NOMSG,
        );
        if (!monster) break;
    }
    const created = (game.level?.monsters?.length ?? 0) - before;
    const name = genocideDisplayName(mnum);
    if (created) {
        const subject = created > 1
            ? `some ${makePlural(name)}`
            : `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
        await plineWithContinuation(`Sent in ${subject}.`);
    } else {
        await plineWithContinuation('Nothing happens.');
    }
    return true;
}
