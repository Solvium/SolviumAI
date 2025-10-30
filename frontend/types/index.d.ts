// types/index.ts

import WebApp from "@twa-dev/sdk";

export {};

declare global {
  interface Window {
    Telegram: {
      WebApp: typeof WebApp;
    };
  }
}
