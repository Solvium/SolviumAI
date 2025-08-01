import { useEffect, useState } from "react";
import { useTonClient } from "./useTonClient";
import { useAsyncInitialize } from "./useAsyncInitialize";
import { useTonConnect } from "./useTonConnect";
import { CHAIN } from "@tonconnect/protocol";
import { SolviumMultiplier } from "../contracts/deposit_multiplier";
import { Address, OpenedContract, toNano } from "@ton/core";

export function useMultiplierContract(user: string) {
  const { client } = useTonClient();
  const { sender, network } = useTonConnect();
  const [deposits, setDeposits]: any = useState();

  const multiplierContract = useAsyncInitialize(async () => {
    if (!client) return;
    const contract = new SolviumMultiplier(
      Address.parse(
        network === CHAIN.MAINNET
          ? "EQBJF4GTZjNzFHOVnWYtMor7v4QdrH-vF0qmNmJRc_BGDLIo"
          : "kQBJF4GTZjNzFHOVnWYtMor7v4QdrH-vF0qmNmJRc_BGDAmi"
      )
    );
    return client.open(contract) as OpenedContract<SolviumMultiplier>;
  }, [client]);

  const getGetAllUserDeposits = async (user: Address) => {
    const res = await multiplierContract?.getGetAllUserDeposits(user);
    if (!res) return;
    const newDeposits = [];
    for (let index = 0; index < res.size; index++) {
      const curDep = res.get(BigInt(index + 1));
      const date = (Number(curDep?.startTime) + 604800) * 1000;
      if (date < Date.now()) continue;
      newDeposits.push(curDep);
    }
    setDeposits(newDeposits);
  };

  useEffect(() => {
    if (!user || !multiplierContract) return;
    getGetAllUserDeposits(Address.parse(user));
  }, [user, multiplierContract]);

  return {
    ca: multiplierContract?.address.toString(),
    deposits,
    handleDeposit: async (amount: string) => {
      return multiplierContract?.send(
        sender,
        { value: toNano(amount) },
        "Deposit"
      );
    },
    adminWithdraw: async (amount: string) => {
      return multiplierContract?.send(
        sender,
        { value: toNano("0.1") },
        { $$type: "AdminWithdraw", amount: toNano("1.4") }
      );
    },
  };
}
