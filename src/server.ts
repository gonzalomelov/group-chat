import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generatePrivateKey } from "viem/accounts";
import { createGroupChat, setupXmtpClient } from './lib/xmtp.js';

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
    const { target, targetFirstName, situation, privateInfo, groupTitle, groupImage, connectedAddress } = req.body;

    // Validate required fields
    if (!target || !targetFirstName || !situation || !privateInfo || !groupTitle || !groupImage || !connectedAddress) {
      return res.status(400).json({ error: "Missing required fields in the request body" });
    }

    // XMTP addresses
    const creatorAddress = connectedAddress;
    const targetAddress = target;
    const iPhoneAddress = "0x6f0dE9a389e19F40b38817D30C1FFBA6a08b8142"; // iPhone 15 Pro Max
    const iPhone2Address = "0x9Bec9A9c4961905c6bfB466064C11287d1aC8D6C"; // iPhone 15
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

    const workerId = `group-chat-${Date.now()}`;
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
        // target,
        // targetFirstName,
        // situation,
        // privateInfo,
        // groupTitle,
        // groupImage,
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