import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Movie, MovieStatus } from './entities/movie.entity';
import { Genre } from '../genres/entities/genre.entity';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { generateSlug } from '../../shared/utils/slug.util';

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async create(createMovieDto: CreateMovieDto): Promise<Movie> {
    if (createMovieDto.genreIds && createMovieDto.genreIds.length > 0) {
      const existingGenres = await this.genreRepository.find({
        where: { id: In(createMovieDto.genreIds) },
      });
      const existingIds = existingGenres.map((g) => g.id);
      const invalidIds = createMovieDto.genreIds.filter(
        (id) => !existingIds.includes(id),
      );

      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `Thể loại với id [${invalidIds.join(', ')}] không tồn tại`,
        );
      }
    }

    const movieData = {
      ...createMovieDto,
      genres: createMovieDto.genreIds?.map((id) => ({ id })) || [],
    };

    let movie = this.movieRepository.create(movieData);

    movie = await this.movieRepository.save(movie);

    const idPadded = String(movie.id).padStart(3, '0');
    const baseSlug = generateSlug(movie.title);
    movie.slug = `${baseSlug}-${idPadded}`;

    return this.movieRepository.save(movie);
  }

  async findAll(): Promise<Movie[]> {
    return this.movieRepository.find({ relations: ['genres'] });
  }

  async findOneBySlugOrId(slugOrId: string): Promise<Movie> {
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
        `Movie with identifier ${slugOrId} not found`,
      );
    }
    return movie;
  }

  async update(id: number, updateMovieDto: UpdateMovieDto): Promise<Movie> {
    if (updateMovieDto.genreIds && updateMovieDto.genreIds.length > 0) {
      const existingGenres = await this.genreRepository.find({
        where: { id: In(updateMovieDto.genreIds) },
      });
      const existingIds = existingGenres.map((g) => g.id);
      const invalidIds = updateMovieDto.genreIds.filter(
        (genId) => !existingIds.includes(genId),
      );

      if (invalidIds.length > 0) {
        throw new BadRequestException(
          `Thể loại với id [${invalidIds.join(', ')}] không tồn tại`,
        );
      }
    }

    const { genreIds, ...restDto } = updateMovieDto;
    const updateData: Omit<UpdateMovieDto, 'genreIds'> & {
      genres?: Pick<Genre, 'id'>[];
    } = { ...restDto };

    if (genreIds) {
      updateData.genres = genreIds.map((val) => ({ id: val }));
    }

    const movie = await this.movieRepository.preload({
      id,
      ...updateData,
    });

    if (!movie) {
      throw new NotFoundException(`Movie #${id} not found`);
    }

    if (updateMovieDto.title) {
      const idPadded = String(movie.id).padStart(3, '0');
      const baseSlug = generateSlug(movie.title);
      movie.slug = `${baseSlug}-${idPadded}`;
    }

    return this.movieRepository.save(movie);
  }

  async remove(id: number): Promise<void> {
    const movie = await this.movieRepository.findOneBy({ id });
    if (!movie) {
      throw new NotFoundException(`Movie #${id} not found`);
    }

    if (movie.status !== MovieStatus.ENDED) {
      throw new BadRequestException(
        'Chỉ có thể xóa phim khi trạng thái đã chuyển sang ended.',
      );
    }

    await this.movieRepository.remove(movie);
  }
}
