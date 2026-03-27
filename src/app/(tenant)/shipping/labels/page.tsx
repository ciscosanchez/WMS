import { getAllTemplates } from "@/modules/gs1";
import { getOperationalAttributesForDocumentSurface } from "@/modules/attributes/actions";

export default async function LabelsPage() {
  const templates = getAllTemplates();
  const [labelAttributes, manifestAttributes, packingListAttributes] = await Promise.all([
    getOperationalAttributesForDocumentSurface("label"),
    getOperationalAttributesForDocumentSurface("manifest"),
    getOperationalAttributesForDocumentSurface("packing_list"),
  ]);

  const documentGroups = [
    { title: "Label Surface", attributes: labelAttributes },
    { title: "Manifest Surface", attributes: manifestAttributes },
    { title: "Packing List Surface", attributes: packingListAttributes },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GS1 Compliance Labels</h1>
        <p className="text-muted-foreground">
          Generate GS1-128 / SSCC-18 compliant shipping labels for retailer requirements
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {documentGroups.map((group) => (
          <div key={group.title} className="rounded-lg border bg-card p-4 space-y-3">
            <div>
              <h3 className="font-semibold">{group.title}</h3>
              <p className="text-sm text-muted-foreground">
                Configured operational attributes available to this document surface
              </p>
            </div>
            {group.attributes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attributes mapped yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {group.attributes.map((attribute) => (
                  <span
                    key={`${group.title}-${attribute.id}`}
                    className="inline-flex items-center rounded bg-secondary px-2 py-1 text-xs"
                  >
                    {attribute.label}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {attribute.entityScope.replaceAll("_", " ")}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
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
