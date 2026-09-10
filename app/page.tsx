export default function Home() {
  return (
    <main className="game-shell">
      <iframe
        className="game-frame"
        src="/game/index.html"
        title="宝马之路横屏格斗游戏"
        allow="autoplay; fullscreen"
      />
    </main>
  );
}
