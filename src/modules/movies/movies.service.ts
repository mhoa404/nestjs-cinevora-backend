import {
  BadRequestException,
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

  async findOneBySlugOrId(slugOrId: string): Promise<MovieResponseDto> {
    const movie = await this.findEntityBySlugOrId(slugOrId);
    return MovieResponseDto.fromEntity(movie);
  }

  async update(id: number, dto: UpdateMovieDto): Promise<MovieResponseDto> {
    const movie = await this.findEntityById(id);

    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('Không có dữ liệu nào để cập nhật.');
    }

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

    if (updateInput.title !== undefined) {
      movie.slug = this.buildMovieSlug(updateInput.baseSlug!, movie.id);
    }

    assignDefined(movie, {
      title: updateInput.title,
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
      endDate:
        dto.endDate !== undefined
          ? dto.endDate
            ? new Date(dto.endDate)
            : null
          : undefined,
    });

    if (dto.genreIds !== undefined) {
      movie.genres = await this.validateGenreIds(dto.genreIds);
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
    if (!endDate) return;

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
