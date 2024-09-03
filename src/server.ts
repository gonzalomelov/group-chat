import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

const activeWorkers = new Map();

app.post("/group-chats", async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!groupId) {
      return res.status(400).json({ error: "groupId is required in the request body" });
    }

    const workerId = `group-chat-${Date.now()}`;
    const worker = new Worker(path.join(__dirname, 'index.js'), {
      workerData: {
        RPC_URL: process.env.RPC_URL,
        PRIVATE_KEY: process.env.PRIVATE_KEY,
        AGENT_CONTRACT_ADDRESS: process.env.AGENT_CONTRACT_ADDRESS,
        OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
        STACK_API_KEY: process.env.STACK_API_KEY,
        MSG_LOG: process.env.MSG_LOG,
        groupId: groupId,
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
      workerId: workerId,
      groupId: groupId,
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