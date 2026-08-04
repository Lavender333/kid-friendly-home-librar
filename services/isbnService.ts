export interface IsbnBookDetails {
  title: string;
  author: string;
  publisher: string;
  publicationYear: string;
  genre: string;
}

const LOOKUP_TIMEOUT_MS = 12000;

export const normalizeIsbn = (value: string) => value.toUpperCase().replace(/[^0-9X]/g, '');

export const isValidIsbn = (value: string) => {
  const isbn = normalizeIsbn(value);

  if (/^\d{13}$/.test(isbn)) {
    const sum = isbn
      .slice(0, 12)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === Number(isbn[12]);
  }

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = isbn.split('').reduce((total, digit, index) => {
      const valueAtPosition = digit === 'X' ? 10 : Number(digit);
      return total + valueAtPosition * (10 - index);
    }, 0);
    return sum % 11 === 0;
  }

  return false;
};

const yearFrom = (value: unknown) => String(value || '').match(/\b(?:1[5-9]|20)\d{2}\b/)?.[0] || '';

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Book service returned ${response.status}.`);
  return response.json() as Promise<T>;
};

const lookupWithEditionApi = async (isbn: string): Promise<Partial<IsbnBookDetails> | null> => {
  type EditionSubject = string | { name?: string };
  type Edition = {
    title?: string;
    by_statement?: string;
    publish_date?: string;
    publishers?: string[];
    subjects?: EditionSubject[];
    authors?: Array<{ key?: string }>;
    works?: Array<{ key?: string }>;
    isbn_10?: string[];
    isbn_13?: string[];
  };
  type Author = { name?: string; personal_name?: string };
  type Work = { subjects?: string[] };

  // This endpoint resolves one specific edition, unlike broad catalog searches
  // that can return another edition or an unrelated digitized record.
  const edition = await fetchJson<Edition>(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  if (!edition.title) return null;

  const returnedIsbns = [...(edition.isbn_10 || []), ...(edition.isbn_13 || [])].map(normalizeIsbn);
  if (returnedIsbns.length > 0 && !returnedIsbns.includes(isbn)) return null;

  const authorKeys = (edition.authors || []).map(author => author.key).filter((key): key is string => Boolean(key)).slice(0, 4);
  const workKey = edition.works?.[0]?.key;
  const [authorResults, workResult] = await Promise.all([
    Promise.allSettled(authorKeys.map(key => fetchJson<Author>(`https://openlibrary.org${key}.json`))),
    workKey ? fetchJson<Work>(`https://openlibrary.org${workKey}.json`).catch(() => null) : Promise.resolve(null),
  ]);
  const authors = authorResults
    .filter((result): result is PromiseFulfilledResult<Author> => result.status === 'fulfilled')
    .map(result => result.value.name || result.value.personal_name)
    .filter((name): name is string => Boolean(name));
  const editionSubjects = (edition.subjects || [])
    .map(subject => typeof subject === 'string' ? subject : subject.name)
    .filter((subject): subject is string => Boolean(subject));
  const subjects = editionSubjects.length > 0 ? editionSubjects : workResult?.subjects || [];

  return {
    title: edition.title,
    author: authors.join(', ') || edition.by_statement || '',
    publisher: edition.publishers?.[0] || '',
    publicationYear: yearFrom(edition.publish_date),
    genre: subjects.slice(0, 3).join(', '),
  };
};

const lookupWithBooksApi = async (isbn: string): Promise<Partial<IsbnBookDetails> | null> => {
  type DataBook = {
    title?: string;
    publish_date?: string;
    authors?: Array<{ name?: string }>;
    publishers?: Array<{ name?: string }>;
    subjects?: Array<{ name?: string }>;
  };
  const key = `ISBN:${isbn}`;
  const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(key)}&jscmd=data&format=json`;
  const response = await fetchJson<Record<string, DataBook>>(url);
  const match = response[key];
  if (!match?.title) return null;

  return {
    title: match.title,
    author: match.authors?.map(author => author.name).filter(Boolean).join(', ') || '',
    publisher: match.publishers?.map(publisher => publisher.name).filter(Boolean)[0] || '',
    publicationYear: yearFrom(match.publish_date),
    genre: match.subjects?.map(subject => subject.name).filter(Boolean).slice(0, 3).join(', ') || '',
  };
};

const lookupWithSearchApi = async (isbn: string): Promise<Partial<IsbnBookDetails> | null> => {
  type SearchDocument = {
    title?: string;
    author_name?: string[];
    publisher?: string[];
    first_publish_year?: number;
    publish_year?: number[];
    subject?: string[];
    isbn?: string[];
  };
  const fields = 'title,author_name,publisher,first_publish_year,publish_year,subject,isbn';
  const url = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=${encodeURIComponent(fields)}&limit=5`;
  const response = await fetchJson<{ docs?: SearchDocument[] }>(url);
  const match = response.docs?.find(document => document.isbn?.some(candidate => normalizeIsbn(candidate) === isbn))
    || response.docs?.[0];
  if (!match?.title) return null;

  const editionYears = match.publish_year?.filter(year => Number.isFinite(year)) || [];
  const year = editionYears.length > 0 ? Math.max(...editionYears) : match.first_publish_year;
  return {
    title: match.title,
    author: match.author_name?.join(', ') || '',
    publisher: match.publisher?.[0] || '',
    publicationYear: year ? String(year) : '',
    genre: match.subject?.slice(0, 3).join(', ') || '',
  };
};

const lookupWithInternetArchive = async (isbn: string): Promise<Partial<IsbnBookDetails> | null> => {
  type ArchiveDocument = {
    title?: string;
    creator?: string | string[];
    publisher?: string | string[];
    date?: string;
    subject?: string | string[];
  };
  const fields = ['title', 'creator', 'publisher', 'date', 'subject'];
  const fieldParameters = fields.map(field => `fl%5B%5D=${field}`).join('&');
  const query = encodeURIComponent(`isbn:${isbn} AND mediatype:texts`);
  const url = `https://archive.org/advancedsearch.php?q=${query}&${fieldParameters}&rows=3&page=1&output=json`;
  const response = await fetchJson<{ response?: { docs?: ArchiveDocument[] } }>(url);
  const match = response.response?.docs?.find(document => document.title);
  if (!match?.title) return null;

  const creators = Array.isArray(match.creator) ? match.creator : match.creator ? [match.creator] : [];
  const publishers = Array.isArray(match.publisher) ? match.publisher : match.publisher ? [match.publisher] : [];
  const subjects = Array.isArray(match.subject) ? match.subject : match.subject ? [match.subject] : [];
  return {
    title: match.title,
    author: creators.join(', '),
    publisher: publishers[0] || '',
    publicationYear: yearFrom(match.date),
    genre: subjects.slice(0, 3).join(', '),
  };
};

export const lookupIsbn = async (rawIsbn: string): Promise<IsbnBookDetails> => {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isValidIsbn(isbn)) {
    throw new Error('Enter a valid 10- or 13-digit ISBN. You can scan the ISBN printed above the book barcode.');
  }

  const requireMatch = async (lookup: Promise<Partial<IsbnBookDetails> | null>) => {
    const result = await lookup;
    if (!result?.title) throw new Error('No match from this catalog.');
    return result;
  };

  let match: Partial<IsbnBookDetails>;
  try {
    // Prefer the ISBN edition record for accuracy. The broader catalogs are only
    // fallbacks for older books that do not yet have an edition record.
    match = await requireMatch(lookupWithEditionApi(isbn));
  } catch {
    try {
      match = await Promise.any([
        requireMatch(lookupWithInternetArchive(isbn)),
        requireMatch(lookupWithBooksApi(isbn)),
        requireMatch(lookupWithSearchApi(isbn)),
      ]);
    } catch {
      throw new Error('No book was found for that ISBN, or the catalogs are unavailable. Check the number or enter the details manually.');
    }
  }

  return {
    title: match.title || '',
    author: match.author || '',
    publisher: match.publisher || '',
    publicationYear: match.publicationYear || '',
    genre: match.genre || '',
  };
};
