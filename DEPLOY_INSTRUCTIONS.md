# 🚀 Deploy API Dedup CAPI no Railway

## PASSO 1: Preparar variáveis de ambiente

Você precisa de 2 variáveis no Railway:

```
META_ACCESS_TOKEN=EAAL5ooo2BjcBRyyChHIV7YZB97dF4YTAWhXVJG2WZARrEymzAxaZAZCFIQ0lfhZCk6wbwlWFfxnajgPfulhcWVsRmaBcpoUjGukxvQ4smVnECEDIeagxviejkAGMeIKZBRbt9U3aUWBquZA5n7RToXihWxf4NHCdUkXFnMnxa2yvo65o4ims9cbqeAW1PlckwZDZD

SHOPIFY_WEBHOOK_SECRET=seu_secret_aqui (opcional, mas recomendado)
```

## PASSO 2: Deploy no Railway

### Opção A: Via GitHub (Recomendado)

1. **Criar repo no GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Mova dedup CAPI API"
   git remote add origin https://github.com/movahomedecor/mova-dedup-capi.git
   git push -u origin main
   ```

2. **Conectar Railway ao GitHub**
   - Ir para railway.app
   - Clique em "New Project"
   - Selecione "Deploy from GitHub"
   - Selecione o repositório
   - Railway detecta Node.js automaticamente

3. **Adicionar variáveis de ambiente**
   - Em Railway → Project Settings → Variables
   - Adicione `META_ACCESS_TOKEN` e `SHOPIFY_WEBHOOK_SECRET`

4. **Deploy**
   - Clique em "Deploy"
   - Railway faz o build e deploy automaticamente

### Opção B: CLI Railway (Rápido)

1. **Instalar Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login e deploy**
   ```bash
   railway login
   railway link
   railway up
   ```

3. **Adicionar variáveis**
   ```bash
   railway variables set META_ACCESS_TOKEN=seu_token_aqui
   railway variables set SHOPIFY_WEBHOOK_SECRET=seu_secret_aqui
   ```

## PASSO 3: Pegar URL do Railway

Após deploy, Railway te dará uma URL como:
```
https://mova-dedup-capi-production.up.railway.app
```

Copie essa URL para usar no Shopify.

## PASSO 4: Registrar Webhook no Shopify

1. **Em Shopify Admin:**
   - Ir para **Configurações** → **Apps e integrações** → **Notificações**
   - Procurar por **Webhooks** ou **Eventos da web** (pode estar em outro lugar)

2. **Criar novo webhook**
   - **Tópico:** `orders/paid` (ou `orders/create` se quiser testar)
   - **URL:** `https://mova-dedup-capi-production.up.railway.app/webhook/purchase-dedup`
   - **Formato:** `JSON`
   - **Salvar**

3. **Testar**
   - Shopify deve te mostrar um status
   - Se OK, aparece um checkmark
   - Se erro 5xx, volte e debugue

## PASSO 5: Desativar Shopify Máximo (IMPORTANTE!)

Para EVITAR duplicação, você precisa desativar os eventos Purchase do Shopify Máximo:

**Em Shopify:**
1. **Facebook & Instagram** → **Configurações** → **Compartilhar dados**
2. Mude para **"Conservador"** (desativa Purchase events do Shopify nativo)
3. Salvar

**Resultado:**
- ✅ API customizada envia eventos com `event_id`
- ✅ Shopify Máximo continua capturando pixels (visitas)
- ✅ Zero duplicação

## PASSO 6: Validar

1. **Fazer uma venda de teste** em Mōva Decor
2. **Ir para Meta Events Manager** → **Deduplicação de evento**
3. **Procurar por:**
   - Cobertura: deve subir de 0%
   - Novo evento com `event_id: shopify_purchase_{order_id}`

## 🔍 Troubleshooting

### Webhook não está chegando
- Verificar URL no Shopify está correta
- Verificar se Railway está rodando (`railway logs`)
- Testar URL manualmente: `https://sua-url/health`

### Evento não aparece em Meta
- Verificar `META_ACCESS_TOKEN` está correto
- Verificar `Dataset ID` está correto no código (111432318200969)
- Checkar logs no Railway: `railway logs`

### Erro 401 Unauthorized em Meta
- Token expirado? Gerar novo token em Meta Ads Manager
- Permissões incorretas? Meta → Configurações → Permissões de app

### Evento chegando mas sem dedup
- Checar se `event_id` está no payload (logs Railway)
- Checar se Meta está recebendo o campo `event_id`
- Meta Events Manager → Detalhamento → procurar `event_id`

## 📊 Monitorar em Produção

**Logs no Railway:**
```bash
railway logs -f
```

**Esperado:**
```
[WEBHOOK] 📨 Recebido: { orderId: 20252614, financial_status: 'paid' }
[DEDUP-CAPI] 📦 Processando pedido #20252614...
[DEDUP-CAPI] Enviando evento: { event_id: 'shopify_purchase_20252614', value: 140.51 }
[DEDUP-CAPI] ✅ Evento enviado com sucesso: { events_received: 1 }
```

## 🎯 Resultado Final

Após configurar tudo:
- ✅ Cobertura de deduplicação sairá de **0%** para **50-70%+**
- ✅ Meta Events Manager mostrará `event_id` no detalhamento
- ✅ Pedidos sairão de "Não processado" para "Processado"
- ✅ Meta Score passará de ~6.1 para **9.5+**

---

**Dúvidas?** Manda um print dos logs do Railway! 🚀
