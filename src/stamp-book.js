/** Stamp pages. Day-valley stamps stay in realm-data. Beauty-valley stamps are added here. */

import { MEI_STAMPS } from './mei-data.js';
import { STAMPS } from './realm-data.js';

export const STAMP_BOOK = Object.freeze([...STAMPS, ...MEI_STAMPS]);
export const STAMP_IDS = new Set(STAMP_BOOK.map((item) => item.id));
