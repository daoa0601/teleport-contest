import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { PlayingGameState } from './game_state.js';
import type { PotionEffectOptions } from './potion_types.js';
// C potion.c:ghost_from_bottle(), djinni_from_bottle(), mongrantswish().
import { G_GONE, MM_NOMSG } from './const.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import {
    canSpotMonster, newsym, plineWithContinuation as pline,
    randomDisplayMonsterName, show_glyph_cell,
} from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { makemonNear } from './mklev.js';
import { MONSTER_NAME } from './monster_data.js';
import { removeMonsterFromGame, removeWishGrantingMonster } from './monster_departure.js';
import { setMonsterMalign } from './monster_alignment.js';
import { monsterName } from './monster_name.js';
import { tameMonster } from './monster_taming.js';
import { OBJECT_DESCRIPTIONS } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { makeWish } from './wish.js';

const PM_GHOST = MONSTER_NAME.indexOf('ghost');
const PM_DJINNI = MONSTER_NAME.indexOf('djinni');

export async function releasePotionOccupant(source: GameObject, { state = game }: PotionEffectOptions = {}): Promise<{ released: boolean; heroDied: boolean }> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const appearance = state.objectDescriptions?.[source.otyp]
        ?? OBJECT_DESCRIPTIONS[source.otyp];
    const species = appearance === 'milky' ? PM_GHOST
        : appearance === 'smoky' ? PM_DJINNI : null;
    if (species === null || ((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE)
        || rn2(13 + 2 * (state.mvitals?.[species]?.born ?? 0)))
        return { released: false, heroDied: false };

    if (species === PM_GHOST) await releaseGhost(state);
    else await releaseDjinni(source, state);
    return { released: true, heroDied: !!state.program_state?.gameover };
}

async function releaseGhost(state: PlayingGameState) {
    const monster = await makemonNear(PM_GHOST, state.u.ux, state.u.uy, MM_NOMSG);
    if (!monster) {
        await pline('This bottle turns out to be empty.');
        return;
    }
    if (heroIsBlind(state)) {
        await pline('As you open the bottle, something emerges.');
        return;
    }
    const name = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'ghost';
    await pline(`As you open the bottle, an enormous ${name} emerges!`);
    if (state.flags.verbose) await pline('You are frightened to death, and unable to move.');
    endVoluntaryMultiTurn(state);
    state._helplessTurns = Math.max(state._helplessTurns ?? 0, 3);
    state._helplessReason = 'being frightened to death';
    state._helplessDoneMessage = 'You regain your composure.';
}

async function releaseDjinni(source: GameObject, state: PlayingGameState) {
    const monster = await makemonNear(PM_DJINNI, state.u.ux, state.u.uy, MM_NOMSG);
    if (!monster) {
        await pline('It turns out to be empty.');
        return;
    }
    if (heroIsBlind(state)) {
        await pline('You smell acrid fumes.');
        await pline('Something speaks.');
    } else {
        await pline(`In a cloud of smoke, ${monsterName(monster, { article: 'a', state })} emerges!`);
        await pline(`${monsterName(monster, { capitalized: true, state })} speaks.`);
    }

    let chance = rn2(5);
    if (source.blessed) chance = chance === 4 ? rnd(4) : 0;
    else if (source.cursed) chance = chance === 0 ? rn2(4) : 4;
    switch (chance) {
    case 0:
        await pline('"I am in your debt.  I will grant one wish!"');
        await grantMonsterWish(monster, { state });
        break;
    case 1:
        await pline('"Thank you for freeing me!"');
        await tameMonster(monster, null, { state });
        break;
    case 2:
        await pline('"You freed me!"');
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        break;
    case 3:
        await pline('"It is about time!"');
        if (canSpotMonster(monster))
            await pline(`${monsterName(monster, { capitalized: true, state })} vanishes.`);
        await removeMonsterFromGame(monster);
        break;
    default:
        await pline('"You disturbed me, fool!"');
        monster.mpeaceful = 0;
        setMonsterMalign(monster, state);
        break;
    }
}

export async function grantMonsterWish(monster: Monster, {
    state = game, announce = false,
}: PotionEffectOptions & { announce?: boolean } = {}): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { mx, my } = monster;
    const spentTime = state.context.move;
    const square = state.level.at(mx, my);
    const projection = square ? {
        ch: square.disp_ch ?? ' ', color: square.disp_color,
        decgfx: square.disp_decgfx, attr: square.disp_attr,
        glyph: square.disp_glyph ?? null,
    } : null;
    // Remove before wishing so an artifact-fatal wish cannot put the donor
    // in bones. Keep its last map projection visible until the prompt ends.
    await removeWishGrantingMonster(monster);
    if (state.program_state.gameover) return;
    if (projection)
        show_glyph_cell(mx, my, projection.ch, projection.color,
            projection.decgfx, projection.attr, projection.glyph);
    try {
        await makeWish({ announce });
    } finally {
        state.context.move = spentTime;
        newsym(mx, my);
    }
}
