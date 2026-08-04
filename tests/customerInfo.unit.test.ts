import { describe, expect, it, vi } from "vitest";
import {
  isCustomerInfoValid,
  validateCustomerInfo,
  type CustomerInfoInput,
} from "@/lib/customerInfo";

function validInput(): CustomerInfoInput {
  return {
    lastName: "山田",
    firstName: "太郎",
    lastNameKana: "やまだ",
    firstNameKana: "たろう",
    birthDate: "1990-05-10",
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    town: "千代田",
    addressLine: "1-1",
    mobilePhone: "090-1234-5678",
    homePhone: "",
    email: "taro@example.com",
    emailConfirm: "taro@example.com",
    licenseNumber: "123456789012",
    licenseIssuedDate: "2015-04-01",
  };
}

describe("validateCustomerInfo", () => {
  it("全項目が正しければエラーなし(自宅電話番号は空でもOK)", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo(validInput());
    expect(isCustomerInfoValid(errors)).toBe(true);
  });

  it("必須項目が空だとエラーになる(自宅電話番号以外)", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({ ...validInput(), lastName: "" });
    expect(errors.lastName).toBeDefined();
  });

  it("氏名かながひらがな以外だとエラーになる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({ ...validInput(), lastNameKana: "ヤマダ" });
    expect(errors.lastNameKana).toBeDefined();
  });

  it("メールアドレス再入力が一致しないとエラーになる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({
      ...validInput(),
      email: "taro@example.com",
      emailConfirm: "jiro@example.com",
    });
    expect(errors.emailConfirm).toBe("メールアドレスが一致しません");
  });

  it("メールアドレスの形式が不正だとエラーになる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({ ...validInput(), email: "not-an-email", emailConfirm: "not-an-email" });
    expect(errors.email).toBeDefined();
  });

  it("郵便番号が7桁の数字でないとエラーになる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({ ...validInput(), postalCode: "123" });
    expect(errors.postalCode).toBeDefined();
  });

  it("生年月日が実在しない日付だとエラーになる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({ ...validInput(), birthDate: "1990-02-30" });
    expect(errors.birthDate).toBeDefined();
  });

  it("生年月日が未来の日付だとエラーになる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({ ...validInput(), birthDate: "2026-09-01" });
    expect(errors.birthDate).toBeDefined();
  });

  it("免許証取得日が未来の日付だとエラーになる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const errors = validateCustomerInfo({ ...validInput(), licenseIssuedDate: "2026-09-01" });
    expect(errors.licenseIssuedDate).toBeDefined();
  });

  it("自宅電話番号は空文字でもエラーにならないが、値がある場合は形式チェックされる", () => {
    vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    const okErrors = validateCustomerInfo({ ...validInput(), homePhone: "" });
    expect(okErrors.homePhone).toBeUndefined();

    const ngErrors = validateCustomerInfo({ ...validInput(), homePhone: "abc" });
    expect(ngErrors.homePhone).toBeDefined();
  });
});
