import { getAllTemplates } from "@/modules/gs1";

export default function LabelsPage() {
  const templates = getAllTemplates();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GS1 Compliance Labels</h1>
        <p className="text-muted-foreground">
          Generate GS1-128 / SSCC-18 compliant shipping labels for retailer requirements
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <div key={tpl.retailer} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{tpl.retailer}</h3>
              <span className="text-xs text-muted-foreground">
                {tpl.labelSize.widthMm}x{tpl.labelSize.heightMm}mm
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{tpl.notes}</p>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Required Fields:</p>
              <div className="flex flex-wrap gap-1">
                {tpl.fields
                  .filter((f) => f.required)
                  .map((f) => (
                    <span
                      key={f.ai}
                      className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
                    >
                      ({f.ai}) {f.label}
                    </span>
                  ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Optional Fields:</p>
              <div className="flex flex-wrap gap-1">
                {tpl.fields
                  .filter((f) => !f.required)
                  .map((f) => (
                    <span
                      key={f.ai}
                      className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      ({f.ai}) {f.label}
                    </span>
                  ))}
                {tpl.fields.filter((f) => !f.required).length === 0 && (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
