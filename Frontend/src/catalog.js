import {
  AlignLeft,
  BookOpen,
  Bookmark,
  Layers3,
  Quote,
  Sparkles,
  Type,
} from "lucide-react";

export const CATEGORIES = [
  { id: "all", label: "Everything", plural: "Everything", icon: Layers3, color: "all" },
  { id: "word", label: "Word", plural: "Words", icon: Type, color: "word" },
  { id: "phrase", label: "Phrase", plural: "Phrases", icon: Quote, color: "phrase" },
  { id: "idiom", label: "Idiom", plural: "Idioms", icon: Sparkles, color: "idiom" },
  { id: "book", label: "Book", plural: "Books", icon: BookOpen, color: "book" },
  { id: "article", label: "Article", plural: "Articles", icon: AlignLeft, color: "article" },
  { id: "collection", label: "Collection", plural: "Collections", icon: Bookmark, color: "collection" },
];

export const ENTRY_TYPES = CATEGORIES.filter(({ id }) => id !== "all");

export function categoryForEntry(entry) {
  return CATEGORIES.find(({ id }) => id.toUpperCase() === entry.entryType) ?? CATEGORIES[0];
}

export function dateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}
