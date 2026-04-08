import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';

import { hashRefreshToken } from '../../../common/utils/token-hash.util';
import { RefreshToken } from '../entities/refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  private getRepository(manager?: EntityManager): Repository<RefreshToken> {
    return manager
      ? manager.getRepository(RefreshToken)
      : this.refreshTokenRepository;
  }

  async save(
    userId: string,
    rawRefreshToken: string,
    expiresAt: Date,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = this.getRepository(manager);

    const refreshTokenEntity = repository.create({
      userId,
      token: hashRefreshToken(rawRefreshToken),
      expiresAt,
      isRevoked: false,
    });

    await repository.save(refreshTokenEntity);
  }

  async consumeValidToken(
    rawRefreshToken: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repository = this.getRepository(manager);
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const result = await repository.update(
      {
        token: tokenHash,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      {
        isRevoked: true,
      },
    );

    return (result.affected ?? 0) > 0;
  }

  async revokeActiveByRawToken(
    rawRefreshToken: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repository = this.getRepository(manager);
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const result = await repository.update(
      {
        token: tokenHash,
        isRevoked: false,
      },
      {
        isRevoked: true,
      },
    );

    return (result.affected ?? 0) > 0;
  }
}
