"use client";

import { useState, type FormEvent } from "react";
import { FolderKanban } from "lucide-react";
import { COLLECTIONS } from "@/lib/mock-data";
import { LinkInput } from "@/components/ui/LinkInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollectionProgressList } from "./_components/CollectionProgressList";

export default function CollectionsPage() {
  const [url, setUrl] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUrl("");
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Collections</h2>
        <p className="mt-1 text-sm text-body">
          Import a collection or playlist URL and bulk transcribe up to 50 videos at once.
        </p>
      </div>

      <LinkInput
        value={url}
        onChange={setUrl}
        onSubmit={handleSubmit}
        placeholder="Paste a TikTok collection or playlist link..."
        submitLabel="Import"
        className="max-w-2xl"
      />

      {COLLECTIONS.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No collections yet"
          description="Import a collection URL above to bulk transcribe up to 50 videos."
        />
      ) : (
        <CollectionProgressList collections={COLLECTIONS} />
      )}
    </div>
  );
}
