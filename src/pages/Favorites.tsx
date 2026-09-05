import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

import { Empty, PageHeader, Panel } from "@/components/AppShell";
import { PortBerth } from "@/components/PortBerth";
import { Button } from "@/components/ui/Button";
import { useKill } from "@/hooks/useKill";
import { parsePort } from "@/lib/utils";
import * as api from "@/services/tauri";
import { occupancyOf, useData } from "@/stores/dataStore";
import { useUi } from "@/stores/uiStore";

/** §36 — manage the ports you keep coming back to, and FR-015's presets. */
export function Favorites() {
  const favorites = useData((s) => s.favorites);
  const presets = useData((s) => s.presets);
  const ports = useData((s) => s.ports);
  const setFavorites = useData((s) => s.setFavorites);
  const setPresets = useData((s) => s.setPresets);
  const toast = useUi((s) => s.toast);
  const openDetails = useUi((s) => s.openDetails);
  const recentlyFreed = useUi((s) => s.recentlyFreed);
  const { killPort } = useKill();

  const [port, setPort] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [editingPresets, setEditingPresets] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    const parsed = parsePort(port);
    if (parsed === null) {
      toast("danger", "Ports run from 1 to 65535.");
      return;
    }
    try {
      setFavorites(await api.addFavorite(parsed, label || `Port ${parsed}`, description));
      setPort("");
      setLabel("");
      setDescription("");
    } catch (error) {
      toast("danger", error instanceof Error ? error.message : String(error));
    }
  }

  async function remove(id: string) {
    try {
      setFavorites(await api.removeFavorite(id));
    } catch (error) {
      toast("danger", error instanceof Error ? error.message : String(error));
    }
  }

  const saved = new Set(favorites.map((f) => f.port));
  const suggestions = presets.filter((p) => !saved.has(p.port));

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Favourites"
        description="Ports you use often, kept one click away here and in the tray"
      />

      {favorites.length === 0 ? (
        <Panel className="px-4 py-14 text-center">
          <Empty title="Save a port below and it will appear here and in the tray menu." />
        </Panel>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2.5">
          {favorites.map((favorite) => (
            <PortBerth
              key={favorite.id}
              favorite={favorite}
              holder={occupancyOf(ports, favorite.port)}
              onFree={killPort}
              onInspect={openDetails}
              onRemove={(id) => void remove(id)}
              justFreed={recentlyFreed.includes(favorite.port)}
            />
          ))}
        </div>
      )}

      <Panel className="mt-6 p-5">
        <h2 className="font-medium">Save a port</h2>
        <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
          <Field
            label="Port"
            value={port}
            onChange={(value) => setPort(value.replace(/[^\d]/g, "").slice(0, 5))}
            placeholder="3000"
            width="w-24"
          />
          <Field
            label="Label"
            value={label}
            onChange={setLabel}
            placeholder="Frontend"
            width="w-48"
          />
          <Field
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="Next.js development server"
            width="flex-1 min-w-[220px]"
          />
          <Button type="submit" variant="primary">
            Save port
          </Button>
        </form>
      </Panel>

      {/* FR-015 — the preset catalogue: click to save, or edit the list itself. */}
      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-medium">Common development ports</h2>
          <div className="flex items-center gap-3">
            {presets.length > 0 && (
              <button
                type="button"
                onClick={() => setEditingPresets(!editingPresets)}
                className="text-[13px] text-ink-muted hover:text-ink"
              >
                {editingPresets ? "Done" : "Edit list"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                api
                  .resetPresets()
                  .then(setPresets)
                  .catch((e: unknown) =>
                    toast("danger", e instanceof Error ? e.message : String(e)),
                  );
              }}
              className="text-[13px] text-ink-muted hover:text-ink"
            >
              Restore defaults
            </button>
          </div>
        </div>

        {suggestions.length === 0 && !editingPresets ? (
          <p className="text-ink-muted">
            Every port in the list is already saved above.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(editingPresets ? presets : suggestions).map((preset) => (
              <div
                key={preset.id}
                className="flex items-baseline gap-2 rounded-lg border border-hairline bg-panel px-3 py-2"
              >
                {editingPresets ? (
                  <>
                    <span className="font-semibold">{preset.port}</span>
                    <span className="text-[13px] text-ink-soft">{preset.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        api
                          .savePresets(presets.filter((p) => p.id !== preset.id))
                          .then(setPresets)
                          .catch((e: unknown) =>
                            toast("danger", e instanceof Error ? e.message : String(e)),
                          );
                      }}
                      aria-label={`Remove port ${preset.port} from the list`}
                      className="-mr-1 ml-1 rounded p-0.5 text-ink-muted hover:text-ink"
                    >
                      <X aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      api
                        .addFavorite(preset.port, preset.name, preset.category)
                        .then(setFavorites)
                        .catch((e: unknown) =>
                          toast("danger", e instanceof Error ? e.message : String(e)),
                        );
                    }}
                    className="flex items-baseline gap-2 text-left"
                  >
                    <span className="font-semibold">{preset.port}</span>
                    <span className="text-[13px] text-ink-soft">{preset.name}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  width,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  width: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${width}`}>
      <span className="text-[13px] text-ink-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="h-9 rounded-lg border border-hairline bg-raised px-3 outline-none focus-visible:border-hairline-strong"
      />
    </label>
  );
}
