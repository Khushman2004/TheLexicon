export const LIBRARY_MODELS = Object.freeze([
  Object.freeze({ key: "words", label: "Words", entryTypes: Object.freeze(["WORD"]) }),
  Object.freeze({ key: "phrases", label: "Phrases & idioms", entryTypes: Object.freeze(["PHRASE", "IDIOM"]) }),
  Object.freeze({ key: "reading-spaces", label: "Reading spaces", entryTypes: Object.freeze(["BOOK", "PAPER", "ARTICLE"]) }),
  Object.freeze({ key: "poetry", label: "Poetry & drama", entryTypes: Object.freeze(["POEM", "POETIC_DEVICE", "PLAY"]) }),
  Object.freeze({ key: "research", label: "Custom models & research", entryTypes: Object.freeze(["CUSTOM_MODEL", "THEORY", "RESEARCH"]) }),
]);

export function findLibraryModel(modelKey) {
  return LIBRARY_MODELS.find((model) => model.key === modelKey) ?? null;
}
