// src/modules/payments/payments.service.ts
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

import { UserRole } from '../../common/constants/role.constant';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { CheckMomoTransactionStatusDto } from './dto/check-momo-transaction-status.dto';
import { CreateMomoPaymentDto } from './dto/create-payment.dto';
import { MomoCallbackDto } from './dto/payment-callback.dto';
import {
  Payment,
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
  rawResponseKey: 'callbackResponse' | 'queryResponse';
  rawResponse: Record<string, unknown>;
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

    const existingPendingPayment = await this.paymentRepository.findOne({
      where: {
        bookingId: booking.id,
        method: PaymentMethod.MOMO,
        status: PaymentStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    if (existingPendingPayment?.payUrl) {
      return this.toCreateMomoPaymentResponse(existingPendingPayment);
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
        momoOrderId: orderId,
        momoRequestId: requestId,
        momoTransId: null,
        payUrl: null,
        shortLink: null,
        resultCode: null,
        message: null,
        responseTime: null,
        rawResponse: {
          createRequest: requestBody,
        },
        paidAt: null,
      }),
    );

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

      await this.paymentRepository.update(payment.id, {
        payUrl: response.data.payUrl ?? null,
        shortLink: response.data.shortLink ?? null,
        resultCode: response.data.resultCode,
        message: response.data.message,
        responseTime: String(response.data.responseTime),
        rawResponse: {
          createRequest: requestBody,
          createResponse: response.data,
        },
        status:
          response.data.resultCode === 0
            ? PaymentStatus.PENDING
            : PaymentStatus.FAILED,
      });

      const updatedPayment = await this.paymentRepository.findOne({
        where: { id: payment.id },
      });

      if (!updatedPayment) {
        throw new BadGatewayException(
          'Không thể đọc lại dữ liệu payment sau khi tạo giao dịch MoMo.',
        );
      }

      if (response.data.resultCode !== 0) {
        throw new BadGatewayException(response.data.message);
      }

      return this.toCreateMomoPaymentResponse(updatedPayment);
    } catch (error) {
      const message = this.getAxiosErrorMessage(error);

      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        message,
        rawResponse: {
          createRequest: requestBody,
          createError: message,
        },
      });

      throw new BadGatewayException(
        `Không thể tạo thanh toán MoMo: ${message}`,
      );
    }
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
        momoOrderId: dto.orderId,
        momoRequestId: dto.requestId,
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

    this.assertValidMomoResult(payment, {
      partnerCode: dto.partnerCode,
      orderId: dto.orderId,
      requestId: dto.requestId,
      amount: dto.amount,
      transId: dto.transId,
      resultCode: dto.resultCode,
      message: dto.message,
      responseTime: dto.responseTime,
      rawResponseKey: 'callbackResponse',
      rawResponse: dto as unknown as Record<string, unknown>,
    });

    await this.syncPaymentResult(payment, {
      partnerCode: dto.partnerCode,
      orderId: dto.orderId,
      requestId: dto.requestId,
      amount: dto.amount,
      transId: dto.transId,
      resultCode: dto.resultCode,
      message: dto.message,
      responseTime: dto.responseTime,
      rawResponseKey: 'callbackResponse',
      rawResponse: dto as unknown as Record<string, unknown>,
    });
  }

  async checkMomoTransactionStatus(
    dto: CheckMomoTransactionStatusDto,
    user: User,
  ): Promise<CheckMomoTransactionStatusResponse> {
    const payment = await this.paymentRepository.findOne({
      where: {
        momoOrderId: dto.orderId,
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

    const rawSignature = buildMomoQueryRawSignature({
      accessKey: this.momoConfig.accessKey,
      orderId: payment.momoOrderId,
      partnerCode: this.momoConfig.partnerCode,
      requestId: payment.momoRequestId,
    });

    const signature = createMomoSignature(
      rawSignature,
      this.momoConfig.secretKey,
    );

    const requestBody = {
      partnerCode: this.momoConfig.partnerCode,
      requestId: payment.momoRequestId,
      orderId: payment.momoOrderId,
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
        rawResponse: {
          ...(payment.rawResponse ?? {}),
          queryRequest: requestBody,
          queryError: message,
        },
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
      rawResponseKey: 'queryResponse',
      rawResponse: responseData as unknown as Record<string, unknown>,
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
      orderId: payment.momoOrderId,
      requestId: payment.momoRequestId,
      amount: Number(payment.amount),
      transId:
        responseData.transId !== undefined
          ? String(responseData.transId)
          : payment.momoTransId,
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
    extraRawResponse?: Record<string, unknown>,
  ): Promise<void> {
    if (payment.status === PaymentStatus.SUCCESS) {
      return;
    }

    const nextPaymentStatus = this.getPaymentStatusFromMomoResultCode(
      momoResult.resultCode,
    );

    const nextBookingStatus =
      this.getBookingStatusFromPaymentStatus(nextPaymentStatus);

    const nextMomoTransId =
      momoResult.transId !== undefined && momoResult.transId !== null
        ? String(momoResult.transId)
        : payment.momoTransId;

    const nextRawResponse: Payment['rawResponse'] = {
      ...(payment.rawResponse ?? {}),
      ...(extraRawResponse ?? {}),
      [momoResult.rawResponseKey]: momoResult.rawResponse,
    };

    await this.dataSource.transaction(async (manager) => {
      const paymentRepository = manager.getRepository(Payment);
      const bookingRepository = manager.getRepository(Booking);

      await paymentRepository.save(
        paymentRepository.create({
          id: payment.id,
          status: nextPaymentStatus,
          momoTransId: nextMomoTransId,
          resultCode: momoResult.resultCode,
          message: momoResult.message,
          responseTime: String(momoResult.responseTime),
          rawResponse: nextRawResponse,
          paidAt:
            nextPaymentStatus === PaymentStatus.SUCCESS
              ? new Date(momoResult.responseTime)
              : payment.paidAt,
        }),
      );

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

    if (momoResult.orderId !== payment.momoOrderId) {
      this.logger.warn(
        `MoMo orderId mismatch: expected=${payment.momoOrderId}, received=${momoResult.orderId}`,
      );

      throw new BadRequestException('orderId không hợp lệ.');
    }

    if (momoResult.requestId !== payment.momoRequestId) {
      this.logger.warn(
        `MoMo requestId mismatch: expected=${payment.momoRequestId}, received=${momoResult.requestId}`,
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

    return PaymentStatus.FAILED;
  }

  private getBookingStatusFromPaymentStatus(
    paymentStatus: PaymentStatus,
  ): BookingStatus | null {
    if (paymentStatus === PaymentStatus.SUCCESS) {
      return BookingStatus.CONFIRMED;
    }

    if (paymentStatus === PaymentStatus.FAILED) {
      return BookingStatus.CANCELLED;
    }

    return null;
  }

  private toCreateMomoPaymentResponse(
    payment: Payment,
  ): CreateMomoPaymentResponse {
    return {
      orderId: payment.momoOrderId,
      requestId: payment.momoRequestId,
      amount: Number(payment.amount),
      resultCode: payment.resultCode,
      message: payment.message,
      payUrl: payment.payUrl,
      shortLink: payment.shortLink,
    };
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
}
