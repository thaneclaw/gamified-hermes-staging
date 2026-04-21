export function DeploymentGuide() {
  return (
    <section
      className="p-5 mt-2"
      style={{ background: "#0d0d0d", border: "1px dashed #333" }}
    >
      <div
        className="text-lg mb-3"
        style={{ fontFamily: "Inter, sans-serif", letterSpacing: "0.04em", color: "#00e5ff" }}
      >
        FROM DEMO → REAL SETUP
      </div>
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed"
        style={{ fontFamily: "Inter, sans-serif", color: "#ccc" }}
      >
        <div>
          <div className="mb-1" style={{ color: "#ff2e6b" }}># 1. server</div>
          Spin up a Node + Socket.IO server. It holds shared state: buzzer, card
          counts, current effect. Emit events like <code>buzz</code>,{" "}
          <code>react</code>, <code>card:play</code> and broadcast.
        </div>
        <div>
          <div className="mb-1" style={{ color: "#ffab00" }}># 2. clients</div>
          Split this file into three pages:{" "}
          <code>/contestant?id=alex</code>, <code>/host</code>,{" "}
          <code>/overlay</code>. Each subscribes to relevant events. Contestant
          pages get loaded on phones; host page on your mod monitor.
        </div>
        <div>
          <div className="mb-1" style={{ color: "#c6ff00" }}># 3. OBS</div>
          Add a <code>Browser Source</code> pointing at your{" "}
          <code>/overlay</code> URL, 1920×1080, transparent background. Layer it
          on top of the VDO Ninja video tiles. Effects draw over everything.
        </div>
      </div>
    </section>
  );
}
