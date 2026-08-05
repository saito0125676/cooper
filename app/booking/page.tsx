import Link from "next/link";
import styles from "./page.module.css";
import BookingWidget from "../components/BookingWidget";

export const metadata = {
  title: "予約｜MIYAKO MINI",
};

export default function BookingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link className={styles.brand} href="/">
          MIYAKO MINI
        </Link>
      </header>
      <main className={styles.main}>
        <BookingWidget />
      </main>
    </div>
  );
}
