// C do_name.c:noveltitle(). Title indices are persistent object identity.
import { rn2 } from './rng.js';
export const NOVEL_TITLES = [
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
export function novelTitle(book) {
    const selected = rn2(NOVEL_TITLES.length);
    if (book.novelidx === -1 || book.novelidx === undefined)
        book.novelidx = selected;
    const index = book.novelidx >= 0 && book.novelidx < NOVEL_TITLES.length
        ? book.novelidx : selected;
    const title = NOVEL_TITLES[index];
    if (title === undefined)
        throw new RangeError(`Unknown novel title index ${index}`);
    return title;
}
//# sourceMappingURL=novel_titles.js.map