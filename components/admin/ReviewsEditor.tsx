"use client";

import { useState, useTransition } from "react";
import { saveReviewsAction } from "@/lib/actions/admin";
import type { ReviewCache } from "@/lib/types";
import { SyncGoogleReviewsButton } from "@/components/admin/SyncGoogleReviewsButton";
import {
  AdminPageHeader,
  Field,
  ItemCard,
  SaveBar,
  TextInput,
  TextTextarea,
} from "@/components/admin/form-ui";

type ReviewItem = ReviewCache["reviews"][number];

export function ReviewsEditor({ reviews }: { reviews: ReviewCache | null }) {
  const [overall, setOverall] = useState(String(reviews?.overall_rating ?? 4.8));
  const [total, setTotal] = useState(String(reviews?.total_reviews ?? 0));
  const [googleUrl, setGoogleUrl] = useState(reviews?.google_url ?? "");
  const [items, setItems] = useState<ReviewItem[]>(
    () => reviews?.reviews?.slice(0, 10) ?? [],
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function update(index: number, patch: Partial<ReviewItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          await saveReviewsAction({
            overall_rating: Number(overall) || 0,
            total_reviews: Number(total) || 0,
            google_url: googleUrl,
            reviews: items.slice(0, 10),
          });
          setMsg("Google reviews saved.");
        });
      }}
    >
      <AdminPageHeader
        title="Google Reviews"
        description="These appear in the homepage slider (max 10). After the 10th slide, visitors see Check Google Reviews."
      />

      <SyncGoogleReviewsButton />

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-charcoal/40 p-4 md:grid-cols-3">
        <Field label="Overall rating">
          <TextInput
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
          />
        </Field>
        <Field label="Total reviews">
          <TextInput
            type="number"
            min="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </Field>
        <Field label="Google reviews link" className="md:col-span-3">
          <TextInput
            type="url"
            placeholder="https://www.google.com/search?q=..."
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={items.length >= 10}
          onClick={() =>
            setItems((prev) => [
              ...prev,
              {
                author: "",
                rating: 5,
                text: "",
                relative_time: "",
              },
            ])
          }
          className="rounded-full border border-gold/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/10 disabled:opacity-40"
        >
          + Add review
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <ItemCard
            key={index}
            title="Review"
            index={index}
            onRemove={() => setItems((prev) => prev.filter((_, i) => i !== index))}
          >
            <Field label="Author name">
              <TextInput
                value={item.author}
                onChange={(e) => update(index, { author: e.target.value })}
              />
            </Field>
            <Field label="Star rating">
              <TextInput
                type="number"
                min="1"
                max="5"
                value={item.rating}
                onChange={(e) =>
                  update(index, { rating: Number(e.target.value) || 5 })
                }
              />
            </Field>
            <Field label="When (e.g. 2 weeks ago)">
              <TextInput
                value={item.relative_time || ""}
                onChange={(e) =>
                  update(index, { relative_time: e.target.value })
                }
              />
            </Field>
            <Field label="Review text" className="md:col-span-2">
              <TextTextarea
                rows={3}
                value={item.text}
                onChange={(e) => update(index, { text: e.target.value })}
              />
            </Field>
          </ItemCard>
        ))}
      </div>

      <SaveBar pending={pending} message={msg} label="Save reviews" />
    </form>
  );
}
