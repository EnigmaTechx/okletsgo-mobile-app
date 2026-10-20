import {
  describeSendCodeError,
  describeVerifyCodeError,
  extractErrorCode,
} from "./authErrors";

describe("extractErrorCode", () => {
  it("prefers a code, then a code buried in the message", () => {
    expect(extractErrorCode({ code: "auth/code-expired" })).toBe(
      "auth/code-expired",
    );
    expect(
      extractErrorCode({
        message: "[auth/requires-recent-login] Please sign in again.",
      }),
    ).toBe("auth/requires-recent-login");
    expect(extractErrorCode(undefined)).toBe("unknown");
  });
});

describe("phone-change errors", () => {
  it("explains a number that belongs to another account", () => {
    const e = describeVerifyCodeError({
      code: "auth/credential-already-in-use",
    });
    expect(e.title).toBe("Number already in use");
    expect(e.unknown).toBeUndefined();
  });

  it("flags unknown codes so the screen can surface them to support", () => {
    const e = describeVerifyCodeError({ code: "auth/something-new" });
    expect(e.unknown).toBe(true);
    expect(e.code).toBe("auth/something-new");
    expect(describeSendCodeError(new Error("boom")).unknown).toBe(true);
  });

  it("keeps known sign-in errors specific", () => {
    expect(
      describeVerifyCodeError({ code: "auth/invalid-verification-code" }).title,
    ).toBe("Incorrect code");
    expect(
      describeSendCodeError({ code: "auth/too-many-requests" }).unknown,
    ).toBeUndefined();
  });
});
