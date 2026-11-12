import {
  AlignLeft,
  BookOpen,
  Bookmark,
  FlaskConical,
  Layers3,
  LibraryBig,
  Mic2,
  Quote,
  Sparkles,
  Theater,
  Type,
} from "lucide-react";

export const ENTRY_TYPES = [
  { id: "word", label: "Word", plural: "Words", route: "words", entryType: "WORD", icon: Type, color: "word" },
  { id: "phrase", label: "Phrase", plural: "Phrases", route: "phrases", entryType: "PHRASE", icon: Quote, color: "phrase" },
  { id: "idiom", label: "Idiom", plural: "Idioms", route: "idioms", entryType: "IDIOM", icon: Sparkles, color: "idiom" },
  { id: "book", label: "Book", plural: "Books", route: "books", entryType: "BOOK", icon: BookOpen, color: "book" },
  { id: "paper", label: "Paper", plural: "Papers", route: "papers", entryType: "PAPER", icon: LibraryBig, color: "paper" },
  { id: "article", label: "Article", plural: "Articles", route: "articles", entryType: "ARTICLE", icon: AlignLeft, color: "article" },
  { id: "poem", label: "Poem", plural: "Poems", route: "poems", entryType: "POEM", icon: Quote, color: "poem" },
  { id: "poetic-device", label: "Poetic device", plural: "Poetic devices", route: "poetic-devices", entryType: "POETIC_DEVICE", icon: Sparkles, color: "poetic-device" },
  { id: "play", label: "Play", plural: "Plays", route: "plays", entryType: "PLAY", icon: Theater, color: "play" },
  { id: "custom-model", label: "Custom model", plural: "Custom models", route: "custom-models", entryType: "CUSTOM_MODEL", icon: Layers3, color: "custom-model" },
  { id: "theory", label: "Theory", plural: "Theories", route: "theories", entryType: "THEORY", icon: FlaskConical, color: "theory" },
  { id: "research", label: "Research", plural: "Research", route: "research", entryType: "RESEARCH", icon: Bookmark, color: "research" },
  { id: "collection", label: "Collection", plural: "Collections", route: "collections", entryType: "COLLECTION", icon: Bookmark, color: "collection" },
];

export const MODEL_PAGES = [
  {
    id: "words",
    label: "Words",
    description: "Keep the words you want to carry with you.",
    icon: Type,
    types: ["word"],
  },
  {
    id: "phrases",
    label: "Phrases & idioms",
    description: "Save turns of phrase, expressions, and idioms.",
    icon: Quote,
    types: ["phrase", "idiom"],
  },
  {
    id: "reading-spaces",
    label: "Reading spaces",
    description: "Books, papers, and articles, each with room for notes.",
    icon: BookOpen,
    types: ["book", "paper", "article"],
  },
  {
    id: "poetry",
    label: "Poems & poetic devices",
    description: "Collect poems, craft techniques, and plays.",
    icon: Sparkles,
    types: ["poem", "poetic-device", "play"],
  },
  {
    id: "research",
    label: "Custom models & research",
    description: "Develop theories, models, and your own research.",
    icon: FlaskConical,
    types: ["custom-model", "theory", "research"],
  },
];

export function entryTypeForCategory(categoryId) {
  return ENTRY_TYPES.find(({ id }) => id === categoryId) ?? null;
}

export function categoryForEntry(entry) {
  return ENTRY_TYPES.find(({ entryType }) => entryType === entry.entryType)
    ?? { id: "unknown", label: "Entry", plural: "Entries", icon: Layers3, color: "all" };
}

export function dateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}
