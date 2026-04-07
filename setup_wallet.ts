import { Keypair, Horizon, TransactionBuilder, Networks, Asset, Operation } from '@stellar/stellar-sdk';
import fetch from 'node-fetch';
import fs from 'fs';

const stellarServer = new Horizon.Server('https://horizon-testnet.stellar.org');

// Circle standard testnet USDC issuer:
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'; 

async function setupWallet() {
  console.log('Generating new keypair...');
  const pair = Keypair.random();
  console.log('PUBLIC_KEY=' + pair.publicKey());
  console.log('SECRET_KEY=' + pair.secret());

  console.log('Funding with Friendbot...');
  const res = await fetch('https://friendbot.stellar.org?addr=' + pair.publicKey());
  if (!res.ok) {
    console.error('Failed to fund:', await res.text());
    return;
  }
  console.log('✅ Successfully funded with testnet XLM.');

  console.log('Establishing trustline for USDC...');
  const account = await stellarServer.loadAccount(pair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset('USDC', USDC_ISSUER),
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(pair);

  try {
    const result = await stellarServer.submitTransaction(tx);
    console.log('✅ Trustline established! Tx Hash: ' + result.hash);
    
    const envContent = 'SERVER_PUBLIC_KEY=' + pair.publicKey() + '\n' +
                       'SERVER_SECRET_KEY=' + pair.secret() + '\n' +
                       'LITHIC_API_KEY=sandbox_api_key_mock\n';
    fs.writeFileSync('.env', envContent);
    console.log('✅ Updated .env with new credentials.');

  } catch (error: any) {
    console.error('❌ Failed to establish trustline:', error.response?.data || error.message);
  }
}

setupWallet();
