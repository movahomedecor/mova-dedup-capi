const crypto = require('crypto');
const axios = require('axios');

// ==================== FUNÇÕES DE HASHING ====================

function normalizeString(str) {
  if (!str) return '';
  return str.trim().toLowerCase();
}

function hashField(value) {
  if (!value) return '';
  const normalized = normalizeString(value);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function hashEmail(email) {
  return hashField(email);
}

function hashPhone(phone) {
  if (!phone) return '';
  // Remove non-digits
  const cleaned = phone.replace(/\D/g, '');
  return hashField(cleaned);
}

function hashName(name) {
  return hashField(name);
}

function hashAddress(address) {
  return hashField(address);
}

// ==================== ENVIO PARA META CAPI ====================

async function sendToMetaCAPI(orderData, accessToken) {
  try {
    const pixelId = '1171432318200969';
    const datasetId = '1171432318200969';

    // Extrair dados do pedido
    const orderId = orderData.id;
    const customer = orderData.customer || {};
    const billingAddress = orderData.billing_address || {};
    const lineItems = orderData.line_items || [];

    // Calcular valor total
    const totalValue = orderData.total_price ? parseFloat(orderData.total_price) : 0;
    const currency = orderData.currency || 'BRL';

    // Preparar dados para hashing
    const email = customer.email || '';
    const phone = customer.phone || '';
    const firstName = customer.first_name || '';
    const lastName = customer.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    // Preparar endereço
    const address = [
      billingAddress.address1 || '',
      billingAddress.city || '',
      billingAddress.province || '',
      billingAddress.zip || '',
      billingAddress.country || ''
    ]
      .filter(Boolean)
      .join(' ');

    // Dados com hashing SHA-256
    const userData = {
      em: email ? [hashEmail(email)] : undefined,
      ph: phone ? [hashPhone(phone)] : undefined,
      fn: firstName ? [hashName(firstName)] : undefined,
      ln: lastName ? [hashName(lastName)] : undefined,
      ge: billingAddress.country === 'BR' ? ['m'] : undefined, // placeholder
      db: customer.created_at
        ? [hashField(customer.created_at.split('T')[0])]
        : undefined,
      external_id: [hashField(orderId.toString())] // ID do pedido hasheado
    };

    // Remover campos undefined
    Object.keys(userData).forEach(
      key => userData[key] === undefined && delete userData[key]
    );

    // Montar evento
    const event = {
      event_id: `shopify_purchase_${orderId}`, // ← CHAVE DE DEDUPLICAÇÃO
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: orderData.order_status_url || 'https://movadecor.com.br',
      user_data: userData,
      custom_data: {
        value: totalValue,
        currency: currency,
        content_name: lineItems
          .map(item => item.title)
          .join(', ')
          .substring(0, 100)
      },
      opt_out: false
    };

    console.log('[DEDUP-CAPI] Enviando evento:', {
      event_id: event.event_id,
      value: event.custom_data.value,
      currency: event.custom_data.currency
    });

    // Enviar para Meta Conversions API
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${datasetId}/events`,
      {
        data: [event]
      },
      {
        params: {
          access_token: accessToken
        }
      }
    );

    console.log('[DEDUP-CAPI] ✅ Evento enviado com sucesso:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[DEDUP-CAPI] ❌ Erro ao enviar:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return { success: false, error: error.response?.data || error.message };
  }
}

// ==================== PROCESSAR WEBHOOK ====================

async function processWebhook(body, accessToken) {
  try {
    // Validar que é um webhook de ordem paga
    if (!body.id || body.financial_status !== 'paid') {
      console.log('[DEDUP-CAPI] ⚠️ Webhook ignorado: não é ordem paga');
      return { ignored: true };
    }

    console.log(`[DEDUP-CAPI] 📦 Processando pedido #${body.id}...`);

    // Enviar para Meta CAPI
    const result = await sendToMetaCAPI(body, accessToken);
    return result;
  } catch (error) {
    console.error('[DEDUP-CAPI] Erro ao processar webhook:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  processWebhook,
  sendToMetaCAPI
};
