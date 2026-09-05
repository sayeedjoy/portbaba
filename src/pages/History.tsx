import { Empty, PageHeader, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { cn, formatClock, formatDate, pluralise } from "@/lib/utils";
import * as api from "@/services/tauri";
import { useData } from "@/stores/dataStore";
import { useUi } from "@/stores/uiStore";

/** §37 / FR-022 — the local activity log. Nothing leaves the machine. */
export function History() {
  const history = useData((s) => s.history);
  const reloadHistory = useData((s) => s.reloadHistory);
  const toast = useUi((s) => s.toast);

  async function clear() {
    try {
      await api.clearHistory();
      await reloadHistory();
    } catch (error) {
      toast("danger", error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="History"
        description={
          history.length
            ? `${pluralise(history.length, "action")}, stored on this machine only`
            : "Every termination is recorded here, on this machine only"
        }
      >
        {history.length > 0 && (
          <Button size="sm" onClick={() => void clear()}>
            Clear history
          </Button>
        )}
      </PageHeader>

      {history.length === 0 ? (
        <Panel className="px-4 py-14 text-center">
          <Empty title="Nothing has been terminated yet." />
        </Panel>
      ) : (
        <Panel>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline text-[13px] text-ink-muted">
                <th scope="col" className="w-28 py-2 pl-4 font-medium">
                  Time
                </th>
                <th scope="col" className="w-20 py-2 pr-4 font-medium">
                  Port
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Process
                </th>
                <th scope="col" className="w-28 py-2 pr-4 font-medium">
                  Action
                </th>
                <th scope="col" className="w-40 py-2 pr-4 font-medium">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const failed =
                  entry.result === "Failed" ||
                  entry.result === "Permission denied" ||
                  entry.result === "Blocked";
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-hairline last:border-b-0"
                    title={entry.message}
                  >
                    <td className="py-2.5 pl-4 text-ink-soft">
                      <span className="text-ink">{formatClock(entry.timestamp)}</span>
                      <span className="ml-2 text-[12.5px] text-ink-muted">
                        {formatDate(entry.timestamp)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold">{entry.port ?? "—"}</td>
                    <td className="max-w-0 truncate py-2.5 pr-4">
                      {entry.processName}
                      <span className="ml-2 text-[12.5px] text-ink-muted">
                        PID {entry.pid}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-ink-soft">{entry.action}</td>
                    <td
                      className={cn(
                        "py-2.5 pr-4",
                        failed ? "text-[var(--danger)]" : "text-[var(--free)]",
                      )}
                    >
                      {entry.result}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
