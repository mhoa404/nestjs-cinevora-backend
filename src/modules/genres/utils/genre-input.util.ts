import { BadRequestException } from '@nestjs/common';

import { generateSlug } from '../../../common/utils/slug.util';

export interface PreparedGenreInput {
  name: string;
  slug: string;
  normalizedName: string;
}

export function prepareGenreInput(rawName: string): PreparedGenreInput {
  const name = rawName.trim();

  if (name.length === 0) {
    throw new BadRequestException('Tên thể loại không được để trống.');
  }

  return {
    name,
    slug: generateSlug(name),
    normalizedName: name.toLowerCase(),
  };
}
