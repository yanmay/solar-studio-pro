import useSWR, { mutate } from "swr";

interface UnlockStatus {
  unlocked: boolean;
  source?: "db" | "cookie";
}

const statusKey = (scanId: string) =>
  `/api/payment/status?scanId=${encodeURIComponent(scanId)}`;

async function fetchStatus(url: string): Promise<UnlockStatus> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json();
}

/**
 * Server-authoritative unlock state for a scan.
 * The database (via /api/payment/status) is the single source of truth —
 * never trust URL flags, localStorage, or sessionStorage for paywall state.
 */
export function useUnlockStatus(scanId: string | null | undefined) {
  const { data, error, isLoading } = useSWR<UnlockStatus>(
    scanId ? statusKey(scanId) : null,
    fetchStatus,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  );

  return {
    unlocked: data?.unlocked === true,
    isChecking: isLoading,
    error,
  };
}

/** Revalidate unlock state after a successful payment verification. */
export function revalidateUnlock(scanId: string): Promise<unknown> {
  return mutate(statusKey(scanId));
}
