export interface CarOption {
  id: string;
  en: string;
  name: string;
  desc: string;
  image: string;
  imageAlt: string;
  capacity: string;
  transmission: string;
  luggage: string;
  extraLabel: string;
  extraValue: string;
}

// 現状は貸し出し車両が2台のみの固定リスト。台数が増えたら配列に足すだけで
// 予約フローの車種選択ステップにそのまま反映される。
export const CARS: CarOption[] = [
  {
    id: "classic-blue",
    en: "CLASSIC MINI COOPER",
    name: "クラシックミニ／ブルー",
    desc: "1990年代の個体を整備して使っています。エンジン音がよく聞こえるので、窓を開けて走ると音楽はいりません。屋根は白のツートン。",
    image: "/hero-car.jpg",
    imageAlt: "クラシックミニ／ブルー",
    capacity: "4名",
    transmission: "5MT",
    luggage: "機内持込サイズ×2",
    extraLabel: "カーナビ",
    extraValue: "なし（スマホ台あり）",
  },
  {
    id: "convertible-cream",
    en: "MINI CONVERTIBLE",
    name: "コンバーチブル／クリーム",
    desc: "屋根が開きます。日差しが強い日は正直きついので、開けるなら朝か夕方をおすすめします。帽子は飛びます。",
    image: "/IMG_0638.JPG",
    imageAlt: "コンバーチブル／クリーム",
    capacity: "4名",
    transmission: "6MT",
    luggage: "機内持込サイズ×1",
    extraLabel: "幌",
    extraValue: "電動／走行中も開閉可",
  },
];
