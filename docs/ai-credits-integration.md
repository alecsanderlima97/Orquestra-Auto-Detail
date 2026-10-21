# Integração de créditos de IA

## Carteira

A carteira fica em `tenants/{tenantId}.aiCredits`. O navegador pode consultar a carteira pelas funções autenticadas, mas não pode alterar saldo, bônus ou consumo diretamente.

Na virada do mês, a carteira é renovada para `créditos do plano + bônus acumulado`, e o consumo mensal volta a zero.

## Compra no Portal

O sistema abre `VITE_ORQUESTRA_PORTAL_PAYMENTS_URL` com os parâmetros públicos `sourceSystem`, `product`, `packageId`, `credits`, `externalCustomerId` e `returnUrl`. O retorno do navegador não concede créditos.

Depois que o pagamento for confirmado, o Portal deve enviar `POST` para a função `portalAiCreditsWebhook` com JSON no formato:

```json
{
  "eventId": "evento-unico-do-portal",
  "paymentId": "pagamento-unico-do-portal",
  "sourceSystem": "orquestra_auto_detail",
  "status": "paid",
  "packageId": "ai-300",
  "externalCustomerId": "id-fixo-do-cliente"
}
```

Pacotes aceitos: `ai-100`, `ai-300` e `ai-1000`.

O corpo bruto deve ser assinado com HMAC SHA-256 usando o secret `ORQUESTRA_PORTAL_WEBHOOK_SECRET`. A assinatura hexadecimal deve ser enviada no cabeçalho `x-orquestra-signature`, com ou sem o prefixo `sha256=`.

O `paymentId` é a chave de idempotência: o mesmo pagamento não adiciona créditos duas vezes.

## Secrets das Cloud Functions

- `OPENAI_API_KEY`
- `ORQUESTRA_PORTAL_WEBHOOK_SECRET`
- `ORQUESTRA_PORTAL_CONNECTOR_URL`
- `ORQUESTRA_CONNECTOR_SHARED_SECRET`

Esses valores nunca devem usar prefixo `VITE_` nem ser enviados ao navegador.

## Ordem de publicação

1. Configurar os quatro secrets.
2. Publicar as Cloud Functions.
3. Publicar as regras do Firestore.
4. Configurar o webhook no Portal.
5. Publicar o frontend e executar uma compra controlada de teste.
