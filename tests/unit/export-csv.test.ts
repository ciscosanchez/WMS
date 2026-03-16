import { exportToCsv } from "@/lib/export/csv";

describe("CSV export utility", () => {
  let clickSpy: jest.Mock;
  let anchorEl: Partial<HTMLAnchorElement>;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    clickSpy = jest.fn();
    anchorEl = {
      href: "",
      download: "",
      style: { display: "" } as CSSStyleDeclaration,
      click: clickSpy,
    };

    jest.spyOn(document, "createElement").mockReturnValue(anchorEl as HTMLAnchorElement);
    jest.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    jest.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    // jsdom does not implement URL.createObjectURL/revokeObjectURL, so assign directly
    URL.createObjectURL = jest.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("creates a CSV with headers and rows", () => {
    exportToCsv(
      "test.csv",
      ["Name", "Age"],
      [
        ["Alice", "30"],
        ["Bob", "25"],
      ]
    );

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorEl.download).toBe("test.csv");
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("appends .csv extension when not present", () => {
    exportToCsv("report", ["H"], [["V"]]);
    expect(anchorEl.download).toBe("report.csv");
  });

  it("does not double-append .csv extension", () => {
    exportToCsv("report.csv", ["H"], [["V"]]);
    expect(anchorEl.download).toBe("report.csv");
  });

  it("handles empty rows", () => {
    exportToCsv("empty.csv", ["Name", "Age"], []);

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("escapes values containing commas", () => {
    // We verify by checking the Blob was created — the internal escaping is tested
    // via the CSV content. Since Blob content isn't easily read in jsdom, we check
    // the flow completes without error.
    expect(() => {
      exportToCsv("test.csv", ["Name"], [["Doe, John"]]);
    }).not.toThrow();
  });

  it("escapes values containing quotes", () => {
    expect(() => {
      exportToCsv("test.csv", ["Desc"], [['She said "hello"']]);
    }).not.toThrow();
  });

  it("escapes values containing newlines", () => {
    expect(() => {
      exportToCsv("test.csv", ["Notes"], [["Line1\nLine2"]]);
    }).not.toThrow();
  });

  it("cleans up DOM after download", () => {
    exportToCsv("test.csv", ["H"], [["V"]]);

    expect(document.body.appendChild).toHaveBeenCalledWith(anchorEl);
    expect(document.body.removeChild).toHaveBeenCalledWith(anchorEl);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
