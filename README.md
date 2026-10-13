# Dependency Task

依存関係のあるタスクを表で入力し、依存グラフとして可視化するツール。設計は [DESIGN.md](DESIGN.md) を参照。

公開ページ: https://nonononoka.github.io/dependency_task/

## 環境構築

### 必要なもの

- Node.js 22.12 以上（推奨は `.nvmrc` に書いたバージョン = 24）
- npm（Node.js に同梱）

### 手順

```sh
# 1. リポジトリを取得
git clone git@github.com:nonononoka/dependency_task.git
cd dependency_task

# 2. Node.js のバージョンを合わせる（nvm を使う場合）
nvm install   # .nvmrc のバージョンを入れる
nvm use

# 3. 依存パッケージを入れる
npm ci

# 4. 開発サーバーを起動（表示された http://localhost:5173/ を開く）
npm run dev
```

nvm を使っていない場合は、`node -v` で 22.12 以上になっていることを確認してから 3 に進む。

### よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー（保存すると即反映） |
| `npm test` | ドメインロジックのテスト（Vitest） |
| `npm run typecheck` | 型チェック |
| `npm run build` | 型チェック + 本番ビルド（`dist/` に出力） |
| `npm run preview` | ビルド結果をローカルで確認 |

## 使い方

- 下の表でタスクを追加し、「依存先」欄で #番号かタイトルを入力して依存先を選ぶ
- グラフ上でノード右端の丸から別のノードへドラッグすると「ドラッグ先がドラッグ元に依存する」
- 線をクリックして Delete / Backspace で依存を削除
- 循環する依存は追加できない
- サイドパネルの「ラベル」でカテゴリを作り、表の「ラベル」列でタスクに付けると色分けされる。件数ボタンでそのラベルに絞り込み
- 表の「担当者」欄に名前を入れると担当者を付けられる（新しい名前はそのまま登録される）。サイドパネルの件数ボタンでその人のタスクに絞り込み
- 「一括追加」で `タイトル @担当者 <- 依存先, 依存先 [doing]` を 1 行 1 タスクで貼り付けられる
- 「タスク一覧」のバーで下の表を、サイドパネル右上の › で右のパネルを折りたたんでグラフを広げられる（状態は保存される）
- ヘッダーのプルダウンでプロジェクトを切り替え、「＋」で新規作成、「⋯」で名前変更・複製・削除。担当者とラベルは全プロジェクト共通
- データはブラウザ（localStorage）に自動保存。「書き出し」で全プロジェクトを 1 つの JSON ファイルに保存し、「読み込み」で復元できる（以前の 1 プロジェクト分のファイルは新しいプロジェクトとして追加される）

## デプロイ（GitHub Pages）

`main` に push すると、`.github/workflows/deploy.yml` がテスト・ビルド・公開を行う。

初回のみ、リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にしておく。
