/**
 * Document Vault — upload UI scaffold.
 * File storage requires Supabase Storage to be configured.
 * The upload button is wired but shows a "coming soon" notice until
 * VITE_API_URL is set and the storage bucket is provisioned.
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DocumentChecklistItem } from "@/lib/api";
import { Upload, FileText, Trash2, Lock } from "lucide-react";

interface UploadedFile {
  name: string;
  type: string;
  uploadedAt: string;
}

const DOC_TYPES = [
  "Test Report",
  "Certificate",
  "Supplier Declaration",
  "Commercial Invoice",
  "Packing List",
  "Bill of Lading",
  "SDS / MSDS",
  "Product Photo",
  "Broker Confirmation",
  "Other",
];

export function DocumentVault({
  missingDocs = [],
}: {
  missingDocs?: DocumentChecklistItem[];
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedType, setSelectedType] = useState(DOC_TYPES[0]);

  // In a real implementation this would call Supabase Storage
  const handleUpload = () => {
    alert(
      "Document upload requires Supabase Storage to be configured.\n\n" +
        "Steps:\n" +
        "1. Go to Supabase → Storage → Create bucket 'product-documents'\n" +
        "2. Set bucket to private\n" +
        "3. Connect VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n\n" +
        "This UI is ready — just needs the bucket."
    );
  };

  const missingHighPriority = missingDocs.filter(
    (d) => d.required && !files.some((f) => f.type === d.document),
  );

  return (
    <div className="space-y-4">
      {missingHighPriority.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            Missing required documents:
          </p>
          {missingHighPriority.map((doc) => (
            <div
              key={doc.document}
              className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              {doc.document} — {doc.reason}
            </div>
          ))}
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Upload a document</span>
          <Badge variant="outline" className="text-xs">
            Requires Supabase Storage
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Document type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleUpload}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Choose file
            </Button>
          </div>
        </div>
      </Card>

      {files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file, i) => (
            <Card key={i} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.type} · {file.uploadedAt}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          No documents uploaded yet.
        </p>
      )}
    </div>
  );
}
