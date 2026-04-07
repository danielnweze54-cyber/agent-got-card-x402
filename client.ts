import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { ExactStellarScheme } from '@x402/stellar/exact/client';
import { createEd25519Signer } from '@x402/stellar';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3000/issue-card';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'SA7VHLHPDHFHJHFR7YCN5C5BZRYNORIXBEJUTI6WK6DFAZNUGRN4T72N';

async function main() {
    console.log(`[Client] Initializing x402 client with Stellar Testnet...`);

    // Create the x402 compatible signer using the client secret
    const signer = createEd25519Signer(CLIENT_SECRET, "stellar:testnet");
    
    // Register the Stellar exact scheme
    const client = new x402Client().register(
      "stellar:testnet",
      new ExactStellarScheme(signer) 
    );

    // Wrap fetch automatically handles the 402 handshake!
    const fetchWithX402 = wrapFetchWithPayment(fetch, client);

    console.log('\n[Client] Sending request to issue card for netflix_india...');
    try {
        const response = await fetchWithX402(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merchant_name: 'netflix_india' })
        });

        const cardDetails = await response.json();

        if (response.ok) {
            console.log('\n✅ SUCCESS - VIRTUAL CARD ISSUED!');
            console.log('Server verified payment seamlessly via x402 OpenZeppelin Facilitator!');
            if (cardDetails.card) {
                console.table({
                    Pan: cardDetails.card.pan,
                    CVV: cardDetails.card.cvv,
                    Exp: `${cardDetails.card.exp_month}/${cardDetails.card.exp_year}`,
                    Token: cardDetails.card.token,
                    Limit: cardDetails.card.spend_limit,
                    State: cardDetails.card.state
                });
            } else {
                console.log(cardDetails);
            }
        } else {
            console.error('\n❌ Request failed after x402 attempt.');
            console.error('Status:', response.status);
            console.error('Body:', cardDetails);
        }

    } catch (e: any) {
        console.error('❌ Client Error:', e.message || e);
    }
}

main();
