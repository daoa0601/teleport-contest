// C dokick.c:dokick(): refusals precede the direction prompt.
import { displayMessageWindow, plineWithContinuation as pline } from './display.js';
import { resetCommandVariables } from './command_state.js';
import { game, requirePlayingGame } from './gstate.js';
import { heroLegName } from './body_parts.js';
import { IS_DOOR, IS_OBSTRUCTED, Is_airlevel, TT_BEARTRAP, TT_PIT, TT_WEB } from './const.js';
import { heroPassesWalls, heroSpecies } from './hero_species.js';
import { MONSTER_FLAGS1, MONSTER_SIZE, MONSTER_SYMBOL, monsterDigests } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { BOULDER } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { promptYesNo } from './query.js';
import { rn2 } from './rng.js';
import { strikeSteed } from './steed.js';
import { nearCapacity, SLT_ENCUMBER } from './weight.js';

export async function admitHeroKick(): Promise<boolean> {
    requirePlayingGame(game);
    const hero = game.u;
    const species = heroSpecies();
    const flags = MONSTER_FLAGS1[species] ?? 0;
    let refusal: string | null = null;
    if ((flags & 0x00006000) === 0x00006000 || (flags & 0x00080000)) {
        refusal = 'You have no legs to kick with.';
    } else if ((MONSTER_SIZE[species] ?? 2) < 1) {
        refusal = 'You are too small to do any kicking.';
    } else if (hero.usteed) {
        if (await promptYesNo('Kick your steed?', 'y') === 'y') {
            await pline(`You kick ${monsterName(hero.usteed)}.`);
            await strikeSteed({ announce: pline });
            game.context.move = 1;
        } else game.context.move = 0;
        return false;
    } else if ((hero._woundedLegTurns ?? 0) > 0) {
        const side = hero._woundedLegSide;
        const leg = heroLegName();
        refusal = `Your ${side === 'both' ? makePlural(leg)
            : `${side || 'right'} ${leg}`} ${side === 'both' ? 'are' : 'is'} in no shape for kicking.`;
    } else if (nearCapacity(game) > SLT_ENCUMBER) {
        refusal = 'Your load is too heavy to balance yourself for a kick.';
    } else if (MONSTER_SYMBOL[species] === 58) { // S_LIZARD
        refusal = 'Your legs cannot kick effectively.';
    } else if (hero.uinwater && rn2(2) === 0) {
        refusal = "Your slow motion kick doesn't hit anything.";
    } else if (hero.utrap) {
        if (hero.utraptype === TT_PIT && heroPassesWalls()) return true;
        if (hero.utraptype === TT_PIT)
            refusal = "There's not enough room to kick down here.";
        else if (hero.utraptype === TT_WEB || hero.utraptype === TT_BEARTRAP)
            refusal = `You can't move your ${heroLegName()}!`;
        // Other restraints silently prevent the command as well.
        if (refusal) await pline(refusal);
        await displayMessageWindow();
        resetCommandVariables(true);
        return false;
    } else if (!heroPassesWalls()
        && game.level.objects[hero.ux]?.[hero.uy]?.some(object => object.otyp === BOULDER)) {
        refusal = "There's not enough room to kick in here.";
    }
    if (!refusal) return true;
    await pline(refusal);
    await displayMessageWindow();
    resetCommandVariables(true);
    return false;
}

// These checks use the chosen direction but do not reach the target square.
export async function kickCanReachTarget(): Promise<boolean> {
    requirePlayingGame(game);
    const hero = game.u;
    if (hero.uswallow) {
        const outcome = rn2(3);
        if (outcome === 0) await pline(`You can't move your ${heroLegName()}!`);
        else if (outcome === 1 && monsterDigests(hero.ustuck)) {
            if (!hero.ustuck) throw new Error('A swallowed kick requires its engulfer.');
            const name = monsterName(hero.ustuck);
            await pline(`${name.charAt(0).toUpperCase() + name.slice(1)} burps loudly.`);
        } else await pline('Your feeble kick has no effect.');
        game.context.move = 1;
        return false;
    }
    if (hero.utrap && hero.utraptype === TT_PIT) {
        await pline('You kick at the side of the pit.');
        game.context.move = 1;
        return false;
    }
    if (hero.levitating) {
        const x = hero.ux - (hero.dx ?? 0), y = hero.uy - (hero.dy ?? 0);
        const location = game.level.at(x, y);
        if (location && !IS_OBSTRUCTED(location.typ) && !IS_DOOR(location.typ)
            && (!Is_airlevel(hero.uz) || !game.level.objects[x]?.[y]?.length)) {
            await pline('You have nothing to brace yourself against.');
            game.context.move = 0;
            return false;
        }
    }
    return true;
}
