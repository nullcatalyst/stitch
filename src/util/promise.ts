export function safeRejectedPromise<T>(err: Error): Promise<T> {
    const result = Promise.reject(err);
    // Catch the error to prevent it from being unhandled.
    result.catch(() => {});
    return result;
}

export async function promiseWithTimeout<T>(timeoutMs: number, promise: Promise<T>): Promise<T> {
    let timeout: NodeJS.Timeout;
    const timeoutP = new Promise<T>((resolve, reject) => {
        timeout = setTimeout(() => reject(), timeoutMs);
    });

    const result = await Promise.race([promise, timeoutP]);

    clearTimeout(timeout);
    return result;
}
