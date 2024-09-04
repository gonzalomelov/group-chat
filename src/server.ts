import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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
    const { target, targetFirstName, situation, privateInfo, groupTitle, groupImage } = req.body;

    // Validate required fields
    if (!target || !targetFirstName || !situation || !privateInfo || !groupTitle) {
      return res.status(400).json({ error: "Missing required fields in the request body" });
    }

    // XMTP addresses
    const creatorAddress = "0x372082138ea420eBe56078D73F0359D686A7E981";
    const otherAddress = "0xB35da5B86DB0Ef18234675afd481138A7617857c"; // iPhone 15 Pro Max
    const targetAddress = "0xF2d0d7c3bc3963410A8FdFCc9E0676E49217CCb4"; // iPhone 15
    const agentAddresses = [
      "0x0D79E8F6A3F81420DDbFfaDAc4CD651335777a9D", // Mario: LEAD_AGENT_XMTP_ADDRESS
      "0xeEE998Beb137A331bf47Aa5Fc366033906F1dB34", // Paul: TECH_AGENT_XMTP_ADDRESS
      "0xE67b3617E9CbAf456977CA9d4b9beAb8944EFc37", // Emile: SOCIAL_AGENT_XMTP_ADDRESS
      "0xfA568f302F93Ed732C88a8F1999dCe8e841E14EC", // Gabriel: DATA_AGENT_XMTP_ADDRESS
    ];
    const groupMembers = [creatorAddress, otherAddress, targetAddress, ...agentAddresses];

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