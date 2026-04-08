import express from 'express';
import Lithic from 'lithic';
import dotenv from 'dotenv';
import path from 'path';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactStellarScheme } from '@x402/stellar/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

// Polyfill-like or let's import the client dependencies
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { ExactStellarScheme as ClientExactStellarScheme } from '@x402/stellar/exact/client';
import { createEd25519Signer } from '@x402/stellar';

dotenv.config();

const app = express();
app.use(express.json());
// Serve the modern UI dashboard
app.use(express.static(path.join(__dirname, 'public')));
app.get('/demo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'demo.html')));

const PORT = process.env.PORT || 3000;
const SERVER_PUBLIC_KEY = process.env.SERVER_PUBLIC_KEY || '';
// USDC Soroban Contract on testnet
const USDC_ISSUER = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

// Lithic Config (Sandbox)
const lithic = new Lithic({
  apiKey: process.env.LITHIC_API_KEY || 'sandbox_api_key_mock',
  environment: 'sandbox',
});

// Configure x402 Facilitator Client (OpenZeppelin)
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || '';
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://channels.openzeppelin.com/x402/testnet",
  createAuthHeaders: async () => {
    const headers = { Authorization: `Bearer ${FACILITATOR_API_KEY}` };
    return { verify: headers, settle: headers, supported: headers };
  }
});

// Register Stellar Scheme for Testnet
const x402Server = new x402ResourceServer(facilitatorClient).register(
  "stellar:testnet",
  new ExactStellarScheme()
);

app.post('/issue-card', paymentMiddleware({
  "POST /issue-card": {
    accepts: [
      {
        scheme: "exact",
        price: async (context: any) => {
          let body: any = {};
          try {
             body = context.adapter.getBody();
          } catch(e) {}
          
          const amountNum = parseFloat(body?.amount) || 5.00;
          const amountPlusFee = amountNum * 1.01; // Agent pays limit + 1% fee
          const baseUnits = Math.round(amountPlusFee * 10_000_000).toString();
          
          return { asset: USDC_ISSUER, amount: baseUnits };
        },
        network: "stellar:testnet",
        payTo: SERVER_PUBLIC_KEY,
      }
    ],
    description: "Issue a virtual card with dynamic pricing",
    mimeType: "application/json"
  }
}, x402Server), async (req, res) => {
  // Extract custom param that was protected by x402
  const merchant_name = req.body?.merchant_name || 'Agent_Purchase';
  const amountNum = parseFloat(req.body?.amount) || 5.00; 

  try {
    // If the request reaches here, the x402 middleware has ALREADY 
    // verified and fully settled the dynamic payment on the Stellar testnet!
    console.log(`[Server] Payment verified via OpenZeppelin! Issuing ${amountNum} USD card for ${merchant_name}...`);
    
    // Generating a card via lithic sandbox
    const card = await lithic.cards.create({
      type: 'SINGLE_USE',
      spend_limit: Math.round(amountNum * 100), // Spend limits are in cents
      memo: `AgentCard: ${merchant_name}`,
    });

    return res.status(200).json({
      message: 'Payment settled on-chain via x402 Facilitator! Virtual card issued.',
      card: {
        token: card.token,
        pan: card.pan,
        cvv: card.cvv,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        state: card.state,
        spend_limit: amountNum
      }
    });

  } catch (err) {
    console.error('Error issuing card:', err);
    return res.status(500).json({ error: 'Internal server error while issuing card' });
  }
});

app.post('/api/run-agent', async (req, res) => {
  try {
    const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
    if (!CLIENT_SECRET) {
      return res.status(500).json({ error: 'Client secret not configured' });
    }

    const merchant_name = req.body?.merchant || 'Notion';
    const amountNum = parseFloat(req.body?.amount) || 5.00;

    // Initialize the x402 client using the exact stellar scheme
    const signer = createEd25519Signer(CLIENT_SECRET, "stellar:testnet");
    const client = new x402Client().register(
      "stellar:testnet",
      new ClientExactStellarScheme(signer) 
    );
    const fetchWithX402 = wrapFetchWithPayment(fetch as any, client);

    // AI Agent explicitly runs the 402 negotiation against our server
    const agentResponse = await fetchWithX402(`http://localhost:${PORT}/issue-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_name, amount: amountNum })
    });

    const agentData = await agentResponse.json();
    return res.status(agentResponse.status).json(agentData);
  } catch (err: any) {
    console.error('Agent runner error:', err);
    return res.status(500).json({ error: err.message || 'Internal failure in agent client' });
  }
});

// ==========================================
// ADDITIONAL LITHIC MANAGEMENT ENDPOINTS
// ==========================================

// List all cards
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await lithic.cards.list();
    return res.status(200).json(cards.data);
  } catch (err: any) {
    console.error('Error listing cards:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get a specific card by token
app.get('/api/cards/:token', async (req, res) => {
  try {
    const card = await lithic.cards.retrieve(req.params.token);
    return res.status(200).json(card);
  } catch (err: any) {
    console.error('Error retrieving card:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update a card (e.g. pause, close, or update spend limit)
app.patch('/api/cards/:token', async (req, res) => {
  try {
    const { state, spend_limit } = req.body;
    const updatePayload: any = {};
    if (state) updatePayload.state = state;
    if (spend_limit) updatePayload.spend_limit = Math.round(parseFloat(spend_limit) * 100);

    const card = await lithic.cards.update(req.params.token, updatePayload);
    return res.status(200).json(card);
  } catch (err: any) {
    console.error('Error updating card:', err);
    return res.status(500).json({ error: err.message });
  }
});

// List card transactions/authorizations
app.get('/api/cards/:token/transactions', async (req, res) => {
  try {
    const transactions = await lithic.transactions.list({
      card_token: req.params.token
    });
    return res.status(200).json(transactions.data);
  } catch (err: any) {
    console.error('Error listing transactions:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 Card For Agent Dash running at: `);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`=========================================\n`);
    console.log(`[Server] x402 protected endpoint at POST /issue-card`);
});
