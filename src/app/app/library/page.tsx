"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Library as LibraryIcon, PenSquare, Search } from "lucide-react";
import { LIBRARY_ITEMS } from "@/lib/mock-data";
import type { LibraryItemType } from "@/lib/types";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

const TYPE_ICON: Record<LibraryItemType, typeof FileText> = {
  transcript: FileText,
  sop: LibraryIcon,
  script: PenSquare,
  download: Download,
};

const TABS = [
  { id: "all", label: "All" },
  { id: "transcript", label: "Transcripts" },
  { id: "sop", label: "SOPs" },
  { id: "script", label: "Scripts" },
  { id: "download", label: "Downloads" },
];

export default function LibraryPage() {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return LIBRARY_ITEMS.filter((item) => {
      const matchesTab = tab === "all" || item.type === tab;
      const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [tab, query]);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Library</h2>
        <p className="mt-1 text-sm text-body">Every transcript, SOP, script, and download, saved and searchable.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs items={TABS} active={tab} onChange={setTab} />
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3.5 py-2 sm:w-72">
          <Search className="h-4 w-4 text-body" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search library..."
            className="w-full bg-transparent text-sm text-heading placeholder:text-body focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={LibraryIcon}
          title="Nothing here yet"
          description="Items you save from transcripts, SOPs, scripts, and downloads will show up here."
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Folder</TableHeaderCell>
              <TableHeaderCell>Saved</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filtered.map((item) => {
              const Icon = TYPE_ICON[item.type];
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {item.title}
                    </span>
                  </TableCell>
                  <TableCell className="capitalize">{item.type}</TableCell>
                  <TableCell>{item.folder ?? "—"}</TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
