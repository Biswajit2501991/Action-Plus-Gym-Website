"use client";

import { useEffect, useState, useTransition } from "react";
import { replaceCollectionAction } from "@/lib/actions/admin";
import {
  AdminPageHeader,
  Field,
  ItemCard,
  SaveBar,
  TextInput,
  TextSelect,
  TextTextarea,
  Toggle,
} from "@/components/admin/form-ui";

export type EditorField =
  | {
      key: string;
      label: string;
      type: "text" | "url" | "number" | "textarea" | "features";
      placeholder?: string;
      hint?: string;
      fullWidth?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      hint?: string;
      fullWidth?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "toggle";
      hint?: string;
      fullWidth?: boolean;
    };

type Row = Record<string, unknown>;

function featuresToText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("\n");
  return "";
}

function textToFeatures(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ItemListEditor({
  title,
  description,
  table,
  fields,
  initialRows,
  emptyItem,
  itemLabel = "Item",
}: {
  title: string;
  description: string;
  table: string;
  fields: EditorField[];
  initialRows: Row[];
  /** Plain object template for new rows (must be JSON-serializable). */
  emptyItem: Row;
  itemLabel?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialRows.length ? initialRows.map((r) => ({ ...r })) : [],
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows.length ? initialRows.map((r) => ({ ...r })) : []);
  }, [initialRows]);

  function update(index: number, key: string, value: unknown) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  function move(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, i) => ({ ...row, sort_order: i }));
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const payload = rows.map((row, i) => {
            const out: Row = { ...row, sort_order: i };
            for (const field of fields) {
              if (field.type === "features") {
                out[field.key] = Array.isArray(row[field.key])
                  ? row[field.key]
                  : textToFeatures(String(row[field.key] ?? ""));
              }
              if (field.type === "number") {
                out[field.key] = Number(row[field.key] ?? 0);
              }
            }
            return out;
          });
          await replaceCollectionAction(table, payload);
          setMsg(`${title} saved.`);
        });
      }}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <AdminPageHeader title={title} description={description} />
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                ...structuredClone(emptyItem),
                sort_order: prev.length,
              },
            ])
          }
          className="mt-1 shrink-0 rounded-full border border-gold/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/10"
        >
          + Add {itemLabel}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-muted">
          No {itemLabel.toLowerCase()}s yet. Click Add {itemLabel} to create one.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row, index) => (
            <ItemCard
              key={`${table}-${index}`}
              title={itemLabel}
              index={index}
              onRemove={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              onMoveUp={index > 0 ? () => move(index, -1) : undefined}
              onMoveDown={
                index < rows.length - 1 ? () => move(index, 1) : undefined
              }
            >
              {fields.map((field) => {
                const value = row[field.key];
                const wrap = field.fullWidth || field.type === "textarea" || field.type === "features"
                  ? "md:col-span-2"
                  : "";

                if (field.type === "toggle") {
                  return (
                    <div key={field.key} className={wrap}>
                      <Toggle
                        label={field.label}
                        hint={field.hint}
                        checked={Boolean(value)}
                        onChange={(next) => update(index, field.key, next)}
                      />
                    </div>
                  );
                }

                if (field.type === "select") {
                  return (
                    <Field
                      key={field.key}
                      label={field.label}
                      hint={field.hint}
                      className={wrap}
                    >
                      <TextSelect
                        value={String(value ?? "")}
                        onChange={(e) => update(index, field.key, e.target.value)}
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </TextSelect>
                    </Field>
                  );
                }

                if (field.type === "textarea" || field.type === "features") {
                  return (
                    <Field
                      key={field.key}
                      label={field.label}
                      hint={
                        field.type === "features"
                          ? field.hint || "One benefit per line"
                          : field.hint
                      }
                      className={wrap}
                    >
                      <TextTextarea
                        rows={field.type === "features" ? 4 : 3}
                        placeholder={field.placeholder}
                        value={
                          field.type === "features"
                            ? featuresToText(value)
                            : String(value ?? "")
                        }
                        onChange={(e) =>
                          update(
                            index,
                            field.key,
                            field.type === "features"
                              ? textToFeatures(e.target.value)
                              : e.target.value,
                          )
                        }
                      />
                    </Field>
                  );
                }

                return (
                  <Field
                    key={field.key}
                    label={field.label}
                    hint={field.hint}
                    className={wrap}
                  >
                    <TextInput
                      type={
                        field.type === "number"
                          ? "number"
                          : field.type === "url"
                            ? "url"
                            : "text"
                      }
                      placeholder={field.placeholder}
                      value={String(value ?? "")}
                      onChange={(e) =>
                        update(
                          index,
                          field.key,
                          field.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                        )
                      }
                    />
                  </Field>
                );
              })}
            </ItemCard>
          ))}
        </div>
      )}

      <SaveBar pending={pending} message={msg} />
    </form>
  );
}
