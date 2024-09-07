import express from 'express';
import { Worker, WorkerOptions } from 'worker_threads';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generatePrivateKey } from "viem/accounts";
import { createGroupChat, setupXmtpClient } from './lib/xmtp.js';
import { ChatParams } from './types.js';
import { ethers } from 'ethers';
import LeadAgentABI from "./abis/LeadAgentABI.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface AgentRunInfo {
  owner: string;
  creator: string;
  target: string;
  targetFirstName: string;
  targetFriend: string;
  situation: "UsdcDonation" | "NftMint";
  situationAddress: string;
  publicInfo: string;
  privateInfo: string;
  groupTitle: string;
  groupImage: string;
  groupId: string;
  responsesCount: bigint;
  max_iterations: number;
  is_finished: boolean;
}

const app = express();
app.use(express.json());

const activeWorkers = new Map();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const agentContract = new ethers.Contract(process.env.AGENT_CONTRACT_ADDRESS!, LeadAgentABI, wallet);

await setupXmtpClient(process.env.TECH_AGENT_KEY);
await setupXmtpClient(process.env.SOCIAL_AGENT_KEY);
await setupXmtpClient(process.env.DATA_AGENT_KEY);

createInitialWorkers();

async function createInitialWorkers() {
  const activeRuns = await getActiveAgentRuns();
  
  activeRuns.forEach((run: AgentRunInfo, index: number) => {
    const chatParams: ChatParams = {
      creator: run.creator,
      target: run.target,
      targetFirstName: run.targetFirstName,
      targetFriend: run.targetFriend,
      situation: run.situation as "UsdcDonation" | "NftMint",
      situationAddress: run.situationAddress,
      publicInfo: run.publicInfo,
      privateInfo: run.privateInfo,
      groupTitle: run.groupTitle,
      groupImage: run.groupImage,
      groupId: run.groupId
    };

    const botKey = generatePrivateKey() as `0x${string}`;
    process.env.KEY = botKey;
    const workerId = `group-chat-${run.groupId}`;
    console.log("### Worker ID ###: ", workerId);
    console.log("### Gonzalo: Chat ID ###: ", index);
    const worker = createWorker(workerId, chatParams, botKey, index);
    activeWorkers.set(workerId, worker);

    console.log(`Worker created for existing run: ${workerId}`);
  });
}

async function getActiveAgentRuns() {
  try {
    const activeRuns = await agentContract.getAgentRuns(ethers.ZeroAddress);
    console.log("### Active runs ###: ", activeRuns);
    return activeRuns;
  } catch (error) {
    console.error("Error fetching active agent runs:", error);
    return [];
  }
}

function createWorker(workerId: string, chatParams: ChatParams, botKey: string, chatId?: number): Worker {
  const workerOptions: WorkerOptions = {
    workerData: {
      RPC_URL: process.env.RPC_URL,
      PRIVATE_KEY: process.env.PRIVATE_KEY,
      AGENT_CONTRACT_ADDRESS: process.env.AGENT_CONTRACT_ADDRESS,
      OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
      STACK_API_KEY: process.env.STACK_API_KEY,
      MSG_LOG: process.env.MSG_LOG,
      groupId: chatParams.groupId,
      botKey,
      chatParams,
      chatId,
    },
  };

  const worker = new Worker(path.join(__dirname, 'index.js'), workerOptions);

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

  return worker;
}

app.post("/group-chats", async (req, res) => {
  try {
    const { creator, target, targetFirstName, targetFriend, situation, situationAddress, privateInfo, groupTitle, groupImage } = req.body;

    // Validate required fields
    if (!creator || !target || !targetFirstName || !targetFriend || situation === undefined || !situationAddress || !privateInfo || !groupTitle || !groupImage) {
      return res.status(400).json({ error: "Missing required fields in the request body" });
    }

    // Validate situation enum
    if (!["UsdcDonation", "NftMint"].includes(situation)) {
      return res.status(400).json({ error: "Invalid situation value" });
    }

    // XMTP addresses
    const creatorAddress = creator;
    const targetAddress = target;
    const iPhoneAddress = "0xbBaA51d7D7A8d9F84A0763C96D36af1ee4f1BA07"; // iPhone 15 Pro Max
    const iPhone2Address = "0x2d96D6421c1b07D73d422e5A0Bd9b859cc293369"; // iPhone 15
    const agentAddresses = [
      "0xeEE998Beb137A331bf47Aa5Fc366033906F1dB34", // Paul: TECH_AGENT_XMTP_ADDRESS
      "0xE67b3617E9CbAf456977CA9d4b9beAb8944EFc37", // Emile: SOCIAL_AGENT_XMTP_ADDRESS
      "0xfA568f302F93Ed732C88a8F1999dCe8e841E14EC", // Gabriel: DATA_AGENT_XMTP_ADDRESS
    ];
    const groupMembers = [creatorAddress, targetAddress, iPhoneAddress, iPhone2Address, ...agentAddresses];

    const botKey = generatePrivateKey() as `0x${string}`;
    process.env.KEY = botKey;
    
    console.log("### Bot Key ###: ", botKey);

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
      situationAddress,
      publicInfo,
      privateInfo,
      groupTitle,
      groupImage,
      groupId
    };

    const worker = createWorker(workerId, chatParams, botKey);

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