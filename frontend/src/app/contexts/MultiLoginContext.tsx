// src/context/MultiLoginContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { useMultiLogin } from "../hooks/useMultiLogin";
import axios from "axios";
import WebApp from "@twa-dev/sdk";

const MultiLoginContext = createContext<
  | (ReturnType<typeof useMultiLogin> & {
      // Added API and state variables
      leader: any[];
      tasks: any;
      userTasks: any[];
      loading: boolean;
      multiplier: number;
      getLeaderBoard: () => Promise<void>;
      getAllInfo: () => Promise<void>;
      getTasks: () => Promise<void>;
      getAllUserTasks: (data: any) => Promise<void>;
      claimPoints: (
        type: string,
        func: (param: boolean) => void
      ) => Promise<object>;
      engageTasks: (
        type: string,
        data: any,
        func: (param: boolean) => void
      ) => Promise<object>;
    })
  | null
>(null);

export const MultiLoginProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const multiLogin = useMultiLogin();
  const { userData: user, checkAuthStatus } = multiLogin;

  // Added state for API calls
  const [leader, setLeader] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any>(null);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [multiplier, setMultiplier] = useState(0);
  const [tg, setTg] = useState<typeof WebApp | null>();

  // Get values from your app context
  // const nearConnected = false;
  // const nearAddress = "";

  // const nearDeposits: any = null;
  // const deposits: string | any[] = [];
  // const getDeposits = () => 0;

  const getLeaderBoard = async () => {
    try {
      const res = await axios("/api/allroute?type=leaderboard");
      if (res.status === 200) {
        setLeader(res.data);
      } else {
        console.error("Failed to get leaderboard:", res.status, res.data);
      }
    } catch (error: any) {
      console.error(
        "Error fetching leaderboard:",
        error?.response?.data || error.message
      );
    }
  };

  const getTasks = async () => {
    try {
      const res = await axios(
        "/api/allroute?type=getTasksInfo&username=" + user?.username
      );

      if (res.status == 200) {
        setTasks(res.data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getAllUserTasks = async () => {
    try {
      if (!user?.id) {
        console.error("User ID is required for fetching tasks");
        setUserTasks([]); // Set empty tasks instead of null
        return;
      }

      const res = await axios.get(
        `/api/allroute?type=allusertasks&id=${user.id}`
      );
      if (res.status === 200) {
        setUserTasks(res.data);
      } else {
        console.error("Failed to get user tasks:", res.status, res.data);
        setUserTasks([]); // Set empty tasks instead of null
      }
    } catch (error: any) {
      console.error(
        "Error fetching user tasks:",
        error?.response?.data || error.message
      );
      setUserTasks([]); // Set empty tasks instead of null
    }
  };

  useEffect(() => {
    if (tg) return;
    let count = 0;
    const getTg = setInterval(() => {
      const _tg = window?.Telegram?.WebApp;
      if (_tg) {
        setTg(_tg);
        clearInterval(getTg);
      }
      _tg;

      console.log(count);

      if (count > 10) {
        clearInterval(getTg);
      }
      count++;
    }, 10000);
  }, []);

  const getAllInfo = async () => {
    await checkAuthStatus();
    await getLeaderBoard();
    await getTasks();
  };

  useEffect(() => {
    if (user?.username) {
      getAllUserTasks();
    }
  }, [user]);

  useEffect(() => {
    if (tasks && !tasks.error && user?.username) {
      // setLoadingPage(false);
    }
  }, [tasks, user]);

  useEffect(() => {
    if (!tg) return;
    const initializeApp = async () => {
      try {
        await getAllInfo();
      } catch (error) {
        console.error("Error initializing app:", error);
      }
    };

    initializeApp();
  }, [tg]);

  // useEffect(() => {
  //   let total = 0;
  //   if (userDeposits) {
  //     for (let index = 0; index < userDeposits.deposits?.length; index++) {
  //       total += Number(userDeposits.deposits[index].multiplier);
  //     }
  //   }
  //   setMultiplier(total);
  // }, [userDeposits]);

  const engageTasks = async (
    type: string,
    data: any,
    func: (param: boolean) => void
  ) => {
    setLoading(true);

    if (!user) return;

    const res = await (
      await fetch("/api/allroute", {
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          data: { task: data, userId: user.id },
          username: user.username,
          userMultipler: multiplier,
          type,
        }),
      })
    ).json();

    if (res.weeklyScore || res.id) {
      console.log(res);
      checkAuthStatus();
      setLoading(false);
      getLeaderBoard();
      func(false);
      return res;
    }

    setLoading(false);
    return res;
  };

  const claimPoints = async (type: string, func: (param: boolean) => void) => {
    console.log(type);
    setLoading(true);

    // if (userDeposits?.deposits) {
    //   total = getDeposits();
    // } else if (deposits?.length > 0) {
    // }

    const res = await (
      await fetch("/api/claim", {
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          username: user?.username,
          type,
          userMultipler: multiplier,
          solWallet: "",
        }),
      })
    ).json();

    if (res.username != null) {
      checkAuthStatus();
      setLoading(false);
      getLeaderBoard();
      func(false);
      return res;
    }
    setLoading(false);

    return res;
  };

  return (
    <MultiLoginContext.Provider
      value={{
        ...multiLogin,
        leader,
        tasks,
        userTasks,
        loading,
        multiplier,
        engageTasks,
        getLeaderBoard,
        getAllInfo,
        getTasks,
        getAllUserTasks,
        claimPoints,
      }}
    >
      {children}
    </MultiLoginContext.Provider>
  );
};

export const useMultiLoginContext = () => {
  const context = useContext(MultiLoginContext);
  if (!context)
    throw new Error(
      "useMultiLoginContext must be used within MultiLoginProvider"
    );
  return context;
};
