import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateGenreDto } from './dto/create-genre.dto';
import { GenreResponseDto } from './dto/genre-response.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';
import { Genre } from './entities/genre.entity';
import { prepareGenreInput } from './utils/genre-input.util';

@Injectable()
export class GenresService {
  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async findAll(): Promise<GenreResponseDto[]> {
    const genres = await this.genreRepository.find({
      order: { name: 'ASC' },
    });

    return genres.map((genre) => GenreResponseDto.fromEntity(genre));
  }

  async findOne(id: number): Promise<GenreResponseDto> {
    const genre = await this.findEntityById(id);
    return GenreResponseDto.fromEntity(genre);
  }

  async create(dto: CreateGenreDto): Promise<GenreResponseDto> {
    const { name, slug, normalizedName } = prepareGenreInput(dto.name);

    await this.assertNameUnique(normalizedName);
    await this.assertSlugUnique(slug);

    const genre = this.genreRepository.create({ name, slug });
    const saved = await this.genreRepository.save(genre);

    return GenreResponseDto.fromEntity(saved);
  }

  async update(id: number, dto: UpdateGenreDto): Promise<GenreResponseDto> {
    const genre = await this.findEntityById(id);
    const { name, slug, normalizedName } = prepareGenreInput(dto.name);

    const isSameName = name === genre.name;
    const isSameSlug = slug === genre.slug;

    if (isSameName && isSameSlug) {
      return GenreResponseDto.fromEntity(genre);
    }

    if (!isSameName) {
      await this.assertNameUnique(normalizedName, id);
    }

    if (!isSameSlug) {
      await this.assertSlugUnique(slug, id);
    }

    genre.name = name;
    genre.slug = slug;

    const saved = await this.genreRepository.save(genre);
    return GenreResponseDto.fromEntity(saved);
  }

  async remove(id: number): Promise<void> {
    const genre = await this.findEntityById(id);
    await this.assertNotInUse(id);
    await this.genreRepository.remove(genre);
  }

  private async findEntityById(id: number): Promise<Genre> {
    const genre = await this.genreRepository.findOne({ where: { id } });

    if (!genre) {
      throw new NotFoundException(`Thể loại #${id} không tồn tại.`);
    }

    return genre;
  }

  private async assertNameUnique(
    normalizedName: string,
    excludeId?: number,
  ): Promise<void> {
    const query = this.genreRepository
      .createQueryBuilder('genre')
      .where('LOWER(genre.name) = :normalizedName', { normalizedName });

    if (excludeId !== undefined) {
      query.andWhere('genre.id != :excludeId', { excludeId });
    }

    const existing = await query.getOne();

    if (existing) {
      throw new ConflictException('Tên thể loại đã tồn tại');
    }
  }

  private async assertSlugUnique(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.genreRepository.findOne({ where: { slug } });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Slug này đã tồn tại.');
    }
  }

  private async assertNotInUse(id: number): Promise<void> {
    const count = await this.genreRepository
      .createQueryBuilder('genre')
      .innerJoin('genre.movies', 'movie')
      .where('genre.id = :id', { id })
      .getCount();

    if (count > 0) {
      throw new ConflictException(
        `Không thể xoá thể loại đang được sử dụng bởi ${count} phim.`,
      );
    }
  }
}
