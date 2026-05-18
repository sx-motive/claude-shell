import { beforeEach, describe, expect, it } from "vitest";
import {
  readSkipPermissions,
  resetSkipPermissionsCache,
  SKIP_PERMISSIONS_DEFAULT,
  SKIP_PERMISSIONS_KEY,
  writeSkipPermissions,
} from "./skipPermissions";

beforeEach(() => {
  window.localStorage.clear();
  resetSkipPermissionsCache();
});

describe("readSkipPermissions", () => {
  it("returns the default when nothing is stored", () => {
    expect(readSkipPermissions()).toBe(SKIP_PERMISSIONS_DEFAULT);
  });

  it("returns true when stored value is '1'", () => {
    window.localStorage.setItem(SKIP_PERMISSIONS_KEY, "1");
    expect(readSkipPermissions()).toBe(true);
  });

  it("returns false when stored value is '0'", () => {
    window.localStorage.setItem(SKIP_PERMISSIONS_KEY, "0");
    expect(readSkipPermissions()).toBe(false);
  });

  it("treats unknown stored values as false (not default)", () => {
    window.localStorage.setItem(SKIP_PERMISSIONS_KEY, "garbage");
    expect(readSkipPermissions()).toBe(false);
  });
});

describe("writeSkipPermissions", () => {
  it("persists true as '1'", () => {
    writeSkipPermissions(true);
    expect(window.localStorage.getItem(SKIP_PERMISSIONS_KEY)).toBe("1");
  });

  it("persists false as '0'", () => {
    writeSkipPermissions(false);
    expect(window.localStorage.getItem(SKIP_PERMISSIONS_KEY)).toBe("0");
  });

  it("makes subsequent reads return the new value", () => {
    writeSkipPermissions(false);
    expect(readSkipPermissions()).toBe(false);
    writeSkipPermissions(true);
    expect(readSkipPermissions()).toBe(true);
  });
});
