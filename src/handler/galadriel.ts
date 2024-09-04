import { HandlerContext, User } from "@xmtp/message-kit";
import { textGeneration } from "../lib/galadriel.js";

export async function handler(context: HandlerContext) {
  if (!process?.env?.AGENT_CONTRACT_ADDRESS) {
    console.log("No AGENT_CONTRACT_ADDRESS found in .env");
    return;
  }

  const {
    message: {
      content: { content, params },
    },
  } = context;

  // If the received message comes from a bot, do not process it

  console.log("### Message From ###: ", context.message.sender.address);

  const botAddresses = [
    "0xeEE998Beb137A331bf47Aa5Fc366033906F1dB34",
    "0xE67b3617E9CbAf456977CA9d4b9beAb8944EFc37",
    "0xfA568f302F93Ed732C88a8F1999dCe8e841E14EC"
  ].map(addr => addr.toLowerCase());

  if (botAddresses.includes(context.message.sender.address.toLowerCase())) {
    console.log("### Message from bot ###");
    return;
  } else {
    console.log("### Message from user ###");
  }

  // If the message comes from a user, process it

  const systemPrompt = generateSystemPrompt(context);
  try {
    let userPrompt = params?.prompt ?? content;
    if (process?.env?.MSG_LOG === "true") {
      console.log("userPrompt", userPrompt);
    } 

    const { reply } = await textGeneration(userPrompt, systemPrompt);

    // Only reply if the lead Agent needs to say something

    if (reply) {
      context.intent(reply);
    }
  } catch (error) {
    console.error("Error during Galadriel ChatGPT call:", error);
    await context.reply("An error occurred while processing your request.");
  }
}

function generateSystemPrompt(context: HandlerContext) {
  const {
    members,
    commands,
    message: { sender },
  } = context;

  const systemPrompt = `You are a helpful agent that lives inside a web3 messaging group.\n
  These are the users of the group: ${JSON.stringify(members?.map((member: User) => ({ ...member, username: `@${member.username}` })))}\n 
  This group app has many commands available: ${JSON.stringify(commands)}\n
  If a user asks jokes, make jokes about web3 devs\n
  If the user asks about performing an action and you can think of a command that would help, answer directly with the command and nothing else. Populate the command with the correct or random values. Always return commands with real values only, using usernames with @ and excluding addresses.\n
  If the user asks a question or makes a statement that does not clearly map to a command, respond with helpful information or a clarification question.\n
  The message was sent by @${sender?.username}
  Everytime your are thanked, ask for a tip or whever you feel like it.
  .`;

  return systemPrompt;
}
