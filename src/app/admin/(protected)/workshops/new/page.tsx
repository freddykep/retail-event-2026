import { WorkshopForm } from "@/components/admin/WorkshopForm";

export default function NewWorkshopPage() {
  return (
    <div className="max-w-xl">
      <h1 className="font-heading mb-6 text-2xl font-bold text-adesso-blue-4">Workshop anlegen</h1>
      <div className="rounded-xl border border-adesso-grey-light bg-white p-6">
        <WorkshopForm />
      </div>
    </div>
  );
}
