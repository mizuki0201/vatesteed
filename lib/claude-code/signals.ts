/**
 * 入口を中断するシグナルの受け取り。
 *
 * `SIGINT` や `SIGTERM` で入口を止めたときに、実行記録を `running` のまま残さず、ロックも
 * 残さないようにする（docs/claude-code-bridge.md の「Claude Code と Codex の引き継ぎ」）。
 *
 * 受け取り方を差し込めるようにしてあるのは、実際にプロセスへシグナルを送らずに中断の後始末を
 * 試せるようにするため。
 */

/** 中断として扱うシグナル。 */
export const INTERRUPT_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export type ClaudeSignalSource = {
  /** 中断を受け取る。戻り値を呼ぶと受け取りをやめる */
  listen: (handler: (signal: string) => void) => () => void;
};

/** 実際のプロセスのシグナルを受け取る。 */
export function processSignalSource(target: NodeJS.Process = process): ClaudeSignalSource {
  return {
    listen(handler) {
      const listeners = INTERRUPT_SIGNALS.map((signal) => {
        const listener = (): void => handler(signal);
        target.on(signal, listener);

        return { signal, listener } as const;
      });

      return () => {
        for (const { signal, listener } of listeners) target.off(signal, listener);
      };
    },
  };
}
