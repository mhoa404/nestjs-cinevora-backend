import {
  ConflictException,
<<<<<<< HEAD
=======
  BadRequestException,
>>>>>>> origin/main
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

<<<<<<< HEAD
=======
import { generateSlug } from '../../shared/utils/slug.util';
>>>>>>> origin/main
import { CreateGenreDto } from './dto/create-genre.dto';
import { GenreResponseDto } from './dto/genre-response.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';
import { Genre } from './entities/genre.entity';
<<<<<<< HEAD
import { prepareGenreInput } from './utils/genre-input.util';
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
    const { name, slug, normalizedName } = prepareGenreInput(dto.name);

    await this.assertNameUnique(normalizedName);
=======
    const name = dto.name.trim();

    if (name.length === 0) {
      throw new BadRequestException('Tên thể loại không được để trống.');
    }

    const slug = generateSlug(name);

    await this.assertNameUnique(name);
>>>>>>> origin/main
    await this.assertSlugUnique(slug);

    const genre = this.genreRepository.create({ name, slug });
    const saved = await this.genreRepository.save(genre);

    return GenreResponseDto.fromEntity(saved);
  }

  async update(id: number, dto: UpdateGenreDto): Promise<GenreResponseDto> {
    const genre = await this.findEntityById(id);
<<<<<<< HEAD
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
=======
    const name = dto.name.trim();

    if (name.length === 0) {
      throw new BadRequestException('Tên thể loại không được để trống.');
    }

    const slug = generateSlug(name);

    if (name !== genre.name) {
      await this.assertNameUnique(name, id);
    }

    if (slug !== genre.slug) {
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.genreRepository.findOne({ where: { name } });

    if (existing && existing.id !== excludeId) {
      if (existing.name.toLowerCase() === name.toLowerCase()) {
        throw new ConflictException(`Tên thể loại đã tồn tại`);
      }
>>>>>>> origin/main
    }
  }

  private async assertSlugUnique(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.genreRepository.findOne({ where: { slug } });

    if (existing && existing.id !== excludeId) {
<<<<<<< HEAD
      throw new ConflictException('Slug này đã tồn tại.');
=======
      throw new ConflictException(`Slug này đã tồn tại.`);
>>>>>>> origin/main
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
