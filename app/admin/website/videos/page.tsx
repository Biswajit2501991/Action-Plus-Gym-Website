import { getSiteContent } from "@/lib/cms/get-site-content";
import { ItemListEditor } from "@/components/admin/ItemListEditor";

export default async function WebsiteVideosPage() {
  const content = await getSiteContent();
  return (
    <ItemListEditor
      title="Videos"
      description="YouTube or MP4 videos for the website. Prefer a YouTube link when possible."
      table="website_videos"
      itemLabel="Video"
      initialRows={content.videos}
      createEmpty={() => ({
        title: "",
        youtube_url: "",
        mp4_url: "",
        thumbnail_url: "",
        sort_order: 0,
        is_active: true,
      })}
      fields={[
        { key: "title", label: "Video title", type: "text", fullWidth: true },
        {
          key: "youtube_url",
          label: "YouTube URL",
          type: "url",
          fullWidth: true,
          placeholder: "https://www.youtube.com/watch?v=...",
        },
        {
          key: "mp4_url",
          label: "MP4 URL (optional)",
          type: "url",
          fullWidth: true,
        },
        {
          key: "thumbnail_url",
          label: "Thumbnail image URL (optional)",
          type: "url",
          fullWidth: true,
        },
        { key: "is_active", label: "Show on website", type: "toggle" },
      ]}
    />
  );
}
