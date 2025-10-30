import React from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface AuthProviderWrapperProps {
  children: React.ReactNode;
}

export const AuthProviderWrapper: React.FC<AuthProviderWrapperProps> = ({
  children,
}) => {
  return (
    <AuthProvider>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastStyle={{
          backgroundColor: "#151524",
          color: "#ffffff",
          border: "1px solid #2A2A45",
        }}
      />
    </AuthProvider>
  );
};

export default AuthProviderWrapper;
