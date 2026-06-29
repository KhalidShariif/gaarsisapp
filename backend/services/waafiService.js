const crypto = require('crypto');
const db = require('../config/db');

const SUCCESS_CODE = '2001';

function requiredConfig(vendorId) {
  const merchantVendorId = Number(process.env.HURMOOD_VENDOR_ID || 1);
  if (Number(vendorId) !== merchantVendorId) {
    throw Object.assign(
      new Error(`Hurmood merchant API is configured for vendor ${merchantVendorId}. This order belongs to vendor ${vendorId}.`),
      { statusCode: 503 }
    );
  }

  const config = {
    url: process.env.HURMOOD_API_URL || 'https://api.waafipay.net/asm',
    merchantUid: process.env.HURMOOD_MERCHANT_UID,
    apiUserId: process.env.HURMOOD_API_USER_ID,
    apiKey: process.env.HURMOOD_API_KEY,
    merchantVendorId,
  };

  if (!config.merchantUid || !config.apiUserId || !config.apiKey) {
    throw Object.assign(new Error('Hurmood merchant credentials are not configured properly.'), { statusCode: 503 });
  }
  return config;
}

function normalizeAccount(account) {
  const digits = String(account || '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    throw Object.assign(new Error('Enter a valid WAAFI/EVC account number.'), { statusCode: 400 });
  }
  // Handle Somali phone numbers: 061xxxxxxx → 25261xxxxxxx
  let normalized = digits.startsWith('252') ? digits : `252${digits.replace(/^0+/, '')}`;
  // Ensure country code is 252 and remove leading zeros
  if (normalized.startsWith('0')) {
    normalized = `252${normalized.replace(/^0+/, '')}`;
  }
  return normalized;
}

function providerTransactionId(response) {
  return response?.params?.transactionId || response?.params?.referenceId ||
    response?.transactionId || response?.transactionInfo?.transactionId || null;
}

function clarifyDeclineMessage(message, amount, currency, responseCode = '') {
  const baseMessage = String(message || 'Hurmood payment was declined.').trim();
  const amountLabel = `${currency} ${Number(amount).toFixed(2)}`;
  if (responseCode === '5310' || /RCS_USER_REJECTED|user[_\s-]*rejected/i.test(baseMessage)) {
    return `Hurmood/EVC payment request waa la diiday ama wakhtigiisa wuu dhamaaday. Fadlan hubi telefoonkaaga, marka prompt-ku yimaado taabo Approve/OK si aad u bixiso ${amountLabel}.`;
  }
  if (/haraaga|insufficient|kuguma\s+filna/i.test(baseMessage)) {
    return `${baseMessage} Lacagta la jarayo waa ${amountLabel}. Haddii haraagaagu la mid yahay lacagta, EVC/Hurmood fee darteed ku dar wax yar oo dheeraad ah.`;
  }
  return baseMessage;
}

async function purchase({ customerId, vendorId, payerAccount, amount, currency = 'USD', description, idempotencyKey }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw Object.assign(new Error('Payment amount is invalid.'), { statusCode: 400 });
  }
  const config = requiredConfig(vendorId);
  const accountNo = normalizeAccount(payerAccount);
  const safeIdempotencyKey = String(idempotencyKey || '').trim();
  if (!safeIdempotencyKey || safeIdempotencyKey.length > 120) {
    throw Object.assign(new Error('A valid checkout request id is required.'), { statusCode: 400 });
  }
  const [existingAttempts] = await db.query(
    `SELECT * FROM payment_attempts
     WHERE customer_id = ? AND (idempotency_key = ? OR idempotency_key LIKE ?)
     ORDER BY id DESC`,
    [customerId, safeIdempotencyKey, `${safeIdempotencyKey}:retry-%`]
  );
  if (existingAttempts.length > 0) {
    const successfulAttempt = existingAttempts.find((attempt) => attempt.status === 'successful');
    if (successfulAttempt) {
      console.log(`[HURMOOD] Returning cached successful payment: attemptId=${successfulAttempt.id}`);
      return {
        attemptId: successfulAttempt.id,
        requestId: successfulAttempt.request_id,
        referenceId: successfulAttempt.reference_id,
        invoiceId: successfulAttempt.invoice_id,
        transactionId: successfulAttempt.provider_transaction_id,
        responseCode: successfulAttempt.response_code,
        status: 'successful'
      };
    }
    const pendingAttempt = existingAttempts.find((attempt) => attempt.status === 'initiated' || attempt.status === 'unknown');
    if (pendingAttempt) {
      console.log(`[HURMOOD] Existing unresolved payment attempt: attemptId=${pendingAttempt.id}`);
      throw Object.assign(
        new Error('The previous payment result is still unknown. Please wait a moment before retrying.'),
        { statusCode: 409, responseCode: pendingAttempt.response_code }
      );
    }
  }
  const suffix = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
  const requestId = suffix;
  const referenceId = `LPG-${customerId}-${suffix}`;
  const invoiceId = `INV-${vendorId}-${suffix}`;
  const roundedAmount = Number(numericAmount.toFixed(2));
  const attemptIdempotencyKey = existingAttempts.length > 0
    ? `${safeIdempotencyKey}:retry-${existingAttempts.length + 1}`.slice(0, 120)
    : safeIdempotencyKey;

  const [attempt] = await db.query(
    `INSERT INTO payment_attempts
      (customer_id, vendor_id, provider, idempotency_key, request_id, reference_id, invoice_id, payer_account, amount, currency, status)
     VALUES (?, ?, 'waafi', ?, ?, ?, ?, ?, ?, ?, 'initiated')`,
    [customerId, vendorId, attemptIdempotencyKey, requestId, referenceId, invoiceId,
     `${'*'.repeat(Math.max(0, accountNo.length - 4))}${accountNo.slice(-4)}`, roundedAmount, currency]
  );

  const payload = {
    schemaVersion: '1.0',
    requestId,
    timestamp: new Date().toISOString(),
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid: config.merchantUid,
      apiUserId: config.apiUserId,
      apiKey: config.apiKey,
      paymentMethod: 'mwallet_account',
      payerInfo: { accountNo },
      transactionInfo: {
        referenceId,
        invoiceId,
        amount: roundedAmount,
        currency,
        description: String(description || 'LPG delivery payment').slice(0, 120),
      },
    },
  };

  console.log(`[HURMOOD] Initiating payment: vendor=${config.merchantVendorId}, merchant=${config.merchantUid}, attemptId=${attempt.insertId}, referenceId=${referenceId}, account=${accountNo}, amount=${roundedAmount} ${currency}`);

  let responseBody;
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Number(process.env.HURMOOD_TIMEOUT_MS || 30000)),
    });
    const text = await response.text();
    try { responseBody = JSON.parse(text); } catch (_) { responseBody = { responseCode: String(response.status), responseMsg: text.slice(0, 200) }; }
    if (!response.ok && !responseBody?.responseCode) {
      throw new Error(`Hurmood returned HTTP ${response.status}.`);
    }
  } catch (error) {
    const errorMsg = error.name === 'TimeoutError' ? 'Hurmood request timed out' : error.message;
    console.log(`[HURMOOD] Request error: ${errorMsg}`);
    await db.query(
      `UPDATE payment_attempts SET status = 'unknown', response_message = ? WHERE id = ?`,
      [errorMsg, attempt.insertId]
    );
    throw Object.assign(new Error('Hurmood payment could not be confirmed. No order was created.'), { statusCode: 502 });
  }

  const responseCode = String(responseBody?.responseCode || '');
  const responseMessage = clarifyDeclineMessage(
    responseBody?.responseMsg || responseBody?.responseMessage || 'Payment response received',
    roundedAmount,
    currency,
    responseCode
  );
  const transactionId = providerTransactionId(responseBody);
  const successful = responseCode === SUCCESS_CODE;
  
  console.log(`[HURMOOD] Response: code=${responseCode}, transactionId=${transactionId}, successful=${successful}, message=${responseMessage}`);
  
  await db.query(
    `UPDATE payment_attempts SET response_code = ?, response_message = ?, provider_transaction_id = ?,
     status = ?, raw_response = ? WHERE id = ?`,
    [responseCode, responseMessage.slice(0, 255), transactionId, successful ? 'successful' : 'failed', JSON.stringify(responseBody), attempt.insertId]
  );

  if (!successful) {
    throw Object.assign(new Error(responseMessage || 'Hurmood payment was declined.'), {
      statusCode: 402,
      responseCode,
    });
  }

  return {
    attemptId: attempt.insertId,
    requestId,
    referenceId,
    invoiceId,
    transactionId: transactionId || null,
    responseCode,
    status: 'successful',
  };
}

async function attachOrder(attemptId, orderId) {
  if (!attemptId) return;
  await db.query('UPDATE payment_attempts SET order_id = ? WHERE id = ?', [orderId, attemptId]);
}

module.exports = { purchase, attachOrder, normalizeAccount };
