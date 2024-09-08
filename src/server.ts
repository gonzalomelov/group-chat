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
import { SignProtocolClient, SpMode, EvmChains } from '@ethsign/sp-sdk';
import { privateKeyToAccount } from 'viem/accounts';

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

// Initialize SignProtocolClient
const spClient = new SignProtocolClient(SpMode.OnChain, {
  chain: EvmChains.baseSepolia,
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
});

app.post("/api/simulations/:id/verify", async (req, res) => {
  console.log("Received verification request for simulation ID:", req.params.id);
  
  try {
    const { id } = req.params;
    const runId = parseInt(id);
    
    console.log("Fetching run data for simulation ID:", runId);
    // Fetch the specific agent run directly
    const run = await agentContract.agentRuns(runId);
    
    if (!run || run.creator === ethers.ZeroAddress) {
      console.log("Simulation not found for ID:", runId);
      return res.status(404).json({ error: "Simulation not found" });
    }

    console.log("Run data fetched successfully:", run);
    console.log("Creator:", run.creator);
    console.log("Situation:", run.situation);

    // 0x5b664d8d0926bc540bd6401ad7738459a824036c NFT Contract
    // 0x03508bB71268BBA25ECaCC8F620e01866650532c NFT Owner

    const situationString = run.situation === 0n ? "UsdcDonation" : "NftMint";

    console.log("Situation String:", situationString);

    const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['string', 'address', 'address'],
      [situationString, run.situationAddress, run.creator]
    );

    console.log("Extra Data:", extraData);

    console.log("Creating attestation...");
    // Create attestation
    const createAttestationRes = await spClient.createAttestation({
      schemaId: '0x27b',
      data: {
        action: situationString,
        actionAddress: run.situationAddress,
        recipient: run.creator
      },
      recipients: [run.creator],
      indexingValue: id,
    }, {
      extraData: extraData as `0x${string}`
    });

    console.log("Attestation created successfully");
    console.log("Attestation ID:", createAttestationRes.attestationId);
    console.log("Transaction Hash:", createAttestationRes.txHash);
    console.log("Indexing Value:", createAttestationRes.indexingValue);

    res.json({
      message: "Attestation created successfully",
      attestationId: createAttestationRes.attestationId,
      txHash: createAttestationRes.txHash,
      indexingValue: createAttestationRes.indexingValue,
    });
  } catch (error) {
    console.error("Error verifying simulation:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    res.status(500).json({ 
      error: "Failed to verify simulation", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));