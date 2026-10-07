import { describe, expect, it } from "vitest";
import { detectRetification } from "@/lib/ingestion/detect-retification";
import { detectSuspension } from "@/lib/ingestion/detect-suspension";
import { shouldRequireManualReview } from "@/lib/ingestion/parse-pdf";

describe("retificações e documentos", () => {
  it("detecta retificação e prorrogação", () => {
    expect(detectRetification("Retificação do edital")).toBe("retification");
    expect(detectRetification("Prazo prorrogado com novo cronograma")).toBe("extension");
  });

  it("altera o sinal para suspensão", () => {
    expect(detectSuspension("Processo seletivo suspenso")).toBe("suspended");
  });

  it("altera o sinal para cancelamento", () => {
    expect(detectSuspension("Edital cancelado")).toBe("cancelled");
  });

  it("PDF sem texto suficiente exige revisão manual", () => {
    expect(shouldRequireManualReview("imagem digitalizada")).toBe(true);
  });

  it("PDF com texto extraível pode seguir para extração", () => {
    expect(shouldRequireManualReview("Texto oficial ".repeat(20))).toBe(false);
  });
});