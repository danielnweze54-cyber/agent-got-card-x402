# Testing the Agent Got Card API with Postman

This guide explains how to manually test the x402 Agentic Payment flow and the Lithic card management endpoints using Postman (or any other HTTP client like curl or Insomnia).

## Prerequisites
Ensure your local server is running:
```bash
npx ts-node server.ts
```
The server should be listening on `http://localhost:3000`.

---

## Scenario 1: The 402 Payment Required Challenge
*Simulating a standard client trying to access the protected resource without paying.*

1. **Method**: `POST`
2. **URL**: `http://localhost:3000/issue-card`
3. **Headers**: 
   - `Content-Type: application/json`
4. **Body** (raw -> JSON):
    ```json
    {
      "merchant_name": "Postman Test",
      "amount": 10.00
    }
    ```

**Expected Result:**
- **Status**: `402 Payment Required`
- **Headers to Check**: Look at the `WWW-Authenticate` header in the response. It will contain the x402 payment demand, including the required `asset` (USDC) and the dynamically calculated `amount` (base value + 1% fee in stroops/base units).
- **Body**: `{"error": "Payment required"}`

---

## Scenario 2: Successful Agent Execution (Bypassing the 402)
*Simulating an AI agent that has a funded wallet and can automatically pay the 402 demand.*
*(We use our proxy endpoint which runs the `@x402/fetch` client locally using your `.env` secret).*

1. **Method**: `POST`
2. **URL**: `http://localhost:3000/api/run-agent`
3. **Headers**: 
   - `Content-Type: application/json`
4. **Body** (raw -> JSON):
    ```json
    {
      "merchant": "Postman Agent",
      "amount": 10.00
    }
    ```

**Expected Result:**
- **Status**: `200 OK`
- **Explanation**: The proxy intercepted the 402 error, signed a Stellar transaction paying the required USDC amount, and re-submitted the request with the `Authorization: x402 stellar:testnet <signature>` header.
- **Body**: You will receive the provisioned virtual card details.
    ```json
    {
      "message": "Agent execution completed",
      "card": {
        "token": "crd_...",
        "pan": "...",
        "exp_month": 12,
        "exp_year": 2028,
        "cvv": "...",
        "state": "OPEN"
      }
    }
    ```

---

## Scenario 3: Lithic Card Management Endpoints
You can use the tokens retrieved from Scenario 2 to manage the cards.

### 1. List All Cards
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/cards`
- **Expected Result**: `200 OK` with an array of all provisioned cards.

### 2. Get a Specific Card
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/cards/{{card_token}}`
- *(Replace `{{card_token}}` with the `token` from Scenario 2)*

### 3. Update/Pause a Card
- **Method**: `PATCH`
- **URL**: `http://localhost:3000/api/cards/{{card_token}}`
- **Body** (raw -> JSON):
    ```json
    {
      "state": "PAUSED"
    }
    ```
- **Expected Result**: `200 OK` showing the card's state is now `PAUSED`.

### 4. Get Card Transactions
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/cards/{{card_token}}/transactions`
- **Expected Result**: `200 OK` showing the authorization and settlement history for the specific card.