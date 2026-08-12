"use client";

import Image from "next/image";
import styles from "./CarSelect.module.css";
import { CARS, type CarOption } from "@/lib/cars";

interface CarSelectProps {
  selectedId: string | null;
  onSelect: (car: CarOption) => void;
}

export default function CarSelect({ selectedId, onSelect }: CarSelectProps) {
  return (
    <div className={styles.wrap}>
      <span className={styles.eyebrow}>RESERVATION · STEP 1</span>
      <h2 className={styles.title}>車種を選ぶ</h2>

      <ul className={styles.list}>
        {CARS.map((car) => (
          <li key={car.id} className={styles.card}>
            <div className={styles.imageBox}>
              <Image
                src={car.image}
                alt={car.imageAlt}
                fill
                sizes="(min-width: 760px) 380px, 100vw"
                className={styles.image}
              />
            </div>
            <p className={styles.disclaimer}>
              ※実際の貸し出し車両は写真と異なる場合がございます。
            </p>

            <span className={styles.carEn}>{car.en}</span>
            <h3 className={styles.carName}>{car.name}</h3>
            <p className={styles.carDesc}>{car.desc}</p>

            <ul className={styles.spec}>
              <li>
                <span>乗車定員</span>
                <span className={styles.v}>{car.capacity}</span>
              </li>
              <li>
                <span>ミッション</span>
                <span className={styles.v}>{car.transmission}</span>
              </li>
              <li>
                <span>荷室</span>
                <span className={styles.v}>{car.luggage}</span>
              </li>
              <li>
                <span>{car.extraLabel}</span>
                <span className={styles.v}>{car.extraValue}</span>
              </li>
            </ul>

            <button
              type="button"
              className={styles.selectButton}
              onClick={() => onSelect(car)}
            >
              {selectedId === car.id ? "この車を選択中" : "この車を選ぶ"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
