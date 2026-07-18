"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { VideoItem } from "@/lib/types";
import { youtubeEmbed } from "@/lib/utils";
import { useState } from "react";

export function Videos({ videos }: { videos: VideoItem[] }) {
  const [active, setActive] = useState<VideoItem | null>(null);

  return (
    <section id="videos" className="section-pad">
      <div className="container-site">
        <SectionHeading
          eyebrow="Videos"
          title="See the energy"
          subtitle="Tours, training clips, and member moments from Action Plus."
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, i) => (
            <motion.button
              key={video.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setActive(video)}
              className="group overflow-hidden rounded-3xl border border-white/10 text-left"
            >
              <div className="relative aspect-video">
                <Image
                  src={
                    video.thumbnail_url ||
                    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80"
                  }
                  alt={video.title}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <span className="rounded-full bg-gold p-3 text-black">
                    <Play className="h-5 w-5 fill-current" />
                  </span>
                </div>
              </div>
              <div className="bg-charcoal/70 px-4 py-3">
                <p className="font-medium text-white">{video.title}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            {active.mp4_url ? (
              <video src={active.mp4_url} controls autoPlay className="w-full" />
            ) : (
              <div className="aspect-video">
                <iframe
                  src={youtubeEmbed(active.youtube_url)}
                  title={active.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
