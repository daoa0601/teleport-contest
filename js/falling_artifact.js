// C artifact.c:artifact_hit(), with no attacker and the hero as defender.
// toss_up() supplies a die roll from 2 through 19, excluding natural-one cuts.
import { artifactById, artifactDamageBonus } from './artifacts.js';
import { nomul } from './command_state.js';
import { Upolyd } from './const.js';
import { displayColorName, shieldeff } from './display.js';
import { loseHeroExperience } from './exper.js';
import { burnAwayHeroSlime } from './hack.js';
import { makeConfused, makeStunned } from './hero_mental_status.js';
import { heroSpecies } from './hero_species.js';
import { formatFeltMessage } from './hero_speech.js';
import { MONSTER_NAME, monsterIsNonliving } from './monster_data.js';
import { wakeMonstersNear } from './monster_wake.js';
import { objectName, observeDistantObjectForNaming } from './objnam.js';
import { observeObject } from './object_knowledge.js';
import { heroIsUnchanging, returnHeroToHumanForm } from './polyself.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { destroyInventoryByElement, INVENTORY_DAMAGE } from './zap.js';
export async function hitHeroWithFallingArtifact(object, baseDamage, options) {
    const { state, publish, random, rollOne, dieRoll } = options;
    const artifact = artifactById(object.oartifact, state);
    if (!artifact?.attack)
        return { damage: baseDamage, specialMessage: false };
    const target = { mnum: heroSpecies(state) };
    const bonus = artifactDamageBonus(object, target, baseDamage, rollOne, {
        hero: true, state, random,
    });
    const damage = baseDamage + bonus;
    const applied = bonus > 0;
    const type = artifact.attack.damageType;
    if (type === 'fire' || type === 'cold' || type === 'shock') {
        if (type === 'fire') {
            const verb = !applied ? 'hits'
                : MONSTER_NAME[target.mnum] === 'water elemental' ? 'vaporizes part of' : 'burns';
            await publish(`The fiery blade ${verb} you${applied ? '!' : '.'}`);
        }
        else if (type === 'cold') {
            await publish(`The ice-cold blade ${applied ? 'freezes' : 'hits'} you${applied ? '!' : '.'}`);
        }
        else {
            await publish(applied ? 'The massive hammer hits!  Lightning strikes you!'
                : 'The massive hammer hits you.');
            // artifact_hit() uses youmonst's coordinates, which stay (0, 0).
            if (applied)
                wakeMonstersNear(0, 0, 16, state);
        }
        if (random(type === 'shock' ? 5 : 4) === 0) {
            const element = type === 'shock' ? INVENTORY_DAMAGE.ELECTRIC
                : type === 'fire' ? INVENTORY_DAMAGE.FIRE : INVENTORY_DAMAGE.COLD;
            const destroyed = await destroyInventoryByElement(element, damage, {
                state, publish, random, rollOne,
            });
            if (destroyed.heroDied)
                return { heroDied: true };
        }
        // Native ignites youmonst.minvent, which is empty; hero possessions
        // live in invent. Item destruction above still affects invent.
        if (type === 'fire')
            await burnAwayHeroSlime(state, publish);
        return { damage, specialMessage: true };
    }
    if (artifact.name === 'Magicbane' && dieRoll <= 8)
        return hitHeroWithMagicbane(object, damage, applied, options);
    if (!applied)
        return { damage, specialMessage: false };
    // The fake die excludes ordinary beheading. Vorpal still always cuts a
    // jabberwock, including a hero in that form.
    if (artifact.name === 'Vorpal Blade' && MONSTER_NAME[target.mnum] === 'jabberwock') {
        const fatalDamage = 2 * (Upolyd(state.u) ? state.u.mh : state.u.uhp) + 200;
        await publish(`Vorpal Blade ${random(2) === 0 ? 'beheads' : 'decapitates'} you!`);
        observeObject(object, state);
        return { damage: fatalDamage, specialMessage: true };
    }
    if (artifact.flags.includes('SPFX_DRLI')) {
        const life = monsterIsNonliving(target.mnum) ? 'animating force' : 'life';
        if (heroIsBlind(state)) {
            await publish(formatFeltMessage(`an ${artifact.name === 'Stormbringer'
                ? 'unholy blade' : 'object'} drain your ${life}!`, state));
        }
        else {
            observeDistantObjectForNaming(object, state);
            const name = artifact.name === 'Stormbringer'
                ? `${displayColorName('black', state)} blade` : objectName(object, state);
            await publish(`The ${name} drains your ${life}!`);
        }
        if (await loseHeroExperience('life drainage', { state, publish }))
            return { heroDied: true };
        return { damage, specialMessage: true };
    }
    return { damage, specialMessage: false };
}
async function hitHeroWithMagicbane(object, baseDamage, applied, { state, publish, random, rollOne, dieRoll }) {
    const enchantment = object.spe;
    const scareRoll = enchantment >= 3 ? Math.trunc(4 / 2 ** Math.trunc(enchantment / 3)) : 4;
    const roll = dieRoll + (applied ? 0 : 1);
    let stun = Math.max(enchantment, 0) < random(applied ? 11 : 7);
    let effect = stun ? 'stun' : 'probe';
    let damage = baseDamage + rollOne(4);
    if (stun)
        damage += rollOne(4);
    if (roll <= scareRoll) {
        effect = 'scare';
        damage += rollOne(4);
    }
    if (roll <= Math.trunc(scareRoll / 2)) {
        effect = 'cancel';
        damage += rollOne(4);
    }
    const verb = heroIsHallucinating(state)
        ? { probe: 'prods', stun: 'amazes', scare: 'tickles', cancel: 'purges' }[effect]
        : { probe: 'probes', stun: 'stuns', scare: 'scares', cancel: 'cancels' }[effect];
    await publish(`The magic-absorbing blade ${verb} you!`);
    let resisted = false;
    if (effect === 'cancel') {
        resisted = !!state.u.antimagic;
        if (!resisted) {
            const oldSpecies = heroSpecies(state);
            if (Upolyd(state.u)) {
                if (MONSTER_NAME[oldSpecies] === 'clay golem') {
                    await publish(heroIsBlind(state)
                        ? formatFeltMessage(`${heroIsHallucinating(state) ? 'dark' : 'light'} headed.`, state)
                        : 'Some writing vanishes from your head!');
                    state.u.mh = 0;
                }
                if (heroIsUnchanging(state) && state.u.mh > 0)
                    await publish('Your amulet grows hot for a moment, then cools.');
                else if ((await returnHeroToHumanForm(state, { publish })).died)
                    return { heroDied: true };
            }
            stun = false;
            if (heroSpecies(state) !== oldSpecies)
                damage = 0;
            if ((state.u.uenmax ?? 0) > 0) {
                state.u.uenmax = (state.u.uenmax ?? 0) - 1;
                if ((state.u.uen ?? 0) > 0)
                    state.u.uen = (state.u.uen ?? 0) - 1;
                state.context.botl = true;
                await publish('You lose magical energy!');
            }
        }
    }
    else if (effect === 'scare') {
        resisted = !!state.u.antimagic;
        if (!resisted) {
            nomul(-3, state);
            state._helplessReason = 'being scared stiff';
            state._helplessDoneMessage = '';
            stun = false;
        }
    }
    if (stun) {
        await makeStunned((state.u.stunnedTurns ?? 0) + 3, { state, talk: false });
        if (effect === 'stun')
            stun = false;
    }
    const confused = random(12) === 0;
    if (confused)
        await makeConfused((state.u.confusionTurns ?? 0) + 4, { state, talk: false });
    if (resisted) {
        await publish('You resist!');
        await shieldeff(state.u.ux, state.u.uy, state);
    }
    if ((stun || confused) && state.flags.verbose !== false) {
        const conditions = [...(stun ? ['stunned'] : []), ...(confused ? ['confused'] : [])];
        await publish(`You are ${conditions.join(' and ')}${conditions.length > 1 ? '!' : '.'}`);
    }
    return { damage, specialMessage: true };
}
//# sourceMappingURL=falling_artifact.js.map