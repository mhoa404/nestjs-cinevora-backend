export interface MomoCreatePaymentApiResponse {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl?: string;
  shortLink?: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

export interface MomoQueryTransactionApiResponse {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  transId?: number;
  resultCode: number;
  message: string;
  payType?: string;
  responseTime: number;
  extraData?: string;
  signature?: string;
}

export interface CreateMomoPaymentResponse {
  orderId: string;
  requestId: string;
  amount: number;
  resultCode: number | null;
  message: string | null;
  payUrl: string | null;
  shortLink: string | null;
}

export interface CheckMomoTransactionStatusResponse {
  orderId: string;
  requestId: string;
  amount: number;
  transId: string | null;
  resultCode: number;
  message: string;
  paymentStatus: string;
  bookingStatus: string | null;
  responseTime: number;
}
