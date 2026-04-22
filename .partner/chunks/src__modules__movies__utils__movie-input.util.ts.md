# FILE: src/modules/movies/utils/movie-input.util.ts

path: src/modules/movies/utils/movie-input.util.ts
module: movies
kind: file
language: ts
line_count: 71
size_bytes: 1996
sha256: 5cda385954ec92852a525fef7bda7a8524d600e8d04608ae57d96e919f5d09b1
updated_at: 2026-04-15T12:42:21.294Z

## SYMBOLS
- prepareMovieInput
- normalizeRequiredText
- normalizeOptionalText

## CODE

````ts
import { BadRequestException } from '@nestjs/common';

import { generateSlug } from '../../../common/utils/slug.util';

export interface PreparedMovieInput {
  title: string;
  baseSlug: string;
  posterUrl: string;
  trailerUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  duration: number;
  director: string | null;
  actor: string | null;
  language: string | null;
  rated: string | null;
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new BadRequestException(`${fieldName} không được để trống.`);
  }

  return normalizedValue;
}

function normalizeOptionalText(value?: string): string | null {
  if (value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function prepareMovieInput(input: {
  title: string;
  posterUrl: string;
  trailerUrl?: string;
  bannerUrl?: string;
  description?: string;
  duration: number;
  director?: string;
  actor?: string;
  language?: string;
  rated?: string;
}): PreparedMovieInput {
  const title = normalizeRequiredText(input.title, 'Tên phim');
  const posterUrl = normalizeRequiredText(input.posterUrl, 'Poster phim');

  if (input.duration <= 0) {
    throw new BadRequestException('Thời lượng phim phải lớn hơn 0.');
  }

  return {
    title,
    baseSlug: generateSlug(title),
    posterUrl,
    trailerUrl: normalizeOptionalText(input.trailerUrl),
    bannerUrl: normalizeOptionalText(input.bannerUrl),
    description: normalizeOptionalText(input.description),
    duration: input.duration,
    director: normalizeOptionalText(input.director),
    actor: normalizeOptionalText(input.actor),
    language: normalizeOptionalText(input.language),
    rated: normalizeOptionalText(input.rated),
  };
}

````
