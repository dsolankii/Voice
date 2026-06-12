"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import {
  deleteContact,
  deleteContactList,
  getAgents,
  getCampaigns,
  getContactLists,
  getContacts,
  uploadContactListCsv,
} from "@/lib/api";
import type {
  Agent,
  Campaign,
  Contact,
  ContactList,
  UploadContactListResult,
} from "@/lib/types";

function formatDate(value?: string) {
  if (!value) return "Unknown date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] =
    useState<UploadContactListResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);

    try {
      const [contactsResult, listsResult, agentsResult, campaignsResult] =
        await Promise.allSettled([
          getContacts(),
          getContactLists(),
          getAgents(),
          getCampaigns(),
        ]);

      if (contactsResult.status === "fulfilled") {
        setContacts(contactsResult.value.contacts);
      }

      if (listsResult.status === "fulfilled") {
        setContactLists(listsResult.value.contactLists);
      }

      if (agentsResult.status === "fulfilled") {
        setAgents(agentsResult.value.agents);
      }

      if (campaignsResult.status === "fulfilled") {
        setCampaigns(campaignsResult.value.campaigns);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();

    if (!listName.trim()) {
      setUploadError("Please enter a contact list name");
      return;
    }

    if (!selectedFile) {
      setUploadError("Please choose a CSV file");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadResult(null);

    try {
      const result = await uploadContactListCsv({
        name: listName,
        description: listDescription,
        file: selectedFile,
      });

      setUploadResult(result);
      setListName("");
      setListDescription("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";

      await load();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteContact(id: string) {
    if (!confirm("Delete this contact?")) return;

    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((contact) => contact.id !== id));
    } catch {
      alert("Failed to delete contact");
    }
  }

  function getAgentName(agentId?: string | null) {
    if (!agentId) return "Unknown agent";
    const agent = agents.find((item) => item.id === agentId);
    return agent?.name ?? "Unknown agent";
  }

  function getCampaignsForList(contactListId: string) {
    return campaigns.filter(
      (campaign) => campaign.contactListId === contactListId
    );
  }

  async function handleDeleteContactList(id: string) {
    if (
      !confirm(
        "Delete this contact list? Contacts will remain available, but the list grouping will be removed."
      )
    ) {
      return;
    }

    try {
      await deleteContactList(id);
      setContactLists((prev) => prev.filter((list) => list.id !== id));
    } catch {
      alert("Failed to delete contact list");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Contact Lists
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload CSV files as reusable lead lists for campaigns.
          </p>
        </div>

        <Card>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="mb-1 text-sm font-semibold text-slate-900">
                Upload CSV as Contact List
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Give each CSV a name, then choose that list while creating a
                campaign.
              </p>

              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                <Input
                  label="Contact list name"
                  placeholder="e.g. Mumbai 2BHK Leads"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  required
                />

                <Textarea
                  label="Description (optional)"
                  placeholder="e.g. Leads collected from June landing page"
                  rows={2}
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                />

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    CSV file
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                      id="csv-upload"
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      Choose CSV file
                    </Button>

                    <span className="text-xs text-slate-500">
                      {selectedFile ? selectedFile.name : "No file selected"}
                    </span>
                  </div>
                </div>

                <div>
                  <Button type="submit" loading={uploading}>
                    {uploading ? "Uploading..." : "Upload Contact List"}
                  </Button>
                </div>
              </form>

              {uploadResult ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <p className="mb-1 font-medium text-emerald-800">
                    Contact list created: {uploadResult.contactList.name}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-emerald-700">
                    <span>
                      <strong>{uploadResult.upload.totalRows}</strong> total
                      rows
                    </span>
                    <span>
                      <strong>{uploadResult.upload.createdCount}</strong>{" "}
                      created
                    </span>
                    <span>
                      <strong>{uploadResult.upload.skippedCount}</strong>{" "}
                      skipped
                    </span>
                  </div>
                </div>
              ) : null}

              {uploadError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {uploadError}
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Expected CSV format
              </p>
              <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
{`name,phone,email,company,notes
Amit Shah,9876543210,amit@example.com,ABC Realty,Interested in 2BHK
Priya Patel,9123456789,priya@example.com,XYZ Corp,Callback tomorrow`}
              </pre>
            </div>
          </div>
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Contact Lists{" "}
              {!loading ? (
                <span className="text-sm font-normal text-slate-400">
                  ({contactLists.length})
                </span>
              ) : null}
            </h2>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Loading contact lists...
            </div>
          ) : contactLists.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="text-4xl">📁</div>
              <p className="font-medium text-slate-600">
                No contact lists yet
              </p>
              <p className="text-sm text-slate-400">
                Upload a CSV to create your first list.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {contactLists.map((list) => (
                <Card key={list.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {list.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {list.description || "No description added."}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-600">
                          {list.contactCount} contacts
                        </span>
                        <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-600">
                          Created {formatDate(list.createdAt)}
                        </span>
                      </div>

                      {getCampaignsForList(list.id).length > 0 ? (
                        <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                          <p className="mb-2 text-xs font-semibold text-violet-700">
                            Used in campaigns
                          </p>
                          <div className="flex flex-col gap-1">
                            {getCampaignsForList(list.id).map((campaign) => (
                              <div
                                key={campaign.id}
                                className="text-xs text-violet-700"
                              >
                                {campaign.name} · Agent:{" "}
                                {getAgentName(campaign.agentId)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-xs text-slate-400">
                          Not connected to any campaign yet.
                        </p>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteContactList(list.id)}
                      className="text-red-400 hover:bg-red-50 hover:text-red-600"
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              All contacts{" "}
              {!loading ? (
                <span className="text-sm font-normal text-slate-400">
                  ({contacts.length})
                </span>
              ) : null}
            </h2>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="text-4xl">👥</div>
              <p className="font-medium text-slate-600">No contacts yet</p>
              <p className="text-sm text-slate-400">
                Upload a contact list to import contacts.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
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
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {contact.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {contact.phone}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {contact.email ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {contact.company ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {contact.source ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-400 hover:bg-red-50 hover:text-red-600"
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
