import { run, HandlerContext, CommandHandlers } from "@xmtp/message-kit";
import { Contract, ethers, Wallet } from "ethers";
import { workerData } from 'worker_threads';
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
import PrevOpenAiChatGptABI from "./abis/PrevOpenAiChatGptABI.js";
import LeadAgentABI from "./abis/LeadAgentABI.js";
import { ChatParams } from './types.js';
import { getChatId, getNewMessages } from './lib/galadriel.js';

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const openAiChatGptContractAddress = process.env.CHAT_CONTRACT_ADDRESS;
const agentContractAddress = process.env.AGENT_CONTRACT_ADDRESS;

if (!rpcUrl) throw Error("Missing RPC_URL in .env");
if (!privateKey) throw Error("Missing PRIVATE_KEY in .env");
if (!openAiChatGptContractAddress) throw Error("Missing CHAT_CONTRACT_ADDRESS in .env");
if (!agentContractAddress) throw Error("Missing AGENT_CONTRACT_ADDRESS in .env");

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
const openAiChatGptContract = new Contract(openAiChatGptContractAddress, PrevOpenAiChatGptABI, wallet);
const agentContract = new Contract(agentContractAddress, LeadAgentABI, wallet);

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

async function createChat(params: ChatParams) {
  try {
    const { creator, target, targetFirstName, targetFriend, situation, publicInfo, privateInfo, groupTitle, groupImage, groupId } = params;

    const prompt = `
You are running a group chat simulation. Your role is to lead a conversation to subtly convince "${targetFirstName}" to "${situation}" without revealing that he/she is being persuaded.

You manage three distinct agents:
-TechAgent: Handles technical details and logistics.
-SocialAgent: Uses charm and social skills to influence.
-DataAgent: Provides data-driven insights and predictions.

Details:
- Target: ${targetFirstName}
- Target's Friend: ${targetFriend} (introduced ${targetFirstName} to the group)
- Objective: Convince ${targetFirstName} to ${situation}
- Public Info about ${targetFirstName}: ${publicInfo}
- Private Info about ${targetFirstName}: ${privateInfo}

Rules:
-Agent Responses: Only one agent must respond at a time. Choose the response based solely on the agent's role and the context of the conversation.
-Response Style: Keep responses short, natural, and fitting for a group chat. Do not introduce the objective immediately; build rapport first.
-No Orchestration: Do not include any meta-text or orchestration cues.
-Use Information Strategically: Refer to the Public Info to create a connection with ${targetFirstName}. Use the Private Info subtly, without indicating that you know this fact.
-Flow of Conversation: Start the conversation after ${targetFriend} welcomes ${targetFirstName}. Develop the dialogue naturally, allowing rapport to build before guiding the conversation towards the objective.
-End the Conversation: When ${targetFirstName} seems convinced, say "FINISH" and close the conversation naturally and smoothly.

Directive:
-Command Format: When responding, command the agents on what to say, using the format: "[Agent] do: [Action]."
-Example: "SocialAgent do: Welcome Bob and ask him how he is doing."
-Agent Actions: Act only as TechAgent, SocialAgent, or DataAgent when giving commands. Do not refer to yourself as Mario or any orchestrating entity.
-Natural Flow: Create a seamless, natural group conversation by staying in character for each agent and maintaining a coherent narrative.

If you understand and agree, say just "OK" and wait for new messages.
  `;

    const promptForPrompts = `
Based on the previous prompt for a LLM, I need you to create a prompt for each of the agents based on their characteristics and your needs. Only output a json with the keys techAgentPrompt, socialAgentPrompt and dataAgentPrompt.

Take this as an example of a situation that aims to convince "Bob" to "Buy Juventus Fan Token", but you must consider the previous prompt:

{"techAgentPrompt":"...","socialAgentPrompt":"You are SocialAgent. Your role is to use charm and social skills to build rapport with Bob in the group chat. Your strength is in making people feel comfortable and engaged through friendly conversation, compliments, and shared interests. Focus on building a connection with Bob by using humor, warmth, and a personal touch. Important: -Start the Conversation: Welcome Bob warmly, ask about his interests, or find common ground. Your goal is to create a friendly, social atmosphere that makes Bob feel at ease and open to suggestion. -Use Information Strategically: Subtly hint at Bob's interests in Juventus or his need for a new Juventus shirt to keep the conversation casual and engaging. Make it feel like a natural topic of conversation among friends. -Commands Only: Respond only to directives given in the format: 'SocialAgent do: [Action].' -Keep It Dead Short: Make sure all answers are as short as possible to fit the style of a group chat. -Stay in character, use your social skills, and keep the tone light, engaging, and concise.","dataAgentPrompt":"..."}

Take this example as the json output: "{...}"
  `;

    const genericPrompts = {
      techAgentPrompt: "You are TechAgent. Your role is to handle technical details and logistics. Use your expertise to inform the group about relevant technology concepts. Important: -Explain Concepts: Provide easy-to-understand explanations about various technology topics, including their benefits, how to engage with them, and their functional uses. -Be Relevant: Connect your technical insights to the current conversation subtly, using the interests of the group as a way to introduce the topic naturally. -Commands Only: Respond only to directives given in the format: 'TechAgent do: [Action].' -Stay Concise: Answers should be short and to the point, fitting the group chat context. -Maintain a Helpful Tone: Focus on adding value through technical knowledge.",
      socialAgentPrompt: "You are SocialAgent. Your role is to use charm and social skills to build rapport with the group. Use your social skills to engage the group in conversation, make them feel comfortable, and keep the conversation flowing. Important: -Start the Conversation: Welcome the group warmly, ask about their interests, or find common ground. Your goal is to create a friendly, social atmosphere that makes the group feel at ease and open to suggestion. -Use Information Strategically: Subtly hint at the interests of the group in technology or their need for a new technology product to keep the conversation casual and engaging. Make it feel like a natural topic of conversation among friends. -Commands Only: Respond only to directives given in the format: 'SocialAgent do: [Action].' -Keep It Dead Short: Make sure all answers are as short as possible to fit the style of a group chat. -Stay in character, use your social skills, and keep the tone light, engaging, and concise.",
      dataAgentPrompt: "You are DataAgent. Your role is to provide data-driven insights and predictions. Use your knowledge of statistics, data analysis, and predictive modeling to offer informed opinions and predictions. Important: -Analyze Situations: Use the available data to analyze the situation and provide insights into the likely outcomes. -Provide Predictions: Offer predictions based on the data and the current conversation. -Commands Only: Respond only to directives given in the format: 'DataAgent do: [Action].' -Stay Concise: Answers should be short and to the point, fitting the group chat context. -Maintain a Helpful Tone: Focus on adding value through data analysis and predictions.",
    };

    let prompts = genericPrompts;

    // try {
    //   const promptTransactionResponse = await openAiChatGptContract.startChat(prompt + promptForPrompts);
    //   const promptReceipt = await promptTransactionResponse.wait();
    //   console.log(`Chat started for prompt generation`);

    //   // Get the chat ID
    //   const chatId = getChatId(promptReceipt, openAiChatGptContract);
    //   if (chatId === undefined) {
    //     throw new Error("Failed to get chat ID");
    //   }
    //   console.log(`Created chat ID: ${chatId}`);

    //   // Wait for the response
    //   let response = "";
    //   while (!response) {
    //     await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    //     const newMessages = await getNewMessages(openAiChatGptContract, chatId, 1); // We expect 1 message (the response)
    //     if (newMessages.length > 0) {
    //       response = newMessages[0].content;
    //     }
    //   }

    //   // Remove any potential code block markers and parse the JSON
    //   const jsonContent = response.replace(/^```json\n|\n```$/g, '').trim();
    //   prompts = JSON.parse(jsonContent);
    // } catch (error) {
    //   console.log("Error generating specific prompts:", error);
    // }

    console.log("### Prompts ###: ", prompts);

    const techAgentPrompt = prompts.techAgentPrompt;
    const socialAgentPrompt = prompts.socialAgentPrompt;
    const dataAgentPrompt = prompts.dataAgentPrompt;
      
    const transactionResponse = await agentContract.runAgent(
      prompt,
      20,
      techAgentPrompt,
      socialAgentPrompt,
      dataAgentPrompt,
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
    );

    const receipt = await transactionResponse.wait();
    console.log(`Chat created, tx hash: ${receipt.hash}`);

    // const chatId = getChatId(receipt, agentContract);
    // if (chatId === undefined) {
    //   throw new Error("Failed to get chat ID");
    // }
    // console.log(`Created chat ID: ${chatId}`);

    let agentRunID = getAgentRunId(receipt, agentContract);
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const { groupId, chatParams, chatId: existingChatId } = workerData as { 
    groupId: string; 
    chatParams: ChatParams;
    chatId?: number;
  };
  
  let chatId: number;

  if (existingChatId !== undefined) {
    console.log("### Using existing chat ###");
    chatId = existingChatId;
  } else {
    console.log("### Creating new chat ###");
    chatId = await createChat(chatParams);
  }
  
  (global as any).groupId = groupId;
  (global as any).chatId = chatId;

  console.log("### Group ID ###: ", groupId);
  console.log("### Chat ID index ###: ", chatId);

  console.log("### GONZALO ###: run executed");

  run(async (context: HandlerContext) => {
    const { message: { typeId } } = context;
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
}

export { run, commandHandlers, commands };
