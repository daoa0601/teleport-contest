// C wizcmds.c:wiz_intrinsic(), with menu order from timeout.c:propertynames.
import { KILLED_BY, SICK_NONVOMITABLE, SICK_VOMITABLE } from './const.js';
import { docrt, flushPendingTopline, plineWithContinuation } from './display.js';
import { restoreNaturalMonsterShapes } from './monster_polymorph.js';
import { requireInitializedGame } from './gstate.js';
import { heroLiquidEffects } from './hack.js';
import { makeDeaf } from './hero_hearing.js';
import { startHeroSickness, startHeroVomiting } from './hero_illness.js';
import { makeHallucinated, makeStunned } from './hero_mental_status.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    propertyIsActive,
    propertyTimeout,
    refreshMovementProperties,
    setPropertyTimeout,
} from './properties.js';
import { rn2 } from './rng.js';
import { makeBlinded } from './sight_change.js';
import { setHeroSlimingTimeout } from './slime.js';
import { setHeroPetrificationTimeout } from './stoning.js';
import { setSlipperyHands } from './towel.js';
import { showMultiSelectWindow } from './windows.js';
import type { PlayingGameState } from './game_state.js';
import type { PropertyName } from './property_types.js';

interface WizardIntrinsic {
    readonly name: string;
    readonly property: PropertyName;
}

// Hallucination resistance is deliberately omitted: native wiz_intrinsic
// excludes the exceptional property used by Grayswandir.
const INTRINSICS: readonly WizardIntrinsic[] = [
    { name: 'invulnerable', property: 'invulnerable' },
    { name: 'petrifying', property: 'stoned' },
    { name: 'becoming slime', property: 'slimed' },
    { name: 'strangling', property: 'strangled' },
    { name: 'fatally sick', property: 'sick' },
    { name: 'stunned', property: 'stunned' },
    { name: 'confused', property: 'confusion' },
    { name: 'hallucinating', property: 'hallucination' },
    { name: 'blinded', property: 'blinded' },
    { name: 'deafness', property: 'deaf' },
    { name: 'vomiting', property: 'vomiting' },
    { name: 'slippery fingers', property: 'glib' },
    { name: 'wounded legs', property: 'woundedLegs' },
    { name: 'sleepy', property: 'sleepy' },
    { name: 'teleporting', property: 'teleportation' },
    { name: 'polymorphing', property: 'polymorph' },
    { name: 'levitating', property: 'levitation' },
    { name: 'very fast', property: 'fast' },
    { name: 'clairvoyant', property: 'clairvoyant' },
    { name: 'monster detection', property: 'detectMonsters' },
    { name: 'see invisible', property: 'seeInvisible' },
    { name: 'invisible', property: 'invisible' },
    { name: 'acid resistance', property: 'acidResistance' },
    { name: 'stoning resistance', property: 'stoneResistance' },
    { name: 'displaced', property: 'displaced' },
    { name: 'pass thru walls', property: 'passesWalls' },
    { name: 'magical breathing', property: 'magicalBreathing' },
    { name: 'water walking', property: 'waterWalking' },
    { name: 'fire resistance', property: 'fireResistance' },
    { name: 'cold resistance', property: 'coldResistance' },
    { name: 'sleep resistance', property: 'sleepResistance' },
    { name: 'disintegration resistance', property: 'disintegrationResistance' },
    { name: 'shock resistance', property: 'shockResistance' },
    { name: 'poison resistance', property: 'poisonResistance' },
    { name: 'drain resistance', property: 'drainResistance' },
    { name: 'sickness resistance', property: 'sicknessResistance' },
    { name: 'magic resistance', property: 'antimagic' },
    { name: 'light-induced blindness resistance', property: 'blindResistance' },
    { name: 'fumbling', property: 'fumbling' },
    { name: 'voracious hunger', property: 'hunger' },
    { name: 'telepathic', property: 'telepathy' },
    { name: 'warning', property: 'warning' },
    { name: 'warn: monster type or class', property: 'warnOfMonster' },
    { name: 'warn: undead', property: 'warnUndead' },
    { name: 'searching', property: 'searching' },
    { name: 'infravision', property: 'infravision' },
    { name: 'adorned (+/- Cha)', property: 'adorned' },
    { name: 'stealthy', property: 'stealth' },
    { name: 'monster aggravation', property: 'aggravateMonster' },
    { name: 'conflict', property: 'conflict' },
    { name: 'jumping', property: 'jumping' },
    { name: 'teleport control', property: 'teleportControl' },
    { name: 'flying', property: 'flying' },
    { name: 'swimming', property: 'swimming' },
    { name: 'slow digestion', property: 'slowDigestion' },
    { name: 'half spell damage', property: 'halfSpellDamage' },
    { name: 'half physical damage', property: 'halfPhysicalDamage' },
    { name: 'HP regeneration', property: 'regeneration' },
    { name: 'energy regeneration', property: 'energyRegeneration' },
    { name: 'extra protection', property: 'protection' },
    { name: 'protection from shape changers', property: 'protectionFromShapeChangers' },
    { name: 'polymorph control', property: 'polymorphControl' },
    { name: 'unchanging', property: 'unchanging' },
    { name: 'reflecting', property: 'reflection' },
    { name: 'free action', property: 'freeAction' },
    { name: 'fixed abilities', property: 'sustainAbility' },
    { name: 'life will be saved', property: 'lifeSaving' },
];

export async function wizIntrinsic(): Promise<void> {
    const state = requireInitializedGame();
    const items = INTRINSICS.map(intrinsic => {
        const timeout = propertyTimeout(intrinsic.property, state);
        return {
            text: timeout ? `${intrinsic.name.padEnd(27)} [${timeout}]` : intrinsic.name,
            value: intrinsic,
            separatorBefore: intrinsic.property === 'fireResistance',
        };
    });
    const selections = await showMultiSelectWindow({
        title: 'Which intrinsics?',
        introLines:
            state.flags.cmdassist !== false
                ? ['[Precede any selection with a count to increment by other than 30.]']
                : [],
        sections: [{ heading: '', items }],
        omitHeadings: true,
        pageLocalKeys: true,
        returnCounts: true,
    });

    // Native destroy_nhwindow also removes the extended-command editor.
    state.context.move = 0;
    state._pending_message = '';
    state._retained_message = '';
    for (const { value, count } of selections) {
        // tty stores a long count; wiz_intrinsic explicitly narrows it to int.
        const amount = count === -1 ? 30 : count | 0;
        if (amount <= 0) continue;
        await increaseIntrinsic(value, amount, state);
        if (state.program_state.gameover) return;
    }
    if (selections.length) await flushPendingTopline();
    state._pending_message = '';
    state._retained_message = '';
    await docrt();
}

async function increaseIntrinsic(
    { name, property }: WizardIntrinsic,
    amount: number,
    state: PlayingGameState,
): Promise<void> {
    const oldTimeout = propertyTimeout(property, state);
    const keepsDeadline = property === 'sick' || property === 'slimed' || property === 'stoned';
    const newTimeout = keepsDeadline && oldTimeout > 0 ? oldTimeout : oldTimeout + amount;

    if (property === 'blinded') {
        await makeBlinded(newTimeout, { state });
    } else if (property === 'deaf') {
        await makeDeaf(newTimeout, { state });
    } else if (property === 'hallucination') {
        await makeHallucinated(newTimeout, { state });
    } else if (property === 'sick') {
        await startHeroSickness({
            state,
            turns: newTimeout,
            cause: '#wizintrinsic',
            type: rn2(2) === 0 ? SICK_VOMITABLE : SICK_NONVOMITABLE,
        });
    } else if (property === 'slimed') {
        await setHeroSlimingTimeout(newTimeout, {
            state,
            message: `You are${oldTimeout ? ' still' : ''} turning into slime.`,
        });
    } else if (property === 'stoned') {
        await setHeroPetrificationTimeout(newTimeout, {
            state,
            message: `You are${oldTimeout ? ' still' : ''} turning into stone.`,
            killer: '#wizintrinsic',
            killerFormat: KILLED_BY,
        });
    } else if (property === 'stunned') {
        await makeStunned(newTimeout, { state });
    } else if (property === 'vomiting') {
        startHeroVomiting({ state, turns: newTimeout });
        await plineWithContinuation(`You are${oldTimeout ? ' still' : ''} vomiting.`);
    } else {
        if (property === 'warnOfMonster' && !propertyIsActive(property, state)) {
            const speciesidx = MONSTER_NAME.indexOf('grid bug');
            if (speciesidx < 0) throw new Error('The native grid bug species is missing');
            const warning = (state.context.warntype ||= { obj: 0, polyd: 0, speciesidx: -1 });
            warning.speciesidx = speciesidx;
        }
        if (property === 'glib') setSlipperyHands(newTimeout, state);
        else setPropertyTimeout(property, newTimeout, state);
        state.context.botl = true;
        await plineWithContinuation(
            `Timeout for ${name} ${oldTimeout ? 'increased by' : 'set to'} ${amount}.`,
        );
    }

    if (property === 'levitation' || property === 'flying') refreshMovementProperties(state);
    else if (property === 'protectionFromShapeChangers') await restoreNaturalMonsterShapes(state);
    if (
        (property === 'waterWalking' || property === 'levitation' || property === 'flying') &&
        state.u.uinwater
    )
        await heroLiquidEffects({ state });
}
