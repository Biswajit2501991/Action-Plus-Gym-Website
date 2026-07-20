import { requireAdmin } from "@/lib/auth/require-admin";
import {
  listBotFaqsAdminAction,
  listBotThreadsAction,
} from "@/lib/actions/bot-admin";
import { MessagesBoard } from "@/components/admin/MessagesBoard";

export default async function MessagesPage() {
  await requireAdmin();
  const [threadsData, faqsData] = await Promise.all([
    listBotThreadsAction(),
    listBotFaqsAdminAction(),
  ]);

  const threads = (threadsData?.threads ?? []) as Array<{
    id: number;
    customer_name: string;
    mobile: string;
    email?: string | null;
    status: string;
    last_message?: string | null;
    customer_message_count?: number;
    created_at: string;
    updated_at: string;
  }>;

  const faqs = ((faqsData?.faqs ?? []) as Array<{
    question: string;
    answer: string;
    sort_order?: number;
    is_active?: boolean;
  }>).map((f, i) => ({
    question: f.question || "",
    answer: f.answer || "",
    sort_order: f.sort_order ?? i,
    is_active: f.is_active !== false,
  }));

  return <MessagesBoard initialThreads={threads} initialFaqs={faqs} />;
}
