import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generatePrivateKey } from "viem/accounts";
import { createGroupChat, setupXmtpClient } from './lib/xmtp.js';
import { ChatParams } from './types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

const activeWorkers = new Map();

await setupXmtpClient(process.env.TECH_AGENT_KEY);
await setupXmtpClient(process.env.SOCIAL_AGENT_KEY);
await setupXmtpClient(process.env.DATA_AGENT_KEY);

app.post("/group-chats", async (req, res) => {
  try {
    const { creator, target, targetFirstName, targetFriend, situation, privateInfo, groupTitle, groupImage, connectedAddress } = req.body;

    // Validate required fields
    if (!creator || !target || !targetFirstName || !targetFriend || !situation || !privateInfo || !groupTitle || !groupImage || !connectedAddress) {
      return res.status(400).json({ error: "Missing required fields in the request body" });
    }

    // XMTP addresses
    const creatorAddress = connectedAddress;
    const targetAddress = target;
    const iPhoneAddress = "0x338bb4600c419a329c6F35bF2cb1f021d8663356"; // iPhone 15 Pro Max
    const iPhone2Address = "0x91412B4A9F7F8Fb51658505dE5B0B62114E79370"; // iPhone 15
    const agentAddresses = [
      "0xeEE998Beb137A331bf47Aa5Fc366033906F1dB34", // Paul: TECH_AGENT_XMTP_ADDRESS
      "0xE67b3617E9CbAf456977CA9d4b9beAb8944EFc37", // Emile: SOCIAL_AGENT_XMTP_ADDRESS
      "0xfA568f302F93Ed732C88a8F1999dCe8e841E14EC", // Gabriel: DATA_AGENT_XMTP_ADDRESS
    ];
    const groupMembers = [creatorAddress, targetAddress, iPhoneAddress, iPhone2Address, ...agentAddresses];

    const botKey = generatePrivateKey() as `0x${string}`;
    process.env.KEY = botKey;
    
    // Create the XMTP group conversation
    const xmtpChat = await createGroupChat(groupTitle, groupImage, groupMembers);

    const { id: groupId } = xmtpChat;

    // FIX THIS USING ENVIO
    const publicInfo = "";

    const workerId = `group-chat-${Date.now()}`;
    const chatParams: ChatParams = {
      creator,
      target,
      targetFirstName,
      targetFriend,
      situation,
      publicInfo,
      privateInfo,
      groupTitle,
      groupImage,
      groupId
    };

    const worker = new Worker(path.join(__dirname, 'index.js'), {
      workerData: {
        RPC_URL: process.env.RPC_URL,
        PRIVATE_KEY: process.env.PRIVATE_KEY,
        AGENT_CONTRACT_ADDRESS: process.env.AGENT_CONTRACT_ADDRESS,
        OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
        STACK_API_KEY: process.env.STACK_API_KEY,
        MSG_LOG: process.env.MSG_LOG,
        groupId,
        botKey,
        chatParams,
      },
    });

    worker.on("message", (message) => {
      console.log(`Message from worker ${workerId}:`, message);
    });

    worker.on("error", (error) => {
      console.error(`Error in worker ${workerId}:`, error);
    });

    worker.on("exit", (code) => {
      console.log(`Worker ${workerId} exited with code ${code}`);
      activeWorkers.delete(workerId);
    });

    activeWorkers.set(workerId, worker);

    res.json({
      message: "Group chat instance created",
      workerId,
      groupId,
    });
  } catch (error) {
    console.error("Error creating group chat instance:", error);
    res.status(500).json({ 
      error: "Failed to create group chat instance", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));