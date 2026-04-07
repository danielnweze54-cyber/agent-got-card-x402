import { Keypair, Horizon, TransactionBuilder, Networks, Asset, Operation } from '@stellar/stellar-sdk';
import dotenv from 'dotenv';
dotenv.config();

const stellarServer = new Horizon.Server('https://horizon-testnet.stellar.org');
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

async function fixTrustlines() {
  const usdc = new Asset('USDC', USDC_ISSUER);

  const serverSecret = process.env.SERVER_SECRET_KEY;
  if (serverSecret) {
    const pair = Keypair.fromSecret(serverSecret);
    const account = await stellarServer.loadAccount(pair.publicKey());
    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.changeTrust({ asset: usdc }))
      .setTimeout(30).build();
    tx.sign(pair);
    try {
      const res = await stellarServer.submitTransaction(tx);
      console.log('✅ Server Trustline added. Tx Hash:', res.hash);
    } catch(e: any) { console.error('❌ Server Trustline fail:', e.response?.data || e); }
  }

  const clientSecret = process.env.CLIENT_SECRET;
  if (clientSecret) {
    const pair = Keypair.fromSecret(clientSecret);
    const account = await stellarServer.loadAccount(pair.publicKey());
    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.changeTrust({ asset: usdc }))
      .setTimeout(30).build();
    tx.sign(pair);
    try {
      const res = await stellarServer.submitTransaction(tx);
      console.log('✅ Client Trustline added. Tx Hash:', res.hash);
    } catch(e: any) { console.error('❌ Client Trustline fail:', e.response?.data || e); }
  }
}

fixTrustlines();
