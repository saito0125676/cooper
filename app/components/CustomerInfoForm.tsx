"use client";

import { FormEvent, ReactNode, useState } from "react";
import styles from "./CustomerInfoForm.module.css";
import {
  validateCustomerInfo,
  isCustomerInfoValid,
  type CustomerInfoInput,
  type CustomerInfoErrors,
} from "@/lib/customerInfo";

interface CustomerInfoFormProps {
  onBack: () => void;
  onSubmit: (info: CustomerInfoInput) => void;
  submitting: boolean;
  submitError: string | null;
}

const pad2 = (v: string) => v.padStart(2, "0");

const currentYear = new Date().getFullYear();
const birthYearOptions = Array.from({ length: 100 }, (_, i) => currentYear - i);
const licenseYearOptions = Array.from({ length: 80 }, (_, i) => currentYear - i);
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

interface ZipCloudResponse {
  status: number;
  message: string | null;
  results: { address1: string; address2: string; address3: string }[] | null;
}

function Section({
  label,
  required = true,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>{label}</span>
        {required && <span className={styles.requiredBadge}>必須</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={styles.fieldError}>{message}</p>;
}

function DateSelects({
  year,
  month,
  day,
  onYear,
  onMonth,
  onDay,
  yearOptions,
}: {
  year: string;
  month: string;
  day: string;
  onYear: (v: string) => void;
  onMonth: (v: string) => void;
  onDay: (v: string) => void;
  yearOptions: number[];
}) {
  return (
    <div className={styles.dateRow}>
      <select value={year} onChange={(e) => onYear(e.target.value)}>
        <option value="">選択</option>
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <span>年</span>
      <select value={month} onChange={(e) => onMonth(e.target.value)}>
        <option value="">選択</option>
        {monthOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <span>月</span>
      <select value={day} onChange={(e) => onDay(e.target.value)}>
        <option value="">選択</option>
        {dayOptions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <span>日</span>
    </div>
  );
}

export default function CustomerInfoForm({
  onBack,
  onSubmit,
  submitting,
  submitError,
}: CustomerInfoFormProps) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastNameKana, setLastNameKana] = useState("");
  const [firstNameKana, setFirstNameKana] = useState("");

  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");

  const [postalCode1, setPostalCode1] = useState("");
  const [postalCode2, setPostalCode2] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");
  const [addressLine, setAddressLine] = useState("");

  const [mobilePhone, setMobilePhone] = useState("");
  const [homePhone, setHomePhone] = useState("");

  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");

  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseYear, setLicenseYear] = useState("");
  const [licenseMonth, setLicenseMonth] = useState("");
  const [licenseDay, setLicenseDay] = useState("");

  const [errors, setErrors] = useState<CustomerInfoErrors>({});
  const [showErrors, setShowErrors] = useState(false);

  const [zipLookupLoading, setZipLookupLoading] = useState(false);
  const [zipLookupError, setZipLookupError] = useState<string | null>(null);

  function buildPayload(): CustomerInfoInput {
    return {
      lastName,
      firstName,
      lastNameKana,
      firstNameKana,
      birthDate:
        birthYear && birthMonth && birthDay
          ? `${birthYear}-${pad2(birthMonth)}-${pad2(birthDay)}`
          : "",
      postalCode: `${postalCode1}${postalCode2}`,
      prefecture,
      city,
      town,
      addressLine,
      mobilePhone,
      homePhone,
      email,
      emailConfirm,
      licenseNumber,
      licenseIssuedDate:
        licenseYear && licenseMonth && licenseDay
          ? `${licenseYear}-${pad2(licenseMonth)}-${pad2(licenseDay)}`
          : "",
    };
  }

  async function handleZipLookup() {
    setZipLookupError(null);
    const zip = `${postalCode1}${postalCode2}`;
    if (!/^\d{7}$/.test(zip)) {
      setZipLookupError("郵便番号は7桁の数字で入力してください");
      return;
    }
    setZipLookupLoading(true);
    try {
      // 日本の郵便番号→住所変換の無料公開API(zipcloud)を利用している
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data: ZipCloudResponse = await res.json();
      if (data.status !== 200 || !data.results || data.results.length === 0) {
        throw new Error(data.message ?? "該当する住所が見つかりませんでした");
      }
      const [result] = data.results;
      setPrefecture(result.address1);
      setCity(result.address2);
      setTown(result.address3);
    } catch (err) {
      setZipLookupError(
        err instanceof Error ? err.message : "住所検索に失敗しました。手入力してください"
      );
    } finally {
      setZipLookupLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    const validationErrors = validateCustomerInfo(payload);
    setErrors(validationErrors);
    setShowErrors(true);
    if (!isCustomerInfoValid(validationErrors)) return;
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.form}>
        <Section label="氏名">
          <div className={styles.row}>
            <div>
              <input
                className={styles.input}
                type="text"
                placeholder="姓"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              {showErrors && <FieldError message={errors.lastName} />}
            </div>
            <div>
              <input
                className={styles.input}
                type="text"
                placeholder="名"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              {showErrors && <FieldError message={errors.firstName} />}
            </div>
          </div>
        </Section>

        <Section label="氏名(かな)">
          <div className={styles.row}>
            <div>
              <input
                className={styles.input}
                type="text"
                placeholder="せい"
                value={lastNameKana}
                onChange={(e) => setLastNameKana(e.target.value)}
              />
              {showErrors && <FieldError message={errors.lastNameKana} />}
            </div>
            <div>
              <input
                className={styles.input}
                type="text"
                placeholder="めい"
                value={firstNameKana}
                onChange={(e) => setFirstNameKana(e.target.value)}
              />
              {showErrors && <FieldError message={errors.firstNameKana} />}
            </div>
          </div>
        </Section>

        <Section label="生年月日">
          <DateSelects
            year={birthYear}
            month={birthMonth}
            day={birthDay}
            onYear={setBirthYear}
            onMonth={setBirthMonth}
            onDay={setBirthDay}
            yearOptions={birthYearOptions}
          />
          {showErrors && <FieldError message={errors.birthDate} />}
        </Section>

        <Section label="郵便番号">
          <div className={styles.postalRow}>
            <input
              className={styles.input}
              type="text"
              inputMode="numeric"
              maxLength={3}
              placeholder="123"
              value={postalCode1}
              onChange={(e) => setPostalCode1(e.target.value.replace(/\D/g, ""))}
            />
            <span className={styles.postalSeparator}>-</span>
            <input
              className={styles.input}
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="4567"
              value={postalCode2}
              onChange={(e) => setPostalCode2(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              className={styles.zipButton}
              onClick={handleZipLookup}
              disabled={zipLookupLoading}
            >
              {zipLookupLoading ? "検索中..." : "住所検索"}
            </button>
          </div>
          {showErrors && <FieldError message={errors.postalCode} />}
          {zipLookupError && <FieldError message={zipLookupError} />}
        </Section>

        <Section label="都道府県">
          <input
            className={styles.input}
            type="text"
            placeholder="[例] 神奈川県"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
          />
          {showErrors && <FieldError message={errors.prefecture} />}
        </Section>

        <Section label="市区町村">
          <input
            className={styles.input}
            type="text"
            placeholder="[例] 横浜市港北区"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          {showErrors && <FieldError message={errors.city} />}
        </Section>

        <Section label="町名">
          <input
            className={styles.input}
            type="text"
            placeholder="[例] 新横浜"
            value={town}
            onChange={(e) => setTown(e.target.value)}
          />
          {showErrors && <FieldError message={errors.town} />}
        </Section>

        <Section label="番地">
          <input
            className={styles.input}
            type="text"
            placeholder="[例] 2-3-15 ○○マンション101"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
          />
          {showErrors && <FieldError message={errors.addressLine} />}
        </Section>

        <Section label="携帯電話番号">
          <input
            className={styles.input}
            type="tel"
            placeholder="[例] 090-1234-5678"
            value={mobilePhone}
            onChange={(e) => setMobilePhone(e.target.value)}
          />
          {showErrors && <FieldError message={errors.mobilePhone} />}
        </Section>

        <Section label="自宅電話番号" required={false}>
          <input
            className={styles.input}
            type="tel"
            placeholder="[例] 045-123-4567(任意)"
            value={homePhone}
            onChange={(e) => setHomePhone(e.target.value)}
          />
          {showErrors && <FieldError message={errors.homePhone} />}
        </Section>

        <Section label="メールアドレス">
          <input
            className={styles.input}
            type="email"
            placeholder="[例] taro@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {showErrors && <FieldError message={errors.email} />}
        </Section>

        <Section label="メールアドレス(確認用)">
          <input
            className={styles.input}
            type="email"
            placeholder="もう一度入力してください"
            value={emailConfirm}
            onChange={(e) => setEmailConfirm(e.target.value)}
          />
          {showErrors && <FieldError message={errors.emailConfirm} />}
          <p className={styles.hint}>確認のため、メールアドレスと完全に同じ文字列を入力してください</p>
        </Section>

        <Section label="免許証番号">
          <input
            className={styles.input}
            type="text"
            placeholder="[例] 123456789012"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
          />
          {showErrors && <FieldError message={errors.licenseNumber} />}
        </Section>

        <Section label="免許証取得日">
          <DateSelects
            year={licenseYear}
            month={licenseMonth}
            day={licenseDay}
            onYear={setLicenseYear}
            onMonth={setLicenseMonth}
            onDay={setLicenseDay}
            yearOptions={licenseYearOptions}
          />
          {showErrors && <FieldError message={errors.licenseIssuedDate} />}
        </Section>

        {submitError && <p className={styles.submitError}>{submitError}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.backButton} onClick={onBack} disabled={submitting}>
            日付選択に戻る
          </button>
          <button type="submit" className={styles.submitButton} disabled={submitting}>
            {submitting ? "処理中..." : "予約して決済へ進む"}
          </button>
        </div>
      </div>
    </form>
  );
}
