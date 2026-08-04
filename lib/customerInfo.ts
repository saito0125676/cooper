import { parseIsoDateStrict, todayUtc } from "@/lib/dates";

// prisma/stripeに依存しない純粋なモジュール。
// クライアント側フォーム(app/components/CustomerInfoForm.tsx)と
// サーバー側API(app/api/reservations/route.ts)の両方で同じ検証ルールを共有する。

export interface CustomerInfoInput {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthDate: string; // "YYYY-MM-DD"
  postalCode: string; // ハイフン無し7桁
  prefecture: string;
  city: string;
  town: string;
  addressLine: string;
  mobilePhone: string;
  homePhone: string; // 任意
  email: string;
  emailConfirm: string;
  licenseNumber: string;
  licenseIssuedDate: string; // "YYYY-MM-DD"
}

export type CustomerInfoErrors = Partial<Record<keyof CustomerInfoInput, string>>;

const KANA_PATTERN = /^[ぁ-んー]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^0[0-9-]{9,14}$/;
const POSTAL_PATTERN = /^\d{7}$/;

function validateRequiredDate(
  value: string,
  emptyMessage: string,
  invalidMessage: string
): string | undefined {
  if (!value) return emptyMessage;
  const date = parseIsoDateStrict(value);
  if (!date) return invalidMessage;
  if (date.getTime() > todayUtc().getTime()) return "未来の日付は選択できません";
  return undefined;
}

/** 入力必須項目(自宅電話番号以外)がすべて埋まっているか、形式が正しいかを検証する */
export function validateCustomerInfo(input: CustomerInfoInput): CustomerInfoErrors {
  const errors: CustomerInfoErrors = {};

  if (!input.lastName.trim()) errors.lastName = "姓を入力してください";
  if (!input.firstName.trim()) errors.firstName = "名を入力してください";

  if (!input.lastNameKana.trim()) {
    errors.lastNameKana = "せいを入力してください";
  } else if (!KANA_PATTERN.test(input.lastNameKana.trim())) {
    errors.lastNameKana = "せいはひらがなで入力してください";
  }

  if (!input.firstNameKana.trim()) {
    errors.firstNameKana = "めいを入力してください";
  } else if (!KANA_PATTERN.test(input.firstNameKana.trim())) {
    errors.firstNameKana = "めいはひらがなで入力してください";
  }

  const birthDateError = validateRequiredDate(
    input.birthDate,
    "生年月日を選択してください",
    "生年月日が正しくありません"
  );
  if (birthDateError) errors.birthDate = birthDateError;

  if (!input.postalCode.trim()) {
    errors.postalCode = "郵便番号を入力してください";
  } else if (!POSTAL_PATTERN.test(input.postalCode.trim())) {
    errors.postalCode = "郵便番号は7桁の数字で入力してください";
  }

  if (!input.prefecture.trim()) errors.prefecture = "都道府県を入力してください";
  if (!input.city.trim()) errors.city = "市区町村を入力してください";
  if (!input.town.trim()) errors.town = "町名を入力してください";
  if (!input.addressLine.trim()) errors.addressLine = "番地を入力してください";

  if (!input.mobilePhone.trim()) {
    errors.mobilePhone = "携帯電話番号を入力してください";
  } else if (!PHONE_PATTERN.test(input.mobilePhone.trim())) {
    errors.mobilePhone = "携帯電話番号の形式が正しくありません";
  }

  if (input.homePhone.trim() && !PHONE_PATTERN.test(input.homePhone.trim())) {
    errors.homePhone = "自宅電話番号の形式が正しくありません";
  }

  if (!input.email.trim()) {
    errors.email = "メールアドレスを入力してください";
  } else if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "メールアドレスの形式が正しくありません";
  }

  if (!input.emailConfirm.trim()) {
    errors.emailConfirm = "確認のためメールアドレスを再入力してください";
  } else if (input.emailConfirm.trim() !== input.email.trim()) {
    errors.emailConfirm = "メールアドレスが一致しません";
  }

  if (!input.licenseNumber.trim()) errors.licenseNumber = "免許証番号を入力してください";

  const licenseDateError = validateRequiredDate(
    input.licenseIssuedDate,
    "免許証取得日を選択してください",
    "免許証取得日が正しくありません"
  );
  if (licenseDateError) errors.licenseIssuedDate = licenseDateError;

  return errors;
}

export function isCustomerInfoValid(errors: CustomerInfoErrors): boolean {
  return Object.keys(errors).length === 0;
}
