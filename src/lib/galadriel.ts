import { Contract, ethers, Wallet } from "ethers";
// import ChatGptABI from "../abis/ChatGptABI.js";
import AgentABI from "../abis/AgentABI.js";
import { sendMessage } from "./xmtp.js";

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
// const contractAddress = process.env.CHAT_CONTRACT_ADDRESS;
const contractAddress = process.env.AGENT_CONTRACT_ADDRESS;

if (!rpcUrl) throw Error("Missing RPC_URL in .env");
if (!privateKey) throw Error("Missing PRIVATE_KEY in .env");
if (!contractAddress) throw Error("Missing CHAT_CONTRACT_ADDRESS in .env");

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
// const contract = new Contract(contractAddress, ChatGptABI, wallet);
const contract = new Contract(contractAddress, AgentABI, wallet);

interface Message {
  role: string;
  content: string;
}

export async function textGeneration(userPrompt: string, systemPrompt: string) {
  try {
    const chatId = (global as any).chatId;
    console.log("### Chat ID ###: ", chatId);

    // The lead Agent is the one that checks with the LLM who and what to reply
    // and then sends the message as the right agent

    const transactionResponse = await contract.addMessage(userPrompt, chatId);
    const receipt = await transactionResponse.wait();
    console.log(`Message sent, tx hash: ${receipt.hash}`);

    // Wait for and retrieve the response
    const response = await waitForResponse(contract, chatId);
    console.log("### Response ###: ", response)

    console.log("### Reply ###: ", response.reply);

    if (response.reply.includes("Mario:")) {
      return response;
    } else if (response.reply.includes("Paul:")) {
      const cleanedReply = response.reply.replace(/^Paul:\s*/, '');
      sendMessage(process.env.TECH_AGENT_KEY as string, cleanedReply)
      return { reply: '', history: [] };
    } else if (response.reply.includes("Emile:")) {
      const cleanedReply = response.reply.replace(/^Emile:\s*/, '');
      sendMessage(process.env.SOCIAL_AGENT_KEY as string, cleanedReply)
      return { reply: '', history: [] };
    } else if (response.reply.includes("Gabriel:")) {
      const cleanedReply = response.reply.replace(/^Gabriel:\s*/, '');
      sendMessage(process.env.DATA_AGENT_KEY as string, cleanedReply)
      return { reply: '', history: [] };
    }

    return { reply: '', history: [] };
  } catch (error) {
    console.error("Failed to interact with ChatGPT:", error);
    throw error;
  }
}

// function getChatId(receipt: ethers.TransactionReceipt, contract: Contract) {
//   for (const log of receipt.logs) {
//     try {
//       const parsedLog = contract.interface.parseLog(log);
//       if (parsedLog && parsedLog.name === "ChatCreated") {
//         return ethers.toNumber(parsedLog.args[1]);
//       }
//     } catch (error) {
//       console.log("Could not parse log:", log);
//     }
//   }
// }

async function waitForResponse(contract: Contract, chatId: number): Promise<{ reply: string, history: Message[] }> {
  let allMessages: Message[] = [];
  let retries = 0;
  const maxRetries = 30; // Adjust as needed
  const retryDelay = 2000; // 2 seconds

  while (retries < maxRetries) {
    const newMessages = await getNewMessages(contract, chatId, allMessages.length);
    if (newMessages.length > 0) {
      allMessages = [...allMessages, ...newMessages];
      console.log("### All Messages ###: ", allMessages);
      const lastMessage = allMessages[allMessages.length - 1];
      if (lastMessage.role === "assistant") {
        return { reply: lastMessage.content, history: allMessages };
      }
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    retries++;
  }

  throw new Error("Timeout: No response received from assistant");
}

// async function getNewMessages(
//   contract: Contract,
//   chatId: number,
//   currentMessagesCount: number
// ): Promise<Message[]> {
//   const messages = await contract.getMessageHistory(chatId);
//   return messages.slice(currentMessagesCount).map((message: any) => ({
//     role: message[0],
//     content: message.content[0].value,
//   }));
// }

async function getNewMessages(
  contract: Contract,
  agentRunID: number,
  currentMessagesCount: number
): Promise<Message[]> {
  const messages = await contract.getMessageHistoryContents(agentRunID)
  const messagesRoles = await contract.getMessageHistoryRoles(agentRunID)

  const newMessages: Message[] = []
  messages.forEach((message: any, i: number) => {
    if (i >= currentMessagesCount) {
      newMessages.push(
        {
          // role: message.role,
          // content: message.content[0].value,
          role: messagesRoles[i],
          content: message,
        }
      );
    }
  })
  return newMessages;
}

// The vision function is removed as it's not supported by the ChatGPT contract