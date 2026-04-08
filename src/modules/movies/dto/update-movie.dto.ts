<<<<<<< HEAD
import { CreateMovieDto } from './create-movie.dto';

export class UpdateMovieDto extends CreateMovieDto {}
=======
import { PartialType } from '@nestjs/mapped-types';
import { CreateMovieDto } from './create-movie.dto';

export class UpdateMovieDto extends PartialType(CreateMovieDto) {}
>>>>>>> origin/main
