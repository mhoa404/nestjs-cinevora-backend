import { createHmac, timingSafeEqual } from 'crypto';

export interface MomoCreateSignaturePayload {
  accessKey: string;
  amount: number | string;
  extraData: string;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  requestType: string;
}

export interface MomoCallbackSignaturePayload {
  accessKey: string;
  amount: number | string;
  extraData: string;
  message: string;
  orderId: string;
  orderInfo: string;
  orderType: string;
  partnerCode: string;
  payType: string;
  requestId: string;
  responseTime: number | string;
  resultCode: number | string;
  transId: number | string;
}

export interface MomoQuerySignaturePayload {
  accessKey: string;
  orderId: string;
  partnerCode: string;
  requestId: string;
}

export function buildMomoCreateRawSignature(
  payload: MomoCreateSignaturePayload,
): string {
  return [
    `accessKey=${payload.accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData}`,
    `ipnUrl=${payload.ipnUrl}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `partnerCode=${payload.partnerCode}`,
    `redirectUrl=${payload.redirectUrl}`,
    `requestId=${payload.requestId}`,
    `requestType=${payload.requestType}`,
  ].join('&');
}

export function buildMomoCallbackRawSignature(
  payload: MomoCallbackSignaturePayload,
): string {
  return [
    `accessKey=${payload.accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData}`,
    `message=${payload.message}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `orderType=${payload.orderType}`,
    `partnerCode=${payload.partnerCode}`,
    `payType=${payload.payType}`,
    `requestId=${payload.requestId}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId}`,
  ].join('&');
}

export function buildMomoQueryRawSignature(
  payload: MomoQuerySignaturePayload,
): string {
  return [
    `accessKey=${payload.accessKey}`,
    `orderId=${payload.orderId}`,
    `partnerCode=${payload.partnerCode}`,
    `requestId=${payload.requestId}`,
  ].join('&');
}

export function createMomoSignature(
  rawSignature: string,
  secretKey: string,
): string {
  return createHmac('sha256', secretKey).update(rawSignature).digest('hex');
}

export function verifyMomoSignature(params: {
  rawSignature: string;
  secretKey: string;
  receivedSignature: string;
}): boolean {
  const expectedSignature = createMomoSignature(
    params.rawSignature,
    params.secretKey,
  );

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(params.receivedSignature, 'hex');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
