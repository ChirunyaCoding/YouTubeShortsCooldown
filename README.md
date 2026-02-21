# YouTube Shorts Cooldown

YouTube Shorts をアクティブに5分視聴すると、30分間 Shorts をブロックする Chrome 拡張機能です。

## 動作仕様

- Shorts の視聴時間は、次の条件をすべて満たす場合のみ加算されます。
  - URL が `https://www.youtube.com/shorts/...` である
  - タブが表示状態である
- アクティブ視聴時間が5分に達すると、30分間 Shorts がブロックされます。
- 30分間まったく Shorts を視聴しなかった場合、5分カウント（進捗）はリセットされます。
- 拡張機能アイコンの `popup.html` で、クールダウン発動までの残り時間（5分まで）を表示します。
- ブロック中に Shorts の URL へ遷移しようとすると、YouTube ホームへリダイレクトされます。
- YouTube ホーム上部に、ブロック残り時間を示すバナーを表示します。

## インストール（デベロッパーモード）

1. `chrome://extensions/` を開く
2. **デベロッパー モード** を有効化する
3. **パッケージ化されていない拡張機能を読み込む** をクリックする
4. 次のフォルダを選択する
   - `i:\Programming\PF\2026\2\YouTubeShort WatchBlocker`

## ファイル構成

- `manifest.json`: 拡張機能の設定ファイル
- `background.js`: 視聴時間の管理とブロック状態の制御
- `content.js`: YouTube ページ監視、視聴ティック送信、リダイレクトとバナー表示
- `popup.html` / `popup.js` / `popup.css`: 拡張機能ポップアップの残り時間表示UI
