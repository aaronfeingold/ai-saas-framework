const COMMENT = new TextEncoder().encode(': keep-alive\n\n');

/**
 * Pass an SSE byte stream through, adding a comment line whenever nothing has been sent for
 * `idleMs`. Comments are ignored by SSE clients but keep load balancers and mobile networks
 * from closing a connection that is waiting on the model.
 */
export function withKeepAlive(
  source: ReadableStream<Uint8Array>,
  idleMs: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let timer: NodeJS.Timeout | undefined;
  let lastSent = Date.now();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      timer = setInterval(
        () => {
          if (Date.now() - lastSent < idleMs) return;
          try {
            controller.enqueue(COMMENT);
            lastSent = Date.now();
          } catch {
            clearInterval(timer);
          }
        },
        Math.max(1, Math.floor(idleMs / 2)),
      );
      void (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            lastSent = Date.now();
          }
          controller.close();
        } catch (err) {
          try {
            controller.error(err);
          } catch {
            // Already closed by a cancel.
          }
        } finally {
          clearInterval(timer);
        }
      })();
    },
    async cancel(reason) {
      clearInterval(timer);
      await reader.cancel(reason);
    },
  });
}
