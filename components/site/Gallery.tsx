"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { GalleryImage } from "@/lib/types";

export function Gallery({ images }: { images: GalleryImage[] }) {
  return (
    <section id="gallery" className="section-pad bg-black/25">
      <div className="container-site">
        <SectionHeading
          eyebrow="Gallery"
          title="Inside the club"
          subtitle="A facility designed to feel premium the moment you walk in."
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {images.map((img, i) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 6) * 0.05 }}
              className={`relative overflow-hidden rounded-2xl ${
                i === 0 ? "col-span-2 aspect-[2/1] md:col-span-2" : "aspect-square"
              }`}
            >
              <Image
                src={img.image_url}
                alt={img.alt_text || "Action Plus Gym"}
                fill
                className="object-cover transition duration-700 hover:scale-105"
                sizes="(max-width:768px) 100vw, 33vw"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
