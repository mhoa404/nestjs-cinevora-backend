import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Genre } from '../genres/entities/genre.entity';
import { CreateMovieDto } from './dto/create-movie.dto';
import { MovieResponseDto } from './dto/movie-response.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Movie, MovieStatus } from './entities/movie.entity';
import { buildMovieInput } from './utils/movie-input.util';
import { assignDefined } from '../../common/utils/assign-defined.util';

const CLEARABLE_FIELDS = new Set([
  'description',
  'director',
  'actor',
  'language',
  'rated',
]);

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async create(dto: CreateMovieDto): Promise<MovieResponseDto> {
    this.validateEndDate(dto.endDate, dto.releaseDate);

    const createInput = buildMovieInput({
      title: dto.title,
      posterUrl: dto.posterUrl,
      trailerUrl: dto.trailerUrl,
      bannerUrl: dto.bannerUrl,
      description: dto.description,
      duration: dto.duration,
      director: dto.director,
      actor: dto.actor,
      language: dto.language,
      rated: dto.rated,
    });

    const genres = await this.validateGenreIds(dto.genreIds);

    let movie = this.movieRepository.create({
      title: createInput.title,
      posterUrl: createInput.posterUrl,
      trailerUrl: createInput.trailerUrl,
      bannerUrl: createInput.bannerUrl,
      description: createInput.description,
      duration: createInput.duration,
      director: createInput.director,
      actor: createInput.actor,
      language: createInput.language,
      ageRating: dto.ageRating,
      rated: createInput.rated,
      status: dto.status ?? MovieStatus.COMING,
      releaseDate: new Date(dto.releaseDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      genres,
    });

    movie = await this.movieRepository.save(movie);

    movie.slug = this.buildMovieSlug(createInput.baseSlug!, movie.id);

    const savedMovie = await this.movieRepository.save(movie);

    return MovieResponseDto.fromEntity(savedMovie);
  }

  async findAll(): Promise<MovieResponseDto[]> {
    const movies = await this.movieRepository.find({
      relations: ['genres'],
      order: { createdAt: 'DESC' },
    });

    return movies.map((movie) => MovieResponseDto.fromEntity(movie));
  }

  async findBySlugOrId(slugOrId: string): Promise<MovieResponseDto> {
    const movie = await this.findEntityBySlugOrId(slugOrId);
    return MovieResponseDto.fromEntity(movie);
  }

  private assertUpdatePayload(dto: UpdateMovieDto): void {
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Không có dữ liệu nào để cập nhật.');
    }

    const nullFields = Object.entries(dto)
      .filter(([, value]) => value === null)
      .map(([key]) => key);

    if (nullFields.length > 0) {
      throw new BadRequestException(
        `Không hỗ trợ set null cho PATCH: ${nullFields.join(', ')}.`,
      );
    }

    const emptyStringFields = Object.entries(dto)
      .filter(
        ([key, value]) =>
          typeof value === 'string' &&
          value.length === 0 &&
          !CLEARABLE_FIELDS.has(key),
      )
      .map(([key]) => key);

    if (emptyStringFields.length > 0) {
      throw new BadRequestException(
        `Không hỗ trợ giá trị chuỗi rỗng cho PATCH: ${emptyStringFields.join(', ')}.`,
      );
    }

    if (dto.genreIds !== undefined && dto.genreIds.length === 0) {
      throw new BadRequestException(
        'genreIds không được là mảng rỗng trong PATCH.',
      );
    }
  }

  private hasDefinedMovieFieldChange(
    movie: Movie,
    nextValues: Partial<Movie>,
  ): boolean {
    return Object.entries(nextValues).some(([key, nextValue]) => {
      if (nextValue === undefined) {
        return false;
      }

      const oldValue = movie[key as keyof Movie];

      if (oldValue instanceof Date && nextValue instanceof Date) {
        return oldValue.getTime() !== nextValue.getTime();
      }

      return oldValue !== nextValue;
    });
  }

  private hasSameGenreIds(
    currentGenres: Genre[],
    nextGenres: Genre[],
  ): boolean {
    if (currentGenres.length !== nextGenres.length) {
      return false;
    }

    const currentIds = currentGenres.map((genre) => genre.id).sort();
    const nextIds = nextGenres.map((genre) => genre.id).sort();

    return currentIds.every((currentId, index) => currentId === nextIds[index]);
  }

  private async assertSlugUnique(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.movieRepository.findOne({ where: { slug } });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Slug phim đã tồn tại.');
    }
  }

  async update(id: number, dto: UpdateMovieDto): Promise<MovieResponseDto> {
    this.assertUpdatePayload(dto);

    const movie = await this.findEntityById(id);

    this.validateEndDate(dto.endDate, dto.releaseDate);

    const updateInput = buildMovieInput({
      title: dto.title,
      posterUrl: dto.posterUrl,
      trailerUrl: dto.trailerUrl,
      bannerUrl: dto.bannerUrl,
      description: dto.description,
      duration: dto.duration,
      director: dto.director,
      actor: dto.actor,
      language: dto.language,
      rated: dto.rated,
    });

    let hasChange = false;

    if (updateInput.title !== undefined) {
      const nextSlug = this.buildMovieSlug(updateInput.baseSlug!, movie.id);

      if (movie.slug !== nextSlug) {
        await this.assertSlugUnique(nextSlug, movie.id);
      }

      if (movie.title !== updateInput.title) {
        movie.title = updateInput.title;
        hasChange = true;
      }

      if (movie.slug !== nextSlug) {
        movie.slug = nextSlug;
        hasChange = true;
      }
    }

    const nextValues: Partial<Movie> = {
      posterUrl: updateInput.posterUrl,
      trailerUrl: updateInput.trailerUrl,
      bannerUrl: updateInput.bannerUrl,
      description: updateInput.description,
      duration: updateInput.duration,
      director: updateInput.director,
      actor: updateInput.actor,
      language: updateInput.language,
      rated: updateInput.rated,
      ageRating: dto.ageRating,
      status: dto.status,
      releaseDate:
        dto.releaseDate !== undefined ? new Date(dto.releaseDate) : undefined,
      endDate: dto.endDate !== undefined ? new Date(dto.endDate) : undefined,
    };

    if (this.hasDefinedMovieFieldChange(movie, nextValues)) {
      assignDefined(movie, nextValues);
      hasChange = true;
    }

    if (dto.genreIds !== undefined) {
      const nextGenres = await this.validateGenreIds(dto.genreIds);

      if (!this.hasSameGenreIds(movie.genres, nextGenres)) {
        movie.genres = nextGenres;
        hasChange = true;
      }
    }

    if (!hasChange) {
      return MovieResponseDto.fromEntity(movie);
    }

    const savedMovie = await this.movieRepository.save(movie);
    return MovieResponseDto.fromEntity(savedMovie);
  }

  async remove(id: number): Promise<void> {
    const movie = await this.findEntityById(id);

    if (movie.status !== MovieStatus.ENDED) {
      throw new BadRequestException(
        'Chỉ có thể xoá phim khi trạng thái đã kết thúc.',
      );
    }

    await this.movieRepository.remove(movie);
  }

  private async findEntityById(id: number): Promise<Movie> {
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: ['genres'],
    });

    if (!movie) {
      throw new NotFoundException(`Phim #${id} không tồn tại.`);
    }

    return movie;
  }

  private async findEntityBySlugOrId(slugOrId: string): Promise<Movie> {
    const isNumericId = /^\d+$/.test(slugOrId);

    const query = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genres');

    if (isNumericId) {
      query.where('movie.id = :id', { id: Number(slugOrId) });
    } else {
      query.where('movie.slug = :slug', { slug: slugOrId });
    }

    const movie = await query.getOne();

    if (!movie) {
      throw new NotFoundException(
        `Không tìm thấy phim với định danh "${slugOrId}".`,
      );
    }

    return movie;
  }

  private async validateGenreIds(genreIds?: number[]): Promise<Genre[]> {
    if (!genreIds || genreIds.length === 0) {
      return [];
    }

    const genres = await this.genreRepository.find({
      where: { id: In(genreIds) },
    });

    const foundIds = new Set(genres.map((genre) => genre.id));
    const invalidIds = genreIds.filter((genreId) => !foundIds.has(genreId));

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Thể loại với id [${invalidIds.join(', ')}] không tồn tại.`,
      );
    }

    return genres;
  }

  private buildMovieSlug(baseSlug: string, id: number): string {
    return `${baseSlug}-${String(id).padStart(3, '0')}`;
  }

  private validateEndDate(endDate?: string, releaseDate?: string): void {
    if (endDate === undefined) {
      return;
    }

    const end = new Date(endDate);

    const minAllowed = new Date();
    minAllowed.setDate(minAllowed.getDate() + 7);
    minAllowed.setHours(0, 0, 0, 0);

    if (end < minAllowed) {
      throw new BadRequestException(
        'Ngày kết thúc chiếu phải cách ít nhất 7 ngày kể từ hôm nay.',
      );
    }

    if (releaseDate && end <= new Date(releaseDate)) {
      throw new BadRequestException(
        'Ngày kết thúc chiếu phải sau ngày khởi chiếu.',
      );
    }
  }
}
