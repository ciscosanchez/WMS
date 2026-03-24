import { cursorPaginateQuery, buildCursorResult } from "@/lib/pagination";

describe("cursorPaginateQuery", () => {
  it("returns take = pageSize + 1 for the first page (no cursor)", () => {
    const result = cursorPaginateQuery(20);
    expect(result).toEqual({ take: 21 });
    expect(result.cursor).toBeUndefined();
    expect(result.skip).toBeUndefined();
  });

  it("returns cursor + skip: 1 when cursor is provided", () => {
    const result = cursorPaginateQuery(20, "abc-123");
    expect(result).toEqual({
      take: 21,
      skip: 1,
      cursor: { id: "abc-123" },
    });
  });

  it("treats null cursor the same as undefined (first page)", () => {
    const result = cursorPaginateQuery(10, null);
    expect(result).toEqual({ take: 11 });
  });

  it("treats empty string cursor the same as undefined (first page)", () => {
    const result = cursorPaginateQuery(10, "");
    expect(result).toEqual({ take: 11 });
  });
});

describe("buildCursorResult", () => {
  const makeItems = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `item-${i}` }));

  it("returns hasMore: false when data length <= pageSize", () => {
    const data = makeItems(5);
    const result = buildCursorResult(data, 10);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.data).toHaveLength(5);
  });

  it("returns hasMore: true and trims extra item when data length > pageSize", () => {
    const data = makeItems(11); // pageSize + 1
    const result = buildCursorResult(data, 10);
    expect(result.hasMore).toBe(true);
    expect(result.data).toHaveLength(10);
    expect(result.nextCursor).toBe("item-9"); // last item of trimmed page
  });

  it("returns correct nextCursor as the last item id", () => {
    const data = [
      { id: "aaa" },
      { id: "bbb" },
      { id: "ccc" },
      { id: "ddd" }, // extra, will be trimmed
    ];
    const result = buildCursorResult(data, 3);
    expect(result.nextCursor).toBe("ccc");
    expect(result.data).toEqual([{ id: "aaa" }, { id: "bbb" }, { id: "ccc" }]);
  });

  it("handles empty data", () => {
    const result = buildCursorResult([], 20);
    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("handles exact pageSize (no extra record = no more pages)", () => {
    const data = makeItems(20);
    const result = buildCursorResult(data, 20);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.data).toHaveLength(20);
  });

  it("does not include prevCursor (forward-only pagination)", () => {
    const data = makeItems(5);
    const result = buildCursorResult(data, 10);
    expect(result).not.toHaveProperty("prevCursor");
  });

  it("preserves pageSize in result", () => {
    const result = buildCursorResult(makeItems(3), 50);
    expect(result.pageSize).toBe(50);
  });
});
