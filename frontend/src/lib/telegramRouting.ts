// Telegram Mini App routing utilities

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    auth_date: number;
    hash: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: {
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    hint_color?: string;
    bg_color?: string;
    text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  HapticFeedback: {
    impactOccurred: (
      style: "light" | "medium" | "heavy" | "rigid" | "soft"
    ) => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    setItem: (
      key: string,
      value: string,
      callback?: (error: string | null, result?: boolean) => void
    ) => void;
    getItem: (
      key: string,
      callback: (error: string | null, result?: string) => void
    ) => void;
    getItems: (
      keys: string[],
      callback: (error: string | null, result?: Record<string, string>) => void
    ) => void;
    removeItem: (
      key: string,
      callback?: (error: string | null, result?: boolean) => void
    ) => void;
    removeItems: (
      keys: string[],
      callback?: (error: string | null, result?: boolean) => void
    ) => void;
    getKeys: (
      callback: (error: string | null, result?: string[]) => void
    ) => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{
        id?: string;
        type?: "default" | "ok" | "close" | "cancel" | "destructive";
        text?: string;
      }>;
    },
    callback?: (buttonId: string) => void
  ) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (
    message: string,
    callback?: (confirmed: boolean) => void
  ) => void;
  showScanQrPopup: (
    params: {
      text?: string;
    },
    callback?: (text: string) => void
  ) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (granted: boolean) => void) => void;
}

// Note: Window.Telegram interface is already declared elsewhere in the codebase

/**
 * Get the current Telegram WebApp instance
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp as any;
  }
  return null;
}

/**
 * Initialize Telegram WebApp
 */
export function initTelegramWebApp(): TelegramWebApp | null {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
  }
  return tg;
}

/**
 * Handle URL parameters for mini app routing
 */
export function getUrlParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();

  // For Telegram Mini Apps, we need to check both window.location and Telegram's start_param
  const urlParams = new URLSearchParams(window.location.search);
  const tg = getTelegramWebApp();

  // Telegram Mini Apps can receive start_param from the bot
  if (tg?.initDataUnsafe?.start_param) {
    // Parse start_param as URL parameters
    const startParams = new URLSearchParams(tg.initDataUnsafe.start_param);
    // Merge with existing URL params
    startParams.forEach((value, key) => {
      if (!urlParams.has(key)) {
        urlParams.set(key, value);
      }
    });
  }

  return urlParams;
}

/**
 * Navigate to a specific game in the mini app
 */
export function navigateToGameInMiniApp(gameId: string): void {
  const tg = getTelegramWebApp();

  if (tg) {
    // Use Telegram's openLink to navigate within the mini app
    const gameUrl = `${window.location.origin}/game/${gameId}`;
    tg.openLink(gameUrl, { try_instant_view: false });
  } else {
    // Fallback for non-Telegram environments
    window.location.href = `/game/${gameId}`;
  }
}

/**
 * Set up back button handling for mini app
 */
export function setupTelegramBackButton(onBack: () => void): () => void {
  const tg = getTelegramWebApp();

  if (tg?.BackButton) {
    tg.BackButton.show();
    tg.BackButton.onClick(onBack);

    // Return cleanup function
    return () => {
      tg.BackButton.offClick(onBack);
      tg.BackButton.hide();
    };
  }

  return () => {}; // No-op cleanup
}

/**
 * Show main button in mini app
 */
export function showTelegramMainButton(
  text: string,
  onClick: () => void,
  options?: {
    color?: string;
    textColor?: string;
    isActive?: boolean;
  }
): () => void {
  const tg = getTelegramWebApp();

  if (tg?.MainButton) {
    tg.MainButton.setText(text);
    if (options?.color) tg.MainButton.setParams({ color: options.color });
    if (options?.textColor)
      tg.MainButton.setParams({ text_color: options.textColor });
    if (options?.isActive !== undefined) {
      if (options.isActive) {
        tg.MainButton.enable();
      } else {
        tg.MainButton.disable();
      }
    }
    tg.MainButton.show();
    tg.MainButton.onClick(onClick);

    // Return cleanup function
    return () => {
      tg.MainButton.offClick(onClick);
      tg.MainButton.hide();
    };
  }

  return () => {}; // No-op cleanup
}

/**
 * Get the current route from URL or Telegram start_param
 */
export function getCurrentRoute(): string {
  if (typeof window === "undefined") return "/";

  const urlParams = getUrlParams();
  const route =
    urlParams.get("route") || urlParams.get("page") || window.location.pathname;

  return route;
}

/**
 * Generate a shareable link for a specific game
 */
export function generateGameShareLink(
  gameId: string,
  botUsername: string
): string {
  const baseUrl = `https://t.me/${botUsername}`;
  const startParam = `route=/game/${gameId}`;
  return `${baseUrl}?startapp=${encodeURIComponent(startParam)}`;
}
