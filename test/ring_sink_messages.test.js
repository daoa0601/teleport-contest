import test from 'node:test';
import assert from 'node:assert/strict';
import { SINK } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { dropRingIntoSink } from '../js/ring_sink.js';
// do.c:dosinkring(): each ring type produces its own observable reaction
// when dropped into the sink. Effects noticable without eyes come first;
// the sight-only group only fires when ideed stays false.
const FRUIT_PLURAL = 'slime molds';
const cases = [
    { ring: 'searching', line: 'You thought your ring of searching got lost in the sink, but there it is!' },
    { ring: 'levitation', line: 'The sink quivers upward for a moment.' },
    { ring: 'poison resistance', line: `You smell rotten ${FRUIT_PLURAL}.` },
    { ring: 'aggravate monster', line: 'Several flies buzz angrily around the sink.' },
    { ring: 'shock resistance', line: 'Static electricity surrounds the sink.' },
    { ring: 'sustain ability', line: 'The water flow seems fixed.' },
    { ring: 'gain strength', overrides: { spe: 1 }, line: 'The water flow seems stronger now.' },
    { ring: 'gain strength', overrides: { spe: -1 }, line: 'The water flow seems weaker now.' },
    { ring: 'gain constitution', overrides: { spe: 1 }, line: 'The water flow seems greater now.' },
    { ring: 'gain constitution', overrides: { spe: -1 }, line: 'The water flow seems lesser now.' },
    { ring: 'increase accuracy', overrides: { spe: 1 }, line: 'The water flow hits the drain.' },
    { ring: 'increase accuracy', overrides: { spe: -1 }, line: 'The water flow misses the drain.' },
    { ring: 'increase damage', overrides: { spe: 1 }, line: "The water's force seems greater now." },
    { ring: 'increase damage', overrides: { spe: -1 }, line: "The water's force seems smaller now." },
    { ring: 'meat ring', line: 'Several flies buzz around the sink.' },
    { ring: 'adornment', line: 'The faucets flash brightly for a moment.' },
    { ring: 'regeneration', line: 'The sink looks as good as new.' },
    { ring: 'invisibility', line: "You don't see anything happen to the sink." },
    { ring: 'free action', line: 'You see the ring slide right down the drain!' },
    { ring: 'see invisible', line: 'You see some air in the sink.' },
    { ring: 'stealth', line: 'The sink seems to blend into the floor for a moment.' },
    { ring: 'fire resistance', line: 'The hot water faucet flashes brightly for a moment.' },
    { ring: 'cold resistance', line: 'The cold water faucet flashes brightly for a moment.' },
    { ring: 'protection from shape changers', line: 'The sink looks nothing like a fountain.' },
    { ring: 'protection', overrides: { spe: 1 }, line: 'The sink glows silver for a moment.' },
    { ring: 'protection', overrides: { spe: -1 }, line: 'The sink glows black for a moment.' },
    { ring: 'warning', line: 'The sink glows white for a moment.' },
    { ring: 'teleport control', line: 'The sink looks like it is being beamed aboard somewhere.' },
    { ring: 'polymorph control', line: 'The sink momentarily looks like a regularly erupting geyser.' },
];
for (const { ring, overrides, line } of cases) {
    void test(`dropping a ${ring} ring into a sink: ${line}`, async () => {
        freshObjectRoom({ gameplaySeed: 909n });
        requirePlayingGame(game);
        requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = SINK;
        const object = await addInventoryObject(OBJECT_NAMES.indexOf(ring), overrides);
        const messages = [];
        await dropRingIntoSink(object, {
            publish: text => { messages.push(text); },
        });
        assert.ok(messages.includes(line), `Expected "${line}" among ${JSON.stringify(messages)}`);
    });
}
//# sourceMappingURL=ring_sink_messages.test.js.map