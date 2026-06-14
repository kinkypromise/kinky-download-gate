import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getSettings();
  if (settings.isConfigured) {
    redirect("/admin");
  }
  redirect("/setup");
}
