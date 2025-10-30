// Global request throttling to prevent multiple simultaneous API calls
class RequestThrottler {
  private activeRequests = new Set<string>();
  private requestQueue = new Map<string, Array<() => Promise<void>>>();
  private readonly maxConcurrentRequests = 2; // Maximum 2 concurrent requests per endpoint

  async throttle<T>(
    endpoint: string,
    requestFn: () => Promise<T>,
    delay: number = 100
  ): Promise<T> {
    // Add delay to prevent rapid successive calls
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Check if we can make the request immediately
    if (this.activeRequests.size < this.maxConcurrentRequests) {
      this.activeRequests.add(endpoint);
      try {
        const result = await requestFn();
        return result;
      } finally {
        this.activeRequests.delete(endpoint);
        this.processQueue();
      }
    } else {
      // Queue the request
      return new Promise((resolve, reject) => {
        const queuedRequest = async () => {
          try {
            const result = await requestFn();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        };

        if (!this.requestQueue.has(endpoint)) {
          this.requestQueue.set(endpoint, []);
        }
        this.requestQueue.get(endpoint)!.push(queuedRequest);
      });
    }
  }

  private processQueue() {
    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      return;
    }

    // Find the next request to process
    for (const [endpoint, queue] of this.requestQueue.entries()) {
      if (queue.length > 0 && !this.activeRequests.has(endpoint)) {
        const request = queue.shift()!;
        this.activeRequests.add(endpoint);

        request().finally(() => {
          this.activeRequests.delete(endpoint);
          this.processQueue();
        });
        break;
      }
    }
  }

  getActiveRequests(): string[] {
    return Array.from(this.activeRequests);
  }

  getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    for (const [endpoint, queue] of this.requestQueue.entries()) {
      status[endpoint] = queue.length;
    }
    return status;
  }
}

// Global instance
export const requestThrottler = new RequestThrottler();

// Helper function to throttle API calls
export async function throttleApiCall<T>(
  endpoint: string,
  requestFn: () => Promise<T>,
  delay: number = 100
): Promise<T> {
  return requestThrottler.throttle(endpoint, requestFn, delay);
}

