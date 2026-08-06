"use client";

import { ScriptEditorModal } from "@/components/features/ScriptEditorModal";

const fakeScript = {
  id: "preview",
  prompt: "A hook about pet care myths",
  content:
    "TITLE: Pet Care Myths\n\nSCRIPT:\nYour dog is not fine.\nHe's just really good at hiding it.\nHere are 3 signs vets wish you knew.\n\nMETRICS:\n",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function DevPreviewScriptModal() {
  return (
    <ScriptEditorModal
      script={fakeScript}
      onClose={() => {}}
      onSaved={() => {}}
    />
  );
}
