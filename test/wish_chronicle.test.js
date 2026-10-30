import assert from 'node:assert/strict';
import test from 'node:test';
import { gameLogEvents } from '../js/gamelog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { makeWish } from '../js/wish.js';
import { freshObjectRoom } from './support/object-room.js';
// C zap.c:makewish() livelogs every granted wish; the first one reads
// 'made his first wish - "<text>", got "<doname>"' and declining with an
// explicit "nothing" logs "declined to make a wish". #chronicle shows these
// entries, so the chronicle must carry them.
void test('a first wish records a chronicle entry with the wish and its grant', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    requirePlayingGame(game);
    pushKeys('food ration\r');
    await makeWish();
    const entries = gameLogEvents(game).map(entry => entry.text);
    const wishEntry = entries.find(line => line.includes('first wish'));
    assert.ok(wishEntry, `chronicle lacks a first-wish entry: ${JSON.stringify(entries)}`);
    assert.match(wishEntry, /^made (his|her) first wish - "food ration", got "a food ration"$/);
});
// zap.c:makewish() mungspaces() the typed line before livelogging it, so
// stray and repeated spaces never reach the chronicle text.
void test('the chronicle wish text collapses stray spaces', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    requirePlayingGame(game);
    pushKeys('  food \t ration  \r');
    await makeWish();
    const entries = gameLogEvents(game).map(entry => entry.text);
    const wishEntry = entries.find(line => line.includes('first wish'));
    assert.ok(wishEntry, `chronicle lacks a first-wish entry: ${JSON.stringify(entries)}`);
    assert.match(wishEntry, /^made (his|her) first wish - "food ration", got "a food ration"$/);
});
void test('declining a wish with nothing records the refusal', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    requirePlayingGame(game);
    pushKeys('nothing\r');
    await makeWish();
    const entries = gameLogEvents(game).map(entry => entry.text);
    assert.ok(entries.includes('declined to make a wish'), `chronicle lacks the refusal: ${JSON.stringify(entries)}`);
    assert.equal(entries.some(line => line.includes('wish - ')), false, 'a declined wish is not a granted wish');
});
// doname() -> xname() sets dknown for a sighted hero before formatting, so a
// wished-for unidentified potion is logged by its appearance.
void test('a sighted wish chronicles the granted potion by its appearance', async () => {
    await freshObjectRoom({ flags: { tips: false, verbose: false } });
    requirePlayingGame(game);
    pushKeys('potion of healing\r');
    await makeWish();
    const wishEntry = gameLogEvents(game).map(entry => entry.text)
        .find(line => line.includes('first wish'));
    assert.ok(wishEntry);
    assert.match(wishEntry, /got "an? (?:uncursed )?[a-z-]+ potion"$/);
    assert.doesNotMatch(wishEntry, /got "an? (?:uncursed )?potion"$/);
});
//# sourceMappingURL=wish_chronicle.test.js.map