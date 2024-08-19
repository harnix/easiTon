const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
  } = require('@solana/web3.js');

const bs58 = require('bs58');

const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { SWAP_PROGRAM_ID, createSwapInstruction } = require('@raydium-io/raydium-sdk');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MONNIFY_API_URL = 'https://sandbox.monnify.com/api/v1/';

// Command handler for "/start"
bot.command('start', (ctx) => {
    // Description of bot functionality
    const description = "Welcome to the Degen234 bot! You can buy Solana using Naira Transfer and also Snipe any Token using the Contract Address \n\n Wallet Address: DUNEabricJywy4t7m1Y9sY4KvSUyMDrLpxesjjHpkR7";

    // Inline keyboard markup with buttons
    const keyboardMarkup = Markup.inlineKeyboard([
        [Markup.button.callback('BUY SOL with NGN', 'purchase'),
         Markup.button.callback('Snipe Token', 'snipe')],
        [Markup.button.callback('Get Help', 'help'),
         Markup.button.callback('Wallet Balance', 'wallet')],
        [Markup.button.callback('Manage Positions', 'manage'),
         Markup.button.callback('Refresh', 'refresh')]
        
    ]);

    // Send message with description and buttons
    ctx.reply(description, keyboardMarkup);
});

// Button click handler for "Purchase Tokens"
bot.action('purchase', (ctx) => {
    ctx.reply('Please enter the amount of fiat currency (NGN) you want to invest. Once refresh');
    // Listen for user's input
    bot.on('text', async (ctx) => {
        const fiatAmount = parseFloat(ctx.message.text);

        // Call Monnify API to generate payment link
        try {
            const token = await getMonnifyAccessToken();
            // console.log(`Got Token as: ${token}`)
            const paymentLink = await generatePaymentLink(token, fiatAmount);

            // Send payment link to the user
            ctx.reply(`Please complete your payment [here](${paymentLink}).`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Monnify API Error:', error.response.data);
            ctx.reply('An error occurred while processing your request. Please try again later.');
        }
    });
});

bot.action('snipe', (ctx) => {
    ctx.reply('Enter the Contract Address of token');
    // Listen for user's input
    bot.on('text', async (ctx) => {
        // await swapSolToToken(ctx.message.text, 0.001);

        ctx.reply('Resolving minor bugs with Solana Account...');
    });

    
});

bot.action('help', (ctx) => {
    // ctx.reply('Enter the Contract Address of token');
    // // Listen for user's input
    // bot.on('text', async (ctx) => {
        
    // });
});

bot.action('wallet', async (ctx) => {
    const balance = await getSolanaBalance(process.env.walletAddress);
    ctx.reply(`You have ${balance} SOL`);
    // // Listen for user's input
    // bot.on('text', async (ctx) => {
        
    // });
});

bot.action('manage', (ctx) => {
    // ctx.reply('Enter the Contract Address of token');
    // // Listen for user's input
    // bot.on('text', async (ctx) => {
        
    // });
});

bot.action('refresh', (ctx) => {
    // ctx.reply('Enter the Contract Address of token');
    // // Listen for user's input
    // bot.on('text', async (ctx) => {
        
    // });
});

// Function to get Monnify access token
async function getMonnifyAccessToken() {
    try {
        // Encode API key and secret key in base64 format
        const apiKey = process.env.MONNIFY_API_KEY;
        const secretKey = process.env.MONNIFY_SECRET_KEY;
        const authString = `${apiKey}:${secretKey}`;
        const encodedAuthString = Buffer.from(authString).toString('base64');

        // Make request to Monnify login endpoint to get access token
        const response = await axios.post(MONNIFY_API_URL+ 'auth/login', {}, {
            headers: {
                Authorization: `Basic ${encodedAuthString}`
            }
        });

        // Return the access token from the response
        return response.data.responseBody.accessToken;
    } catch (error) {
        throw new Error('Error fetching Monnify access token: ' + error.message);
    }
}

// Function to generate payment link
async function generatePaymentLink(token, amount) {
    const response = await axios.post(MONNIFY_API_URL + 'merchant/transactions/init-transaction', {
            "amount": amount,
            "customerName": "Stephen Ikhane",
            "customerEmail": "stephen@ikhane.com",
            "paymentReference": generateTransactionReference(),
            "paymentDescription": "Trial transaction",
            "currencyCode": "NGN",
            "contractCode":process.env.MONNIFY_CONTRACT_CODE,
            // "redirectUrl": "https://my-merchants-page.com/transaction/confirm",
            "paymentMethods":["CARD","ACCOUNT_TRANSFER"]
    
    }, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return response.data.responseBody.checkoutUrl;
}

function generateTransactionReference() {
    // Get the current timestamp
    const timestamp = new Date().getTime();

    // Generate a random string or use a unique identifier library
    const randomString = Math.random().toString(36).substring(7); // Generate a random string of 7 characters

    // Concatenate the timestamp and random string to create the transaction reference
    const transactionReference = `${timestamp}_${randomString}`;

    return transactionReference;
}

// Function to get the wallet balance of a Solana address
async function getSolanaBalance(walletAddress) {
    try {
        // Define the Solana RPC URL (you can use a different endpoint if needed)
        const rpcUrl = process.env.rpcURL; // Mainnet
        // const rpcUrl = 'https://api.devnet.solana.com'; // Devnet

        // Create a connection to the Solana cluster
        const connection = new Connection(rpcUrl, 'confirmed');

        // Convert the wallet address to a PublicKey
        const publicKey = new PublicKey(walletAddress);

        // Fetch the balance (in lamports) from the connection
        const balance = await connection.getBalance(publicKey);

        // Convert the balance from lamports to SOL
        const solBalance = (balance / 1e9).toFixed(5);

        return solBalance;
    } catch (error) {
        console.error('Error fetching balance:', error);
        throw error;
    }
}

async function swapSolToToken(contractAddress, solAmount) {
    const connection = new Connection(process.env.rpcURL, 'confirmed');
    // console.log('privateKey is:',process.env.privateKey)

    const privateKeyArray = Uint8Array.from(Buffer.from(process.env.privateKey, 'base64'));

    const payer = Keypair.fromSecretKey(privateKeyArray.slice(1));
    
    // Define the token swap addresses
    const toTokenMint = new PublicKey(contractAddress);  // Target token contract address

    // Get the associated token accounts
    const toTokenAccount = await Token.getAssociatedTokenAddress(
        toTokenMint,
        payer.publicKey
    );

    // Create the user's associated token account if it doesn't exist
    const tokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!tokenAccountInfo) {
        const createTokenAccountIx = Token.createAssociatedTokenAccountInstruction(
        payer.publicKey,
        toTokenAccount,
        payer.publicKey,
        toTokenMint
        );

        const transaction = new Transaction().add(createTokenAccountIx);
        await sendAndConfirmTransaction(connection, transaction, [payer]);
    }

    // Convert SOL to lamports
    const lamports = solAmount * LAMPORTS_PER_SOL;

    // Create the swap instruction
    const swapInstruction = await createSwapInstruction({
        connection,
        owner: payer.publicKey,
        fromTokenAccount: payer.publicKey,
        toTokenAccount,
        fromTokenMint: null,  // SOL doesn't have a mint address
        toTokenMint,
        amount: lamports,
        programId: SWAP_PROGRAM_ID
    });

    // Create a transaction and add the swap instruction
    const transaction = new Transaction()
        .add(SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: toTokenAccount,
        lamports
        }))
        .add(swapInstruction);


    // Sign and send the transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);

    console.log('Swap transaction signature', signature);
}
  
// Start the bot
bot.launch();
