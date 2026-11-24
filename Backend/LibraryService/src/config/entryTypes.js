export const ENTRY_TYPES = Object.freeze({
  WORD: "WORD",
  PHRASE: "PHRASE",
  IDIOM: "IDIOM",
  BOOK: "BOOK",
  PAPER: "PAPER",
  ARTICLE: "ARTICLE",
  COLLECTION: "COLLECTION",
  POEM: "POEM",
  POETIC_DEVICE: "POETIC_DEVICE",
  PLAY: "PLAY",
  CUSTOM_MODEL: "CUSTOM_MODEL",
  THEORY: "THEORY",
  RESEARCH: "RESEARCH",
  WORDS_SECTION: "WORDS_SECTION",
  PHRASES_SECTION: "PHRASES_SECTION",
  THEORIES_SECTION: "THEORIES_SECTION",
});

export const READING_SPACE_TYPES = Object.freeze([
  ENTRY_TYPES.BOOK,
  ENTRY_TYPES.PAPER,
  ENTRY_TYPES.ARTICLE,
]);

export const READING_SECTIONS = Object.freeze([
  Object.freeze({ type: ENTRY_TYPES.WORDS_SECTION, title: "Words" }),
  Object.freeze({ type: ENTRY_TYPES.PHRASES_SECTION, title: "Phrases" }),
  Object.freeze({ type: ENTRY_TYPES.THEORIES_SECTION, title: "Custom theories" }),
]);

export const READING_SECTION_TYPES = Object.freeze(READING_SECTIONS.map(({ type }) => type));
