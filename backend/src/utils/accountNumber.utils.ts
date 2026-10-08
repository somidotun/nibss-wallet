import Wallet from "../models/wallet.model.js";

export const generateAccountNumber = async (): Promise<string> => {
  while (true) {
    const accountNumber =
      "90" +
      Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0");

    const existing = await Wallet.findOne({ accountNumber });

    if (!existing) {
      return accountNumber;
    }
  }
};
