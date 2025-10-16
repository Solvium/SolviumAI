export const REF_ENV: string | undefined =
  process.env.NEXT_PUBLIC_REF_ENV || process.env.NEAR_ENV;

export const REF_REFERRAL_ID: string | undefined =
  process.env.NEXT_PUBLIC_REF_REFERRAL_ID || undefined;

// If you want to force using Ref SDK over other routers
export const REF_USE_SDK: boolean =
  String(process.env.NEXT_PUBLIC_REF_USE_SDK || "false").toLowerCase() ===
  "true";

export function isRefConfigured(): boolean {
  return Boolean(REF_ENV);
}

export const REF_INDEXER_URL: string | undefined =
  process.env.NEXT_PUBLIC_REF_INDEXER_URL || undefined;

export const REF_NODE_URL: string | undefined =
  process.env.NEXT_PUBLIC_REF_NODE_URL || undefined;
