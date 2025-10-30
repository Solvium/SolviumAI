import { AuthProvider, AuthProviderConfig } from "@/contexts/AuthContext";

// Base interface for all auth providers
export interface IAuthProvider {
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  loginHandler: (data: any) => Promise<any>;
  validateConfig?: (config: any) => boolean;
}

// Registry for auth providers
class AuthProviderRegistry {
  private providers: Map<AuthProvider, IAuthProvider> = new Map();

  // Register a new auth provider
  register(provider: AuthProvider, config: IAuthProvider) {
    this.providers.set(provider, config);
  }

  // Get a specific provider
  get(provider: AuthProvider): IAuthProvider | undefined {
    return this.providers.get(provider);
  }

  // Get all enabled providers
  getEnabledProviders(): AuthProviderConfig[] {
    const enabledProviders: AuthProviderConfig[] = [];

    this.providers.forEach((provider, key) => {
      if (provider.enabled) {
        enabledProviders.push({
          name: provider.name,
          icon: provider.icon,
          color: provider.color,
          enabled: provider.enabled,
          loginHandler: provider.loginHandler,
        });
      }
    });

    return enabledProviders;
  }

  // Get all providers (enabled and disabled)
  getAllProviders(): Record<AuthProvider, AuthProviderConfig> {
    const allProviders: Record<AuthProvider, AuthProviderConfig> = {} as Record<
      AuthProvider,
      AuthProviderConfig
    >;

    this.providers.forEach((provider, key) => {
      allProviders[key] = {
        name: provider.name,
        icon: provider.icon,
        color: provider.color,
        enabled: provider.enabled,
        loginHandler: provider.loginHandler,
      };
    });

    return allProviders;
  }

  // Enable/disable a provider
  setProviderEnabled(provider: AuthProvider, enabled: boolean) {
    const existingProvider = this.providers.get(provider);
    if (existingProvider) {
      existingProvider.enabled = enabled;
    }
  }

  // Validate provider configuration
  validateProvider(provider: AuthProvider, config: any): boolean {
    const providerInstance = this.providers.get(provider);
    if (providerInstance?.validateConfig) {
      return providerInstance.validateConfig(config);
    }
    return true;
  }
}

// Create singleton instance
export const authProviderRegistry = new AuthProviderRegistry();

// Example: How to register a new provider
export const registerCustomProvider = (
  provider: AuthProvider,
  config: IAuthProvider
) => {
  authProviderRegistry.register(provider, config);
};

// Example: Email provider registration
export const registerEmailProvider = () => {
  authProviderRegistry.register("email", {
    name: "Email",
    icon: "✉️",
    color: "#34a853",
    enabled: false,
    loginHandler: async (data: { email: string; password: string }) => {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    validateConfig: (config) => {
      return config.email && config.password;
    },
  });
};

// Example: Wallet provider registration
export const registerWalletProvider = () => {
  authProviderRegistry.register("wallet", {
    name: "Wallet",
    icon: "💼",
    color: "#f7931e",
    enabled: false,
    loginHandler: async (data: {
      address: string;
      signature: string;
      message: string;
    }) => {
      const response = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    validateConfig: (config) => {
      return config.address && config.signature && config.message;
    },
  });
};
