"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { deleteContact, getContacts, uploadContactsCsv } from "@/lib/api";
import type { Contact, UploadResult } from "@/lib/types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await getContacts();
      setContacts(res.contacts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const res = await uploadContactsCsv(file);
      setUploadResult(res.result);
      await load();
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact?")) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Failed to delete contact");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload and manage your lead contact list
          </p>
        </div>

        {/* Upload card */}
        <Card>
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                Import CSV
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Upload a CSV file with your contacts. Duplicates are skipped
                automatically.
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <Button
                  onClick={() => fileRef.current?.click()}
                  loading={uploading}
                  size="sm"
                >
                  {uploading ? "Uploading..." : "Choose CSV file"}
                </Button>
              </div>

              {uploadResult && (
                <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                  <p className="font-medium text-emerald-800 mb-1">
                    Upload complete
                  </p>
                  <div className="flex gap-4 text-emerald-700 text-xs">
                    <span>
                      <strong>{uploadResult.totalRows}</strong> total rows
                    </span>
                    <span>
                      <strong>{uploadResult.createdCount}</strong> created
                    </span>
                    <span>
                      <strong>{uploadResult.skippedCount}</strong> skipped
                    </span>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                  {uploadError}
                </div>
              )}
            </div>

            {/* Sample format */}
            <div className="md:w-80 flex-shrink-0">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Expected CSV format
              </p>
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-slate-600 overflow-x-auto leading-relaxed">
{`name,phone,email,company,notes
Amit Shah,9876543210,amit@example.com,ABC Realty,Interested in 2BHK
Priya Patel,9123456789,priya@example.com,XYZ Corp,`}
              </pre>
            </div>
          </div>
        </Card>

        {/* Contacts table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              All contacts{" "}
              {!loading && (
                <span className="text-slate-400 font-normal text-sm">
                  ({contacts.length})
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="text-4xl">👥</div>
              <p className="text-slate-600 font-medium">No contacts yet</p>
              <p className="text-sm text-slate-400">
                Upload a CSV file to import your contacts
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      Company
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      Source
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                        {c.phone}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {c.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {c.company ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {c.source ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
