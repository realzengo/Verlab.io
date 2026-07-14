"use client";

import { Plus, Trash2 } from "lucide-react";
import { API_KEYS } from "@/lib/mock-data";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

export function ApiKeyTable() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-body">API keys</h3>
        <Button size="sm" icon={Plus}>
          Create key
        </Button>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Label</TableHeaderCell>
            <TableHeaderCell>Key</TableHeaderCell>
            <TableHeaderCell>Created</TableHeaderCell>
            <TableHeaderCell>Last used</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHead>
        <tbody>
          {API_KEYS.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium">{key.label}</TableCell>
              <TableCell className="font-mono text-xs">{key.keyPreview}</TableCell>
              <TableCell>{formatDate(key.createdAt)}</TableCell>
              <TableCell>{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</TableCell>
              <TableCell>
                <Badge variant={key.revoked ? "default" : "success"}>{key.revoked ? "Revoked" : "Active"}</Badge>
              </TableCell>
              <TableCell>
                {!key.revoked && (
                  <button type="button" aria-label={`Revoke ${key.label}`} className="text-body hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
