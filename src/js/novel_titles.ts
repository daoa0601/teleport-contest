// C do_name.c:noveltitle(). Title indices are persistent object identity.
import { rn2 } from './rng.js';
import type { GameObject } from './object_types.js';
import { definiteName } from './objnam.js';

export const NOVEL_TITLES: readonly string[] = [
    "The Colour of Magic",
    "The Light Fantastic",
    "Equal Rites",
    "Mort",
    "Sourcery",
    "Wyrd Sisters",
    "Pyramids",
    "Guards! Guards!",
    "Eric",
    "Moving Pictures",
    "Reaper Man",
    "Witches Abroad",
    "Small Gods",
    "Lords and Ladies",
    "Men at Arms",
    "Soul Music",
    "Interesting Times",
    "Maskerade",
    "Feet of Clay",
    "Hogfather",
    "Jingo",
    "The Last Continent",
    "Carpe Jugulum",
    "The Fifth Elephant",
    "The Truth",
    "Thief of Time",
    "The Last Hero",
    "The Amazing Maurice and His Educated Rodents",
    "Night Watch",
    "The Wee Free Men",
    "Monstrous Regiment",
    "A Hat Full of Sky",
    "Going Postal",
    "Thud!",
    "Wintersmith",
    "Making Money",
    "Unseen Academicals",
    "I Shall Wear Midnight",
    "Snuff",
    "Raising Steam",
    "The Shepherd's Crown"
];

export function novelTitle(book: GameObject): string {
    const selected = rn2(NOVEL_TITLES.length);
    if (book.novelidx === -1 || book.novelidx === undefined)
        book.novelidx = selected;
    const index = book.novelidx >= 0 && book.novelidx < NOVEL_TITLES.length
        ? book.novelidx : selected;
    const title = NOVEL_TITLES[index];
    if (title === undefined) throw new RangeError(`Unknown novel title index ${index}`);
    return title;
}

// C do_name.c:lookup_novel(). An unrecognized label keeps a novel's existing
// title index; recognized spellings replace both its title and index.
export function lookupNovelTitle(name: string, book: GameObject): string | null {
    const theName = `T${definiteName(name).slice(1)}`;
    const aliases: ReadonlyMap<string, string> = new Map([
        ['the color of magic', 'The Colour of Magic'], ['sorcery', 'Sourcery'],
        ['masquerade', 'Maskerade'],
        ['the amazing maurice', 'The Amazing Maurice and His Educated Rodents'],
        ['thud', 'Thud!'],
    ]);
    const requested = aliases.get(name.toLowerCase()) ?? aliases.get(theName.toLowerCase()) ?? name;
    const fullName = definiteName(requested).toLowerCase();
    const index = NOVEL_TITLES.findIndex(title => title.toLowerCase() === requested.toLowerCase()
        || title.toLowerCase() === fullName);
    if (index >= 0) {
        book.novelidx = index;
        return NOVEL_TITLES[index] ?? null;
    }
    return book.novelidx === undefined ? null : NOVEL_TITLES[book.novelidx] ?? null;
}
