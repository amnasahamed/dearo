/** Native availability is not a guarantee that Apple/Google will display a prompt. */
export interface NativeReviewPort {
  isAvailableAsync(): Promise<boolean>;
  requestReview(): Promise<void>;
}
export type NativeReviewResult = "requested" | "unavailable";
/**
 * Call only at a calm, eligible completion milestone, not from a Rate button.
 * Persist markReviewRequested() first to enforce cooldown across errors/restarts.
 * Never interpret this result as a displayed prompt, a submitted rating or review.
 * No fake App Store ID, fallback store URL, pre-prompt or sentiment gating.
 */
export async function requestNativeReview(
  port?: NativeReviewPort,
): Promise<NativeReviewResult> {
  const native = port ?? (await import("expo-store-review"));
  if (!(await native.isAvailableAsync())) return "unavailable";
  await native.requestReview();
  return "requested";
}
