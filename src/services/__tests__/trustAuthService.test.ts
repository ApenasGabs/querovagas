import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureUtterancesSessionFromUrl,
  getStoredTrustToken,
  getStoredUserProfile,
  getStoredUtterancesSession,
  signOut,
  verifyUtterancesSessionWithBackend,
} from "../trustAuthService";

describe("trustAuthService (Utterances Session Auth)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.history.replaceState(undefined, "", "/");
  });

  it("deve capturar ?utterances=... da URL, salvar em utterances-session e limpar a query string", () => {
    window.history.replaceState(undefined, "", "/?utterances=session_abc_123");

    const result = captureUtterancesSessionFromUrl();

    expect(result.fromRedirect).toBe(true);
    expect(result.session).toBe("session_abc_123");
    expect(getStoredUtterancesSession()).toBe("session_abc_123");
    expect(window.location.search).toBe("");
  });

  it("deve resolver usuário via verifyUtterancesSessionWithBackend e salvar perfil mesmo sem isVerified", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          isVerified: false,
          username: "devcomunidade",
          user: {
            username: "devcomunidade",
            name: "Dev Comunidade",
            avatarUrl: "https://avatars.githubusercontent.com/u/123",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await verifyUtterancesSessionWithBackend("session_abc_123");

    expect(res.isVerified).toBe(false);
    expect(res.user?.username).toBe("devcomunidade");
    expect(getStoredUserProfile()?.username).toBe("devcomunidade");
    expect(getStoredTrustToken()).toBeNull();
  });

  it("deve salvar trustToken e perfil quando o usuário do Utterances é verificado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          isVerified: true,
          trustToken: "signed_token_xyz",
          username: "ApenasGabs",
          user: {
            username: "ApenasGabs",
            name: "Gabriel",
            avatarUrl: "https://avatars.githubusercontent.com/u/1",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await verifyUtterancesSessionWithBackend("session_gabs");

    expect(res.isVerified).toBe(true);
    expect(res.trustToken).toBe("signed_token_xyz");
    expect(getStoredTrustToken()).toBe("signed_token_xyz");
    expect(getStoredUserProfile()?.username).toBe("ApenasGabs");
  });

  it("deve limpar utterances-session, trustToken e userProfile no signOut", () => {
    window.history.replaceState(undefined, "", "/?utterances=session_to_clear");
    captureUtterancesSessionFromUrl();

    signOut();

    expect(getStoredUtterancesSession()).toBeNull();
    expect(getStoredTrustToken()).toBeNull();
    expect(getStoredUserProfile()).toBeNull();
  });
});
