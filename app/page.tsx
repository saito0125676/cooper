import Link from "next/link";
import styles from "./home.module.css";
import GarageCooperMark from "./components/GarageCooperMark";

export const metadata = {
  title: "MIYAKO MINI｜宮古島でミニを借りる",
  description:
    "宮古島でクラシックミニを1日から。伊良部大橋も東平安名崎も、屋根の低い小さな車で走ると景色が変わります。",
};

// 背景スライドショーの写真。並び順が表示順(sakuraが最初=スポットライト演出で最初に照らされる1枚)。
const HERO_PHOTOS = [
  { src: "/hero-sakura.jpg", position: "50% 42%" },
  { src: "/hero-car.jpg", position: "56% 50%" },
  { src: "/IMG_0638.JPG", position: "55% 55%" },
  { src: "/IMG_0642.JPG", position: "55% 58%" },
  { src: "/IMG_0644.JPG", position: "45% 55%" },
  { src: "/IMG_0645.JPG", position: "42% 52%" },
];

export default function Home() {
  return (
    <div className={styles.homePage}>
      <section className={styles.heroSplit}>
        <div className={styles.heroBgWrap} aria-hidden="true">
          <div className={styles.pageBgSlides}>
            {HERO_PHOTOS.map((photo) => (
              <div
                key={photo.src}
                className={styles.pageBgSlide}
                style={{
                  backgroundImage: `url(${photo.src})`,
                  backgroundPosition: photo.position,
                }}
              />
            ))}
          </div>
        </div>
        <div className={styles.heroScrim} aria-hidden="true" />
      </section>

      <GarageCooperMark className={styles.fixedWordmark} />
      <Link href="/booking" className={`${styles.btn} ${styles.fixedFind}`}>
        空車を探す
      </Link>

      {/* 車種 */}
      <section className={styles.band} id="cars">
        <span className={styles.secTag}>CARS</span>
        <div className={styles.bandInner}>
          <div className={styles.secHead}>
            <span className={styles.plate}>01</span>
            <h2 className={styles.secTitle}>貸し出しているのは2台だけです</h2>
            <span className={styles.secNote}>どちらもマニュアル</span>
          </div>
          <div className={styles.cars}>
            <article className={styles.car}>
              <span className={styles.carEn}>CLASSIC MINI COOPER</span>
              <h3 className={styles.carName}>クラシックミニ／ブルー</h3>
              <p className={styles.carDesc}>
                1990年代の個体を整備して使っています。エンジン音がよく聞こえるので、窓を開けて走ると音楽はいりません。屋根は白のツートン。
              </p>
              <ul className={styles.spec}>
                <li>
                  <span>乗車定員</span>
                  <span className={styles.v}>4名</span>
                </li>
                <li>
                  <span>ミッション</span>
                  <span className={styles.v}>5MT</span>
                </li>
                <li>
                  <span>荷室</span>
                  <span className={styles.v}>機内持込サイズ×2</span>
                </li>
                <li>
                  <span>カーナビ</span>
                  <span className={styles.v}>なし（スマホ台あり）</span>
                </li>
              </ul>
            </article>
            <article className={styles.car}>
              <span className={styles.carEn}>MINI CONVERTIBLE</span>
              <h3 className={styles.carName}>コンバーチブル／クリーム</h3>
              <p className={styles.carDesc}>
                屋根が開きます。日差しが強い日は正直きついので、開けるなら朝か夕方をおすすめします。帽子は飛びます。
              </p>
              <ul className={styles.spec}>
                <li>
                  <span>乗車定員</span>
                  <span className={styles.v}>4名</span>
                </li>
                <li>
                  <span>ミッション</span>
                  <span className={styles.v}>6MT</span>
                </li>
                <li>
                  <span>荷室</span>
                  <span className={styles.v}>機内持込サイズ×1</span>
                </li>
                <li>
                  <span>幌</span>
                  <span className={styles.v}>電動／走行中も開閉可</span>
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ルート */}
      <section className={styles.band} id="route">
        <span className={styles.secTag}>ROUTE</span>
        <div className={styles.bandInner}>
          <div className={styles.secHead}>
            <span className={styles.plate}>02</span>
            <h2 className={styles.secTitle}>半日で回るなら、この順で</h2>
            <span className={styles.secNote}>店から一周およそ70km</span>
          </div>
          <ol className={styles.book}>
            <li>
              <span className={styles.km}>
                0.0
                <small>スタート</small>
              </span>
              <div>
                <h3>店を出て、まず北へ</h3>
                <p>最初の10分は市街地です。道が狭いので、車幅の感覚をここでつかんでください。小さいので、慣れると楽になります。</p>
              </div>
            </li>
            <li>
              <span className={styles.km}>
                12.4
                <small>KM</small>
              </span>
              <div>
                <h3>伊良部大橋</h3>
                <p>全長3540メートル。橋の途中に停められる場所はないので、渡り切ってから振り返ってください。風が強い日はハンドルを取られます。</p>
              </div>
            </li>
            <li>
              <span className={styles.km}>
                28.0
                <small>KM</small>
              </span>
              <div>
                <h3>佐和田の浜</h3>
                <p>浅瀬に岩が点在する独特の景色です。干潮の時間を調べてから行くと、水が引いた砂の上を歩けます。</p>
              </div>
            </li>
            <li>
              <span className={styles.km}>
                54.6
                <small>KM</small>
              </span>
              <div>
                <h3>東平安名崎</h3>
                <p>島の東端。灯台まで登れます。ここまで来ると燃料計を見ておいてください。周辺にスタンドは多くありません。</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* 料金 */}
      <section className={styles.band} id="price">
        <span className={styles.secTag}>PRICE</span>
        <div className={styles.bandInner}>
          <div className={styles.secHead}>
            <span className={styles.plate}>03</span>
            <h2 className={styles.secTitle}>料金</h2>
            <span className={styles.secNote}>税込・保険込み</span>
          </div>
          <table className={styles.price}>
            <thead>
              <tr>
                <th>プラン</th>
                <th className={styles.r}>クラシック</th>
                <th className={styles.r}>コンバーチブル</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>6時間</td>
                <td className={styles.num}>9,800</td>
                <td className={styles.num}>12,800</td>
              </tr>
              <tr>
                <td>24時間</td>
                <td className={styles.num}>14,800</td>
                <td className={styles.num}>18,800</td>
              </tr>
              <tr>
                <td>2泊3日</td>
                <td className={styles.num}>38,000</td>
                <td className={styles.num}>48,000</td>
              </tr>
              <tr>
                <td>以降1日ごと</td>
                <td className={styles.num}>12,000</td>
                <td className={styles.num}>15,000</td>
              </tr>
            </tbody>
          </table>
          <p className={styles.priceNote}>
            ガソリンは満タン返しです。空港までの送迎は無料、返却時も空港までお送りします。追加ドライバーは1名まで無料、2名目から1,000円です。
          </p>
        </div>
      </section>

      {/* 借りる前に */}
      <section className={styles.band} id="notes">
        <span className={styles.secTag}>BEFORE YOU GO</span>
        <div className={styles.bandInner}>
          <div className={styles.secHead}>
            <span className={styles.plate}>04</span>
            <h2 className={styles.secTitle}>先に言っておきます</h2>
          </div>
          <div className={styles.notes}>
            <div className={styles.note}>
              <span className={styles.noteMark}>MT ONLY</span>
              <h3>2台ともマニュアルです</h3>
              <p>オートマ限定免許では運転できません。久しぶりの方は、店の駐車場で少し練習してから出発してください。付き合います。</p>
            </div>
            <div className={styles.note}>
              <span className={styles.noteMark}>AIR CON</span>
              <h3>エアコンは強くありません</h3>
              <p>古い車なので、真夏の渋滞では冷えが弱くなります。飲み物を積んでから出てください。</p>
            </div>
            <div className={styles.note}>
              <span className={styles.noteMark}>SAND &amp; SALT</span>
              <h3>砂と潮に弱い車です</h3>
              <p>砂浜への乗り入れはご遠慮ください。海で遊んだあとは、足を流してから乗ってもらえると助かります。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 電話予約 */}
      <section className={styles.band} id="book">
        <span className={styles.secTag}>RESERVATION</span>
        <div className={`${styles.bandInner} ${styles.ctaWrap}`}>
          <span className={`${styles.eyebrow} ${styles.eyebrowCta}`}>PHONE RESERVATION</span>
          <h2 className={styles.secTitle}>お電話でも承ります</h2>
          <a className={styles.ctaTel} href="tel:0980000000">
            0980-00-0000
          </a>
          <p className={styles.ctaHours}>
            9:00 – 19:00 ／ 年中無休
            <br />
            直前でも空いていれば貸し出します。まず聞いてください。
          </p>
        </div>
      </section>

      <footer className={styles.foot}>
        <span>MIYAKO MINI — 沖縄県宮古島市平良○○ 1-2-3</span>
        <span className={styles.latinTight}>SINCE 2026</span>
      </footer>
    </div>
  );
}
