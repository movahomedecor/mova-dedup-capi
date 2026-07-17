const express = require('express');
const crypto = require('crypto');
const { processWebhook } = require('./dedup-capi');

const app = express();

// Middleware
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // Para validação de signature

// ==================== VALIDAÇÃO DE WEBHOOK SHOPIFY ====================

function verifyShopifyWebhook(req) {
  const hmac = req.get('X-Shopify-Hmac-SHA256');
  const body = req.rawBody || req.body;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';

  if (!hmac || !secret) {
    console.warn('[WEBHOOK] ⚠️ HMAC ou SECRET não configurado');
    return false;
  }

  try {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const computed = crypto
      .createHmac('sha256', secret)
      .update(bodyString, 'utf8')
      .digest('base64');

    const verified = computed === hmac;
    if (!verified) {
      console.error('[WEBHOOK] ❌ Assinatura inválida');
    }
    return verified;
  } catch (error) {
    console.error('[WEBHOOK] Erro ao validar:', error);
    return false;
  }
}

// ==================== ROTAS ====================

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mova-dedup-capi',
    endpoint: 'POST /webhook/purchase-dedup',
    timestamp: new Date().toISOString()
  });
});

app.post('/webhook/purchase-dedup', async (req, res) => {
  try {
    console.log('[WEBHOOK] 📨 Recebido:', {
      orderId: req.body.id,
      financial_status: req.body.financial_status,
      timestamp: new Date().toISOString()
    });

    // ✅ Opcional: validar assinatura Shopify
    // if (!verifyShopifyWebhook(req)) {
    //   console.error('[WEBHOOK] Assinatura inválida');
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }

    // Pegar token de acesso
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('[WEBHOOK] ❌ META_ACCESS_TOKEN não configurado');
      return res.status(500).json({ error: 'Missing META_ACCESS_TOKEN' });
    }

    // Processar webhook
    const result = await processWebhook(req.body, accessToken);

    if (result.ignored) {
      return res.status(200).json({ status: 'ignored' });
    }

    if (result.success) {
      return res.status(200).json({
        status: 'ok',
        event_id: `shopify_purchase_${req.body.id}`,
        message: 'Evento enviado para Meta CAPI com dedup'
      });
    } else {
      return res.status(400).json({
        status: 'error',
        error: result.error
      });
    }
  } catch (error) {
    console.error('[WEBHOOK] Erro geral:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ==================== INICIAR SERVIDOR ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📍 Webhook URL: https://<seu-railway-url>/webhook/purchase-dedup`);
  console.log(`🏥 Health: https://<seu-railway-url>/health`);
});

module.exports = app;
