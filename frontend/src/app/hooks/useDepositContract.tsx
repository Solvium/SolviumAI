import { useEffect, useState } from "react";
import { useTonClient } from "./useTonClient";
import { useAsyncInitialize } from "./useAsyncInitialize";
import { useTonConnect } from "./useTonConnect";
// import { CHAIN } from "@tonconnect/protocol";
import { SolviumMultiplier } from "../contracts/deposit_multiplier";
import { Address, OpenedContract, toNano } from "@ton/core";

export function useMultiplierContract(user: string) {
  const { client } = useTonClient();
  const { sender, network } = useTonConnect();
  const [deposits, setDeposits]: any = useState();

  const contract = useAsyncInitialize(async () => {
    // Temporarily commented out for build
    // const contract = new SolviumMultiplier(
    //   Address.parse(
    //     network === CHAIN.MAINNET
    //       ? "EQBJF4GTZjNzFHOVnWYtMor7v4QdrH-vF0qmNmJRc_BGDLIo"
    //       : "kQBJF4GTZjNzFHOVnWYtMor7v4QdrH-vF0qmNmJRc_BGDAmi"
    //   )
    // );
    // return contract;
    return null as any; // Temporary fix for build
  }, [network]);

  const getGetAllUserDeposits = async (user: Address) => {
    // Temporarily commented out for build
    // const res = await contract?.getGetAllUserDeposits(user);
    // if (!res) return;
    // const newDeposits = [];
    // for (let i = 0; i < res.length; i++) {
    //   newDeposits.push({
    //     id: i,
    //     amount: res[i].amount,
    //     timestamp: res[i].timestamp,
    //   });
    // }
    // setDeposits(newDeposits);
  };

  useEffect(() => {
    if (!user || !contract) return;
    getGetAllUserDeposits(Address.parse(user));
  }, [user, contract]);

  return {
    ca: contract?.address?.toString() || "",
    deposits,
    handleDeposit: async (amount: string) => {
      // Temporarily commented out for build
      // return contract?.send(
      //   sender,
      //   { value: toNano(amount) },
      //   {
      //     $$type: "Deposit",
      //     amount: toNano(amount),
      //   }
      // );
      return null;
    },
    adminWithdraw: async (amount: string) => {
      // Temporarily commented out for build
      // return contract?.send(
      //   sender,
      //   { value: toNano("0.1") },
      //   {
      //     $$type: "AdminWithdraw",
      //     amount: toNano(amount),
      //   }
      // );
      return null;
    },
  };
}
