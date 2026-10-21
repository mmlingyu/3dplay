/** Stamp pages. Day, beauty and alien stamps stay in their own modules. */

import { MEI_STAMPS } from './mei-data.js';
import { RI_STORY_STAMPS, STAMPS } from './realm-data.js';
import { VISTA_STAMPS } from './vista-data.js';
import { XING_STAMPS } from './xing-data.js';

export const STAMP_BOOK = Object.freeze([...STAMPS, ...RI_STORY_STAMPS, ...MEI_STAMPS, ...XING_STAMPS, ...VISTA_STAMPS]);
export const STAMP_IDS = new Set(STAMP_BOOK.map((item) => item.id));
