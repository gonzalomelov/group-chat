import { run, HandlerContext, CommandHandlers } from "@xmtp/message-kit";
import { Contract, ethers, Wallet } from "ethers";
import { commands } from "./commands.js";
import { handler as bet } from "./handler/betting.js";
import { handler as tipping } from "./handler/tipping.js";
import { handler as agent } from "./handler/agent.js";
import { handler as transaction } from "./handler/transaction.js";
import { handler as splitpayment } from "./handler/payment.js";
import { handler as games } from "./handler/game.js";
import { handler as admin } from "./handler/admin.js";
import { handler as loyalty } from "./handler/loyalty.js";
import { handler as image } from "./handler/image.js";
import { handler as galadriel } from "./handler/galadriel.js";
// import ChatGptABI from "./abis/ChatGptABI.js";
import AgentABI from "./abis/AgentABI.js";

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

// Define command handlers
const commandHandlers: CommandHandlers = {
  "/tip": tipping,
  "/agent": agent,
  "/image": image,
  "/galadriel": galadriel,
  "/bet": bet,
  "/send": transaction,
  "/swap": transaction,
  "/mint": transaction,
  "/show": transaction,
  "/points": loyalty,
  "/leaderboard": loyalty,
  "/game": games,
  "/add": admin,
  "/remove": admin,
  "/name": admin,
  "/help": async (context: HandlerContext) => {
    const intro =
      "Available experiences:\n" +
      commands
        .flatMap((app) => app.commands)
        .map((command) => `${command.command} - ${command.description}`)
        .join("\n") +
      "\nUse these commands to interact with specific apps.";
    context.reply(intro);
  },
};

// App configuration
const appConfig = {
  commands: commands,
  commandHandlers: commandHandlers,
};

const chatId = await createChat();
// const chatId = 4;

(global as any).chatId = chatId;

console.log("### Chat ID index ###: ", chatId);

console.log("### GONZALO ###: run executed");

// Main function to run the app
run(async (context: HandlerContext) => {
  const {
    message: { typeId },
  } = context;
  console.log("### GONZALO ###: inside run");
  console.log("typeId", typeId);
  try {
    switch (typeId) {
      // case "reaction":
      //   handleReaction(context);
      //   loyalty(context);
      //   break;
      // case "reply":
      //   handleReply(context);
      //   break;
      // case "group_updated":
      //   admin(context);
      //   loyalty(context);
      //   break;
      // case "remoteStaticAttachment":
      //   handleAttachment(context);
      //   break;
      case "text":
        handleTextMessage(context);
        // loyalty(context, true);
        break;
      default:
        console.warn(`Unhandled message type: ${typeId}`);
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
}, appConfig);

// Handle reaction messages
async function handleReaction(context: HandlerContext) {
  const {
    content: { content: emoji, action },
  } = context.message;

  if (action === "added" && (emoji === "degen" || emoji === "🎩")) {
    await tipping(context);
  }
}

// Handle reply messages
async function handleReply(context: HandlerContext) {
  const {
    content: { content: reply },
  } = context.message;
  if (reply.includes("degen")) {
    await tipping(context);
  }
}

// Handle attachment messages
async function handleAttachment(context: HandlerContext) {
  await splitpayment(context);
}

// Handle text messages
async function handleTextMessage(context: HandlerContext) {
  const {
    content: { content: text },
  } = context.message;
  // if (text.includes("@bot")) {
  //   await agent(context);
  // } else if (text.startsWith("/")) {
  //   await context.intent(text);
  // }
  await galadriel(context);
}

async function createChat() {
  try {
    const prompt = `
      You are running a group chat simulation. Your role is to lead a conversation to subtly convince "Bob" to "Buy a Bored Ape NFT" without revealing that he is being persuaded.
      
      You manage three distinct agents:
      -Pablo: Handles technical details and logistics.
      -Emilio: Uses charm and social skills to influence.
      -Gabriel: Provides data-driven insights and predictions.
      
      Details:
      - Target: Bob
      - Target's Friend: Jack (introduced Bob to the group)
      - Objective: Convince Bob to buy a Bored Ape NFT
      - Public Info about Bob: Owns a The Sandbox NFT
      - Private Info about Bob: Loves the apes at his local zoo
      
      Rules:
      -Agent Responses: Only one agent may respond at a time. Choose the response based solely on the agent's role and the context of the conversation.
      -Response Style: Keep responses short, natural, and fitting for a group chat. Do not introduce the objective immediately; build rapport first.
      -No Orchestration: Do not include any meta-text or orchestration cues like "Mario: signals Emilio to start" or "Mario: pauses to let the conversation flow."
      -Use Information Strategically: Refer to the Public Info to create a connection with Bob. Use the Private Info subtly, without indicating that you know this fact.
      -Flow of Conversation: Start the conversation after Jack welcomes Bob. Develop the dialogue naturally, allowing rapport to build before guiding the conversation towards the objective.
      -End the Conversation: When Bob seems convinced, say "FINISH" and close the conversation naturally and smoothly.
      
      Directive:
      -Act only as Pablo, Emilio, or Gabriel when responding. Never refer to yourself as Mario or any orchestrating entity.
      -Remember: You are creating a seamless, natural group conversation. Stay in character for each agent and maintain a coherent narrative.
      -If you understand and agree, say "OK".
    `;

    const transactionResponse = await contract.runAgent(prompt, 20);
    // const transactionResponse = await contract.startChat("You'll take part as a Juve fan. You have to convince everybody to buy Juventus Fan Tokens. You'll never reveal that you're an AI, and you'll never reveal that you're part of a group chat.");
    // const transactionResponse = await contract.startChat("You'll take part as a Juve fan, and you'll respond to any message with a short, witty comment about the team. You'll never reveal that you're an AI, and you'll never reveal that you're part of a group chat.");
    // const transactionResponse = await contract.startChat("Based on Los Simuladores (argentinian serie) I want to create the following. Suppose we are in a simulation that is runniing in a group chat (this chat). You will take part of the ones that simulate the situation and I will be taking part with 2 people: -The target person to be convinced about something (let's call him Bob) -The target person friend who added him to this group (let's call him Jack). Suppose you want to convince me of buying a Juventus shirt. You will take part with 4 other 'people' (bots) and chat me trying to convice me to do it. You know the following about me: -> Public: that I have a The Sandbox NFT and Juventus fan tokens -> Private (you must never say directly to me that you know this): My last Juventus shirt came unstitched and I need a new one. I will start the conversation and you will pop up with those 4 other people, one by one, accordingly and reasonably based on the conversation.");

    const receipt = await transactionResponse.wait();
    console.log(`Chat created, tx hash: ${receipt.hash}`);

    // const chatId = getChatId(receipt, contract);
    // if (chatId === undefined) {
    //   throw new Error("Failed to get chat ID");
    // }
    // console.log(`Created chat ID: ${chatId}`);

    let agentRunID = getAgentRunId(receipt, contract);
    // let agentRunID = 5;
    if (!agentRunID && agentRunID !== 0) {
      throw new Error("Failed to get run ID");
    }
    console.log(`Created agent run ID: ${agentRunID}`)
    
    return agentRunID;
  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
}

// // Function to get chat ID from transaction receipt
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

function getAgentRunId(receipt: ethers.TransactionReceipt, contract: Contract) {
  let agentRunID
  for (const log of receipt.logs) {
    try {
      const parsedLog = contract.interface.parseLog(log)
      if (parsedLog && parsedLog.name === "AgentRunCreated") {
        // Second event argument
        agentRunID = ethers.toNumber(parsedLog.args[1])
      }
    } catch (error) {
      // This log might not have been from your contract, or it might be an anonymous log
      console.log("Could not parse log:", log)
    }
  }
  return agentRunID;
}
