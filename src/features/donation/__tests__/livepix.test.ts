import { describe, expect, it } from "vitest";
import {
  assertSafeLivePixUrl,
  buildLivePixDonationUrl,
  DEFAULT_LIVEPIX_USERNAME,
  isSafeLivePixUrl,
} from "../utils/livepix";

describe("LivePix Utils", () => {
  it("deve montar URL padrão apontando para o username default", () => {
    const url = buildLivePixDonationUrl();
    expect(url).toBe(`https://livepix.gg/${DEFAULT_LIVEPIX_USERNAME}`);
  });

  it("deve limpar o prefixo @ do username customizado", () => {
    const url = buildLivePixDonationUrl({ username: "@criador_teste" });
    expect(url).toBe("https://livepix.gg/criador_teste");
  });

  it("deve incluir parâmetros de amount e message quando informados", () => {
    const url = buildLivePixDonationUrl({
      username: "apenasgabs",
      amount: 25,
      message: "Valeu pelas vagas!",
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://livepix.gg");
    expect(parsed.pathname).toBe("/apenasgabs");
    expect(parsed.searchParams.get("amount")).toBe("25");
    expect(parsed.searchParams.get("message")).toBe("Valeu pelas vagas!");
  });

  it("deve validar corretamente domínios seguros do LivePix", () => {
    expect(isSafeLivePixUrl("https://livepix.gg/apenasgabs")).toBe(true);
    expect(isSafeLivePixUrl("https://checkout.livepix.gg/1234")).toBe(true);
    expect(isSafeLivePixUrl("http://livepix.gg/apenasgabs")).toBe(true);

    // Domínios maliciosos ou tentativas de phishing / open redirect
    expect(isSafeLivePixUrl("https://livepix.gg.fake.com")).toBe(false);
    expect(isSafeLivePixUrl("https://evil-site.com?url=livepix.gg")).toBe(false);
    expect(isSafeLivePixUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeLivePixUrl("not-a-valid-url")).toBe(false);
  });

  it("assertSafeLivePixUrl deve lançar erro se a URL não for segura", () => {
    expect(() => assertSafeLivePixUrl("https://phishing-site.com")).toThrow(
      /URL de doação inválida ou insegura/,
    );
  });
});
