// Hero alignment record changes.
// C ref: attrib.c adjalign().

import { game, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { AlignmentValue, Role } from './roles.js';
import { rn1, rn2, rn2Display } from './rng.js';
import { nativeRoleAt, roles } from './roles.js';
import { heroIsHallucinating } from './senses.js';
import { A_NONE, G_GONE, Is_astralevel, MM_ADJACENTOK, MM_NOWAIT } from './const.js';
import { plineWithContinuation } from './display.js';
import { recordGameLogEvent } from './gamelog.js';
import { retouchEquipment } from './hero_retouch.js';
import { makeConfused } from './hero_mental_status.js';
import { makemonAt } from './mklev.js';
import { adjustErinys, MONSTER_NAME } from './monster_data.js';
import { HELM_OF_OPPOSITE_ALIGNMENT } from './object_data.js';

export function deityName(alignment: number, state: GameState = game): string {
    if (alignment === A_NONE) return 'Moloch';
    const key = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    return state.urole?.gods?.[key] || 'your god';
}

// C pray.c:halu_gname(). Both selection steps use the display RNG.
const HALLUCINATED_GODS = [
    'the Flying Spaghetti Monster', 'Eris', 'the Martians', 'Xom',
    'AnDoR dRaKoN', 'the Central Bank of Yendor', 'Tooth Fairy', 'Om',
    'Yawgmoth', 'Morgoth', 'Cthulhu', 'the Ori', 'destiny',
    'your Friend the Computer',
];

export function hallucinatedDeityName(
    alignment: number, state: GameState = game, hallucinating = heroIsHallucinating(state),
) {
    requireLiveGame(state);
    if (!hallucinating) return deityName(alignment, state);
    if (!state.urole) throw new Error('Hallucinated deity names require a selected hero role');
    let gods: Role['gods'];
    do {
        const role = nativeRoleAt(rn2Display(roles.length));
        if (!role) throw new Error('No hallucinated deity role was selected');
        // C installs the current Priest's borrowed pantheon in roles[].
        // JS keeps it on the live role instead of mutating the shared table.
        gods = role.key === state.urole.key ? state.urole.gods : role.gods;
    } while (!gods?.lawful);
    const choice = rn2Display(9);
    const name = choice < 2 ? gods.lawful
        : choice < 4 ? gods.neutral
        : choice < 6 ? gods.chaotic
        : choice < 8 ? HALLUCINATED_GODS[rn2Display(HALLUCINATED_GODS.length)]
        : 'Moloch';
    if (name === undefined) throw new Error('No hallucinated deity name was selected');
    return name.replace(/^_/, '');
}

// C attrib.c:uchangealign(A_CG_CONVERT). A helm can hide a permanent
// conversion, but it cannot undo the change to the hero's chosen deity.
export async function convertHeroAlignment(alignment: AlignmentValue, state: GameState = game): Promise<void> {
    const hero = state.u;
    const current = hero.ualign;
    if (!current) throw new Error('Hero alignment is not initialized');
    const previous = current.type;
    const original = hero.ualignbase?.[1] ?? previous;
    hero.ublessed = 0;
    state.context.botl = true;
    hero.ualignbase = [alignment, original];
    const name = alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    recordGameLogEvent(`permanently converted to ${name}`, { state });
    const helmet = state.uarmh || hero.uarmh;
    if (helmet?.otyp !== HELM_OF_OPPOSITE_ALIGNMENT) current.type = alignment;
    await plineWithContinuation(`You have a ${current.type !== previous ? 'sudden ' : ''}sense of a new direction.`);
    if (current.type !== previous) {
        current.record = 0;
        await retouchEquipment(0, { state });
    }
}

// C attrib.c:uchangealign(A_CG_HELM_ON/A_CG_HELM_OFF). The base deity
// stays unchanged; equipment is retouched after the alignment message.
export async function changeHeroAlignmentFromHelmet(
    alignment: AlignmentValue, puttingOn: boolean, state: GameState = game,
): Promise<void> {
    requireLiveGame(state);
    const current = state.u.ualign;
    if (!current) throw new Error('A helmet alignment change requires initialized alignment');
    const previous = current.type;
    state.u.ublessed = 0;
    state.context.botl = true;
    current.type = alignment;
    if (puttingOn) {
        adjustHeroAlignment(-7, state);
        await plineWithContinuation(`Your mind oscillates ${heroIsHallucinating(state) ? 'wildly' : 'briefly'}.`);
        await makeConfused(rn1(2, 3), { state, talk: false });
        const astral = Is_astralevel(state.u.uz);
        if (astral || rn2(50) < (current.abuse ?? 0)) await summonFuries(astral ? 0 : 1, state);
        recordGameLogEvent(`used a helm to turn ${alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral'}`, { state });
    } else {
        await plineWithContinuation(`Your mind is ${heroIsHallucinating(state)
            ? 'much of a muchness' : 'back in sync with your body'}.`);
    }
    if (alignment !== previous) {
        current.record = 0;
        await retouchEquipment(0, { state });
    }
}

// C makemon.c:summon_furies(). Erinyes are a real species with a birth
// limit; makemon() updates that history, ending the unlimited Astral case.
async function summonFuries(limit: number, state: GameState): Promise<void> {
    const species = MONSTER_NAME.indexOf('erinys');
    let created = 0;
    while (!((state.mvitals?.[species]?.mvflags ?? 0) & G_GONE) && (created < limit || limit === 0)) {
        await makemonAt(species, state.u.ux, state.u.uy, MM_ADJACENTOK | MM_NOWAIT);
        created++;
    }
}

export function adjustHeroAlignment(amount: number, state: GameState = game): void {
    if (!amount || !state.u?.ualign) return;
    const alignment = state.u.ualign;
    if (amount < 0) {
        alignment.record = (alignment.record || 0) + amount;
        alignment.abuse = (alignment.abuse ?? 0) - amount;
        adjustErinys(alignment.abuse);
        return;
    }
    const alignmentLimit = 10 + Math.trunc((state.moves || 0) / 200);
    alignment.record = Math.min(
        alignmentLimit, (alignment.record || 0) + amount,
    );
}
