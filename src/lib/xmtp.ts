import { Client } from "@xmtp/mls-client";
import * as fs from "fs";
import { createWalletClient, http, toBytes } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// Function to send a message to a specific group
async function sendMessageToGroup(client: Client, groupId: any, messageContent: string) {
  const conversation = client.conversations.getConversationById(groupId);
  if (!conversation) {
    console.log(`No conversation found with ID: ${groupId}`);
    return;
  }
  await conversation.send(messageContent);
  console.log(`Message sent to group ${groupId}: ${messageContent}`);
}

// Function to create a wallet from a private key
async function createWallet(senderKey?: string) {
  let key = senderKey as `0x${string}`;
  if (!key) {
    key = generatePrivateKey();
    console.error("KEY not set. Using random one. For using your own wallet , set the KEY environment variable.");
    console.log("Random private key: ", key);
  }

  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });
  console.log(`Init wallet ${account.address}`);
  return wallet;
}

// Function to create and setup the XMTP client
async function setupClient(wallet: any, config = {}) {
  const initialConfig = {
    env: "production" as const,
  };
  const finalConfig = { ...initialConfig, ...config };

  const client = await Client.create(wallet.account?.address, finalConfig);
  console.log("Inbox id: ", client.inboxId);
  return client;
}

// Function to register the client if not already registered
async function registerClient(client: Client, wallet: any) {
  if (!client.isRegistered) {
    console.log("Client is not registered");
    const signature = toBytes(
      await wallet.signMessage({
        message: client.signatureText,
      }),
    );
    client.addEcdsaSignature(signature);
    await client.registerIdentity();
  } else {
    console.log("Client already registered");
  }
}

// Function to handle conversations
async function handleConversations(client: Client) {
  await client.conversations.sync();
  const conversations = await client.conversations.list();
  console.log(`Total conversations: ${conversations.length}`);
  for (const conv of conversations) {
    console.log(`Handling conversation with ID: ${conv.id}`);
    await conv.sync();
    const messages = await conv.messages();
    console.log(`Total messages in conversation: ${messages.length}`);
    // for (let i = 0; i < messages.length; i++) {
    //   console.log(`Message ${i}: ${messages[i].content}`);
    // }
  }
}
// // Function to stream all messages and respond to new ones
// async function streamAndRespond(client: Client) {
//   console.log("Started streaming messages");
//   const stream = await client.conversations.streamAllMessages();
//   for await (const message of stream) {
//     console.log(`Streamed message: ${message.content}`);
//     if (message.senderInboxId !== client.inboxId) {
//       sendMessageToGroup(client, message.conversationId, "gm");
//     }
//   }
// }
async function createGroupConversation(
  client: Client,
  groupName: string,
  groupImageUrlSquare: string,
  memberAddresses: string[],
) {
  // Create the group conversation
  const conversation = await client.conversations.newConversation(memberAddresses, {
    groupName,
    groupImageUrlSquare,
  });
  return conversation;
}

export async function setupXmtpClient(senderKey?: string) {
  const wallet = await createWallet(senderKey);

  if (!fs.existsSync(`.cache`)) {
    fs.mkdirSync(`.cache`);
  }

  const client = await setupClient(wallet, {
    dbPath: `.cache/${wallet.account?.address}-${"prod"}`,
  });

  await registerClient(client, wallet);

  try {
    await handleConversations(client);
  } catch (error) {
    console.error("Error handling conversations:", error);
  }

  return client;
}

export async function createGroupChat(groupName: string, groupImageUrlSquare: string, memberAddresses: string[]) {
  const client = await setupXmtpClient(process.env.KEY);

  const botAddress = client.accountAddress;
  const allMembers = [...new Set([...memberAddresses, botAddress])];

  const groupConversation = await createGroupConversation(client, groupName, groupImageUrlSquare, allMembers);
  console.log(`Group "${groupName}" created with id: ${groupConversation.id}`);

  return groupConversation;
}

export async function sendMessage(senderKey: string, message: string, groupId: string) {
  const client = await setupXmtpClient(senderKey);

  await sendMessageToGroup(client, groupId, message);
  console.log("Message sent: ", message);
}
