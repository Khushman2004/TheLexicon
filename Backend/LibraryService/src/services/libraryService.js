import { HttpError } from "../utils/httpError.js";
import { ENTRY_TYPES, READING_SECTION_TYPES, READING_SPACE_TYPES } from "../config/entryTypes.js";

const COLLECTION_CHILD_TYPES = new Set([
  ENTRY_TYPES.WORD,
  ENTRY_TYPES.PHRASE,
  ENTRY_TYPES.IDIOM,
  ENTRY_TYPES.BOOK,
  ENTRY_TYPES.PAPER,
  ENTRY_TYPES.ARTICLE,
  ENTRY_TYPES.POEM,
  ENTRY_TYPES.POETIC_DEVICE,
  ENTRY_TYPES.PLAY,
  ENTRY_TYPES.CUSTOM_MODEL,
  ENTRY_TYPES.THEORY,
  ENTRY_TYPES.RESEARCH,
]);
const SECTION_CHILD_TYPES = new Map([
  [ENTRY_TYPES.WORDS_SECTION, new Set([ENTRY_TYPES.WORD])],
  [ENTRY_TYPES.PHRASES_SECTION, new Set([ENTRY_TYPES.PHRASE, ENTRY_TYPES.IDIOM])],
  [ENTRY_TYPES.THEORIES_SECTION, new Set([ENTRY_TYPES.THEORY])],
]);
export class LibraryService {
  constructor(libraryRepository) {
    this.libraryRepository = libraryRepository;
  }

  async listLibraries(userId) {
    return this.libraryRepository.listForUser(userId);
  }

  async createLibrary(userId, body) {
    return this.libraryRepository.create(userId, readName(body, "name", "Library name", 100));
  }

  async getLibrary(userId, libraryId) {
    const library = await this.libraryRepository.findForUser(userId, readId(libraryId, "libraryId"));
    if (!library) throw new HttpError(404, "Library not found.");
    return library;
  }

  async updateLibrary(userId, libraryId, body) {
    const library = await this.libraryRepository.updateName(
      userId,
      readId(libraryId, "libraryId"),
      readName(body, "name", "Library name", 100),
    );
    if (!library) throw new HttpError(404, "Library not found.");
    return library;
  }

  async listEntries(userId, libraryId, entryType, parentEntryId) {
    const id = readId(libraryId, "libraryId");
    await this.getLibrary(userId, id);
    const parentId = parentEntryId === undefined
      ? null
      : readId(parentEntryId, "parentId");

    await this.validateParent(userId, id, parentId);

    return this.libraryRepository.listEntries(userId, id, entryType, parentId);
  }

  async listAllEntries(userId, libraryId, parentEntryId) {
    const id = readId(libraryId, "libraryId");
    await this.getLibrary(userId, id);
    const parentId = parentEntryId === undefined
      ? null
      : readId(parentEntryId, "parentId");

    await this.validateParent(userId, id, parentId);
    return this.libraryRepository.listAllEntries(userId, id, parentId);
  }

  async listReadingSpaces(userId, libraryId) {
    const id = readId(libraryId, "libraryId");
    await this.getLibrary(userId, id);
    return this.libraryRepository.listReadingSpaces(userId, id);
  }

  async createReadingSpace(userId, libraryId, body) {
    const id = readId(libraryId, "libraryId");
    await this.getLibrary(userId, id);
    const readingSpaceType = body?.readingSpaceType;
    if (!READING_SPACE_TYPES.includes(readingSpaceType)) {
      throw new HttpError(400, "readingSpaceType must be BOOK, PAPER, or ARTICLE.");
    }

    const entry = readEntry(body, readingSpaceType);
    if (entry.parentEntryId !== null) {
      throw new HttpError(400, "Reading spaces must be created at the library root.");
    }

    const created = await this.libraryRepository.createEntry(userId, id, entry);
    if (!created) throw new HttpError(404, "Library not found.");
    const sections = await this.listReadingSpaceSections(userId, id, created.id);
    return { readingSpace: created, sections };
  }

  async listReadingSpaceSections(userId, libraryId, readingSpaceId) {
    const id = readId(libraryId, "libraryId");
    const spaceId = readId(readingSpaceId, "readingSpaceId");
    await this.getLibrary(userId, id);
    const readingSpace = await this.libraryRepository.findAnyEntryForUser(userId, id, spaceId);
    if (!readingSpace || !READING_SPACE_TYPES.includes(readingSpace.entryType)) {
      throw new HttpError(404, "Reading space not found.");
    }
    const sections = await this.libraryRepository.listAllEntries(userId, id, spaceId);
    const sectionOrder = new Map(READING_SECTION_TYPES.map((type, index) => [type, index]));
    return sections
      .filter((section) => sectionOrder.has(section.entryType))
      .sort((left, right) => sectionOrder.get(left.entryType) - sectionOrder.get(right.entryType));
  }

  async createEntry(userId, libraryId, entryType, body) {
    const id = readId(libraryId, "libraryId");
    await this.getLibrary(userId, id);
    const entry = readEntry(body, entryType);

    if (entry.parentEntryId !== null) {
      const parent = await this.libraryRepository.findAnyEntryForUser(userId, id, entry.parentEntryId);
      if (!parent) throw new HttpError(404, "Parent entry not found.");
      const allowedTypes = SECTION_CHILD_TYPES.get(parent.entryType)
        ?? (READING_SPACE_TYPES.includes(parent.entryType)
          ? new Set(READING_SECTION_TYPES)
          : parent.entryType === ENTRY_TYPES.COLLECTION
            ? COLLECTION_CHILD_TYPES
            : null);
      if (!allowedTypes) throw new HttpError(400, "Entries can only be added to a reading-space section or custom collection.");
      if (!allowedTypes.has(entryType)) {
        throw new HttpError(400, `${parent.entryType.toLowerCase()} entries cannot contain ${entryType.toLowerCase()} entries.`);
      }
    }

    const created = await this.libraryRepository.createEntry(userId, id, entry);
    if (!created) throw new HttpError(404, "Library not found.");
    return created;
  }

  async updateEntry(userId, libraryId, entryId, entryType, body) {
    const id = readId(libraryId, "libraryId");
    const itemId = readId(entryId, "entryId");
    const current = await this.libraryRepository.findEntryForUser(userId, id, itemId, entryType);
    if (!current) throw new HttpError(404, "Library entry not found.");
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    if (!["title", "content", "url"].some((key) => Object.hasOwn(body, key))) {
      throw new HttpError(400, "At least one of title, content, or url is required.");
    }

    const entry = {
      title: Object.hasOwn(body, "title")
        ? readName(body, "title", "Entry title", 255)
        : current.title,
      content: Object.hasOwn(body, "content")
        ? readOptionalText(body.content, "content", 10000)
        : current.content,
      url: Object.hasOwn(body, "url") ? readUrl(body.url) : current.url,
    };
    const updated = await this.libraryRepository.updateEntry(
      userId,
      id,
      itemId,
      entryType,
      entry,
    );
    if (!updated) throw new HttpError(404, "Library entry not found.");
    return updated;
  }

  async deleteEntry(userId, libraryId, entryId, entryType) {
    const id = readId(libraryId, "libraryId");
    const itemId = readId(entryId, "entryId");
    const current = await this.libraryRepository.findEntryForUser(userId, id, itemId, entryType);
    if (!current) throw new HttpError(404, "Library entry not found.");
    if (await this.libraryRepository.hasChildEntries(userId, id, itemId)) {
      throw new HttpError(409, "Remove this entry's contents before deleting it.");
    }
    if (!(await this.libraryRepository.deleteEntry(userId, id, itemId, entryType))) {
      throw new HttpError(404, "Library entry not found.");
    }
  }

  async validateParent(userId, libraryId, parentId) {
    if (parentId === null) return;
    const parent = await this.libraryRepository.findAnyEntryForUser(userId, libraryId, parentId);
    if (!parent) throw new HttpError(404, "Parent entry not found.");
    if (!READING_SPACE_TYPES.includes(parent.entryType)
      && !READING_SECTION_TYPES.includes(parent.entryType)
      && parent.entryType !== ENTRY_TYPES.COLLECTION) {
      throw new HttpError(400, "Entries can only be listed inside a reading space, its section, or a custom collection.");
    }
  }
}

function readEntry(body, entryType) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  const parentEntryId = body.parentEntryId === undefined || body.parentEntryId === null
    ? null
    : readId(body.parentEntryId, "parentEntryId");

  return {
    parentEntryId,
    entryType,
    title: readName(body, "title", "Entry title", 255),
    content: readOptionalText(body.content, "content", 10000),
    url: readUrl(body.url),
  };
}

function readName(body, field, label, maxLength) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  const value = body[field];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${label} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function readOptionalText(value, label, maxLength) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpError(400, `${label} must be a string of at most ${maxLength} characters.`);
  }
  return value;
}

function readUrl(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw new HttpError(400, "url must be a valid HTTP(S) URL of at most 2048 characters.");
  }
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported URL protocol.");
    }
  } catch {
    throw new HttpError(400, "url must be a valid HTTP(S) URL of at most 2048 characters.");
  }
  return value;
}

function readId(value, label) {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, `${label} must be a positive integer.`);
  }
  return id;
}
