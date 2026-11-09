import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ UPLOAD_MAX_MB: 10 }),
}));

import type { CertificateLabOption } from "./labs";
import { parseSellerForm } from "./parse-form";

const labs: CertificateLabOption[] = [
  { id: "lab_gia", code: "gia", name: "GIA", isOther: false },
  { id: "lab_other", code: "other", name: "Other", isOther: true },
];

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

const textFields: Record<string, string> = {
  name: "Asha Rao",
  email: "Seller@Example.com",
  mobile: "+91 98123 45678",
  password: "correct-horse-1",
  country: "India",
  businessName: "Rao Gems",
  businessType: "PARTNERSHIP",
  gstNumber: "",
  addressLine: "12 MG Road, Jaipur",
  city: "Jaipur",
  state: "Rajasthan",
  businessCountry: "India",
  pincode: "302001",
  yearsInBusiness: "12",
  specialties: "Ruby, Sapphire,  Emerald ,",
};

function file(bytes: Buffer, name: string, type = "application/pdf"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function buildForm(options: { omit?: string[]; files?: Record<string, File>; text?: Record<string, string> } = {}): FormData {
  const form = new FormData();
  const text = { ...textFields, ...options.text };
  for (const [key, value] of Object.entries(text)) {
    if (options.omit?.includes(key)) continue;
    form.append(key, value);
  }
  const files: Record<string, File> = {
    idProof: file(PDF, "id-proof.pdf"),
    businessProof: file(PNG, "business.png", "image/png"),
    ...options.files,
  };
  for (const [key, value] of Object.entries(files)) form.append(key, value);
  return form;
}

describe("parseSellerForm", () => {
  it("accepts a complete application and normalises the input", async () => {
    const result = await parseSellerForm(buildForm(), labs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.account.email).toBe("seller@example.com");
    expect(result.value.account.mobile).toBe("+919812345678");
    expect(result.value.business.specialties).toEqual(["Ruby", "Sapphire", "Emerald"]);
    expect(result.value.idProof.mimeType).toBe("application/pdf");
    expect(result.value.businessProof.mimeType).toBe("image/png");
    expect(result.value.certificates).toEqual([]);
  });

  it("rejects a missing ID proof", async () => {
    const result = await parseSellerForm(buildForm({ files: { idProof: new File([], "") as unknown as File } }), labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.idProof).toBeDefined();
  });

  it("rejects a missing business proof", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(textFields)) form.append(key, value);
    form.append("idProof", file(PDF, "id.pdf"));
    const result = await parseSellerForm(form, labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.businessProof).toBeDefined();
  });

  it("rejects a malformed GST number", async () => {
    const result = await parseSellerForm(buildForm({ text: { gstNumber: "27AAPFU0939F1Z" } }), labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.gstNumber).toBeDefined();
  });

  it("accepts a valid GST number", async () => {
    const result = await parseSellerForm(buildForm({ text: { gstNumber: "27aapfu0939f1zv" } }), labs);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.business.gstNumber).toBe("27AAPFU0939F1ZV");
  });

  it("rejects an oversized file using the claimed size", async () => {
    const big = file(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(11 * 1024 * 1024)]), "big.pdf");
    const result = await parseSellerForm(buildForm({ files: { idProof: big } }), labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.idProof).toMatch(/10 MB/);
  });

  it("rejects a file of the wrong type even when its name and MIME type claim PDF", async () => {
    const fake = file(Buffer.from("<html>not a pdf</html>"), "id.pdf", "application/pdf");
    const result = await parseSellerForm(buildForm({ files: { idProof: fake } }), labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.idProof).toMatch(/PDF, JPEG or PNG/);
  });

  it("rejects an unknown certificate lab code", async () => {
    const form = buildForm();
    form.append("certificate_0_file", file(PDF, "cert.pdf"));
    form.append("certificate_0_lab", "not-a-lab");
    const result = await parseSellerForm(form, labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.certificate_0_lab).toBeDefined();
  });

  it("requires a lab name when the lab is Other", async () => {
    const form = buildForm();
    form.append("certificate_0_file", file(PDF, "cert.pdf"));
    form.append("certificate_0_lab", "other");
    const result = await parseSellerForm(form, labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.certificate_0_labOther).toBeDefined();
  });

  it("limits the free-text lab name to 80 characters", async () => {
    const form = buildForm();
    form.append("certificate_0_file", file(PDF, "cert.pdf"));
    form.append("certificate_0_lab", "other");
    form.append("certificate_0_labOther", "x".repeat(81));
    const result = await parseSellerForm(form, labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.certificate_0_labOther).toBeDefined();
  });

  it("accepts a certificate from a known lab and an Other lab with a name", async () => {
    const form = buildForm();
    form.append("certificate_0_file", file(PDF, "gia.pdf"));
    form.append("certificate_0_lab", "gia");
    form.append("certificate_1_file", file(PNG, "other.png", "image/png"));
    form.append("certificate_1_lab", "other");
    form.append("certificate_1_labOther", "Jaipur Gem Lab");
    const result = await parseSellerForm(form, labs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.certificates).toHaveLength(2);
    expect(result.value.certificates[0]).toMatchObject({ labId: "lab_gia", labOther: null });
    expect(result.value.certificates[1]).toMatchObject({ labId: "lab_other", labOther: "Jaipur Gem Lab" });
  });

  it("rejects more than five certificates", async () => {
    const form = buildForm();
    for (let i = 0; i < 6; i++) {
      form.append(`certificate_${i}_file`, file(PDF, `c${i}.pdf`));
      form.append(`certificate_${i}_lab`, "gia");
    }
    const result = await parseSellerForm(form, labs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.certificates).toBeDefined();
  });

  it("strips path parts and unsafe characters from the stored file name", async () => {
    const result = await parseSellerForm(
      buildForm({ files: { idProof: file(PDF, "../../etc/evil<script>.pdf") } }),
      labs,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.idProof.fileName).toBe("evilscript.pdf");
  });
});
