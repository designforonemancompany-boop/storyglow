type StoryLike = {
  title: string;
  dedication: string;
  pages: Array<{
    title: string;
    text: string;
    sceneDescription: string;
  }>;
};

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function capitalizeOpening(value: string) {
  const cleaned = clean(value);
  const index = cleaned.search(/[A-Za-z]/);
  if (index < 0) return cleaned;
  return `${cleaned.slice(0, index)}${cleaned.charAt(index).toUpperCase()}${cleaned.slice(index + 1)}`;
}

export function normalizeStoryBook<T extends StoryLike>(book: T): T {
  return {
    ...book,
    title: capitalizeOpening(book.title),
    dedication: capitalizeOpening(book.dedication),
    pages: book.pages.map(page => ({
      ...page,
      title: capitalizeOpening(page.title),
      text: capitalizeOpening(page.text),
      sceneDescription: capitalizeOpening(page.sceneDescription),
    })),
  };
}
