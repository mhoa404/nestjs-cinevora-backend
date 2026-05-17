import { generateSlug } from '../../../common/utils/slug.util';

export interface MovieInput {
  title?: string;
  baseSlug?: string;
  posterUrl?: string;
  trailerUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
  duration?: number;
  director?: string | null;
  actor?: string | null;
  language?: string | null;
  rated?: string | null;
}

function emptyStringToNull(value?: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value.length > 0 ? value : null;
}

export function buildMovieInput(input: {
  title?: string;
  posterUrl?: string;
  trailerUrl?: string;
  bannerUrl?: string;
  description?: string;
  duration?: number;
  director?: string;
  actor?: string;
  language?: string;
  rated?: string;
}): MovieInput {
  const movieInput: MovieInput = {};

  if (input.title !== undefined) {
    movieInput.title = input.title;
    movieInput.baseSlug = generateSlug(input.title);
  }

  if (input.posterUrl !== undefined) {
    movieInput.posterUrl = input.posterUrl;
  }

  if (input.duration !== undefined) {
    movieInput.duration = input.duration;
  }

  const trailerUrl = emptyStringToNull(input.trailerUrl);
  if (trailerUrl !== undefined) {
    movieInput.trailerUrl = trailerUrl;
  }

  const bannerUrl = emptyStringToNull(input.bannerUrl);
  if (bannerUrl !== undefined) {
    movieInput.bannerUrl = bannerUrl;
  }

  const description = emptyStringToNull(input.description);
  if (description !== undefined) {
    movieInput.description = description;
  }

  const director = emptyStringToNull(input.director);
  if (director !== undefined) {
    movieInput.director = director;
  }

  const actor = emptyStringToNull(input.actor);
  if (actor !== undefined) {
    movieInput.actor = actor;
  }

  const language = emptyStringToNull(input.language);
  if (language !== undefined) {
    movieInput.language = language;
  }

  const rated = emptyStringToNull(input.rated);
  if (rated !== undefined) {
    movieInput.rated = rated;
  }

  return movieInput;
}
