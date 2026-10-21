# Sincronização com a Central Admin Orquestra.cs

## Fluxo

O botão **Sincronizar Portal** chama a Cloud Function autenticada `adminSyncPortal`. Somente o e-mail oficial da administração da plataforma pode executar essa função.

A função lê os clientes no Firestore, monta o contrato `v1` e envia o snapshot diretamente do servidor para `ORQUESTRA_PORTAL_CONNECTOR_URL`. O navegador não recebe a URL privada nem o segredo do conector.

O envio utiliza:

- `Authorization: Bearer <ORQUESTRA_CONNECTOR_SHARED_SECRET>`
- `X-Orquestra-Contract-Version: v1`
- `X-Orquestra-Source-System: orquestra_auto_detail`
- `Content-Type: application/json`

O identificador externo é fixo no formato `orquestra_auto_detail_{tenantId}` e passa a ser persistido no campo `externalId`. O Portal deve usar a combinação `sourceSystem + externalCustomerId` como chave idempotente e fazer atualização por mesclagem, sem apagar dados próprios.

## Dados enviados

O snapshot inclui cadastro, responsável, documento, endereço, assinatura, limites, último pagamento, carteira de créditos IA, usuários, atividade e estado online. Observações internas e segredos não são enviados.

Depois de cada tentativa, o sistema registra em cada empresa:

- `lastSyncAt`
- `syncStatus`
- `lastSyncError`
- `externalId`

## Configuração segura

Configurar como secrets das Cloud Functions, sem prefixo `VITE_`:

- `ORQUESTRA_PORTAL_CONNECTOR_URL`
- `ORQUESTRA_CONNECTOR_SHARED_SECRET`

A URL deve ser HTTPS em produção. HTTP é aceito somente para `localhost` e `127.0.0.1` durante testes locais.
