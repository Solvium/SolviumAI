import Image from "next/image";
import { Dispatch, SetStateAction, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { GOOGLE_CLIENT_ID } from "@/app/config/google";
import { jwtDecode } from "jwt-decode";
import WebApp from "@twa-dev/sdk";

export const WelcomeModal = ({
  setUser,
  tg,
}: {
  setUser: any;
  tg: null | typeof WebApp;
}) => {
  const { user: authUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState<string>("");

  const handleLogin = async (resp: any) => {
    setLoading(true);
    let decoded: any = jwtDecode(resp?.credential);
    const email = decoded?.email;
    const name = decoded?.name;
    const ref = location.search?.split("?ref=")[1]?.split("&")[0] ?? "null";

    const res = await axios("/api/allroute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      data: JSON.stringify({
        type: "createAccount",
        username: email.split("@gmail.com")[0],
        email,
        name,
        ref,
      }),
    });

    if (res.data) {
      const expiryTime = Date.now() + 15 * 24 * 60 * 60 * 1000; // 15 days in milliseconds
      const data = {
        userData: res.data,
        expiryTime,
      };
      localStorage.setItem("userSession", JSON.stringify(data));

      setUser(res.data);
    } else {
      setLoading(false);
      throw "an error occured";
    }
  };

  const handleLoginError = () => {
    throw "Login Failed";
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Dark overlay */}

      {/* Modal content */}
      {loading ? (
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-6 w-[300px] mx-4 relative z-10">
          <div className="text-center">
            {/* Emoji */}
            <div className="text-6xl flex rounded-full justify-center mb-4">
              <Image
                className="rounded-full"
                src="/logo.png"
                width={150}
                height={150}
                alt=""
              />
            </div>

            <div className="flex flex-col items-center justify-center  p-4">
              <div className="mb-4">
                <select
                  defaultValue="Pick User Type"
                  className="select text-black ring dark:text-white"
                  onChange={(e) => {
                    setSelectedAuth(e.target.value);
                  }}
                >
                  <option disabled={true}>Pick User Type</option>
                  <option value={"google"}>New User</option>
                  <option value={"wallet"}>Old User</option>
                </select>
              </div>

              {selectedAuth === "google" && (
                <div className="mb-2 mx-auto w-[81%]">
                  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <GoogleLogin
                      size="large"
                      theme="filled_blue"
                      logo_alignment="center"
                      type="standard"
                      text="signin_with"
                      onSuccess={(e) => handleLogin(e)}
                      onError={() => handleLoginError()}
                    />
                  </GoogleOAuthProvider>
                </div>
              )}

              {selectedAuth === "wallet" && (
                <div>
                  <p className="text-black mt-1 text-sm">
                    Connect the same Near wallet to regain old data from
                    Telegram.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
