import type { ATSPlatform } from "../types/company";

export interface ATSDetectionResult {
  ats: ATSPlatform;
  platformName: string;
  cleanUrl: string;
  isKnownATS: boolean;
}

export function detectATS(rawUrl: string): ATSDetectionResult {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    return {
      ats: "OUTRO",
      platformName: "Outro / Site Próprio",
      cleanUrl: "",
      isKnownATS: false,
    };
  }

  // Garante protocolo https se não informado
  let normalizedUrl = trimmed;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  let hostname = "";
  try {
    const parsed = new URL(normalizedUrl);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    hostname = trimmed.toLowerCase();
  }

  if (hostname.includes("gupy.io")) {
    return {
      ats: "GUPY",
      platformName: "Gupy",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  if (hostname.includes("ashbyhq.com")) {
    return {
      ats: "ASHBY",
      platformName: "Ashby",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  if (hostname.includes("greenhouse.io")) {
    return {
      ats: "GREENHOUSE",
      platformName: "Greenhouse",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  if (hostname.includes("lever.co")) {
    return {
      ats: "LEVER",
      platformName: "Lever",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  if (hostname.includes("workable.com")) {
    return {
      ats: "WORKABLE",
      platformName: "Workable",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  if (hostname.includes("inhire.app") || hostname.includes("inhire.com.br")) {
    return {
      ats: "INHIRE",
      platformName: "InHire",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  if (hostname.includes("programathor.com.br")) {
    return {
      ats: "PROGRAMATHOR",
      platformName: "Programathor",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  if (hostname.includes("geekhunter.com.br")) {
    return {
      ats: "GEEKHUNTER",
      platformName: "GeekHunter",
      cleanUrl: normalizedUrl,
      isKnownATS: true,
    };
  }

  return {
    ats: "OUTRO",
    platformName: "Outro / Site de Carreiras",
    cleanUrl: normalizedUrl,
    isKnownATS: false,
  };
}
