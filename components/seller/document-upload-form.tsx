"use client";

import { useActionState } from "react";
import { uploadDocumentAction, type DocumentUploadState } from "@/app/seller/listings/actions";
import { ImageFileField, FieldFrame } from "@/components/seller/catalogue-fields";

const initialState: DocumentUploadState = {};

const inputClass =
  "mt-1 block w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink shadow-sm focus:border-brand focus:outline-none";

const documentTypes = [
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "VALUATION_REPORT", label: "Valuation report" },
  { value: "LAB_DOCUMENT", label: "Lab document" },
] as const;

export function DocumentUploadForm({
  listingId,
  labs,
}: {
  listingId: string;
  labs: readonly { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(uploadDocumentAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldFrame name="type" label="Document type" required>
          <select id="type" name="type" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose a type
            </option>
            {documentTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FieldFrame>
        <FieldFrame name="title" label="Title" required>
          <input id="title" name="title" type="text" required maxLength={120} className={inputClass} />
        </FieldFrame>
        <FieldFrame name="certificateLabId" label="Certificate lab">
          <select id="certificateLabId" name="certificateLabId" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {labs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </FieldFrame>
      </div>
      <ImageFileField
        name="file"
        label="File"
        accept="application/pdf,image/jpeg,image/png"
        hint="PDF, JPEG or PNG. New documents stay private until an administrator verifies them."
        error={state.error}
      />
      {state.message ? (
        <p role="status" className="text-sm text-ink-soft">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}
