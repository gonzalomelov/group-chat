export interface ChatParams {
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
}

export enum Situation {
  UsdcDonation = 0,
  NftMint = 1,
}