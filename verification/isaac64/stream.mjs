// score.sh installs this frozen adapter before running the game.
import { isaac64_init, isaac64_reseed, isaac64_next_uint64 } from '../../frozen/isaac64.js';

const [hex, extra] = process.argv.slice(2);
const bytes = (text) => Uint8Array.from(Buffer.from(text, 'hex'));
const ctx = isaac64_init(bytes(hex));
for (let i = 0; i < 1000; i++) {
    if (i === 333 && extra !== undefined)
        isaac64_reseed(ctx, bytes(extra));
    console.log(isaac64_next_uint64(ctx).toString(16).padStart(16, '0'));
}
