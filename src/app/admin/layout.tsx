/**
 * Per-route config gating for the admin area. Runs in the Node runtime so it
 * can use Prisma directly; the Edge middleware stays Prisma-free.
 */
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  if (!settings.isConfigured) {
    redirect("/setup");
  }
  return <>{children}</>;
}
