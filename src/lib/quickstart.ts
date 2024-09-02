import { Contract, ethers, Wallet } from "ethers";
// import ABI from "./abis/OpenAiSimpleLLM.json";

const ABI = [
  "function initializeDalleCall(string memory message) public returns (uint)",
  "function lastResponse() public view returns (string)"
];

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.QUICKSTART_CONTRACT_ADDRESS;

if (!rpcUrl) throw Error("Missing RPC_URL in .env");
if (!privateKey) throw Error("Missing PRIVATE_KEY in .env");
if (!contractAddress) throw Error("Missing QUICKSTART_CONTRACT_ADDRESS in .env");

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
const contract = new Contract(contractAddress, ABI, wallet);

export async function textGeneration(userPrompt: string, systemPrompt: string) {
  try {
    // Send the message to the contract
    const transactionResponse = await contract.initializeDalleCall(userPrompt);
    const receipt = await transactionResponse.wait();
    console.log(`Message sent, tx hash: ${receipt.hash}`);

    let lastResponse = await contract.lastResponse();
    let newResponse = lastResponse;
    
    while (newResponse === lastResponse) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      newResponse = await contract.lastResponse();
    }
    
    return { reply: newResponse as string, history: [] };

    // // Wait for and retrieve the response
    // let response = null;
    // while (!response) {
    //   response = await contract.response();
    //   if (!response) {
    //     await new Promise(resolve => setTimeout(resolve, 2000));
    //   }
    // }

    // // Construct the history (note: this is simplified as we don't have full history)
    // const history = [
    //   { role: "system", content: systemPrompt },
    //   { role: "user", content: userPrompt },
    //   { role: "assistant", content: response },
    // ];

    // return { reply: response as string, history: history };
  } catch (error) {
    console.error("Failed to fetch from Quickstart:", error);
    throw error;
  }
}

// The vision function is removed as it's not supported by the Simple LLM contract