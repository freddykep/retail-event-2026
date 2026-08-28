import { notFound } from "next/navigation";
import { getWorkshopById } from "@/lib/firestore/workshops";
import { WorkshopForm } from "@/components/admin/WorkshopForm";

export default async function EditWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workshop = await getWorkshopById(id);
  if (!workshop) notFound();

  return (
    <div className="max-w-xl">
      <h1 className="font-heading mb-6 text-2xl font-bold text-adesso-blue-4">
        Workshop bearbeiten
      </h1>
      <div className="rounded-xl border border-adesso-grey-light bg-white p-6">
        <WorkshopForm workshop={workshop} />
      </div>
    </div>
  );
}
