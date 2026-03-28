"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ExtractionReview } from "@/components/receiving/extraction-review";
import { getProcessingJob, getFileViewUrl } from "@/modules/receiving/docai-actions";
import { getClients } from "@/modules/clients/actions";
import { getWarehouses } from "@/modules/warehouse/actions";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ReviewExtractionPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [job, setJob] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [fileViewUrl, setFileViewUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [jobData, clientData, warehouseData] = await Promise.all([
          getProcessingJob(params.jobId),
          getClients(),
          getWarehouses(),
        ]);
        setJob(jobData);
        setClients(clientData);
        setWarehouses(warehouseData);

        if (jobData?.fileUrl) {
          const url = await getFileViewUrl(jobData.fileUrl);
          if (url) setFileViewUrl(url);
        }
      } catch {
        // Job not found or error loading
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Extraction Not Found" />
        <p className="text-muted-foreground">This processing job could not be found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Review Extraction">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </PageHeader>

      <ExtractionReview
        job={job}
        fileViewUrl={fileViewUrl}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
      />
    </div>
  );
}
