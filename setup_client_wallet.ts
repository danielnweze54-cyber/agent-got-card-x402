import { Keypair, Horizon, TransactionBuilder, Networks, Asset, Operation } from '@stellar/stellar-sdk';
import fetch from 'node-fetch';
import fs from 'fs';

const stellarServer = new Horizon.Server('https://horizon-testnet.stellar.org');
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'; 

async function setupClientWallet() {
  console.log('Generating new keypair for client...');
  const pair = Keypair.random();
  console.log('CLIENT_PUBLIC_KEY=' + pair.publicKey());
  console.log('CLIENT_SECRET=' + pair.secret());

  console.log('Funding client with Friendbot...');
  const res = await fetch('https://friendbot.stellar.org?addr=' + pair.publicKey());
  if (!res.ok) {
    console.error('Failed to fund client:', await res.text());
    return;
  }
  console.log('✅ Successfully funded client with testnet XLM.');

  console.log('Establishing trustline for USDC on client...');
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
    console.log('✅ Trustline established for client! Tx Hash: ' + result.hash);
    
    let envContent = fs.readFileSync('.env', 'utf8');
    // Ensure we don't append multiple times
    if (!envContent.includes('CLIENT_SECRET')) {
      envContent += '\nCLIENT_PUBLIC_KEY=' + pair.publicKey() + '\nCLIENT_SECRET=' + pair.secret() + '\n';
      fs.writeFileSync('.env', envContent);
      console.log('✅ Updated .env with client credentials.');
    }

  } catch (error: any) {
    console.error('❌ Failed to establish trustline:', error.response?.data || error.message);
  }
}

setupClientWallet();