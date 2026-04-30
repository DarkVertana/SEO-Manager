import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/server";
import RewriteWorkspace from "./RewriteWorkspace";

export default async function RewriteContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const { id } = await params;

  const record = await db.rewritePage.findFirst({
    where: { id, userId: session.uid },
    select: {
      id: true,
      url: true,
      title: true,
      byteSize: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!record) notFound();

  return (
    <RewriteWorkspace
      record={{
        id: record.id,
        url: record.url,
        title: record.title,
        byteSize: record.byteSize,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      }}
    />
  );
}
