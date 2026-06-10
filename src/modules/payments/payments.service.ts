import axios, { AxiosError } from 'axios';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { UserRole } from '../../common/constants/role.constant';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { CheckMomoTransactionStatusDto } from './dto/check-momo-transaction-status.dto';
import { CreateMomoPaymentDto } from './dto/create-payment.dto';
import { MomoCallbackDto } from './dto/payment-callback.dto';
import {
  Payment,
  PaymentGatewayMetadata,
  PaymentMethod,
  PaymentStatus,
} from './entities/payment.entity';
import {
  CheckMomoTransactionStatusResponse,
  CreateMomoPaymentResponse,
  MomoCreatePaymentApiResponse,
  MomoQueryTransactionApiResponse,
} from './interfaces/momo-response.interface';
import { MomoConfig } from './providers/momo/momo.config';
import {
  buildMomoCallbackRawSignature,
  buildMomoCreateRawSignature,
  buildMomoQueryRawSignature,
  createMomoSignature,
  verifyMomoSignature,
} from './utils/momo-signature.util';

interface MomoPaymentResult {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  transId?: number | string | null;
  resultCode: number;
  message: string;
  responseTime: number;
  metadataKey: 'callbackPayload' | 'queryResponse';
  metadata: Record<string, unknown>;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,

    private readonly dataSource: DataSource,
    private readonly momoConfig: MomoConfig,
  ) {}

  async createMomoPayment(
    dto: CreateMomoPaymentDto,
    user: User,
  ): Promise<CreateMomoPaymentResponse> {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking không tồn tại.');
    }

    if (booking.userId !== user.id) {
      throw new NotFoundException('Booking không tồn tại.');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Không thể thanh toán booking trạng thái "${booking.status}".`,
      );
    }

    if (booking.expiresAt <= new Date()) {
      await this.bookingRepository.update(booking.id, {
        status: BookingStatus.EXPIRED,
      });

      throw new BadRequestException('Booking đã hết hạn thanh toán.');
    }

    const amount = Number(booking.totalPrice);

    if (!Number.isInteger(amount)) {
      throw new BadRequestException('Số tiền thanh toán không hợp lệ.');
    }

    if (amount < 1000 || amount > 50000000) {
      throw new BadRequestException(
        'Số tiền thanh toán MoMo phải nằm trong khoảng 1.000 đến 50.000.000 VND.',
      );
    }

    const orderId = `BOOKING_${booking.id}_${Date.now()}`;
    const requestId = orderId;
    const orderInfo = this.momoConfig.orderInfo;

    const rawSignature = buildMomoCreateRawSignature({
      accessKey: this.momoConfig.accessKey,
      amount,
      extraData: this.momoConfig.extraData,
      ipnUrl: this.momoConfig.ipnUrl,
      orderId,
      orderInfo,
      partnerCode: this.momoConfig.partnerCode,
      redirectUrl: this.momoConfig.redirectUrl,
      requestId,
      requestType: this.momoConfig.requestType,
    });

    const signature = createMomoSignature(
      rawSignature,
      this.momoConfig.secretKey,
    );

    const requestBody = {
      partnerCode: this.momoConfig.partnerCode,
      partnerName: this.momoConfig.partnerName,
      storeId: this.momoConfig.storeId,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: this.momoConfig.redirectUrl,
      ipnUrl: this.momoConfig.ipnUrl,
      lang: this.momoConfig.lang,
      requestType: this.momoConfig.requestType,
      autoCapture: this.momoConfig.autoCapture,
      extraData: this.momoConfig.extraData,
      orderGroupId: this.momoConfig.orderGroupId,
      signature,
    };

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        bookingId: booking.id,
        amount,
        method: PaymentMethod.MOMO,
        status: PaymentStatus.PENDING,
        gatewayOrderId: orderId,
        gatewayTransId: null,
        gatewayMetadata: {
          momo: {
            createRequest: requestBody,
          },
        },
        paidAt: null,
      }),
    );

    let responseData: MomoCreatePaymentApiResponse;

    try {
      const response = await axios.post<MomoCreatePaymentApiResponse>(
        this.momoConfig.createEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      responseData = response.data;
    } catch (error) {
      const message = this.getAxiosErrorMessage(error);

      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        gatewayMetadata: this.toPaymentGatewayMetadataUpdate(
          this.mergeGatewayMetadata(payment.gatewayMetadata, {
            momo: {
              createRequest: requestBody,
              createError: message,
            },
          }),
        ),
      });

      throw new BadGatewayException(
        `Không thể tạo thanh toán MoMo: ${message}`,
      );
    }

    const nextStatus =
      responseData.resultCode === 0
        ? PaymentStatus.PENDING
        : PaymentStatus.FAILED;

    await this.paymentRepository.update(payment.id, {
      status: nextStatus,
      gatewayMetadata: this.toPaymentGatewayMetadataUpdate(
        this.mergeGatewayMetadata(payment.gatewayMetadata, {
          momo: {
            createRequest: requestBody,
            createResponse: responseData,
          },
        }),
      ),
    });

    const updatedPayment = await this.paymentRepository.findOne({
      where: { id: payment.id },
    });

    if (!updatedPayment) {
      throw new BadGatewayException(
        'Không thể đọc lại dữ liệu payment sau khi tạo giao dịch MoMo.',
      );
    }

    if (responseData.resultCode !== 0) {
      throw new BadGatewayException(responseData.message);
    }

    return this.toCreateMomoPaymentResponse(updatedPayment);
  }

  async handleMomoCallback(dto: MomoCallbackDto): Promise<void> {
    const rawSignature = buildMomoCallbackRawSignature({
      accessKey: this.momoConfig.accessKey,
      amount: dto.amount,
      extraData: dto.extraData ?? '',
      message: dto.message,
      orderId: dto.orderId,
      orderInfo: dto.orderInfo,
      orderType: dto.orderType,
      partnerCode: dto.partnerCode,
      payType: dto.payType,
      requestId: dto.requestId,
      responseTime: dto.responseTime,
      resultCode: dto.resultCode,
      transId: dto.transId,
    });

    const isValidSignature = verifyMomoSignature({
      rawSignature,
      secretKey: this.momoConfig.secretKey,
      receivedSignature: dto.signature,
    });

    if (!isValidSignature) {
      this.logger.warn(
        `Invalid MoMo callback signature: orderId=${dto.orderId}, requestId=${dto.requestId}`,
      );

      throw new BadRequestException('Chữ ký callback MoMo không hợp lệ.');
    }

    const payment = await this.paymentRepository.findOne({
      where: {
        gatewayOrderId: dto.orderId,
        method: PaymentMethod.MOMO,
      },
    });

    if (!payment) {
      this.logger.warn(
        `MoMo callback payment not found: orderId=${dto.orderId}, requestId=${dto.requestId}`,
      );

      throw new NotFoundException('Không tìm thấy payment tương ứng.');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return;
    }

    const momoResult: MomoPaymentResult = {
      partnerCode: dto.partnerCode,
      orderId: dto.orderId,
      requestId: dto.requestId,
      amount: dto.amount,
      transId: dto.transId,
      resultCode: dto.resultCode,
      message: dto.message,
      responseTime: dto.responseTime,
      metadataKey: 'callbackPayload',
      metadata: dto as unknown as Record<string, unknown>,
    };

    this.assertValidMomoResult(payment, momoResult);
    await this.syncPaymentResult(payment, momoResult);
  }

  async checkMomoTransactionStatus(
    dto: CheckMomoTransactionStatusDto,
    user: User,
  ): Promise<CheckMomoTransactionStatusResponse> {
    const payment = await this.paymentRepository.findOne({
      where: {
        gatewayOrderId: dto.orderId,
        method: PaymentMethod.MOMO,
      },
      relations: {
        booking: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy payment tương ứng.');
    }

    this.assertCanAccessPayment(payment, user);

    const requestId = this.getMomoRequestId(payment);

    const rawSignature = buildMomoQueryRawSignature({
      accessKey: this.momoConfig.accessKey,
      orderId: payment.gatewayOrderId,
      partnerCode: this.momoConfig.partnerCode,
      requestId,
    });

    const signature = createMomoSignature(
      rawSignature,
      this.momoConfig.secretKey,
    );

    const requestBody = {
      partnerCode: this.momoConfig.partnerCode,
      requestId,
      orderId: payment.gatewayOrderId,
      signature,
      lang: this.momoConfig.lang,
    };

    let responseData: MomoQueryTransactionApiResponse;

    try {
      const response = await axios.post<MomoQueryTransactionApiResponse>(
        this.momoConfig.queryEndpoint,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      responseData = response.data;
    } catch (error) {
      const message = this.getAxiosErrorMessage(error);

      await this.paymentRepository.update(payment.id, {
        gatewayMetadata: this.toPaymentGatewayMetadataUpdate(
          this.mergeGatewayMetadata(payment.gatewayMetadata, {
            momo: {
              queryRequest: requestBody,
              queryError: message,
            },
          }),
        ),
      });

      throw new BadGatewayException(
        `Không thể kiểm tra trạng thái giao dịch MoMo: ${message}`,
      );
    }

    const momoResult: MomoPaymentResult = {
      partnerCode: responseData.partnerCode,
      orderId: responseData.orderId,
      requestId: responseData.requestId,
      amount: responseData.amount,
      transId: responseData.transId ?? null,
      resultCode: responseData.resultCode,
      message: responseData.message,
      responseTime: responseData.responseTime,
      metadataKey: 'queryResponse',
      metadata: responseData as unknown as Record<string, unknown>,
    };

    this.assertValidMomoResult(payment, momoResult);

    await this.syncPaymentResult(payment, momoResult, {
      queryRequest: requestBody,
    });

    const nextPaymentStatus = this.getPaymentStatusFromMomoResultCode(
      responseData.resultCode,
    );

    const nextBookingStatus =
      this.getBookingStatusFromPaymentStatus(nextPaymentStatus);

    return {
      orderId: payment.gatewayOrderId,
      requestId,
      amount: Number(payment.amount),
      transId:
        responseData.transId !== undefined
          ? String(responseData.transId)
          : payment.gatewayTransId,
      resultCode: responseData.resultCode,
      message: responseData.message,
      paymentStatus: nextPaymentStatus,
      bookingStatus: nextBookingStatus,
      responseTime: responseData.responseTime,
    };
  }

  private async syncPaymentResult(
    payment: Payment,
    momoResult: MomoPaymentResult,
    extraMomoMetadata?: Record<string, unknown>,
  ): Promise<void> {
    if (payment.status === PaymentStatus.SUCCESS) {
      return;
    }

    const nextPaymentStatus = this.getPaymentStatusFromMomoResultCode(
      momoResult.resultCode,
    );

    const nextBookingStatus =
      this.getBookingStatusFromPaymentStatus(nextPaymentStatus);

    const nextGatewayTransId =
      momoResult.transId !== undefined && momoResult.transId !== null
        ? String(momoResult.transId)
        : payment.gatewayTransId;

    const nextGatewayMetadata = this.mergeGatewayMetadata(
      payment.gatewayMetadata,
      {
        momo: {
          ...(extraMomoMetadata ?? {}),
          [momoResult.metadataKey]: momoResult.metadata,
        },
      },
    );

    await this.dataSource.transaction(async (manager) => {
      const paymentRepository = manager.getRepository(Payment);
      const bookingRepository = manager.getRepository(Booking);

      await paymentRepository.update(payment.id, {
        status: nextPaymentStatus,
        gatewayTransId: nextGatewayTransId,
        gatewayMetadata:
          this.toPaymentGatewayMetadataUpdate(nextGatewayMetadata),
        paidAt:
          nextPaymentStatus === PaymentStatus.SUCCESS
            ? new Date(momoResult.responseTime)
            : payment.paidAt,
      });

      if (nextBookingStatus) {
        await bookingRepository.update(payment.bookingId, {
          status: nextBookingStatus,
        });
      }
    });
  }

  private assertValidMomoResult(
    payment: Payment,
    momoResult: MomoPaymentResult,
  ): void {
    if (momoResult.partnerCode !== this.momoConfig.partnerCode) {
      this.logger.warn(
        `MoMo partnerCode mismatch: orderId=${momoResult.orderId}, received=${momoResult.partnerCode}`,
      );

      throw new BadRequestException('partnerCode không hợp lệ.');
    }

    if (momoResult.orderId !== payment.gatewayOrderId) {
      this.logger.warn(
        `MoMo orderId mismatch: expected=${payment.gatewayOrderId}, received=${momoResult.orderId}`,
      );

      throw new BadRequestException('orderId không hợp lệ.');
    }

    if (momoResult.requestId !== this.getMomoRequestId(payment)) {
      this.logger.warn(
        `MoMo requestId mismatch: expected=${this.getMomoRequestId(payment)}, received=${momoResult.requestId}`,
      );

      throw new BadRequestException('requestId không hợp lệ.');
    }

    if (Number(payment.amount) !== Number(momoResult.amount)) {
      this.logger.warn(
        `MoMo amount mismatch: orderId=${momoResult.orderId}, expected=${payment.amount}, received=${momoResult.amount}`,
      );

      throw new BadRequestException('Số tiền không khớp.');
    }
  }

  private assertCanAccessPayment(payment: Payment, user: User): void {
    const privilegedRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

    if (privilegedRoles.includes(user.role)) {
      return;
    }

    if (payment.booking.userId === user.id) {
      return;
    }

    throw new ForbiddenException('Bạn không có quyền truy cập payment này.');
  }

  private getPaymentStatusFromMomoResultCode(
    resultCode: number,
  ): PaymentStatus {
    if (resultCode === 0) {
      return PaymentStatus.SUCCESS;
    }

    if (resultCode === 9000) {
      return PaymentStatus.AUTHORIZED;
    }

    if ([7000, 7002].includes(resultCode)) {
      return PaymentStatus.PENDING;
    }

    return PaymentStatus.FAILED;
  }

  private getBookingStatusFromPaymentStatus(
    paymentStatus: PaymentStatus,
  ): BookingStatus | null {
    if (paymentStatus === PaymentStatus.SUCCESS) {
      return BookingStatus.PAID;
    }

    return null;
  }

  private toCreateMomoPaymentResponse(
    payment: Payment,
  ): CreateMomoPaymentResponse {
    const createResponse = this.getMomoMetadataObject(
      payment,
      'createResponse',
    );

    return {
      orderId: payment.gatewayOrderId,
      requestId: this.getMomoRequestId(payment),
      amount: Number(payment.amount),
      resultCode: this.getMetadataNumber(createResponse, 'resultCode'),
      message: this.getMetadataString(createResponse, 'message'),
      payUrl: this.getMetadataString(createResponse, 'payUrl'),
      shortLink: this.getMetadataString(createResponse, 'shortLink'),
    };
  }

  private getMomoRequestId(payment: Payment): string {
    const createRequest = this.getMomoMetadataObject(payment, 'createRequest');
    return (
      this.getMetadataString(createRequest, 'requestId') ??
      payment.gatewayOrderId
    );
  }

  private getMomoMetadataObject(
    payment: Payment,
    key: string,
  ): Record<string, unknown> | null {
    const momoMetadata = payment.gatewayMetadata?.momo;

    if (!this.isRecord(momoMetadata)) {
      return null;
    }

    const value = momoMetadata[key];

    if (!this.isRecord(value)) {
      return null;
    }

    return value;
  }

  private getMetadataString(
    metadata: Record<string, unknown> | null,
    key: string,
  ): string | null {
    const value = metadata?.[key];

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }

  private getMetadataNumber(
    metadata: Record<string, unknown> | null,
    key: string,
  ): number | null {
    const value = metadata?.[key];

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    return null;
  }

  private mergeGatewayMetadata(
    currentMetadata: PaymentGatewayMetadata | null,
    nextMetadata: PaymentGatewayMetadata,
  ): PaymentGatewayMetadata {
    const currentMomoMetadata = this.isRecord(currentMetadata?.momo)
      ? currentMetadata.momo
      : {};

    const nextMomoMetadata = this.isRecord(nextMetadata.momo)
      ? nextMetadata.momo
      : {};

    return {
      ...(currentMetadata ?? {}),
      ...nextMetadata,
      momo: {
        ...currentMomoMetadata,
        ...nextMomoMetadata,
      },
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getAxiosErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      const responseData = error.response?.data as
        | { message?: string; error?: string }
        | undefined;

      return responseData?.message ?? responseData?.error ?? error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  private toPaymentGatewayMetadataUpdate(
    metadata: PaymentGatewayMetadata | null,
  ): QueryDeepPartialEntity<PaymentGatewayMetadata | null> {
    return metadata as unknown as QueryDeepPartialEntity<PaymentGatewayMetadata | null>;
  }
}
